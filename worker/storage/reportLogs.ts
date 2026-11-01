/**
 * سجل التنبيهات ونشاط التقارير ومحادثات التصحيح: حماية على الخادم لحساب ليس مدير نظام.
 * - القراءة: يستلم الحساب صفوف أقسامه فقط، وبشرط صلاحية «سجل التنبيهات».
 * - الإضافة: الاسم يُؤخذ من الحساب لا من الجهاز، والوقت لا يتجاوز وقت الخادم، والقسم لا بد أن يملك تعديله.
 * - المحادثة: الحساب يضيف ردًّا فقط، على طلب مفتوح ينتظره؛ الطلب والإغلاق وإعادة الفتح لمدير النظام.
 */
import { CHECK_SECTION_PERM, type CheckSection } from '../../src/lib/checkSections';
import type { Perms } from '../../src/lib/permCatalog';
import type { D1Database } from '../types';
import { readCollection, type CollectionOps } from './collections';

const ALERTS = 'sahara_report_alerts_v1';
const ACTIVITY = 'sahara_report_activity_v1';
const THREADS = 'sahara_report_threads_v1';
const MAX_TEXT = 1000;

export const isReportLogKey = (k: string) => k === ALERTS || k === ACTIVITY || k === THREADS;

type Row = Record<string, unknown>;
const parseRow = (s: string): Row | null => {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
};
const parseRows = (s: string): Row[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const sectionLevel = (perms: Perms, section: unknown) => perms[CHECK_SECTION_PERM[section as CheckSection]] || 0;
const seesSection = (perms: Perms, section: unknown) => !!perms.alerts && sectionLevel(perms, section) >= 1;

/** حصر السجلات الثلاثة في أقسام الحساب (تُعدَّل items في مكانها) */
export const scopeReportLogs = async (db: D1Database, items: Record<string, string>, perms: Perms) => {
  if (!(ALERTS in items || ACTIVITY in items || THREADS in items)) return;
  if (perms.alerts && Object.keys(CHECK_SECTION_PERM).every(s => seesSection(perms, s))) return;
  const alerts = parseRows(items[ALERTS] ?? (THREADS in items ? await readCollection(db, ALERTS) : '[]'));
  const ids = new Set(alerts.filter(a => seesSection(perms, a.section)).map(a => a.id));
  if (ALERTS in items) items[ALERTS] = JSON.stringify(alerts.filter(a => ids.has(a.id)));
  if (ACTIVITY in items) items[ACTIVITY] = JSON.stringify(parseRows(items[ACTIVITY]).filter(a => seesSection(perms, a.section)));
  if (THREADS in items) items[THREADS] = JSON.stringify(parseRows(items[THREADS]).filter(m => ids.has(m.alertId)));
};

/** هل يستطيع الحساب الرد على طلب التصحيح؟ يتطابق مع شرط الواجهة: مفتوح، وهو المطلوب منه أو يعدّل القسم */
const canReply = async (db: D1Database, row: Row, perms: Perms, username: string) => {
  if (row.kind !== 'reply' || typeof row.alertId !== 'string' || typeof row.text !== 'string' || !row.text.trim() || row.text.length > MAX_TEXT) return false;
  const { results: found } = await db.prepare('SELECT data FROM collection_items WHERE key = ? AND id = ?').bind(ALERTS, row.alertId).all<{ data: string }>();
  const alert = found[0] && parseRow(found[0].data);
  if (!alert || !seesSection(perms, alert.section)) return false;
  const { results } = await db.prepare("SELECT data FROM collection_items WHERE key = ? AND json_extract(data, '$.alertId') = ?").bind(THREADS, row.alertId).all<{ data: string }>();
  const last = results.map(r => parseRow(r.data)).filter((m): m is Row => !!m).sort((a, b) => Number(a.at) - Number(b.at)).pop();
  if (last?.kind !== 'request' && last?.kind !== 'reopen') return false;
  return sectionLevel(perms, alert.section) >= 2 || last.to === username;
};

/**
 * فحص عمليات حساب محدود الكتابة على السجلات الثلاثة (بعد limitedOpsAllowed).
 * يعيد العمليات بعد تثبيت هوية الكاتب على الصفوف الجديدة، أو null إن وُجد صف غير مسموح فيُرفض المفتاح كله.
 */
export const guardReportLogOps = async (db: D1Database, key: string, ops: CollectionOps, userId: string, perms: Perms, now: number): Promise<CollectionOps | null> => {
  const upsert = Array.isArray(ops.upsert) ? ops.upsert : [];
  if (!upsert.length) return ops;
  const existing = new Set<string>();
  for (let i = 0; i < upsert.length; i += 90) {
    const part = upsert.slice(i, i + 90).map(u => u.id);
    const { results } = await db.prepare(`SELECT id FROM collection_items WHERE key = ? AND id IN (${part.map(() => '?').join(',')})`).bind(key, ...part).all<{ id: string }>();
    for (const r of results) existing.add(r.id);
  }
  const { results } = await db.prepare('SELECT name, username FROM chat_users WHERE id = ?').bind(userId).all<{ name: string; username: string }>();
  const account = results[0];
  if (!account) return null;
  const out: NonNullable<CollectionOps['upsert']> = [];
  for (const u of upsert) {
    const row = parseRow(u.data);
    if (!row) return null;
    // صف موجود = تعليم تنبيه كمراجَع (تحقق منه limitedOpsAllowed): يكفي أن يكون قسمه ظاهرًا للحساب
    if (existing.has(u.id)) {
      if (!seesSection(perms, row.section)) return null;
      out.push(u);
      continue;
    }
    if (key === THREADS ? !(await canReply(db, row, perms, account.username)) : sectionLevel(perms, row.section) < 2) return null;
    out.push({ ...u, data: JSON.stringify({ ...row, by: account.name, byUser: account.username, at: Math.min(Number(row.at) || now, now) }) });
  }
  return { ...ops, upsert: out };
};
