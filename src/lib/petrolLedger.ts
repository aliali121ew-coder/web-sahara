import { useCallback, useEffect, useMemo, useState } from 'react';
import { syncSaharaPetrolTanks } from './centralTanks';

/**
 * السجل اليومي لبنزين شركة صحاري كربلاء.
 * كل يوم: الرصيد السابق (= الرصيد الحالي لليوم الذي قبله) + الوارد الخارجي + الوارد الداخلي − الاستهلاك = الرصيد الحالي.
 * كارت "الوارد" والشاشة الرئيسية والسعر تعتمد الوارد الخارجي فقط.
 * الاستهلاك يُسجَّل لكل محطة (خزانات قسم "بنزين - صحاري كربلاء" في منظومة الخزانات)،
 * وأرصدة المحطات تُنقل للخزانات بعد "تأكيد البيانات".
 */
export interface PetrolLedgerRecord {
  id: string;
  date: string; // YYYY/MM/DD
  /** كمية الوارد (لتر) وسعر شراء اللتر */
  inboundQty: number;
  inboundPrice: number;
  /** الوارد الداخلي (لتر): يدخل في الرصيد الحالي فقط، ولا يُعرض ضمن الوارد ولا في السعر */
  inboundInternal?: number;
  /** الاستهلاك اليومي لكل محطة { tankId: لتر } */
  consumption: Record<string, number>;
  /** أرصدة المحطات لهذا اليوم { tankId: لتر } */
  stationBalances: Record<string, number>;
  /** الرصيد السابق يدويًا (لأول سجل = الرصيد الافتتاحي، أو لتصحيح رصيد) */
  previousOverride?: number | null;
  savedAt?: string;
}

export interface ComputedPetrolRecord extends PetrolLedgerRecord {
  previous: number;
  inboundCost: number;
  totalConsumption: number;
  current: number;
}

/** محطات البنزين المعتمدة (بهذا الترتيب) وسعة خزان كل محطة باللتر */
export const PETROL_STATIONS: { name: string; capacity: number }[] = [
  { name: 'الطاقة', capacity: 44000 },
  { name: 'التسمين', capacity: 20000 },
  { name: 'البياض', capacity: 10000 },
  { name: 'البوادي', capacity: 5000 },
  { name: 'امهات البياض', capacity: 5000 },
  { name: 'الاجداد', capacity: 5000 }
];

/** السعة الكلية لمحطات البنزين */
export const PETROL_TOTAL_CAPACITY = PETROL_STATIONS.reduce((a, s) => a + s.capacity, 0);

const STORAGE_KEY = 'sahara_petrol_ledger_v1';
const PUBLISHED_KEY = 'sahara_petrol_published_v1';
const SYNC_EVENT = 'sahara-petrol-ledger-updated';

const readList = (key: string): PetrolLedgerRecord[] | null => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(saved) ? saved : null;
  } catch {
    return null;
  }
};

export const readPetrolRecords = (): PetrolLedgerRecord[] => readList(STORAGE_KEY) ?? [];

const write = (key: string, records: PetrolLedgerRecord[]) => {
  localStorage.setItem(key, JSON.stringify(records));
  window.dispatchEvent(new Event(SYNC_EVENT));
};

const sum = (o: Record<string, number> | undefined) => Object.values(o || {}).reduce((a, v) => a + (v || 0), 0);

/** الحساب بالترتيب الزمني (تصاعدي) */
export const computePetrol = (records: PetrolLedgerRecord[]): ComputedPetrolRecord[] => {
  const asc = [...records].sort((a, b) => a.date.localeCompare(b.date));
  let prevCurrent = 0;
  return asc.map(r => {
    const previous = r.previousOverride ?? prevCurrent;
    const totalConsumption = sum(r.consumption);
    const inboundCost = (r.inboundQty || 0) * (r.inboundPrice || 0);
    const current = previous + (r.inboundQty || 0) + (r.inboundInternal || 0) - totalConsumption;
    prevCurrent = current;
    return { ...r, previous, inboundCost, totalConsumption, current };
  });
};

/**
 * متوسط سعر البنزين = تكلفة كل الوارد ÷ كميته،
 * ونسبة التغير = معدل آخر يومين معًا مقارنة بسعر اليوم السابق (نفس معادلة الكاز)
 */
export const petrolPriceStats = (days: ComputedPetrolRecord[]) => {
  const withInbound = days.filter(d => d.inboundQty > 0 && d.inboundPrice > 0);
  const qty = withInbound.reduce((a, d) => a + d.inboundQty, 0);
  const cost = withInbound.reduce((a, d) => a + d.inboundCost, 0);
  const avgPrice = qty > 0 ? cost / qty : 0;
  const today = withInbound[withInbound.length - 1] ?? null;
  const prev = withInbound[withInbound.length - 2] ?? null;
  const twoDayAvg = today && prev ? (today.inboundCost + prev.inboundCost) / (today.inboundQty + prev.inboundQty) : null;
  const pct = twoDayAvg !== null && prev && prev.inboundPrice > 0 ? ((twoDayAvg - prev.inboundPrice) / prev.inboundPrice) * 100 : null;
  return { avgPrice, today, prev, twoDayAvg, pct };
};

/** قراءة/كتابة السجل مع مزامنة حية؛ الواجهة الرئيسية تقرأ النسخة المعتمدة فقط */
export const usePetrolLedger = () => {
  const [records, setRecords] = useState<PetrolLedgerRecord[]>(readPetrolRecords);
  // أول تشغيل بدون نسخة معتمدة: البيانات الحالية تُعتبر معتمدة (حتى يظهر "تأكيد البيانات" بعد أول حفظ)
  const [published, setPublished] = useState<PetrolLedgerRecord[]>(() => {
    const saved = readList(PUBLISHED_KEY);
    if (saved) return saved;
    const current = readPetrolRecords();
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify(current));
    return current;
  });

  useEffect(() => {
    const refresh = () => {
      setRecords(readPetrolRecords());
      setPublished(readList(PUBLISHED_KEY) ?? []);
    };
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY || e.key === PUBLISHED_KEY) refresh(); };
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = useCallback((fn: (prev: PetrolLedgerRecord[]) => PetrolLedgerRecord[]) => {
    write(STORAGE_KEY, fn(readPetrolRecords()));
  }, []);

  const computed = useMemo(() => computePetrol(records), [records]);
  const latest = computed.length ? computed[computed.length - 1] : null;
  const publishedComputed = useMemo(() => computePetrol(published), [published]);
  // خزانات قسم البنزين في المنظومة تتبع الرصيد الحالي لآخر يوم مؤكَّد تلقائيًا
  useEffect(() => {
    const last = publishedComputed[publishedComputed.length - 1];
    if (last) syncSaharaPetrolTanks(last.current, last.stationBalances);
  }, [publishedComputed]);
  const hasPending = useMemo(() => JSON.stringify(records) !== JSON.stringify(published), [records, published]);
  const publish = useCallback(() => write(PUBLISHED_KEY, readPetrolRecords()), []);
  const discard = useCallback(() => write(STORAGE_KEY, readList(PUBLISHED_KEY) ?? []), []);

  return { records, computed, latest, update, publishedComputed, hasPending, publish, discard };
};
