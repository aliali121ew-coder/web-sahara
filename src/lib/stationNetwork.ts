/**
 * شبكة طرق محطات مركز التوزيع حسب رسمة الإدارة: شارع رئيسي بفروع قصيرة تنتهي كل منها بمحطة،
 * فلا يمر الصهريج بأي محطة إلا وجهته. الإحداثيات «وحدات أرض» (= وحدات المشهد ÷ 10)، وتُدوَّر زوايا الطرق بانسيابية.
 * داخل كل ساحة: حارة من مدخلها إلى موقف التفريغ عند مستودع الخزانات، بحيث يصل طرف خرطوم الصهريج إلى وصلة الخزانات.
 * لا يعتمد على three حتى تُختبر الحسابات.
 */

export type RoadPt = [number, number];
export interface RoadEdge { a: string; b: string; pts: RoadPt[]; yard?: boolean }
/** ساحة المحطة: الموقف عند وصلة الخزانات، والطريق إليه من كل مدخل */
export interface Yard { park: RoadPt; pre?: RoadPt; from: Record<string, RoadPt[]> }
export interface RoadNet { nodes: Record<string, RoadPt>; edges: RoadEdge[]; yards: Record<string, Yard>; entries: Record<string, string[]> }

/** وحدة المشهد لكل متر (صهريج 16.5 م = 84 وحدة) ووحدة أرض ← مشهد */
export const M = 5.1;
export const WORLD_S = 10;
export const toWorld = (x: number, y: number): [number, number] => [x * WORLD_S, y * WORLD_S];

/** طرف خرطوم الصهريج بالأمتار نسبة لمركزه (للأمام x، ولليمين z) — يطابق نموذج الصهريج */
export const HOSE_TIP_M = { x: -1.17, z: 4.09 };

/** مستودع الخزانات خلف المحطة (إحداثيات المحطة المحلية بوحدات المشهد): يُستعمل في النموذج وفي حساب الموقف */
export const depotLayout = (depot: number) => {
  const big = depot > 2;
  const r = (big ? 2.9 : 2.3) * M, th = (big ? 9.5 : 7.5) * M;
  const dx = big ? 2 * M : 6 * M, dz = big ? -26 * M : -22 * M;
  const cols = depot > 2 ? 2 : depot, rows = Math.ceil(depot / cols);
  const gap = r * 2 + 3 * M;
  const bw = cols * gap + 2 * M, bd = rows * gap + 2 * M;
  const manX = dx, manZ = dz + bd / 2 - 1.2 * M;
  return { big, r, th, dx, dz, cols, rows, gap, bw, bd, manX, manZ, fx: manX, fz: manZ + 2.6 * M };
};

export interface StationColors { main: number; accent: number; shop: number }
export interface SitePlan {
  /** مركز الساحة (وحدات المشهد) ودورانها حول المحور الرأسي */
  x: number; z: number; angle: number;
  /** أبعاد الساحة (وحدات المشهد) */
  w: number; d: number;
  depot: number;
  colors: StationColors;
  /** جهة حارة الصهاريج داخل الساحة: 1 غربها (وتقف متجهة شرقًا)، -1 شرقها (متجهة غربًا) */
  hand: 1 | -1;
  /** جهة الخرطوم من الصهريج نحو الوصلة: -1 يساره، 1 يمينه */
  hoseSide: 1 | -1;
  /** مدخل الساحة (وحدات المشهد) واتجاه الدخول */
  entry: [number, number];
}

/** إزاحة المحطة داخل ساحتها (وحدات المشهد على المحور المحلي z) */
export const STATION_OFFSET_Z = 10;
const PAD_W = 420;

// ---------------- رسمة الإدارة (بكسل) ← وحدات أرض ----------------
const P = (x: number, y: number): RoadPt => [(x - 400) * 1.0, (y - 225) * 1.0];
const NODES: Record<string, RoadPt> = {
  A: P(228, 12), N1: P(228, 125), N2: P(348, 160), N3: P(348, 203),
  Uc: P(568, 203), U: P(568, 147), N4: P(348, 305), Bw: P(385, 305),
  N5: P(348, 340), N6: P(500, 382), N7: P(500, 355), Ts: P(540, 355),
  N8: P(500, 445), N9: P(348, 445), N10: P(468, 445), Byc: P(468, 405), By: P(436, 405), T: P(530, 445),
};
/** الطرق: كل حافة من عقدة إلى عقدة عبر نقاط وسيطة (تُدوَّر زواياها لاحقًا) */
const EDGES: [string, string, string[]][] = [
  ['A', 'N2', ['N1']], ['N2', 'N3', []], ['N3', 'U', ['Uc']], ['N3', 'N4', []], ['N4', 'Bw', []],
  ['N4', 'N5', []], ['N5', 'N6', []], ['N6', 'N7', []], ['N7', 'Ts', []], ['N6', 'N8', []],
  ['N5', 'N9', []], ['N9', 'N10', []], ['N10', 'N8', []], ['N8', 'T', []], ['N10', 'By', ['Byc']],
];
/** المحطة عند نهاية كل فرع: العقدة، والألوان، وعدد الخزانات، وجهة الحارة */
const SITES: Record<string, { node: string; from: string; colors: StationColors; depot: number; hand: 1 | -1; d: number }> = {
  الاجداد: { node: 'A', from: 'N1', colors: { main: 0xd32f2f, accent: 0xf8fafc, shop: 0xeef0f2 }, depot: 2, hand: 1, d: 290 },
  'امهات البياض': { node: 'U', from: 'Uc', colors: { main: 0x1f2937, accent: 0xdc2626, shop: 0x374151 }, depot: 2, hand: 1, d: 290 },
  البوادي: { node: 'Bw', from: 'N4', colors: { main: 0xc2410c, accent: 0xfbbf24, shop: 0xeef0f2 }, depot: 2, hand: -1, d: 290 },
  التسمين: { node: 'Ts', from: 'N7', colors: { main: 0x1d4ed8, accent: 0xfacc15, shop: 0xeef0f2 }, depot: 2, hand: 1, d: 290 },
  البياض: { node: 'By', from: 'Byc', colors: { main: 0xeab308, accent: 0xdc2626, shop: 0xeef0f2 }, depot: 2, hand: 1, d: 290 },
  الطاقة: { node: 'T', from: 'N10', colors: { main: 0xdc2626, accent: 0xfacc15, shop: 0xf8fafc }, depot: 4, hand: 1, d: 370 },
};

