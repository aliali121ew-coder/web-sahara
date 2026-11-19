/**
 * سطور تفويل العربات في R2 (ملف JSON لكل شهر: vehicles/refills/YYYY-MM.json) بدل D1 ومساحة المتصفح.
 * كانت مجموعة في collection_items: كل فتح للتطبيق يقرأ كل سطورها، وكل رفع كشف يجعل كل جهاز مفتوح يعيد تنزيلها كاملة،
 * فامتلأت مساحة المتصفح (≈5MB) وتوقف الرفع. الآن لا قراءة من D1 أبدًا، والتطبيق يحفظ الأشهر في IndexedDB
 * ولا ينزّل إلا الشهر الذي تغيّر (بصمة الملف ETag).
 */
import type { D1Database, Env, ExecutionContext, R2Bucket } from './types';
import type { Session } from './chat';
import { audit } from './chat';
import { levelOf } from '../src/lib/permCatalog';
import { REFILLS_PREFIX, VEHICLES_SIGNAL, byMonth, isMonth, mergeSheets, type SheetIn } from '../src/lib/vehicleRows';
import type { VehicleRefill } from '../src/lib/vehicleFuel';
import { readCollection } from './storage/collections';
import { bumpStateVersion } from './storage/stateVersion';

/** مفتاح المجموعة القديمة في D1 (يُنقل منها مرة واحدة ثم يُفرَّغ) */
export const LEGACY_REFILLS_KEY = 'sahara_vehicle_refills_v1';

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra } });

const objKey = (month: string) => `${REFILLS_PREFIX}${month}.json`;

/** قراءة شهر: السطور وبصمة الملف (null = لا يوجد بعد) */
const readMonth = async (bucket: R2Bucket, month: string): Promise<{ rows: VehicleRefill[]; etag: string | null }> => {
  const obj = await bucket.get(objKey(month));
  if (!obj) return { rows: [], etag: null };
  try {
    const rows = JSON.parse(await obj.text());
    return { rows: Array.isArray(rows) ? rows : [], etag: obj.etag ?? null };
  } catch {
    return { rows: [], etag: obj.etag ?? null };
  }
};

/**
 * كتابة شهر بشرط ألا يكون تغيّر منذ قراءته (رفعان متزامنان لا يمسح أحدهما الآخر).
 * شهر جديد يُكتب مباشرة. false = تغيّر الملف أثناء العمل فيُعاد من البداية.
 */
const writeMonth = async (bucket: R2Bucket, month: string, rows: VehicleRefill[], etag: string | null) => {
  const body = JSON.stringify(rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)));
  const opts = { httpMetadata: { contentType: 'application/json' }, ...(etag ? { onlyIf: { etagMatches: etag } } : {}) };
  if (!rows.length) {
    await bucket.delete(objKey(month));
    return true;
  }
  return (await bucket.put(objKey(month), body, opts)) !== null;
};

/** تعديل عدة أشهر معًا مع إعادة المحاولة إن تغيّر أحدها أثناء العمل */
const updateMonths = async <T>(
  bucket: R2Bucket,
  months: string[],
  change: (current: Map<string, VehicleRefill[]>) => { next: Map<string, VehicleRefill[]>; result: T },
): Promise<T> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const loaded = new Map<string, { rows: VehicleRefill[]; etag: string | null }>();
    for (const m of months) loaded.set(m, await readMonth(bucket, m));
    const { next, result } = change(new Map([...loaded].map(([m, v]) => [m, v.rows])));
    let ok = true;
    for (const [m, rows] of next) {
      if (!(await writeMonth(bucket, m, rows, loaded.get(m)?.etag ?? null))) { ok = false; break; }
    }
    if (ok) return result;
  }
  throw new Error('تعذّر الحفظ: الملف يتغيّر من جهاز آخر، أعد المحاولة');
};

const listMonths = async (bucket: R2Bucket) => {
  const out: { month: string; etag: string; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: REFILLS_PREFIX, cursor, limit: 1000 });
    for (const o of page.objects) {
      const m = o.key.slice(REFILLS_PREFIX.length).replace(/\.json$/, '');
      if (isMonth(m)) out.push({ month: m, etag: o.etag || String(o.uploaded?.getTime?.() ?? ''), size: o.size });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => a.month.localeCompare(b.month));
};

/** نقل السطور من D1 إلى R2 (لا يحذف من D1): يدمج حسب المعرّف، فإعادة تشغيله آمنة */
export const migrateLegacyRefills = async (db: D1Database, bucket: R2Bucket) => {
  const legacy = JSON.parse(await readCollection(db, LEGACY_REFILLS_KEY)) as VehicleRefill[];
  const groups = byMonth(legacy);
  let written = 0;
  for (const [month, rows] of groups) {
    written += await updateMonths(bucket, [month], cur => {
      const have = new Map((cur.get(month) || []).map(r => [r.id, r]));
      let added = 0;
      for (const r of rows) if (!have.has(r.id)) { have.set(r.id, r); added++; }
      return { next: new Map([[month, [...have.values()]]]), result: added };
    });
  }
  return { legacyRows: legacy.length, months: groups.size, added: written };
};

