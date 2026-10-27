import { useMemo } from 'react';
import { VEHICLE_PROFILES_KEY, vehicleCategory, type VehicleProfile, type VehicleStat } from '../../lib/vehicleFuel';
import { useSyncedStorage } from '../../lib/useSyncedStorage';

export interface CategoryGroup {
  key: string;
  label: string;
  /** رمز عربة من الفئة لعرض صورتها */
  sample: string;
  vehicles: VehicleStat[];
  total: number;
  fills: number;
  frequent: number;
}

export const OTHER_CATEGORY = 'OTHER';

/** تجميع العربات حسب فئتها (من رمزها)، الأعلى استهلاكًا أولًا و«أخرى» في الآخر */
export const groupByCategory = (stats: VehicleStat[], names?: Map<string, string>): CategoryGroup[] => {
  const map = new Map<string, CategoryGroup>();
  for (const s of stats) {
    const code = names?.get(s.vehicle) || s.vehicle;
    const cat = vehicleCategory(code);
    const key = cat?.key || OTHER_CATEGORY;
    const c = map.get(key) || { key, label: cat?.label || 'أخرى', sample: code, vehicles: [], total: 0, fills: 0, frequent: 0 };
    c.vehicles.push(s);
    c.total += s.total;
    c.fills += s.count;
    if (s.frequent) c.frequent += 1;
    map.set(key, c);
  }
  // «أخرى» دائمًا في الآخر، وبقية الفئات بالأعلى استهلاكًا
  return [...map.values()].sort((a, b) => (a.key === OTHER_CATEGORY ? 1 : 0) - (b.key === OTHER_CATEGORY ? 1 : 0) || b.total - a.total);
};

/** أسماء العربات من ملفاتها: عند تغيير الاسم تتبعه الفئة والصورة (الاسم يُعامل كرمز العربة) */
export const useVehicleNames = () => {
  const [profiles] = useSyncedStorage<VehicleProfile[]>(VEHICLE_PROFILES_KEY, []);
  return useMemo(() => new Map(profiles.filter(p => p.name?.trim()).map(p => [p.id, p.name!.trim()])), [profiles]);
};
