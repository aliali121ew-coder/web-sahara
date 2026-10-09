import { getBusinessDate } from './utils';
import { matchStation } from './saharaReportFile';
import type { SaharaReportExtraction } from './saharaReportUpload';
import type { ComputedSaharaRecord, SaharaExternalSource, SaharaLedgerRecord } from './saharaLedger';

/**
 * منطق نافذة "تسجيل يوم" لرصيد الصحاري (كاز) خارج الواجهة: يوم جديد، التعبئة من ملف الكشف،
 * بناء السجل، وشروط الحفظ. تستخدمه النافذة والرفع المتعدد معًا فتكون النتيجة واحدة.
 */

/** كتابة الأرقام بفوارز أثناء الإدخال */
export const withCommas = (v: string) => {
  const digits = v.replace(/[^\d]/g, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
};
export const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(/,/g, '')));

export interface SaharaBalanceForm {
  id: string | null;
  date: string;
  previous: string;
  editPrevious: boolean; // false = الرصيد السابق تلقائي من اليوم الذي قبله
  prevEditing: boolean; // خانة الرصيد السابق مفتوحة للإدخال (قبل الضغط على حفظ)
  vehicles: string;
  farms: string;
  generators: string;
  external: Partial<Record<SaharaExternalSource, string>>; // المصادر المختارة فقط
  sales: string;
  stations: Record<string, string>; // { tankId: لتر }
  currentOverride: string; // الرصيد الحالي من ملف الكشف ('' = يُحسب تلقائيًا)
  /** مجاميع الحقول لحظة تحميل رصيد الكشف: أي زيادة أو نقص بعدها ينعكس على الرصيد الحالي */
  overrideBase: { stations: number; inbound: number; consumption: number } | null;
}

/** محطة كاز الصحاري (خزان من قسم كاز شركة صحاري كربلاء في منظومة الخزانات) */
export interface SaharaStation { id: string; name: string; balance: number; capacity: number }

/** مجاميع حقول النموذج المرتبطة بالرصيد الحالي */
export const formStationsSum = (f: Pick<SaharaBalanceForm, 'stations'>) => Object.values(f.stations).reduce((a, v) => a + num(v || ''), 0);
export const formInbound = (f: Pick<SaharaBalanceForm, 'external'>) => Object.values(f.external).reduce((a, v) => a + num(v || ''), 0);
export const formConsumption = (f: Pick<SaharaBalanceForm, 'vehicles' | 'farms' | 'generators' | 'sales'>) =>
  num(f.vehicles) + num(f.farms) + num(f.generators) + num(f.sales);

