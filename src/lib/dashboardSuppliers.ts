import { useCallback, useEffect, useState } from 'react';
import { CLOUD_APPLIED_EVENT } from './cloudSync';
import { keepIfSame } from './keepIfSame';
import { sameSupplier, supplierKey } from './archiveSuppliers';

/**
 * الموردون الظاهرون في كارت «مؤشرات الأسعار» في الرئيسية: يُختارون بعلامة صح في جدول «كل الموردين».
 * المورد غير المعلَّم لا يظهر. لكل شركة مستلمة علامتها: يُحفظ «الشركة::الاسم»، فالمورد الذي يورّد للصحاري والاتحاد
 * يُعلَّم صف كل شركة وحده. الاسم وحده (الصيغة القديمة) يعني الشركتين معًا.
 */
export const DASHBOARD_SUPPLIERS_KEY = 'sahara_dashboard_suppliers_v1';
const SYNC_EVENT = 'sahara-dashboard-suppliers-updated';

export const readDashboardSuppliers = (): string[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(DASHBOARD_SUPPLIERS_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];
  } catch {
    return [];
  }
};

type Company = 'sahara' | 'etihad';
const SEP = '::';
const parse = (k: string): { company?: Company; name: string } => {
  const i = k.indexOf(SEP);
  const co = i > 0 ? k.slice(0, i) : '';
  return co === 'sahara' || co === 'etihad' ? { company: co, name: k.slice(i + SEP.length) } : { name: k };
};
const sameName = (a: string, b: string) => sameSupplier(a, b) || supplierKey(a) === supplierKey(b);

/** هل المورد معلَّم (لشركة الصف إن أُعطيت) */
export const isOnDashboard = (list: string[], name: string, company?: Company) =>
  list.some(k => { const e = parse(k); return sameName(e.name, name) && (!e.company || !company || e.company === company); });

/** إظهار المورد في الرئيسية أو إخفاؤه؛ بشركة: صف تلك الشركة وحده (علامة الشركة الأخرى تبقى كما هي) */
export const setOnDashboard = (name: string, on: boolean, company?: Company) => {
  const clean = name.replace(/\s+/g, ' ').trim();
  const list: string[] = [];
  for (const k of readDashboardSuppliers()) {
    const e = parse(k);
    if (!sameName(e.name, name)) { list.push(k); continue; }
    if (!company) continue;
    // صيغة قديمة (الشركتان): تبقى علامة الشركة الأخرى
    if (!e.company) list.push(`${company === 'sahara' ? 'etihad' : 'sahara'}${SEP}${e.name}`);
    else if (e.company !== company) list.push(k);
  }
  if (on) list.push(company ? `${company}${SEP}${clean}` : clean);
  localStorage.setItem(DASHBOARD_SUPPLIERS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(SYNC_EVENT));
};

/** مزامنة حية بين التبويبات والأجهزة */
export const useDashboardSuppliers = () => {
  const [list, setList] = useState<string[]>(readDashboardSuppliers);
  const refresh = useCallback(() => setList(keepIfSame(readDashboardSuppliers())), []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === DASHBOARD_SUPPLIERS_KEY) refresh(); };
    const onCloud = (e: Event) => { if (((e as CustomEvent<string[]>).detail ?? []).includes(DASHBOARD_SUPPLIERS_KEY)) refresh(); };
    // الصفحة المخفية (تبقى محمّلة) لا تستلم الأحداث: تُعاد القراءة عند ظهورها فلا يبقى اختيار قديم حتى الرفرش
    refresh();
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener(CLOUD_APPLIED_EVENT, onCloud);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CLOUD_APPLIED_EVENT, onCloud);
    };
  }, [refresh]);
  return list;
};
