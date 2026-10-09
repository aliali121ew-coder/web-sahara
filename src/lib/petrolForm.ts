import { getBusinessDate } from './utils';
import type { PetrolReportExtraction } from './petrolReportFile';
import type { PetrolLedgerRecord } from './petrolLedger';

/**
 * منطق نافذة "تسجيل يوم" لبنزين الصحاري خارج الواجهة: يوم جديد، التعبئة من كشف البنزين،
 * بناء السجل، وشروط الحفظ. تستخدمه النافذة والرفع المتعدد معًا فتكون النتيجة واحدة.
 */

/** كتابة الأرقام بفوارز أثناء الإدخال (مع منزلتين عشريتين للسعر) */
export const withCommas = (v: string) => {
  const clean = v.replace(/[^\d.]/g, '');
  if (!clean) return '';
  const [int, dec] = clean.split('.');
  return (int ? Number(int).toLocaleString('en-US') : '0') + (dec !== undefined ? `.${dec.slice(0, 2)}` : '');
};
export const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(/,/g, '')) || 0);
export const fmtInput = (n: number | undefined | null) => (n ? withCommas(String(n)) : '');

export interface PetrolForm {
  id?: string;
  date: string;
  previous: string;
  /** الرصيد السابق معدّل يدويًا (وإلا = الرصيد الحالي لليوم الذي قبله) */
  editPrevious: boolean;
  /** خانة الرصيد السابق مفتوحة للإدخال */
  prevEditing: boolean;
  inboundQty: string;
  inboundInternal: string;
  inboundPrice: string;
  consumption: Record<string, string>;
  balances: Record<string, string>;
}

export interface PetrolStation { id: string; name: string; balance: number; capacity: number }
type Day = { id: string; date: string; current: number; inboundPrice: number };

/** يوم جديد: تاريخ اليوم (فارغ إن كان مسجّلًا)، وآخر سعر شراء مقترحًا، وأرصدة المحطات الحالية */
export const newPetrolForm = (computed: Day[], stations: PetrolStation[]): PetrolForm => {
  const today = getBusinessDate();
  return {
    date: computed.some(r => r.date === today) ? '' : today,
    previous: '',
    editPrevious: false,
    prevEditing: computed.length === 0,
    inboundQty: '',
    inboundInternal: '',
    // الكشف لا يحتوي السعر: يُقترح آخر سعر شراء مسجّل
    inboundPrice: fmtInput([...computed].reverse().find(r => r.inboundPrice > 0)?.inboundPrice),
    consumption: Object.fromEntries(stations.map(s => [s.id, ''])),
    balances: Object.fromEntries(stations.map(s => [s.id, fmtInput(s.balance)]))
  };
};

/** الرصيد السابق التلقائي لتاريخ = الرصيد الحالي لآخر يوم قبله */
export const petrolAutoPrevious = (computed: Day[], date: string, excludeId?: string) =>
  [...computed].filter(r => r.date < date && r.id !== excludeId).pop()?.current ?? null;

export interface PetrolReportApplied { form: PetrolForm; filled: number; unmatched: string[]; dateFromFile: string | null }

/** تعبئة نموذج من كشف البنزين المقروء (نفس ما تفعله النافذة عند رفع الملف) */
export const applyPetrolReport = (form: PetrolForm, data: PetrolReportExtraction, stations: PetrolStation[], computed: Day[]): PetrolReportApplied => {
  const byName = new Map(stations.map(s => [s.name, s.id]));
  const consumption = { ...form.consumption };
  const balances = { ...form.balances };
  let filled = 0;
  const unmatched: string[] = [];
  data.stations.forEach(st => {
    const id = st.matched ? byName.get(st.matched) : undefined;
    if (!id) { unmatched.push(st.nameInFile); return; }
    if (st.consumption !== undefined) { consumption[id] = fmtInput(st.consumption) || '0'; filled++; }
    if (st.balance !== undefined) { balances[id] = fmtInput(st.balance) || '0'; filled++; }
  });
  // تاريخ الكشف يصبح تاريخ اليوم تلقائيًا (للتسجيل الجديد فقط، ويبقى قابلًا للتعديل يدويًا)
  const dateFromFile = !form.id && data.date ? data.date : null;
  const date = dateFromFile ?? form.date;
  const next: PetrolForm = { ...form, date, consumption, balances };
  if (data.inboundQty !== undefined) { next.inboundQty = fmtInput(data.inboundQty); filled++; }
  if (data.inboundInternal !== undefined) { next.inboundInternal = fmtInput(data.inboundInternal); filled++; }
  if (data.inboundPrice !== undefined) { next.inboundPrice = fmtInput(data.inboundPrice); filled++; }
  // الرصيد السابق من الملف يُستعمل فقط إن لم يوجد يوم قبله في النظام (لتاريخ الكشف)
  if (data.previous !== undefined && petrolAutoPrevious(computed, date, form.id) === null) {
    next.previous = fmtInput(data.previous);
    next.editPrevious = true;
    filled++;
  }
  return { form: next, filled, unmatched, dateFromFile };
};

/** السجل الذي يُحفظ من النموذج */
export const petrolRecord = (form: PetrolForm, computed: Day[]): PetrolLedgerRecord => {
  const autoPrevious = petrolAutoPrevious(computed, form.date, form.id);
  return {
    id: form.id || `pet-${Date.now()}`,
    date: form.date,
    inboundQty: num(form.inboundQty),
    inboundInternal: num(form.inboundInternal),
    inboundPrice: num(form.inboundPrice),
    consumption: Object.fromEntries(Object.entries(form.consumption).map(([k, v]) => [k, num(v)])),
    stationBalances: Object.fromEntries(Object.entries(form.balances).map(([k, v]) => [k, num(v)])),
    // يُحفظ الرصيد السابق فقط إذا عُدّل يدويًا أو لم يوجد يوم قبله (الرصيد الافتتاحي)
    previousOverride: form.editPrevious || autoPrevious === null ? num(form.previous) : null,
    savedAt: new Date().toISOString()
  };
};

export type PetrolSaveBlocker = 'noDate' | 'dateTaken' | 'noPrevious' | 'overCapacity';

/** ما يمنع الحفظ (فارغ = يمكن الحفظ) — نفس شروط زر الحفظ في النافذة */
export const petrolSaveBlockers = (form: PetrolForm, computed: Day[], stations: PetrolStation[]): PetrolSaveBlocker[] => {
  const out: PetrolSaveBlocker[] = [];
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(form.date)) out.push('noDate');
  if (computed.some(r => r.date === form.date && r.id !== form.id)) out.push('dateTaken');
  if (!(form.editPrevious || petrolAutoPrevious(computed, form.date, form.id) !== null || form.previous.trim() !== '')) out.push('noPrevious');
  if (stations.some(s => s.capacity > 0 && num(form.balances[s.id] || '') > s.capacity)) out.push('overCapacity');
  return out;
};
