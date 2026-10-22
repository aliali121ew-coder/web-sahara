import { Delaunay } from 'd3-delaunay';
import polygonClipping from 'polygon-clipping';
import { farmsDates, farmsOn, type SiteFarmsRecord } from './siteFarms';
import type { FarmRow } from './siteFarmsTypes';

/**
 * خريطة مزارع الموقع وحقل المزارع:
 * - الحالة (اللون) من الرصيد التراكمي: 25,000 لتر فأقل حرجة (أحمر)، حتى 50,000 تحذير (أصفر)، وفوقها آمنة (أخضر)
 * - أيام التغطية لكل مزرعة = الرصيد ÷ معدل المصروف اليومي (متوسط آخر الكشوف اليومية المرفوعة) — معلومة إضافية
 * - هندسة الخريطة: حدود متعرجة للموقع مقسّمة إلى مناطق (فورونوي) بعدد المزارع — تخطيطية لا جغرافية
 */

export type CoverStatus = 'crit' | 'warn' | 'ok' | 'idle';

/** حدود الحالات بالرصيد التراكمي (لتر) */
export const BALANCE_CRIT = 25000;
export const BALANCE_WARN = 50000;
/** التوصية: الكمية التي توصل الرصيد إلى الأخضر */
export const BALANCE_TARGET = 51000;
/** عدد الكشوف الأخيرة التي يُحسب منها المعدل */
const RATE_REPORTS = 14;

export interface FarmCover {
  name: string;
  /** اسم مختصر للخريطة (رقم المزرعة إن وُجد) */
  label: string;
  previous: number;
  inbound: number;
  consumption: number;
  balance: number;
  /** متوسط المصروف اليومي (لتر) */
  rate: number;
  /** أيام التغطية (Infinity إن لم يوجد مصروف) */
  days: number;
  status: CoverStatus;
  /** الكمية المقترحة ليصل الرصيد إلى BALANCE_TARGET */
  need: number;
}

export interface SiteCover {
  date: string | null;
  /** عدد الكشوف التي حُسب منها المعدل */
  reports: number;
  farms: FarmCover[];
  /** صف خزان المحطة في الكشف */
  station: FarmRow | null;
}

const isTank = (name: string) => /^(محطة|معمل|خزان)/.test(name.trim());

export const statusOf = (balance: number): CoverStatus =>
  balance <= BALANCE_CRIT ? 'crit' : balance <= BALANCE_WARN ? 'warn' : 'ok';


export const siteCover = (records: SiteFarmsRecord[], site: string): SiteCover => {
  const dates = farmsDates(records, site);
  const date = dates[dates.length - 1] ?? null;
  if (!date) return { date: null, reports: 0, farms: [], station: null };
  const recent = dates.slice(-RATE_REPORTS);
  const sums = new Map<string, { s: number; n: number }>();
  for (const d of recent) {
    for (const r of farmsOn(records, site, d)) {
      if (r.consumption === null) continue;
      const e = sums.get(r.name) ?? { s: 0, n: 0 };
      e.s += r.consumption; e.n++;
      sums.set(r.name, e);
    }
  }
  const rows = farmsOn(records, site, date);
  const station = rows.find(r => isTank(r.name) && /^محطة/.test(r.name.trim())) ?? null;
  // أسماء بلا رقم (مثل المفاقس) تأخذ رقمًا متسلسلًا مع أول كلمة: "مفقس 1"، "مفقس 2"
  const seen = new Map<string, number>();
  const labelOf = (name: string) => {
    const num = name.match(/\d+/)?.[0];
    if (num) return num;
    const word = name.trim().split(/\s+/)[0];
    const k = (seen.get(word) ?? 0) + 1;
    seen.set(word, k);
    return `${word} ${k}`;
  };
  const farms = rows.filter(r => !isTank(r.name)).map(r => {
    const e = sums.get(r.name);
    const rate = e && e.n ? e.s / e.n : 0;
    const balance = r.balance ?? 0;
    const days = rate > 0 ? balance / rate : Infinity;
    const status = statusOf(balance);
    const need = Math.max(0, Math.ceil((BALANCE_TARGET - balance) / 500) * 500);
    return { name: r.name, label: labelOf(r.name), previous: r.previous ?? 0, inbound: r.inbound ?? 0, consumption: r.consumption ?? 0, balance, rate, days, status, need };
  });
  return { date, reports: recent.length, farms, station };
};

