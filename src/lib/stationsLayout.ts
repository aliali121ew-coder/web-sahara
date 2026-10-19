import { DAY_ROADS, type RoadPt } from './stationRoads';

/**
 * تخطيط مشهد محطات مركز التوزيع ثلاثي الأبعاد: نفس مواقع الصورة المرجعية (بالنسبة المئوية من عرضها وارتفاعها)
 * مع «فرد» محور العمق (الصورة مائلة بزاوية ~48°)، فتبقى الشوارع المتتبَّعة والساحات ونقاط التفريغ كما هي.
 * وحدات الأرض: x من 0 إلى 100، والعمق y من 0 إلى GROUND_D؛ وفي المشهد تُضرب في WORLD_S.
 */

/** أبعاد الصورة المرجعية التي تتبّعنا منها الشوارع */
export const PIC = { w: 1500, h: 1152 };
/** ميل منظور الصورة عن الأفق */
export const PIC_TILT = (48 * Math.PI) / 180;
/** نسبة % من ارتفاع الصورة ← وحدات عمق الأرض */
export const Y_SCALE = PIC.h / PIC.w / Math.sin(PIC_TILT);
export const GROUND_D = 100 * Y_SCALE;
/** وحدة أرض ← وحدة مشهد */
export const WORLD_S = 10;

/** نقطة من الصورة (%) ← وحدات الأرض */
export const unfold = (p: RoadPt): [number, number] => [p[0], p[1] * Y_SCALE];
/** وحدات الأرض ← إحداثيات المشهد (x, z) حول المركز */
export const toWorld = (x: number, y: number): [number, number] => [(x - 50) * WORLD_S, (y - GROUND_D / 2) * WORLD_S];

/** صندوق على الأرض بنسب الصورة: المركز (cx, cy) والعرض والعمق */
export interface Box { cx: number; cy: number; w: number; d: number }
export interface StationLayout {
  /** ساحة المحطة (الخرسانة) */
  pad: { x0: number; x1: number; y0: number; y1: number };
  /** قاعدة المظلة (المضخات تحتها) */
  canopy: Box;
  /** مبنى المحل */
  shop: Box;
  /** خزان الوقود الأبيض خلف المبنى */
  tank: RoadPt;
  /** عمود اللوحة */
  sign: RoadPt;
  colors: { roof: number; band: number; shop: number; trim: number; text: string };
}

/** المحطات الست كما في الصورة: ألوان المظلة والمبنى ومواقعها */
export const STATIONS: Record<string, StationLayout> = {
  الاجداد: {
    pad: { x0: 8, x1: 32, y0: 8.6, y1: 16.6 },
    canopy: { cx: 19.5, cy: 11.4, w: 10, d: 3 }, shop: { cx: 26.8, cy: 11.6, w: 5.6, d: 3 },
    tank: [27.6, 9.4], sign: [11, 12.2],
    colors: { roof: 0xf1f5f9, band: 0xd32f2f, shop: 0xe2e8f0, trim: 0x94a3b8, text: '#ffffff' },
  },
  'امهات البياض': {
    pad: { x0: 55, x1: 83.5, y0: 13.4, y1: 23.6 },
    canopy: { cx: 66, cy: 17.4, w: 13, d: 3.4 }, shop: { cx: 77.2, cy: 17.6, w: 6, d: 3.4 },
    tank: [78.4, 15], sign: [59.2, 17.4],
    colors: { roof: 0x1f2937, band: 0xdc2626, shop: 0x111827, trim: 0x374151, text: '#ffffff' },
  },
  البوادي: {
    pad: { x0: 4, x1: 33, y0: 29.6, y1: 41.4 },
    canopy: { cx: 19, cy: 34, w: 14, d: 3.6 }, shop: { cx: 28.2, cy: 34.6, w: 5.6, d: 3.4 },
    tank: [27.6, 31.4], sign: [8, 34.4],
    colors: { roof: 0xc2410c, band: 0x9a3412, shop: 0x92400e, trim: 0x78350f, text: '#ffffff' },
  },
  التسمين: {
    pad: { x0: 71, x1: 98.4, y0: 38.6, y1: 50.6 },
    canopy: { cx: 84, cy: 43.6, w: 13, d: 3.6 }, shop: { cx: 93.4, cy: 43.8, w: 5, d: 3.4 },
    tank: [93.4, 40.4], sign: [74.2, 43.4],
    colors: { roof: 0x1d4ed8, band: 0x1e3a8a, shop: 0x1e40af, trim: 0x1e3a8a, text: '#ffffff' },
  },
  البياض: {
    pad: { x0: 20.5, x1: 51, y0: 55, y1: 69.4 },
    canopy: { cx: 35, cy: 61.4, w: 13, d: 4 }, shop: { cx: 44.8, cy: 62, w: 6, d: 3.6 },
    tank: [45, 59.2], sign: [25.6, 60.8],
    colors: { roof: 0xeab308, band: 0xca8a04, shop: 0xd97706, trim: 0xb45309, text: '#ffffff' },
  },
  الطاقة: {
    pad: { x0: 64.5, x1: 93, y0: 76, y1: 90 },
    canopy: { cx: 78.4, cy: 80.6, w: 14, d: 4 }, shop: { cx: 89, cy: 81.6, w: 6, d: 3.6 },
    tank: [89.2, 78.6], sign: [68, 81.6],
    colors: { roof: 0xdc2626, band: 0x991b1b, shop: 0xb91c1c, trim: 0x7f1d1d, text: '#ffffff' },
  },
};

/** نقطة الوقوف عند التفريغ واتجاه آخر مقطع قبلها (بوحدات الأرض) لكل محطة */
export const parkPose = (site: string) => {
  const y = DAY_ROADS.yards[site];
  if (!y) return null;
  const before = y.pre ?? Object.values(y.from)[0]?.slice(-1)[0] ?? y.park;
  const [px, py] = unfold(y.park), [bx, by] = unfold(before);
  const heading = Math.atan2(py - by, px - bx);
  // نقطة التفريغ على يمين المتجه شرقًا (نحو مقدمة الساحة) أو يساره إن كان متجهًا غربًا
  const side: 1 | -1 = Math.cos(heading) > 0 ? 1 : -1;
  return { x: px, y: py, heading, side };
};
