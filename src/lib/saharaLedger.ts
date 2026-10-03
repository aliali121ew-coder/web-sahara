import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * السجل اليومي لرصيد شركة الصحاري.
 * كل يوم: الرصيد السابق (= الرصيد الحالي لليوم الذي قبله) + الوارد − الاستهلاك الكلي = الرصيد الحالي.
 * الاستهلاك الكلي = الاستهلاك الفعلي (آليات + مزارع + مولدات) + المرسل إلى المزارع.
 * الوارد = داخلي + خارجي + الاتحاد.
 * (مفتاح "government" يُحفظ فيه الوارد الخارجي حتى تبقى السجلات القديمة صحيحة، و"commercial" قديم يُجمع فقط إن وُجد)
 */
export type SaharaExternalSource = 'government' | 'etihad' | 'commercial';

export const SAHARA_EXTERNAL_SOURCES: { key: SaharaExternalSource; label: string }[] = [
  { key: 'government', label: 'خارجي' },
  { key: 'etihad', label: 'الاتحاد' }
];

export interface SaharaLedgerRecord {
  id: string;
  date: string; // YYYY/MM/DD
  vehicles: number;
  farms: number;
  generators: number;
  /** قديم: الوارد الداخلي أُلغي ولا يدخل في الحساب (قد يبقى في السجلات المحفوظة سابقًا) */
  inboundInternal?: number;
  /** الوارد الخارجي حسب المصدر (المصادر غير المختارة لا تُحفظ) */
  inboundExternal: Partial<Record<SaharaExternalSource, number>>;
  /** المرسل إلى المزارع (من ملف الكشف، ضمن الاستهلاك الكلي) */
  sales: number;
  /** أرصدة المحطات المُدخلة يدويًا لهذا اليوم { tankId: لتر } — تُنقل لمنظومة الخزانات عند الحفظ */
  stationBalances?: Record<string, number>;
  /** الرصيد الحالي كما في ملف الكشف (آخر خلية في عمود الرصيد التراكمي) — يُعتمد بدل الحساب إن وُجد */
  currentOverride?: number | null;
  /** الرصيد السابق يدويًا (لأول سجل = الرصيد الافتتاحي، أو لتصحيح رصيد) */
  previousOverride?: number | null;
  savedAt?: string;
}

export interface ComputedSaharaRecord extends SaharaLedgerRecord {
  previous: number;
  actualConsumption: number;
  totalConsumption: number;
  externalTotal: number;
  inbound: number;
  current: number;
}

const STORAGE_KEY = 'sahara_company_balance_ledger_v1';
const SYNC_EVENT = 'sahara-ledger-updated';

export const readSaharaRecords = (): SaharaLedgerRecord[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

/** الحساب بالترتيب الزمني (تصاعدي) */
export const computeSahara = (records: SaharaLedgerRecord[]): ComputedSaharaRecord[] => {
  const asc = [...records].sort((a, b) => a.date.localeCompare(b.date));
  let prevCurrent = 0;
  return asc.map(r => {
    const previous = r.previousOverride ?? prevCurrent;
    const actualConsumption = (r.vehicles || 0) + (r.farms || 0) + (r.generators || 0);
    const totalConsumption = actualConsumption + (r.sales || 0);
    const externalTotal = Object.values(r.inboundExternal || {}).reduce((a, v) => a + (v || 0), 0);
    const inbound = externalTotal;
    const current = r.currentOverride ?? previous + inbound - totalConsumption;
    prevCurrent = current;
    return { ...r, previous, actualConsumption, totalConsumption, externalTotal, inbound, current };
  });
};

const writeRecords = (records: SaharaLedgerRecord[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(SYNC_EVENT));
};

/**
 * النسخة المعتمدة التي تعرضها الواجهة الرئيسية: لا تتغير عند الحفظ،
 * بل فقط عند الضغط على "تأكيد البيانات" في صفحة رصيد الشركة.
 */
const PUBLISHED_KEY = 'sahara_company_balance_published_v1';

const readPublished = (): SaharaLedgerRecord[] | null => {
  try {
    const saved = JSON.parse(localStorage.getItem(PUBLISHED_KEY) || 'null');
    return Array.isArray(saved) ? saved : null;
  } catch {
    return null;
  }
};

const writePublished = (records: SaharaLedgerRecord[]) => {
  localStorage.setItem(PUBLISHED_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(SYNC_EVENT));
};

/** متوسط سعر لتر الكاز للصحاري: يُعدَّل يدويًا من صفحة رصيد الشركة ويظهر في الواجهة الرئيسية */
const PRICE_KEY = 'sahara_gas_avg_price_v1';
const PRICE_EVENT = 'sahara-price-updated';
const DEFAULT_PRICE = 554;

const readPrice = (): number => {
  const n = Number(localStorage.getItem(PRICE_KEY));
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_PRICE;
};

export const useSaharaPrice = () => {
  const [price, setPriceState] = useState<number>(readPrice);

  useEffect(() => {
    const refresh = () => setPriceState(readPrice());
    const onStorage = (e: StorageEvent) => { if (e.key === PRICE_KEY) refresh(); };
    window.addEventListener(PRICE_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PRICE_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setPrice = useCallback((value: number) => {
    localStorage.setItem(PRICE_KEY, String(value));
    window.dispatchEvent(new Event(PRICE_EVENT));
  }, []);

  return [price, setPrice] as const;
};

/** قراءة/كتابة السجل مع مزامنة حية بين كل الصفحات */
export const useSaharaLedger = () => {
  const [records, setRecords] = useState<SaharaLedgerRecord[]>(readSaharaRecords);
  // أول تشغيل بدون نسخة معتمدة: البيانات الحالية تُعتبر معتمدة
  const [published, setPublished] = useState<SaharaLedgerRecord[]>(() => {
    const saved = readPublished();
    if (saved) return saved;
    const current = readSaharaRecords();
    localStorage.setItem(PUBLISHED_KEY, JSON.stringify(current));
    return current;
  });

  useEffect(() => {
    const refresh = () => {
      setRecords(readSaharaRecords());
      setPublished(readPublished() ?? readSaharaRecords());
    };
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY || e.key === PUBLISHED_KEY) refresh(); };
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = useCallback((fn: (prev: SaharaLedgerRecord[]) => SaharaLedgerRecord[]) => {
    writeRecords(fn(readSaharaRecords()));
  }, []);

  const computed = useMemo(() => computeSahara(records), [records]);
  const latest = computed.length ? computed[computed.length - 1] : null;

  // بيانات الواجهة الرئيسية، ووجود تغييرات لم تُؤكَّد بعد
  const publishedComputed = useMemo(() => computeSahara(published), [published]);
  const hasPending = useMemo(() => JSON.stringify(records) !== JSON.stringify(published), [records, published]);
  const publish = useCallback(() => writePublished(readSaharaRecords()), []);
  // إلغاء العملية: رفض ما حُفظ ولم يُؤكَّد، والعودة لآخر نسخة معتمدة
  const discard = useCallback(() => writeRecords(readPublished() ?? readSaharaRecords()), []);

  return { records, computed, latest, update, publishedComputed, hasPending, publish, discard };
};