/** تدوير زوايا خط متعدد بأقواس (نصف القطر بوحدات أرض) ثم تقسيمه بخطوات متقاربة */
export const roundCorners = (pts: RoadPt[], radius: number, step = 0.8): RoadPt[] => {
  if (pts.length < 3) return densify(pts, step);
  const out: RoadPt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [p0, p1, p2] = [pts[i - 1], pts[i], pts[i + 1]];
    const d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const r = Math.min(radius, d1 * 0.45, d2 * 0.45);
    const a: RoadPt = [p1[0] + ((p0[0] - p1[0]) / d1) * r, p1[1] + ((p0[1] - p1[1]) / d1) * r];
    const b: RoadPt = [p1[0] + ((p2[0] - p1[0]) / d2) * r, p1[1] + ((p2[1] - p1[1]) / d2) * r];
    out.push(a);
    for (let k = 1; k < 8; k++) {
      const t = k / 8, u = 1 - t;
      out.push([u * u * a[0] + 2 * u * t * p1[0] + t * t * b[0], u * u * a[1] + 2 * u * t * p1[1] + t * t * b[1]]);
    }
    out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return densify(out, step);
};
const densify = (pts: RoadPt[], step: number): RoadPt[] => {
  const out: RoadPt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
};

/** محلي الساحة (وحدات المشهد) ← وحدات أرض */
export const padToGround = (s: SitePlan, x: number, z: number): RoadPt => {
  const c = Math.cos(s.angle), sn = Math.sin(s.angle);
  return [(s.x + x * c + z * sn) / WORLD_S, (s.z - x * sn + z * c) / WORLD_S];
};

const buildPlans = () => {
  const plans: Record<string, SitePlan> = {};
  Object.entries(SITES).forEach(([name, s]) => {
    const end = NODES[s.node], prev = NODES[s.from];
    const len = Math.hypot(end[0] - prev[0], end[1] - prev[1]);
    const dir = [(end[0] - prev[0]) / len, (end[1] - prev[1]) / len];
    // واجهة الساحة (محليًا +z) نحو الطريق: عكس اتجاه الدخول
    const angle = Math.atan2(-dir[0], -dir[1]);
    const ex = s.hand === 1 ? -140 : 170, ez = s.d / 2;
    const c = Math.cos(angle), sn = Math.sin(angle);
    const [wx, wz] = toWorld(end[0], end[1]);
    plans[name] = {
      x: wx - (ex * c + ez * sn), z: wz - (-ex * sn + ez * c), angle,
      w: PAD_W, d: s.d, depot: s.depot, colors: s.colors, hand: s.hand,
      hoseSide: s.hand === 1 ? -1 : 1, entry: [wx, wz],
    };
  });
  return plans;
};
export const SITE_PLANS = buildPlans();
export const SITE_NAMES = Object.keys(SITES);

/** موقف التفريغ داخل الساحة (محليًا، وحدات المشهد): طرف الخرطوم يصل إلى وصلة المستودع */
export const parkLocal = (s: SitePlan): [number, number] => {
  const L = depotLayout(s.depot);
  const tipX = HOSE_TIP_M.x * M, tipZ = HOSE_TIP_M.z * M;
  const fz = L.fz + STATION_OFFSET_Z;
  // متجه شرقًا (+x) والخرطوم يساره (-z)، أو غربًا (-x) والخرطوم يمينه (-z)
  return s.hand === 1 ? [L.fx - tipX, fz + tipZ] : [L.fx + tipX, fz + tipZ];
};

const buildNet = (): RoadNet => {
  const edges: RoadEdge[] = EDGES.map(([a, b, via]) => ({ a, b, pts: roundCorners([NODES[a], ...via.map(v => NODES[v]), NODES[b]], 16) }));
  const yards: Record<string, Yard> = {};
  const entries: Record<string, string[]> = {};
  Object.entries(SITES).forEach(([name, s]) => {
    const plan = SITE_PLANS[name];
    const [px, pz] = parkLocal(plan);
    const h = plan.hand, lx = h === 1 ? -140 : 170, top = plan.d / 2;
    // من المدخل: على طول الحارة ثم انعطاف هادئ نحو الموقف موازيًا للمستودع
    const local: [number, number][] = [[lx, top - 60], [lx, pz + 55], [lx + h * 25, pz + 14], [lx + h * 70, pz], [px - h * 40, pz]];
    yards[name] = { park: padToGround(plan, px, pz), from: { [s.node]: local.map(([x, z]) => padToGround(plan, x, z)) } };
    entries[name] = [s.node];
  });
  return { nodes: { ...NODES }, edges, yards, entries };
};
export const NET = buildNet();
