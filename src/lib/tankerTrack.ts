import { STATION_ENTRIES, type RoadNet, type RoadPt } from './stationRoads';

/**
 * حركة صهريج على شوارع خريطة المحطات: أقصر طريق بين مدخلي محطتين، ومسار مُعاد التقسيم بخطوات متساوية،
 * وملف سرعة (تسارع عند الانطلاق، تباطؤ قبل الوصول، وسرعة أقل في المنعطفات وداخل ساحات المحطات).
 * الوحدات: عرض الخريطة = 100 وحدة، والارتفاع = 100 × (ارتفاع الصورة / عرضها).
 */

export interface RoutePoint { x: number; y: number; yard: boolean }

/** أقصر طريق على الشبكة من أي مدخل لمحطة الانطلاق إلى أي مدخل لمحطة الوجهة (null إن تعذّر) */
export const buildRoute = (net: RoadNet, from: string, to: string, hRatio: number): RoutePoint[] | null => {
  const starts = STATION_ENTRIES[from], ends = STATION_ENTRIES[to];
  if (!starts || !ends || from === to) return null;
  const toU = (p: RoadPt) => ({ x: p[0], y: p[1] * hRatio });
  const len = (pts: RoadPt[]) => pts.reduce((s, p, i) => (i ? s + Math.hypot(toU(p).x - toU(pts[i - 1]).x, toU(p).y - toU(pts[i - 1]).y) : 0), 0);
  const adj = new Map<string, { n: string; pts: RoadPt[]; yard: boolean; w: number }[]>();
  const link = (a: string, b: string, pts: RoadPt[], yard: boolean) => {
    if (!adj.has(a)) adj.set(a, []);
    // المرور داخل ساحة محطة مكلف قليلًا: يُفضَّل الشارع إن تساوى الطريقان تقريبًا
    adj.get(a)!.push({ n: b, pts, yard, w: len(pts) * (yard ? 1.4 : 1) });
  };
  net.edges.forEach(e => { link(e.a, e.b, e.pts, !!e.yard); link(e.b, e.a, [...e.pts].reverse(), !!e.yard); });

  const dist = new Map<string, number>(starts.map(s => [s, 0]));
  const prev = new Map<string, { n: string; pts: RoadPt[]; yard: boolean }>();
  const open = new Set(starts);
  const done = new Set<string>();
  let reached: string | null = null;
  while (open.size) {
    const cur = [...open].reduce((a, b) => (dist.get(a)! <= dist.get(b)! ? a : b));
    open.delete(cur); done.add(cur);
    if (ends.includes(cur)) { reached = cur; break; }
    for (const e of adj.get(cur) ?? []) {
      if (done.has(e.n)) continue;
      const d = dist.get(cur)! + e.w;
      if (d < (dist.get(e.n) ?? Infinity)) { dist.set(e.n, d); prev.set(e.n, { n: cur, pts: e.pts, yard: e.yard }); open.add(e.n); }
    }
  }
  if (!reached) return null;
  const legs: { pts: RoadPt[]; yard: boolean }[] = [];
  for (let n = reached; !starts.includes(n); ) {
    const p = prev.get(n)!;
    legs.unshift({ pts: p.pts, yard: p.yard });
    n = p.n;
  }
  // من نقطة الوقوف عند خزان محطة الانطلاق إلى مدخلها، ومن مدخل الوجهة إلى خزانها (داخل الساحة: بطيء)
  const yardOut = (station: string, entry: string): RoadPt[] => {
    const y = net.yards[station];
    return y ? [...(y.from[entry] ?? []), ...(y.pre ? [y.pre] : []), y.park] : [];
  };
  let first = '';
  for (let n = reached; ; ) { const p = prev.get(n); if (!p) { first = n; break; } n = p.n; }
  const out: RoutePoint[] = [];
  const push = (p: RoadPt, yard: boolean) => {
    const u = toU(p), last = out[out.length - 1];
    if (last && Math.hypot(last.x - u.x, last.y - u.y) < 1e-6) return;
    out.push({ ...u, yard });
  };
  [...yardOut(from, first)].reverse().forEach(p => push(p, true));
  legs.forEach(leg => leg.pts.forEach(p => push(p, leg.yard)));
  yardOut(to, reached).forEach(p => push(p, true));
  return out.length > 1 ? out : null;
};

export interface Track {
  x: Float32Array; y: Float32Array;
  /** المسافة التراكمية حتى كل نقطة */
  s: Float32Array;
  /** السرعة المسموحة عند كل نقطة (وحدة/ثانية) بعد التسارع والتباطؤ */
  v: Float32Array;
  yard: Uint8Array;
  length: number;
  step: number;
}

