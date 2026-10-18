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
  const out: RoutePoint[] = [];
  legs.forEach(leg => leg.pts.forEach((p, i) => { if (out.length && i === 0) return; out.push({ ...toU(p), yard: leg.yard }); }));
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
  /** السرعة القصوى على الطريق المستقيم (وحدة/ثانية) */
  vmax: 4.2,
  /** داخل ساحة محطة */
  vyard: 1.3,
  /** التسارع والتباطؤ الطوليان (وحدة/ث²) */
  accel: 1.1,
  decel: 1.6,
  /** التسارع الجانبي المسموح في المنعطفات */
  lateral: 2.2,
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
export type SimPhase = 'loading' | 'moving' | 'arrived';
export interface SimState { dist: number; phase: SimPhase; dwell: number; speed: number }

/** زمن الانتظار عند الوجهة قبل إعادة المحاكاة من البداية */
export const ARRIVE_DWELL = 4;
/** أدنى سرعة تقدّم حتى لا تتوقف المركبة قبل خط الوصول (ملف السرعة صفر عند الطرفين) */
const CREEP = 0.18;

/** خطوة محاكاة: يتقدم الصهريج بسرعة ملف المسار × المضاعف، ويقف عند الوصول ثم يعيد الرحلة */
export const stepSim = (st: SimState, t: Track, dt: number, mult = 1): SimState => {
  if (st.phase === 'loading') {
    const dwell = st.dwell - dt;
    return dwell > 0 ? { ...st, dwell, speed: 0 } : { dist: st.dist, phase: 'moving', dwell: 0, speed: 0 };
  }
  if (st.phase === 'arrived') {
    const dwell = st.dwell - dt;
    return dwell > 0 ? { ...st, dwell, speed: 0 } : { dist: 0, phase: 'moving', dwell: 0, speed: 0 };
  }
  // سرعة ناعمة: تقترب من سرعة الملف (لا قفزات عند تغيّر الحد)
  const target = Math.max(CREEP, poseAt(t, st.dist).speed) * mult;
  const speed = st.speed + (target - st.speed) * Math.min(1, dt * 3);
  const dist = st.dist + Math.max(CREEP * mult, speed) * dt;
  if (dist >= t.length) return { dist: t.length, phase: 'arrived', dwell: ARRIVE_DWELL, speed: 0 };
  return { dist, phase: 'moving', dwell: 0, speed };
};
