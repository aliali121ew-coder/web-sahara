import { useCallback, useEffect, useMemo, useState } from 'react';
import { CLOUD_APPLIED_EVENT } from './cloudSync';
import type { TankUnitRow } from '../components/tanks/TanksOverview';
import { getBusinessDate } from './utils';

/**
 * المخزن المركزي للخزانات (صفحة منظومة الخزانات هي المرجع).
 * أي صفحة أخرى (مثل خزانات الاتحاد) تقرأ وتكتب هنا، فينعكس التعديل فورًا في كل الصفحات.
 */
export const CENTRAL_TANKS_KEY = 'sahara_tank_units_scifi_ruler_v12';
const SYNC_EVENT = 'central-tanks-updated';

export const readCentralTanks = (fallback: TankUnitRow[]): TankUnitRow[] => {
  try {
    const saved = localStorage.getItem(CENTRAL_TANKS_KEY);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const writeCentralTanks = (units: TankUnitRow[]) => {
  localStorage.setItem(CENTRAL_TANKS_KEY, JSON.stringify(units));
  recordDailySnapshot(units);
  window.dispatchEvent(new Event(SYNC_EVENT));
};

type Updater = TankUnitRow[] | ((prev: TankUnitRow[]) => TankUnitRow[]);

/** قراءة/كتابة الخزانات المركزية مع مزامنة حية بين الصفحات والنوافذ */
export const useCentralTanks = (fallback: TankUnitRow[], opts: { includeHidden?: boolean } = {}) => {
  const [allUnits, setUnits] = useState<TankUnitRow[]>(() => readCentralTanks(fallback));
  // الخزانات المخفية لا تظهر في صفحات العرض ولا تُحتسب في الأرصدة (إلا في منظومة الخزانات نفسها)
  const units = useMemo(() => (opts.includeHidden ? allUnits : allUnits.filter(t => !t.hidden)), [allUnits, opts.includeHidden]);

  useEffect(() => {
    // تسجيل كميات اليوم عند الفتح حتى لو لم يُعدَّل أي خزان
    recordDailySnapshot(readCentralTanks(fallback));
    const refresh = () => setUnits(readCentralTanks(fallback));
    const onStorage = (e: StorageEvent) => { if (e.key === CENTRAL_TANKS_KEY) refresh(); };
    // تعديلات من جهاز آخر وصلت أثناء فتح الصفحة
    const onCloud = (e: Event) => { if ((e as CustomEvent<string[]>).detail?.includes(CENTRAL_TANKS_KEY)) refresh(); };
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener(CLOUD_APPLIED_EVENT, onCloud);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CLOUD_APPLIED_EVENT, onCloud);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((next: Updater) => {
    const resolved = typeof next === 'function' ? next(readCentralTanks(fallback)) : next;
    writeCentralTanks(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [units, update] as const;
};

/**
 * قسم الكاز في منظومة الخزانات: يُكتشف مرة واحدة من اسمه ثم يُحفظ بمعرّفه الثابت،
 * فلا ينقطع الربط عند تغيير اسم القسم أو أسماء الخزانات لاحقًا.
 */
const GASOIL_SECTION_KEY_STORAGE = 'etihad_gasoil_section_key';

export const resolveGasoilSectionKey = (tanks: TankUnitRow[]): string | null => {
  const saved = localStorage.getItem(GASOIL_SECTION_KEY_STORAGE);
  if (saved && tanks.some(t => t.sectionKey === saved)) return saved;

  const name = (t: TankUnitRow) => (t.sectionName || '').trim();
  const found =
    tanks.find(t => name(t).includes('كاز') && name(t).includes('الاتحاد')) ||
    tanks.find(t => name(t) === 'خزانات كاز');
  if (found) localStorage.setItem(GASOIL_SECTION_KEY_STORAGE, found.sectionKey);
  return found ? found.sectionKey : null;
};

/**
 * خزان "موقع الاستخلاص" في قسم كاز الاتحاد: يُكتشف من اسمه مرة ثم يُحفظ بمعرّفه الثابت.
 * سعته هي سعة المخزون في الرئيسية، ويُملأ تلقائيًا من الرصيد الحالي لرصيد شركة الاتحاد.
 */
const ETIHAD_EXTRACTION_TANK_STORAGE = 'etihad_extraction_tank_id';

export const resolveEtihadExtractionTank = (tanks: TankUnitRow[]): TankUnitRow | null => {
  const saved = localStorage.getItem(ETIHAD_EXTRACTION_TANK_STORAGE);
  const bySaved = saved ? tanks.find(t => t.id === saved) : undefined;
  if (bySaved) return bySaved;

  const key = resolveGasoilSectionKey(tanks);
  const found = tanks.find(t => t.sectionKey === key && (t.name || '').includes('الاستخلاص'));
  if (found) localStorage.setItem(ETIHAD_EXTRACTION_TANK_STORAGE, found.id);
  return found ?? null;
};

/** ضبط مستوى خزان الاستخلاص ليطابق رصيد شركة الاتحاد (لا يُكتب شيء إن لم يتغير) */
export const syncEtihadExtractionTank = (balanceLiters: number) => {
  const tanks = readCentralTanks([]);
  const tank = resolveEtihadExtractionTank(tanks);
  if (!tank || !tank.capacityLiters) return;
  const max = tank.maxLevelMeters || 1;
  const level = Math.min(max, Math.max(0, (balanceLiters / tank.capacityLiters) * max));
  if (Math.abs(level - tank.levelMeters) < 1e-9) return;
  writeCentralTanks(tanks.map(t => (t.id === tank.id ? { ...t, levelMeters: level } : t)));
};

/** رصيد شركة الاتحاد الحالي = الرصيد الحالي لآخر يوم مسجّل في صفحة رصيد الشركة */
export const readEtihadLatestBalance = (): number | null => {
  try {
    const records: { date: string; currentBalance: number }[] = JSON.parse(localStorage.getItem('sahara_etihad_balance_records_v2') || '[]');
    if (!Array.isArray(records) || !records.length) return null;
    return [...records].sort((a, b) => b.date.localeCompare(a.date))[0].currentBalance ?? null;
  } catch {
    return null;
  }
};

/** قسم "بنزين - صحاري كربلاء": يُكتشف من اسمه مرة ثم يُحفظ بمعرّفه الثابت */
const SAHARA_PETROL_SECTION_KEY_STORAGE = 'sahara_petrol_section_key';

export const resolveSaharaPetrolSectionKey = (tanks: TankUnitRow[]): string | null => {
  const saved = localStorage.getItem(SAHARA_PETROL_SECTION_KEY_STORAGE);
  if (saved && tanks.some(t => t.sectionKey === saved)) return saved;

  const name = (t: TankUnitRow) => (t.sectionName || '').trim();
  const found = tanks.find(t => /بنزين|بانزين/.test(name(t)) && name(t).includes('صحاري'));
  if (found) localStorage.setItem(SAHARA_PETROL_SECTION_KEY_STORAGE, found.sectionKey);
  return found ? found.sectionKey : null;
};

/** قسم "خزانات الكاز - شركة صحاري كربلاء": يُكتشف من اسمه مرة ثم يُحفظ بمعرّفه الثابت */
const SAHARA_GASOIL_SECTION_KEY_STORAGE = 'sahara_gasoil_section_key';

export const resolveSaharaGasoilSectionKey = (tanks: TankUnitRow[]): string | null => {
  const saved = localStorage.getItem(SAHARA_GASOIL_SECTION_KEY_STORAGE);
  if (saved && tanks.some(t => t.sectionKey === saved)) return saved;

  const name = (t: TankUnitRow) => (t.sectionName || '').trim();
  const found = tanks.find(t => name(t).includes('كاز') && name(t).includes('صحاري'));
  if (found) localStorage.setItem(SAHARA_GASOIL_SECTION_KEY_STORAGE, found.sectionKey);
  return found ? found.sectionKey : null;
};

// ── السجل اليومي لكميات الخزانات (لحساب "الكمية السابقة" في الكشوفات) ──
const SNAPSHOTS_KEY = 'central_tank_daily_snapshots_v1';
type Snapshots = Record<string, Record<string, number>>; // { 'YYYY/MM/DD': { tankId: liters } }

export const tankLiters = (t: TankUnitRow) =>
  Math.round((t.levelMeters / (t.maxLevelMeters || 1)) * t.capacityLiters);

const readSnapshots = (): Snapshots => {
  try {
    return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '{}');
  } catch {
    return {};
  }
};

/** حفظ كمية كل خزان ليوم العمل الحالي (يُستبدل خلال نفس اليوم بآخر قيمة) */
export const recordDailySnapshot = (units: TankUnitRow[]) => {
  const all = readSnapshots();
  all[getBusinessDate()] = Object.fromEntries(units.map(t => [t.id, tankLiters(t)]));
  // الاحتفاظ بآخر 400 يوم فقط
  const days = Object.keys(all).sort();
  days.slice(0, Math.max(0, days.length - 400)).forEach(d => delete all[d]);
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(all));
};

/** الكمية السابقة = كمية الخزان في آخر يوم عمل قبل اليوم (أو null إن لم يوجد سجل) */
export const getPreviousLiters = (tankId: string, asOfDate?: string): { liters: number; date: string } | null => {
  const all = readSnapshots();
  const today = asOfDate ?? getBusinessDate();
  const prevDay = Object.keys(all).filter(d => d < today && all[d][tankId] !== undefined).sort().pop();
  return prevDay ? { liters: all[prevDay][tankId], date: prevDay } : null;
};

/**
 * ربط خزانات قسم البنزين برصيد صفحة بنزين الصحاري (آخر يوم مؤكَّد):
 * الخزان المسمّى باسم محطة يأخذ رصيد محطته، وباقي خزانات القسم (مثل "خزان بانزين" الإجمالي)
 * تتقاسم بقية الرصيد الحالي حسب سعاتها. لا يُكتب شيء إن لم يتغير.
 */
export const syncSaharaPetrolTanks = (totalLiters: number, stationBalances?: Record<string, number>) => {
  const tanks = readCentralTanks([]);
  const key = resolveSaharaPetrolSectionKey(tanks);
  if (!key) return;
  const section = tanks.filter(t => t.sectionKey === key && t.capacityLiters > 0);
  const mapped = section.filter(t => stationBalances?.[t.id] !== undefined);
  const rest = section.filter(t => !mapped.includes(t));
  const mappedTotal = mapped.reduce((a, t) => a + (stationBalances![t.id] || 0), 0);
  const remainder = Math.max(0, totalLiters - mappedTotal);
  const restCapacity = rest.reduce((a, t) => a + t.capacityLiters, 0);

  const target = new Map<string, number>();
  mapped.forEach(t => target.set(t.id, stationBalances![t.id] || 0));
  rest.forEach(t => target.set(t.id, restCapacity ? (remainder * t.capacityLiters) / restCapacity : 0));

  let changed = false;
  const next = tanks.map(t => {
    const liters = target.get(t.id);
    if (liters === undefined) return t;
    const max = t.maxLevelMeters || 1;
    const level = Math.min(max, Math.max(0, (liters / t.capacityLiters) * max));
    if (Math.abs(level - t.levelMeters) < 1e-6) return t;
    changed = true;
    return { ...t, levelMeters: level };
  });
  if (changed) writeCentralTanks(next);
};

/**
 * ملء خزانات قسم بالكميات (لتر) بترتيب خزانات القسم الظاهرة؛ null = يُترك الخزان كما هو.
 * الكمية الأكبر من السعة تُقصّ إلى الامتلاء. يُرجع الخزانات التي تغيرت والتي تجاوزت سعتها.
 */
export const setSectionTankLiters = (sectionKey: string, liters: (number | null)[], fallback: TankUnitRow[] = []) => {
  const tanks = readCentralTanks(fallback);
  const section = tanks.filter(t => t.sectionKey === sectionKey && !t.hidden);
  const target = new Map<string, number>();
  const over: string[] = [];
  section.forEach((t, i) => {
    const v = liters[i];
    if (v === null || v === undefined || !t.capacityLiters) return;
    if (v > t.capacityLiters) over.push(t.name);
    const max = t.maxLevelMeters || 1;
    target.set(t.id, Math.min(max, Math.max(0, (v / t.capacityLiters) * max)));
  });
  let changed = false;
  const next = tanks.map(t => {
    const level = target.get(t.id);
    if (level === undefined || Math.abs(level - t.levelMeters) < 1e-9) return t;
    changed = true;
    return { ...t, levelMeters: level };
  });
  if (changed) writeCentralTanks(next);
  return { filled: target.size, sectionSize: section.length, over };
};