export const TRACK = {
  /** خطوة إعادة التقسيم */
  step: 0.2,
  /** السرعة القصوى على الطريق المستقيم (وحدة/ثانية في عرض الرحلة) */
  vmax: 7.5,
  /** داخل ساحة محطة */
  vyard: 2.4,
  /** التسارع والتباطؤ الطوليان (وحدة/ث²) */
  accel: 1.5,
  decel: 2.1,
  /** التسارع الجانبي المسموح في المنعطفات */
  lateral: 2.6,
};

/** مسار بخطوات متساوية مع تنعيم خفيف للزوايا، وملف السرعة عليه */
export const buildTrack = (route: RoutePoint[], cfg = TRACK): Track => {
  // إعادة تقسيم بخطوات متساوية
  const rx: number[] = [], ry: number[] = [], ryard: number[] = [];
  rx.push(route[0].x); ry.push(route[0].y); ryard.push(route[0].yard ? 1 : 0);
  let carry = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    let t = cfg.step - carry;
    while (t <= d) {
      const k = t / d;
      rx.push(a.x + (b.x - a.x) * k); ry.push(a.y + (b.y - a.y) * k); ryard.push(b.yard ? 1 : 0);
      t += cfg.step;
    }
    carry = d - (t - cfg.step);
  }
  const last = route[route.length - 1];
  if (Math.hypot(last.x - rx[rx.length - 1], last.y - ry[ry.length - 1]) > cfg.step * 0.3) { rx.push(last.x); ry.push(last.y); ryard.push(last.yard ? 1 : 0); }
  const n = rx.length;
  // تنعيم (متوسط متحرك) مع تثبيت الطرفين
  const sm = (arr: number[]) => arr.map((v, i) => {
    if (i < 2 || i > n - 3) return v;
    let s = 0; for (let j = -2; j <= 2; j++) s += arr[i + j];
    return s / 5;
  });
  const x = Float32Array.from(sm(sm(rx))), y = Float32Array.from(sm(sm(ry)));
  const s = new Float32Array(n);
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
  // الانحناء من تغيّر الاتجاه على نافذة ±4 نقاط
  const lim = new Float32Array(n);
  const W = 4;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - W), b = Math.min(n - 1, i + W), m = i;
    const h1 = Math.atan2(y[m] - y[a], x[m] - x[a]), h2 = Math.atan2(y[b] - y[m], x[b] - x[m]);
    let dh = Math.abs(h2 - h1); if (dh > Math.PI) dh = 2 * Math.PI - dh;
    const ds = Math.max(1e-3, s[b] - s[a]);
    const kappa = a === m || b === m ? 0 : dh / (ds / 2);
    const vc = kappa > 1e-4 ? Math.sqrt(cfg.lateral / kappa) : Infinity;
    lim[i] = Math.min(ryard[i] ? cfg.vyard : cfg.vmax, vc);
  }
  // تمريرة أمامية (تسارع من التوقف) وخلفية (تباطؤ حتى التوقف عند الوجهة)
  const v = new Float32Array(n);
  v[0] = 0;
  for (let i = 1; i < n; i++) v[i] = Math.min(lim[i], Math.sqrt(v[i - 1] ** 2 + 2 * cfg.accel * (s[i] - s[i - 1])));
  v[n - 1] = 0;
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * cfg.decel * (s[i + 1] - s[i])));
  return { x, y, s, v, yard: Uint8Array.from(ryard), length: s[n - 1], step: cfg.step };
};

const indexAt = (t: Track, dist: number) => {
  const n = t.s.length;
  if (dist <= 0) return 0;
  if (dist >= t.length) return n - 2;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t.s[mid] <= dist) lo = mid; else hi = mid; }
  return lo;
};

export interface TrackPose { x: number; y: number; heading: number; speed: number; yard: boolean }

/**
 * الموضع والاتجاه عند مسافة dist: الاتجاه من نافذة ±look (يمنع الاهتزاز)، والمركبة على المسار الأيمن من الشارع (lane).
 * heading بزاوية الشاشة (y للأسفل).
 */