// ───────────── هندسة الخريطة ─────────────
export type Pt = [number, number];

const area = (pg: Pt[]) => pg.reduce((s, p, i) => { const q = pg[(i + 1) % pg.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
export const centroid = (pg: Pt[]): Pt => {
  const a = area(pg);
  if (!a) return pg.reduce<Pt>((s, p) => [s[0] + p[0] / pg.length, s[1] + p[1] / pg.length], [0, 0]);
  let x = 0, y = 0;
  pg.forEach((p, i) => { const q = pg[(i + 1) % pg.length]; const k = p[0] * q[1] - q[0] * p[1]; x += (p[0] + q[0]) * k; y += (p[1] + q[1]) * k; });
  return [x / (6 * a), y / (6 * a)];
};
const contains = (pg: Pt[], [x, y]: Pt) => {
  let inside = false;
  for (let i = 0, j = pg.length - 1; i < pg.length; j = i++) {
    const [xi, yi] = pg[i], [xj, yj] = pg[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export interface SiteGeometry {
  outline: Pt[];
  cells: { poly: Pt[]; ct: Pt }[];
  bounds: [number, number, number, number];
}

/** شكل ثابت لكل موقع (البذرة من اسمه) بعدد مناطق = عدد المزارع، مرتبة صفوفًا من الأعلى ومن اليمين */
export const siteGeometry = (count: number, key: string): SiteGeometry => {
  let seed = [...key].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483647, 11) || 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ph = [rnd(), rnd(), rnd()].map(v => v * 6.28);
  const RX = 25, RY = 14.5;
  const outline: Pt[] = Array.from({ length: 220 }, (_, i) => {
    const t = (i / 220) * Math.PI * 2;
    const r = 1 + 0.09 * Math.sin(3 * t + ph[0]) + 0.06 * Math.sin(5 * t + ph[1]) + 0.03 * Math.sin(11 * t + ph[2]) + 0.018 * Math.sin(19 * t + 2.1) + 0.01 * Math.sin(37 * t);
    return [Math.cos(t) * RX * r, Math.sin(t) * RY * r * (1 + 0.12 * Math.cos(t + 0.8))];
  });
  const xs = outline.map(p => p[0]), ys = outline.map(p => p[1]);
  const bounds: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  if (count <= 0) return { outline, cells: [], bounds };
  // شبكة بذور متباعدة حسب عدد المزارع
  const step = Math.sqrt((Math.PI * RX * RY) / (count * 1.25));
  const seeds: Pt[] = [];
  for (let gy = -RY; gy <= RY; gy += step * 0.75) {
    for (let gx = -RX; gx <= RX; gx += step) {
      const p: Pt = [gx + (rnd() - 0.5) * step * 0.6, gy + (rnd() - 0.5) * step * 0.5];
      if (contains(outline, p)) seeds.push(p);
    }
  }
  while (seeds.length < count) { // احتياط لعدد صغير جدًا من البذور
    const p: Pt = [(rnd() - 0.5) * RX * 1.6, (rnd() - 0.5) * RY * 1.6];
    if (contains(outline, p)) seeds.push(p);
  }
  const row = step * 0.75;
  const chosen = seeds.sort((a, b) => Math.hypot(a[0] / RX, a[1] / RY) - Math.hypot(b[0] / RX, b[1] / RY)).slice(0, count)
    .sort((a, b) => Math.round(b[1] / row) - Math.round(a[1] / row) || b[0] - a[0]);
  const vor = Delaunay.from(chosen).voronoi([bounds[0] - 1, bounds[1] - 1, bounds[2] + 1, bounds[3] + 1]);
  const ring = [...outline, outline[0]];
  const cells = chosen.map((s, i) => {
    const cell = vor.cellPolygon(i) as Pt[] | null;
    if (!cell) return { poly: [] as Pt[], ct: s };
    const parts = polygonClipping.intersection([cell], [ring]);
    const best = parts.map(pg => pg[0] as Pt[]).sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0] ?? [];
    const poly = best.slice(0, -1);
    return { poly, ct: poly.length >= 3 ? centroid(poly) : s };
  });
  return { outline, cells, bounds };
};
