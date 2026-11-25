/**
 * سطور تفويل العربات: منطق مشترك بين التطبيق والخادم (بلا PDF ولا متصفح).
 * السطور محفوظة في R2 ملفًا لكل شهر (vehicles/refills/YYYY-MM.json)، لا في D1 ولا في مساحة المتصفح المحدودة.
 */
import type { VehicleRefill } from './vehicleFuel';

export type RefillRow = Pick<VehicleRefill, 'site' | 'vehicle' | 'date' | 'qty'>;

/** مجلد ملفات الأشهر في R2 */
export const REFILLS_PREFIX = 'vehicles/refills/';
/** إشعار القناة اللحظية بعد رفع أو حذف كشف (لا يحرّك رقم نسخة حالة البيانات) */
export const VEHICLES_SIGNAL = 'veh:';

/** الشهر من تاريخ الكشف YYYY/MM/DD → YYYY-MM */
export const monthOf = (date: string) => date.slice(0, 7).replace('/', '-');
export const isMonth = (m: string) => /^\d{4}-\d{2}$/.test(m);

/** نفس توحيد الكتابة العربية في قراءة الكشوف (أسماء المواقع) */
const normalizeSite = (s: string) =>
  s.normalize('NFKC').replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, '');

/**
 * سطور كشف جديد مسجلة مسبقًا من كشف آخر (نفس الموقع والعربة والتاريخ والكمية): تُتخطى حتى لا تتكرر التفويلة.
 * العدّ بالتكرار: تفويلتان متطابقتان في الكشف الجديد وواحدة مخزنة = تُتخطى واحدة وتبقى الأخرى.
 */
export const dropStoredRows = <R extends RefillRow>(rows: R[], stored: RefillRow[]) => {
  const key = (r: RefillRow) => `${normalizeSite(r.site)}|${r.vehicle.toUpperCase()}|${r.date}|${r.qty}`;
  const left = new Map<string, number>();
  for (const r of stored) left.set(key(r), (left.get(key(r)) || 0) + 1);
  const kept: R[] = [];
  let skipped = 0;
  for (const r of rows) {
    const n = left.get(key(r)) || 0;
    if (n > 0) { left.set(key(r), n - 1); skipped++; } else kept.push(r);
  }
  return { kept, skipped };
};

export interface SheetIn { fileId: string; legacyId: string; rows: VehicleRefill[] }
export type SheetStatus = 'ok' | 'dup' | 'allDup';
export interface SheetOut { fileId: string; status: SheetStatus; kept: number; dupRows: number }

/**
 * دمج كشوف جديدة مع السطور المحفوظة. الكشف مكرر إذا وُجد بنفس معرّفه (الموقع والتاريخ وعدد العربات، أو رقم المستند)،
 * أو بالمعرّف القديم (الموقع والتاريخ) وبنفس عدد السطور. ثم تُتخطى السطور المسجلة مسبقًا من كشوف أخرى.
 * الكشوف الأكبر أولًا: نسخة جزئية من كشف داخل نفس الملف المدموج تُتخطى ويبقى الكامل.
 */
export const mergeSheets = (existing: VehicleRefill[], sheets: SheetIn[]) => {
  const counts = new Map<string, number>();
  for (const r of existing) counts.set(r.fileId, (counts.get(r.fileId) || 0) + 1);
  const have = new Set(counts.keys());
  let stored: RefillRow[] = existing;
  const added: VehicleRefill[] = [];
  const results: SheetOut[] = [];
  for (const s of [...sheets].sort((a, b) => b.rows.length - a.rows.length)) {
    const dup = have.has(s.fileId) || (s.legacyId !== s.fileId && counts.get(s.legacyId) === s.rows.length);
    if (dup) { results.push({ fileId: s.fileId, status: 'dup', kept: 0, dupRows: 0 }); continue; }
    have.add(s.fileId);
    const { kept, skipped } = dropStoredRows(s.rows, stored);
    stored = [...stored, ...kept];
    added.push(...kept);
    results.push({ fileId: s.fileId, status: kept.length ? 'ok' : 'allDup', kept: kept.length, dupRows: skipped });
  }
  return { added, results };
};

/** تجميع السطور حسب الشهر */
export const byMonth = <R extends { date: string }>(rows: R[]) => {
  const out = new Map<string, R[]>();
  for (const r of rows) {
    const m = monthOf(r.date);
    if (!isMonth(m)) continue;
    const l = out.get(m);
    if (l) l.push(r); else out.set(m, [r]);
  }
  return out;
};