/** علامة اكتمال النقل من D1 (ملف صغير في R2): بعدها لا تُقرأ المجموعة القديمة أبدًا */
const MIGRATED_MARKER = `${REFILLS_PREFIX}_migrated`;
let migrated = false;
/**
 * أول طلب بعد النشر ينقل السطور القديمة من D1 إلى R2 مرة واحدة (قبل أي رفع، حتى يرى التحقق من التكرار الكشوف القديمة).
 * النقل يدمج حسب المعرّف، فطلبان متزامنان آمنان. لا يحذف من D1.
 */
const ensureMigrated = async (env: Env) => {
  if (migrated) return;
  if (await env.FILES.head(MIGRATED_MARKER)) { migrated = true; return; }
  const r = await migrateLegacyRefills(env.DB, env.FILES);
  await env.FILES.put(MIGRATED_MARKER, JSON.stringify({ at: Date.now(), ...r }), { httpMetadata: { contentType: 'application/json' } });
  migrated = true;
};

export async function handleVehicles(
  request: Request, url: URL, env: Env, ctx: ExecutionContext, session: Session, disabled: Set<string>,
  broadcast: (msg: string) => void,
): Promise<Response> {
  const path = url.pathname.slice('/api/vehicles'.length);
  const method = request.method;
  const bucket = env.FILES;
  const lv = (s: string) => (disabled.has(s) ? 0 : levelOf(session.perms, session.admin, s));
  const canRead = lv('vehicles-report') >= 1 || lv('vehicles-tanks') >= 1;
  const canWrite = lv('vehicles-report') >= 2;
  if (!canRead) return json({ error: 'لا تملك صلاحية لهذا القسم', code: 'forbidden' }, 403);
  await ensureMigrated(env);

  // قائمة الأشهر وبصماتها: الجهاز ينزّل ما تغيّرت بصمته فقط
  if (path === '/months' && method === 'GET') return json({ months: await listMonths(bucket) });

  const one = path.match(/^\/refills\/(\d{4}-\d{2})$/);
  if (one && method === 'GET') {
    const obj = await bucket.get(objKey(one[1]));
    if (!obj) return json([], 200, { etag: '"empty"' });
    const etag = obj.httpEtag || `"${obj.etag}"`;
    if ((request.headers.get('if-none-match') || '').replace(/^W\//, '') === etag) return new Response(null, { status: 304, headers: { etag } });
    return new Response(obj.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', etag } });
  }

  const notify = () => broadcast(`${VEHICLES_SIGNAL}${Date.now()}|vehicles:refills`);

  // رفع كشوف: التحقق من التكرار ودمج السطور على الخادم
  if (path === '/upload' && method === 'POST') {
    if (!canWrite) return json({ error: 'لا تملك صلاحية تعديل تقرير العربات', code: 'forbidden' }, 403);
    const b = await request.json().catch(() => null) as { sheets?: SheetIn[] } | null;
    const sheets = (b?.sheets || []).filter(s => s && typeof s.fileId === 'string' && Array.isArray(s.rows)).slice(0, 50);
    if (!sheets.length) return json({ error: 'لا توجد سطور', code: 'invalid_data' }, 400);
    const months = [...new Set(sheets.flatMap(s => s.rows.map(r => r.date.slice(0, 7).replace('/', '-'))).filter(isMonth))];
    try {
      const results = await updateMonths(bucket, months, cur => {
        const existing = [...cur.values()].flat();
        const { added, results } = mergeSheets(existing, sheets);
        const next = new Map<string, VehicleRefill[]>();
        for (const [m, rows] of byMonth(added)) next.set(m, [...(cur.get(m) || []), ...rows]);
        return { next, result: results };
      });
      const added = results.reduce((s, r) => s + r.kept, 0);
      if (added) {
        notify();
        ctx.waitUntil(audit(env.DB, request, session.id, 'data.save', `تقرير العربات · ${added} سطر`, { merge: true }).catch(() => undefined));
      }
      return json({ results });
    } catch (e) {
      return json({ error: (e as Error).message, code: 'conflict' }, 409);
    }
  }

  // حذف كشف: سطوره من الأشهر المذكورة (أو كل الأشهر)
  const del = path.match(/^\/files\/([^/]+)$/);
  if (del && method === 'DELETE') {
    if (!canWrite) return json({ error: 'لا تملك صلاحية تعديل تقرير العربات', code: 'forbidden' }, 403);
    const fileId = decodeURIComponent(del[1]);
    const asked = (url.searchParams.get('months') || '').split(',').filter(isMonth);
    const months = asked.length ? asked : (await listMonths(bucket)).map(m => m.month);
    const removed = await updateMonths(bucket, months, cur => {
      const next = new Map<string, VehicleRefill[]>();
      let n = 0;
      for (const [m, rows] of cur) {
        const kept = rows.filter(r => r.fileId !== fileId);
        if (kept.length !== rows.length) { next.set(m, kept); n += rows.length - kept.length; }
      }
      return { next, result: n };
    });
    if (removed) notify();
    return json({ ok: true, removed });
  }

  // نقل السطور القديمة من D1 (مدير النظام): نسخ أولًا، ثم تفريغ D1 بعد التأكد أن كل سطر وصل
  if (path === '/migrate' && method === 'POST') {
    if (!session.admin) return json({ error: 'لمدير النظام فقط', code: 'forbidden' }, 403);
    const r = await migrateLegacyRefills(env.DB, bucket);
    await audit(env.DB, request, session.id, 'system.vehicles_migrate', `نقل ${r.legacyRows} سطر إلى ${r.months} شهر`);
    notify();
    return json(r);
  }
  if (path === '/migrate/clear' && method === 'POST') {
    if (!session.admin) return json({ error: 'لمدير النظام فقط', code: 'forbidden' }, 403);
    const legacy = JSON.parse(await readCollection(env.DB, LEGACY_REFILLS_KEY)) as VehicleRefill[];
    const inR2 = new Set<string>();
    for (const m of byMonth(legacy).keys()) for (const r of (await readMonth(bucket, m)).rows) inR2.add(r.id);
    const missing = legacy.filter(r => !inR2.has(r.id)).length;
    if (missing) return json({ error: `${missing} سطر لم يُنقل بعد إلى R2، لم يُحذف شيء`, code: 'conflict', missing }, 409);
    const { meta } = await env.DB.prepare('DELETE FROM collection_items WHERE key = ?').bind(LEGACY_REFILLS_KEY).run();
    await bumpStateVersion(env.DB, 'vehicles-migrated');
    await audit(env.DB, request, session.id, 'system.vehicles_migrate', `تفريغ ${legacy.length} سطر من D1 بعد نقلها إلى R2`);
    return json({ ok: true, deleted: Number(meta?.changes ?? 0) });
  }

  return json({ error: 'غير موجود', code: 'not_found' }, 404);
}

// ───── سجل العمليات: ما تغيّر في خزانات كل عربة ─────
/** مفتاح ملفات العربات (السعات) في حالة البيانات */
export const VEHICLE_PROFILES_KEY = 'sahara_vehicle_profiles_v1';
const TANK_FIELDS: [string, string][] = [
  ['tankLiters', 'الرئيسي'], ['tank2Liters', 'احتياط 1'], ['tank3Liters', 'احتياط 2'], ['tank4Liters', 'احتياط 3'], ['reeferTankLiters', 'البراد'],
];
type Prof = Record<string, unknown> & { id?: string; name?: string; tanksCleared?: boolean };
const capOf = (p: Prof | null, f: string) => (typeof p?.[f] === 'number' && (p[f] as number) > 0 ? (p[f] as number) : null);

/**
 * وصف تعديلات خزانات العربات في دفعة حفظ (قبل تطبيقها): «العربة 609: الرئيسي 700 ← 750 · البراد — ← 200»،
 * أو «إضافة عربة …» أو «إلغاء تحديث …». تغييرات لا تمس السعات (الاسم، الصورة) لا تُذكر.
 */
export const describeProfileChanges = async (db: D1Database, upsert: { id: string; data: string }[]): Promise<string[]> => {
  if (!upsert.length) return [];
  const ids = upsert.slice(0, 50).map(u => u.id);
  const { results } = await db.prepare(`SELECT id, data FROM collection_items WHERE key = ? AND id IN (${ids.map(() => '?').join(',')})`)
    .bind(VEHICLE_PROFILES_KEY, ...ids).all<{ id: string; data: string }>();
  const before = new Map(results.map(r => { try { return [r.id, JSON.parse(r.data) as Prof]; } catch { return [r.id, null]; } }));
  const out: string[] = [];
  for (const u of upsert.slice(0, 50)) {
    let next: Prof;
    try { next = JSON.parse(u.data) as Prof; } catch { continue; }
    const old = before.get(u.id) ?? null;
    const code = String(next.name || next.id || u.id).toUpperCase();
    const diffs = TANK_FIELDS
      .map(([f, label]) => [label, capOf(old, f), capOf(next, f)] as const)
      .filter(([, a, b]) => a !== b)
      .map(([label, a, b]) => `${label} ${a ?? '—'} ← ${b ?? '—'}`);
    if (next.tanksCleared && !old?.tanksCleared) out.push(`إلغاء تحديث العربة ${code}${diffs.length ? `: ${diffs.join(' · ')}` : ''}`);
    else if (diffs.length) out.push(`${old ? 'العربة' : 'إضافة عربة'} ${code}: ${diffs.join(' · ')}`);
  }
  return out;
};