export const poseAt = (t: Track, dist: number, lane = 0, look = 0.9): TrackPose => {
  const d = Math.max(0, Math.min(t.length, dist));
  const i = indexAt(t, d);
  const seg = Math.max(1e-6, t.s[i + 1] - t.s[i]);
  const k = (d - t.s[i]) / seg;
  const px = t.x[i] + (t.x[i + 1] - t.x[i]) * k, py = t.y[i] + (t.y[i + 1] - t.y[i]) * k;
  const a = indexAt(t, d - look), b = Math.min(t.s.length - 1, indexAt(t, d + look) + 1);
  const hx = t.x[b] - t.x[a], hy = t.y[b] - t.y[a];
  const hl = Math.hypot(hx, hy) || 1;
  const tx = hx / hl, ty = hy / hl;
  const yard = !!t.yard[i];
  const off = yard ? 0 : lane;
  return { x: px - ty * off, y: py + tx * off, heading: Math.atan2(ty, tx), speed: t.v[i] + (t.v[i + 1] - t.v[i]) * k, yard };
};

/** loading = عند محطة الانطلاق قبل التحرك (تفريق صهاريج نفس المحطة)، moving، arrived = عند الوجهة */
/** زمن قطع المسار بملف السرعة (ثوانٍ تراكمية)؛ أدنى سرعة vfloor حتى لا يكون الزمن لانهائيًا عند التوقف */
export const timeTrack = (t: Track, vfloor = 0.35) => {
  const n = t.s.length, tc = new Float32Array(n);
  for (let i = 1; i < n; i++) tc[i] = tc[i - 1] + (t.s[i] - t.s[i - 1]) / Math.max(vfloor, (t.v[i] + t.v[i - 1]) / 2);
  return tc;
};

/** المسافة على المسار بعد زمن tau من الانطلاق (عكس timeTrack) */
export const distAtTime = (t: Track, tc: Float32Array, tau: number) => {
  const n = tc.length, T = tc[n - 1];
  if (tau <= 0) return 0;
  if (tau >= T) return t.length;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tc[mid] <= tau) lo = mid; else hi = mid; }
  const k = (tau - tc[lo]) / Math.max(1e-9, tc[hi] - tc[lo]);
  return t.s[lo] + (t.s[hi] - t.s[lo]) * k;
};

/**
 * جدول رحلة صهريج بالوقت الحقيقي: الانطلاق (الموافقة + ترتيبه في القافلة)، ومدة القيادة (مدة الوصول)، ومدة التفريغ.
 * لا توجد بيانات GPS: الموقع تقديري من هذا الجدول.
 */
export interface TripPlan { start: number; driveMs: number; queueMs: number; unloadMs: number }
/** waiting = لم ينطلق بعد، driving، queued = وصل وينتظر دوره عند نقطة التفريغ، unloading، unloaded */
export type TripPhase = 'waiting' | 'driving' | 'queued' | 'unloading' | 'unloaded';
export interface TripMoment { phase: TripPhase; drive: number; unload: number; msLeft: number }

/** معدل تفريغ تقديري (لتر/دقيقة) وفاصل الانطلاق بين صهاريج القافلة ومدة افتراضية حين لا تُحدد مدة الوصول */
export const UNLOAD_LPM = 1000;
export const CONVOY_GAP_MIN = 2;
export const DEFAULT_ETA_MIN = 60;

/**
 * صهاريج القافلة تنطلق بفاصل، وتفرغ واحدًا بعد الآخر عند نقطة التفريغ: الصهريج k يبدأ التفريغ
 * بعد وصوله وبعد انتهاء من قبله، فينتظر دوره (queueMs) إذا كان التفريغ أطول من فاصل الانطلاق.
 */
export const queuedPlan = (start0: number, gapMs: number, driveMs: number, unloadMs: number, k: number): TripPlan => ({
  start: start0 + k * gapMs,
  driveMs,
  queueMs: k * Math.max(0, unloadMs - gapMs),
  unloadMs,
});

export const planTrip = (approvedAt: number, etaMin: number, qtyEach: number, index: number): TripPlan =>
  queuedPlan(approvedAt, CONVOY_GAP_MIN * 60000, Math.max(1, etaMin) * 60000, Math.max(60000, (qtyEach / UNLOAD_LPM) * 60000), index);

export const tripAt = (p: TripPlan, now: number): TripMoment => {
  const e = now - p.start;
  if (e < 0) return { phase: 'waiting', drive: 0, unload: 0, msLeft: -e };
  if (e < p.driveMs) return { phase: 'driving', drive: e / p.driveMs, unload: 0, msLeft: p.driveMs - e };
  const q = e - p.driveMs;
  if (q < p.queueMs) return { phase: 'queued', drive: 1, unload: 0, msLeft: p.queueMs - q };
  const u = q - p.queueMs;
  if (u < p.unloadMs) return { phase: 'unloading', drive: 1, unload: u / p.unloadMs, msLeft: p.unloadMs - u };
  return { phase: 'unloaded', drive: 1, unload: 1, msLeft: 0 };
};