const toInputDate = (d: string) => d.replace(/\//g, '-');
const fromInputDate = (d: string) => d.replace(/-/g, '/');

/** يوم جديد: تاريخ اليوم، أو اليوم التالي لآخر يوم مسجّل إن كان اليوم مسجّلًا */
export const newSaharaBalanceForm = (latest: { date: string } | null | undefined, stations: SaharaStation[]): SaharaBalanceForm => {
  const today = getBusinessDate();
  let date = today;
  if (latest && latest.date >= today) {
    const d = new Date(toInputDate(latest.date) + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    date = fromInputDate(d.toISOString().slice(0, 10));
  }
  return {
    id: null,
    date,
    previous: '',
    editPrevious: !latest,
    prevEditing: !latest,
    vehicles: '',
    farms: '',
    generators: '',
    external: {},
    sales: '',
    stations: Object.fromEntries(stations.map(s => [s.id, ''])), // اليوم الجديد يبدأ بخانات فارغة
    currentOverride: '',
    overrideBase: null
  };
};

/** الرصيد السابق التلقائي لتاريخ = الرصيد الحالي لآخر يوم قبله */
export const autoPreviousFor = (computed: ComputedSaharaRecord[], date: string, excludeId: string | null) =>
  computed.filter(r => r.id !== excludeId && r.date < date).pop()?.current ?? null;

export interface SaharaReportApplied {
  form: SaharaBalanceForm;
  filled: number;
  /** مواقع في الكشف بلا محطة مطابقة: الاسم والرصيد */
  unmatched: { name: string; balance: number }[];
  /** مطابقة الحساب مع "الرصيد الحالي" في الكشف (null = الكشف بلا رصيد حالي) */
  check: { current: number; diff: number } | null;
  /** تاريخ الكشف إن طُبّق على النموذج */
  dateFromFile: string | null;
}

/** تعبئة نموذج من كشف الكاز المقروء (نفس ما تفعله النافذة عند رفع الملف) */
export const applySaharaReport = (
  form: SaharaBalanceForm,
  r: SaharaReportExtraction,
  stationsList: SaharaStation[],
  computed: ComputedSaharaRecord[]
): SaharaReportApplied => {
  const names = stationsList.map(s => s.name);
  const val = (n: number) => (n > 0 ? withCommas(String(Math.round(n))) : '');
  const stations = { ...form.stations };
  const unmatched: SaharaReportApplied['unmatched'] = [];
  let filled = 0;
  for (const st of r.stations) {
    const matched = (st.matchedStation && matchStation(st.matchedStation, names)) || matchStation(st.nameInImage, names);
    const target = stationsList.find(ls => ls.name === matched);
    if (target) {
      stations[target.id] = withCommas(String(Math.round(st.balance)));
      filled++;
    } else {
      unmatched.push({ name: st.nameInImage, balance: Math.round(st.balance) });
    }
  }
  const external: SaharaBalanceForm['external'] = {};
  if (r.inboundExternal > 0) external.government = val(r.inboundExternal);
  if (r.inboundEtihad > 0) external.etihad = val(r.inboundEtihad);
  filled += [r.vehicles, r.farms, r.generators, r.sentToFarms, r.inboundExternal, r.inboundEtihad].filter(n => n > 0).length;
  // تاريخ الكشف يصبح تاريخ اليوم تلقائيًا (للتسجيل الجديد فقط، ويبقى قابلًا للتعديل يدويًا)
  const dateFromFile = !form.id && r.date ? r.date : null;
  const date = dateFromFile ?? form.date;
  // الرصيد السابق التلقائي لتاريخ الكشف (قد يختلف عن تاريخ النموذج قبل الرفع)
  const autoPrev = autoPreviousFor(computed, date, form.id);
  // الرصيد السابق = "المدوّر السابق" في الكشف؛ إن طابق التلقائي يبقى تلقائيًا
  const carried = r.previousCarried;
  const prevPatch: Partial<SaharaBalanceForm> = carried !== undefined
    ? (autoPrev !== null && Math.round(carried) === Math.round(autoPrev)
      ? { editPrevious: false, prevEditing: false, previous: '' }
      : { editPrevious: true, prevEditing: false, previous: withCommas(String(Math.round(carried))) })
    : {};
  if (carried !== undefined) filled++;
  const fileCurrent = r.tableTotal ?? r.currentInFile;
  const next: SaharaBalanceForm = {
    ...form,
    date,
    ...prevPatch,
    currentOverride: fileCurrent !== undefined ? withCommas(String(Math.round(fileCurrent))) : form.currentOverride,
    overrideBase: fileCurrent !== undefined
      ? {
          stations: Object.values(stations).reduce((a, v) => a + num(v || ''), 0),
          inbound: r.inboundExternal + r.inboundEtihad,
          consumption: r.vehicles + r.farms + r.generators + r.sentToFarms
        }
      : form.overrideBase,
    vehicles: val(r.vehicles),
    farms: val(r.farms),
    generators: val(r.generators),
    sales: val(r.sentToFarms),
    external,
    stations
  };
  // التحقق: السابق + الوارد − الاستهلاك يجب أن يساوي "الرصيد الحالي" في الكشف
  let check: SaharaReportApplied['check'] = null;
  if (r.currentInFile !== undefined) {
    const previous = carried ?? autoPrev ?? 0;
    const inbound = r.inboundExternal + r.inboundEtihad;
    const consumption = r.vehicles + r.farms + r.generators + r.sentToFarms;
    check = { current: Math.round(r.currentInFile), diff: Math.round(previous + inbound - consumption - r.currentInFile) };
  }
  return { form: next, filled, unmatched, check, dateFromFile };
};

/** السجل الذي يُحفظ من النموذج */
export const saharaDraft = (form: SaharaBalanceForm): SaharaLedgerRecord => ({
  id: form.id || 'draft',
  date: form.date,
  vehicles: num(form.vehicles),
  farms: num(form.farms),
  generators: num(form.generators),
  inboundExternal: Object.fromEntries(
    Object.entries(form.external).map(([k, v]) => [k, num(v || '')])
  ) as SaharaLedgerRecord['inboundExternal'],
  sales: num(form.sales),
  stationBalances: Object.fromEntries(Object.entries(form.stations).map(([id, val]) => [id, num(val)])),
  currentOverride: form.currentOverride.trim() !== ''
    ? num(form.currentOverride)
      + (form.overrideBase
        ? (formStationsSum(form) - form.overrideBase.stations)
          + (formInbound(form) - form.overrideBase.inbound)
          - (formConsumption(form) - form.overrideBase.consumption)
        : 0)
    : null,
  previousOverride: (form.editPrevious || form.prevEditing) && form.previous.trim() !== '' ? num(form.previous) : null
});

export type SaharaSaveBlocker = 'noDate' | 'dateTaken' | 'noPrevious' | 'overCapacity';

/** ما يمنع الحفظ (فارغ = يمكن الحفظ) — نفس شروط زر الحفظ في النافذة */
export const saharaSaveBlockers = (
  form: SaharaBalanceForm,
  records: SaharaLedgerRecord[],
  computed: ComputedSaharaRecord[],
  stationsList: SaharaStation[]
): SaharaSaveBlocker[] => {
  const out: SaharaSaveBlocker[] = [];
  if (!form.date) out.push('noDate');
  if (records.some(r => r.date === form.date && r.id !== form.id)) out.push('dateTaken');
  if (autoPreviousFor(computed, form.date, form.id) === null && !form.editPrevious && !form.prevEditing) out.push('noPrevious');
  if (stationsList.some(s => num(form.stations[s.id] || '') > s.capacity)) out.push('overCapacity');
  return out;
};
