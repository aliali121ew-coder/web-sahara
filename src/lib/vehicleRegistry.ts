/**
 * سجل آليات الشركة (من ملف Excel «جميع آليات الشركة»): لكل عربة رقم الآلية والمحافظة والنوع والمصنع والمجموعة.
 * يُربط بتقرير العربات عن طريق رمز العربة.
 */
export interface VehicleRegistryEntry {
  /** رمز العربة (مثل BS214) */
  id: string;
  /** رقم الآلية (اللوحة) */
  plate: string;
  governorate: string;
  type: string;
  factory: string;
  /** اسم المجموعة (قبل الشرطة) */
  group: string;
  /** المسؤول (بعد الشرطة في عمود المجموعة) */
  supervisor: string;
  importedAt: string;
}

export const VEHICLE_REGISTRY_KEY = 'sahara_vehicle_registry_v1';

const HEADERS: Record<keyof Omit<VehicleRegistryEntry, 'importedAt' | 'supervisor'>, string[]> = {
  id: ['رقم العربة'],
  plate: ['رقم الالية', 'رقم الآلية'],
  governorate: ['المحافظة'],
  type: ['النوع'],
  factory: ['المصنع'],
  group: ['المجموعة'],
};

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
/** «6 - صحارى كربلاء » ← «صحارى كربلاء» */
const dropNumber = (s: string) => s.replace(/^\d+\s*-\s*/, '').trim();

/** يقرأ ملف Excel ويُرجع سطرًا لكل عربة لها رمز */
export const readVehicleRegistry = async (file: File): Promise<VehicleRegistryEntry[]> => {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const now = new Date().toISOString();
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, defval: '' });
    for (let r = 0; r < Math.min(grid.length, 20); r++) {
      const cols = new Map<keyof typeof HEADERS, number>();
      (grid[r] || []).forEach((cell, c) => {
        const h = norm(cell);
        for (const [k, names] of Object.entries(HEADERS) as [keyof typeof HEADERS, string[]][]) {
          if (names.includes(h) && !cols.has(k)) cols.set(k, c);
        }
      });
      if (!cols.has('id') || cols.size < 4) continue;
      const out = new Map<string, VehicleRegistryEntry>();
      for (const line of grid.slice(r + 1)) {
        const get = (k: keyof typeof HEADERS) => norm((line || [])[cols.get(k) ?? -1]);
        const id = get('id').replace(/\s+/g, '').toUpperCase();
        if (!id) continue;
        const [group, ...rest] = get('group').split(' - ');
        out.set(id, {
          id,
          plate: get('plate').replace(/\.$/, ''),
          governorate: dropNumber(get('governorate')),
          type: get('type'),
          factory: dropNumber(get('factory')),
          group: norm(group),
          supervisor: norm(rest.join(' - ')),
          importedAt: now,
        });
      }
      if (out.size) return [...out.values()];
    }
  }
  throw new Error('لم يُعثر على عمود «رقم العربة» في الملف');
};
