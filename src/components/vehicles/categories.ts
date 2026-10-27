import { vehicleCategory, type VehicleStat } from '../../lib/vehicleFuel';

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
export const groupByCategory = (stats: VehicleStat[]): CategoryGroup[] => {
  const map = new Map<string, CategoryGroup>();
  for (const s of stats) {
    const cat = vehicleCategory(s.vehicle);
    const key = cat?.key || OTHER_CATEGORY;
    const c = map.get(key) || { key, label: cat?.label || 'أخرى', sample: s.vehicle, vehicles: [], total: 0, fills: 0, frequent: 0 };
    c.vehicles.push(s);
    c.total += s.total;
    c.fills += s.count;
    if (s.frequent) c.frequent += 1;
    map.set(key, c);
  }
  // «أخرى» دائمًا في الآخر، وبقية الفئات بالأعلى استهلاكًا
  return [...map.values()].sort((a, b) => (a.key === OTHER_CATEGORY ? 1 : 0) - (b.key === OTHER_CATEGORY ? 1 : 0) || b.total - a.total);
};
