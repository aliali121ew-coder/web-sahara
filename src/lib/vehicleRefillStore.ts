import { useEffect, useSyncExternalStore } from 'react';
import { sessionHeaders } from './session';
import { VEHICLES_CHANGED_EVENT } from './cloudSync';
import { monthOf, type SheetIn, type SheetOut } from './vehicleRows';
import type { VehicleRefill } from './vehicleFuel';

/**
 * سطور تفويل العربات: ملفات شهرية في R2 عبر /api/vehicles، مع نسخة على الجهاز في IndexedDB
 * (مساحتها كبيرة، بخلاف localStorage ≈5MB الذي امتلأ). عند الفتح تُعرض النسخة المحلية فورًا،
 * ثم يُنزَّل فقط الشهر الذي تغيّرت بصمته. لا شيء من هذا يقرأ من D1.
 */

const DB_NAME = 'sahara-vehicles';
const STORE = 'months';
interface MonthEntry { month: string; etag: string; rows: VehicleRefill[] }

const openDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'month' }); };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
let dbPromise: Promise<IDBDatabase> | null = null;
const db = () => (dbPromise ??= openDb().catch(e => { dbPromise = null; throw e; }));

const tx = async <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
};
const idbAll = () => tx<MonthEntry[]>('readonly', s => s.getAll() as IDBRequest<MonthEntry[]>).then(r => r || []).catch(() => [] as MonthEntry[]);
const idbPut = (e: MonthEntry) => tx('readwrite', s => { s.put(e); }).catch(() => undefined);
const idbDel = (month: string) => tx('readwrite', s => { s.delete(month); }).catch(() => undefined);
/** مسح النسخة المحلية (تغيّر الحساب أو لا صلاحية) */
export const clearVehicleCache = () => tx('readwrite', s => { s.clear(); }).catch(() => undefined);

// ───── الحالة في الذاكرة ─────
const months = new Map<string, MonthEntry>();
let rows: VehicleRefill[] = [];
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
let status: LoadStatus = 'idle';
let snapshot: { rows: VehicleRefill[]; status: LoadStatus } = { rows, status };
const listeners = new Set<() => void>();
const emit = () => {
  rows = [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).flatMap(m => m.rows);
  snapshot = { rows, status };
  listeners.forEach(l => l());
};
const setStatus = (s: typeof status) => { status = s; snapshot = { rows, status }; listeners.forEach(l => l()); };

const api = (path: string, init: RequestInit = {}) =>
  fetch(`/api/vehicles${path}`, { ...init, cache: 'no-store', headers: { 'content-type': 'application/json', ...sessionHeaders(), ...(init.headers || {}) } });

let loadedLocal = false;
let syncing: Promise<void> | null = null;
let again = false;

/** مزامنة الأشهر: يُنزَّل الشهر الذي تغيّرت بصمته فقط، ويُحذف ما لم يعد موجودًا */
const sync = async () => {
  if (!loadedLocal) {
    for (const e of await idbAll()) months.set(e.month, e);
    loadedLocal = true;
    if (months.size) emit();
  }
  if (!months.size) setStatus('loading');
  const res = await api('/months');
  if (res.status === 403) { months.clear(); await clearVehicleCache(); emit(); setStatus('ready'); return; }
  if (!res.ok) throw new Error(String(res.status));
  const list = ((await res.json()) as { months: { month: string; etag: string }[] }).months;
  const live = new Set(list.map(m => m.month));
  let changed = false;
  for (const m of [...months.keys()]) if (!live.has(m)) { months.delete(m); await idbDel(m); changed = true; }
  for (const { month, etag } of list) {
    if (months.get(month)?.etag === etag) continue;
    const r = await api(`/refills/${month}`);
    if (!r.ok) throw new Error(String(r.status));
    const entry: MonthEntry = { month, etag, rows: (await r.json()) as VehicleRefill[] };
    months.set(month, entry);
    await idbPut(entry);
    changed = true;
  }
  if (changed) emit();
  setStatus('ready');
};

/** طلب مزامنة: الطلبات المتزامنة تُدمج في واحدة، وطلب أثناء مزامنة جارية يُعاد بعدها */
export const refreshVehicleRefills = (): Promise<void> => {
  if (syncing) { again = true; return syncing; }
  syncing = sync()
    .catch(() => setStatus(months.size ? 'ready' : 'error'))
    .finally(() => {
      syncing = null;
      if (again) { again = false; void refreshVehicleRefills(); }
    });
  return syncing;
};

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const getSnapshot = () => snapshot;

/** سطور التفويل كلها (من كل الأشهر) وحالة التحميل؛ يتحدّث عند رفع كشف من أي جهاز */
export const useVehicleRefills = () => {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    void refreshVehicleRefills();
    const on = () => void refreshVehicleRefills();
    window.addEventListener(VEHICLES_CHANGED_EVENT, on);
    return () => window.removeEventListener(VEHICLES_CHANGED_EVENT, on);
  }, []);
  return snap;
};

/** رفع كشوف: الخادم يتحقق من التكرار ويدمج، ثم تُحدَّث الأشهر المتأثرة */
export const uploadVehicleSheets = async (sheets: SheetIn[]): Promise<SheetOut[]> => {
  const res = await api('/upload', { method: 'POST', body: JSON.stringify({ sheets }) });
  const data = (await res.json().catch(() => ({}))) as { results?: SheetOut[]; error?: string };
  if (!res.ok || !data.results) throw new Error(data.error || 'تعذّر رفع الكشف، حاول مرة أخرى');
  await refreshVehicleRefills();
  return data.results;
};

/** حذف كشف: سطوره من أشهره فقط */
export const removeVehicleFileRows = async (fileId: string) => {
  const ms = [...new Set(rows.filter(r => r.fileId === fileId).map(r => monthOf(r.date)))];
  const res = await api(`/files/${encodeURIComponent(fileId)}${ms.length ? `?months=${ms.join(',')}` : ''}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('تعذّر حذف الكشف');
  await refreshVehicleRefills();
};

/** أحدث نسخة من السطور (للرفع المتتابع من نفس النداء) */
export const currentVehicleRefills = () => rows;
