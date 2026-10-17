import { useCallback, useEffect, useState } from 'react';
import { CLOUD_APPLIED_EVENT } from './cloudSync';
import { keepIfSame } from './keepIfSame';
import { sameSupplier, supplierKey } from './archiveSuppliers';

/**
 * الموردون الظاهرون في كارت «مؤشرات الأسعار» في الرئيسية: يُختارون بعلامة صح في جدول «كل الموردين».
 * المورد غير المعلَّم لا يظهر. يُحفظ باسم المورد (المورد الواحد صف واحد في الكارت ولو ورد للشركتين).
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

export const isOnDashboard = (list: string[], name: string) => list.some(k => sameSupplier(k, name) || supplierKey(k) === supplierKey(name));

/** إظهار المورد في الرئيسية أو إخفاؤه */
export const setOnDashboard = (name: string, on: boolean) => {
  const list = readDashboardSuppliers().filter(k => !(sameSupplier(k, name) || supplierKey(k) === supplierKey(name)));
  if (on) list.push(name.replace(/\s+/g, ' ').trim());
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
