/** مواقع الصحاري (أسماؤها كما في المنظومة) */
export const FARM_SITES = ['التسمين', 'البوادي', 'البياض', 'امهات البياض', 'الاجداد', 'الطاقة'] as const;
export type FarmSite = (typeof FARM_SITES)[number];

export interface FarmRow {
  name: string;
  previous: number | null;
  inbound: number | null;
  consumption: number | null;
  balance: number | null;
}
