import type { InboundDelivery, SupplierPriceRecord } from '../types';

/**
 * الموردون الحقيقيون مستخرجون من أرشيف الوارد (وارد الصحاري ووارد الاتحاد).
 * المورد = «اسم المجهز» في الشحنة (الأولوية له)؛ وإن كان فارغًا أو «_» فـ«الشركة المجهزة».
 * السعر الحالي = سعر آخر شحنة مسعّرة، والسابق = آخر سعر مختلف قبله.
 */

const PLACEHOLDER = new Set(['', '_', '-', 'مشتريات متنوعة']);

/** تطبيع للمطابقة: الهمزات والتاء المربوطة والمسافات، وحذف «شركة/المتعهد» والأقواس و«/ وقود» */
export const supplierKey = (v = '') =>
  v.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/\(.*?\)/g, ' ').replace(/\/\s*وقود/g, ' ')
    .replace(/^\s*(شركه|المتعهد)\s+/, '')
    .replace(/\s+/g, ' ').trim();

/** اسم المورد المعروض كما كُتب (منظّف المسافات) */
const cleanName = (v = '') => v.replace(/\(.*?\)/g, ' ').replace(/\/\s*وقود/g, ' ').replace(/\s+/g, ' ').trim();

export const deliverySupplier = (d: InboundDelivery): string => {
  const person = (d.supplierName || '').replace(/\s+/g, ' ').trim();
  if (!PLACEHOLDER.has(person)) return person;
  const co = (d.supplierCompany || '').replace(/\s+/g, ' ').trim();
  return PLACEHOLDER.has(co) ? '' : co;
};

/** الجهة الأخرى في الشحنة: «الشركة المجهزة» إن كان المورد هو المجهز (تُعرض في صفحة المورد) */
export const deliveryCompany = (d: InboundDelivery): string => {
  const co = (d.supplierCompany || '').replace(/\s+/g, ' ').trim();
  return PLACEHOLDER.has(co) ? '' : co;
};

/** هل الاسمان لنفس المورد؟ مطابقة تامة بعد التطبيع، أو احتواء للأسماء الطويلة («معمل المصفى الذهبي» ⊃ «المصفى الذهبي») */
export const sameSupplier = (a?: string, b?: string) => {
  const x = supplierKey(a), y = supplierKey(b);
  if (!x || !y || PLACEHOLDER.has(x) || PLACEHOLDER.has(y)) return false;
  if (x === y) return true;
  return Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x));
};

/** شحنات المورد من الأرشيف: المطابقة التامة أولًا («شركة التصويب» غير «معمل التصويب»)، والتقريبية فقط إن لم توجد تامة */
export const deliveriesOfSupplier = <T,>(items: T[], get: (x: T) => InboundDelivery, name: string): T[] => {
  const key = supplierKey(name);
  const exact = items.filter(x => supplierKey(deliverySupplier(get(x))) === key);
  return exact.length ? exact : items.filter(x => sameSupplier(deliverySupplier(get(x)), name));
};

/** فهرس شحنات الأرشيف بمفتاح المورد (مرور واحد) لاستخراج شحنات موردين كثيرين دون مسح الأرشيف لكل مورد */
export const indexDeliveries = (items: InboundDelivery[]): Map<string, InboundDelivery[]> => {
  const idx = new Map<string, InboundDelivery[]>();
  for (const d of items) {
    const k = supplierKey(deliverySupplier(d));
    const list = idx.get(k);
    if (list) list.push(d); else idx.set(k, [d]);
  }
  return idx;
};

/** مثل deliveriesOfSupplier لكن من الفهرس؛ التقريبية تمر على المفاتيح لا على الشحنات */
export const deliveriesFromIndex = (idx: Map<string, InboundDelivery[]>, name: string): InboundDelivery[] => {
  const exact = idx.get(supplierKey(name));
  if (exact?.length) return exact;
  const out: InboundDelivery[] = [];
  for (const [k, list] of idx) if (sameSupplier(k, name)) out.push(...list);
  return out;
};

/** قيمة فعلية في حقل نصي من الأرشيف («_» و«-» و«0» تعني فارغ) */
export const archiveValue = (v: unknown): string | undefined => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return !s || s === '_' || s === '-' || s === '0' ? undefined : s;
};

const dateKey = (d: InboundDelivery) => (d.receiptUnloadDate || d.date || '').replace(/-/g, '/');
const priceOf = (d: InboundDelivery) => d.productPrice || d.pricePerLiter || 0;

/** موردو أرشيف شركة واحدة؛ المورد الذي ورد للشركتين يصبح سجلين منفصلين */
export const buildArchiveSuppliers = (saharaDeliveries: InboundDelivery[], etihadDeliveries: InboundDelivery[]): SupplierPriceRecord[] => [
  ...buildCompanySuppliers(saharaDeliveries, 'sahara'),
  ...buildCompanySuppliers(etihadDeliveries, 'etihad'),
].sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));

const buildCompanySuppliers = (deliveries: InboundDelivery[], company: 'sahara' | 'etihad'): SupplierPriceRecord[] => {
  const groups = new Map<string, InboundDelivery[]>();
  for (const d of deliveries) {
    const key = supplierKey(deliverySupplier(d));
    if (!key || PLACEHOLDER.has(key)) continue;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const out: SupplierPriceRecord[] = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => dateKey(b).localeCompare(dateKey(a)));
    // الاسم الأكثر تكرارًا بين صيغ الكتابة
    const freq = new Map<string, number>();
    list.forEach(d => { const n = cleanName(deliverySupplier(d)); freq.set(n, (freq.get(n) ?? 0) + 1); });
    const name = [...freq].sort((a, b) => b[1] - a[1])[0][0];
    const priced = list.filter(d => priceOf(d) > 0);
    const price = priced[0] ? priceOf(priced[0]) : 0;
    const prevD = priced.find(d => priceOf(d) !== price);
    const previous = prevD ? priceOf(prevD) : price;
    const products = new Map<string, number>();
    list.forEach(d => d.product && products.set(d.product, (products.get(d.product) ?? 0) + 1));
    const history: { date: string; price: number }[] = [];
    for (const d of priced) {
      if (!history.length || history[history.length - 1].price !== priceOf(d)) history.push({ date: dateKey(d), price: priceOf(d) });
      if (history.length >= 30) break;
    }
    const density = list.map(d => archiveValue(d.productDensity)).find(Boolean);
    const color = list.map(d => archiveValue(d.productColor)).find(Boolean);
    out.push({
      id: `sup-a-${company}-${key.replace(/\s+/g, '-')}`,
      density,
      color,
      company,
      supplierName: name,
      product: [...products].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
      priceIqd: price,
      previousPriceIqd: previous,
      changePercent: previous ? Math.round(((price - previous) / previous) * 10000) / 100 : 0,
      category: 'تجاري',
      availability: 'متوفر',
      lastUpdated: priced[0] ? dateKey(priced[0]) : dateKey(list[0]),
      history,
    });
  }
  return out;
};

/** المجهز في الشحنة: اسم المجهز، وإن كان فارغًا أو «_» فالشركة المجهزة نفسها */
export const equipperOf = (d: InboundDelivery) => {
  const n = (d.supplierName || '').replace(/\s+/g, ' ').trim();
  return n === '' || n === '_' || n === '-' ? (d.supplierCompany || '').replace(/\s+/g, ' ').trim() : n;
};
