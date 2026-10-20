import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { NET, SITE_NAMES, SITE_PLANS, STATION_OFFSET_Z, WORLD_S, type SitePlan } from '../../lib/stationNetwork';
import { createDesert, type Desert } from './desertGround';
import { createDesertShrub, createSmallTree, createStation, type StationModel } from './stationModel';
import { TANKER_LEN, createTanker } from './tankerModel';

/**
 * مشهد محطات مركز التوزيع ثلاثي الأبعاد (سياق WebGL واحد طوال عمر الخريطة):
 * صحراء بكثبان وشجيرات وحصى، وشبكة الطرق حسب رسمة الإدارة بأسفلت وخطوط وأكتاف وأعمدة إنارة،
 * والمحطات الست كنماذج حقيقية (مظلة باسم بارز، مضخات، مبنى الإدارة، لوحة المنتجات، مستودع خزانات) في نهاية فروعها،
 * بساحات برصيف متصل وأشجار صغيرة، وشمس بظلال تتبع الكاميرا نهارًا، وقمر وإنارة تنعكس على الطريق ليلًا؛
 * والصهاريج تسير على الشبكة وتقف عند وصلة الخزانات وتوصل خرطومها. الكاميرا: سحب وتكبير وتدوير وتتبّع.
 */

/** طول الصهريج بوحدات الأرض (84 وحدة مشهد = 16.5 م) */
export const TRUCK_LEN = 8.4;
const TRUCK_WORLD = TRUCK_LEN * WORLD_S;
/** نصف قطر العجلة بوحدات النموذج بعد تصغيره */
const WHEEL_R = (0.52 * TANKER_LEN) / 16.5;
const DUST_MAX = 260;
const PAD_Y = 1.6;

export interface TruckState {
  /** الموضع بوحدات الأرض والاتجاه (راديان، y نحو الجنوب) */
  x: number; y: number; heading: number;
  /** المسافة المقطوعة منذ الإطار السابق (وحدات أرض) */
  travel: number;
  /** داخل ساحة محطة (فوق بلاطتها) */
  yard: boolean;
  brake: boolean;
  signal: -1 | 0 | 1;
  unloading: boolean;
  hoseSide: 1 | -1;
  roll: number; pitch: number;
  dust: number;
}

interface CamState { tx: number; tz: number; dist: number; az: number; el: number }
interface Lights { brake?: THREE.MeshStandardMaterial; signalL?: THREE.MeshStandardMaterial; signalR?: THREE.MeshStandardMaterial; beacon?: THREE.MeshStandardMaterial; hose?: THREE.Object3D }
interface Truck { pivot: THREE.Group; model: THREE.Group; wheels: THREE.Object3D[]; beams: THREE.Mesh; lights: Lights; y: number }
interface Dust { sprite: THREE.Sprite; x: number; y: number; z: number; vx: number; vz: number; age: number; life: number; size: number; alive: boolean }

let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

const canvasTex = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
};
const radial = (stops: [number, string][]) => canvasTex(128, 128, x => {
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, c]) => g.addColorStop(o, c));
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
});

const rounded = (w: number, d: number, r: number) => {
  const s = new THREE.Shape(), x0 = -w / 2, y0 = -d / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x0 + w, y0 + d - r); s.absarc(x0 + w - r, y0 + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y0 + d); s.absarc(x0 + r, y0 + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};

/** شريط على طول نقاط (مشهد) بعرض ثابت، v تراكمي لتكرار الخامة */
const ribbon = (pts: [number, number][], width: number, vPer: number, y: number) => {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let v = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const nx = -tz, nz = tx;
    if (i) v += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / vPer;
    pos.push(pts[i][0] + nx * width / 2, y, pts[i][1] + nz * width / 2, pts[i][0] - nx * width / 2, y, pts[i][1] - nz * width / 2);
    uv.push(0, v, 1, v);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};

/** محلي الساحة ← المشهد */
const padWorld = (s: SitePlan, x: number, z: number): [number, number] => {
  const c = Math.cos(s.angle), sn = Math.sin(s.angle);
  return [s.x + x * c + z * sn, s.z - x * sn + z * c];
};

export class StationsScene {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 10, 40000);
  private hemi = new THREE.HemisphereLight(0xfff1d6, 0x8a6a3a, 1.05);
  private sun = new THREE.DirectionalLight(0xfff4e0, 2.8);
  private moonLight = new THREE.DirectionalLight(0xb9c8ff, 0);
  private moon: THREE.Sprite;
  private stars: THREE.Points;
  private desert: Desert;
  private stations: StationModel[] = [];
  private roadMat!: THREE.MeshStandardMaterial;
  private lampHeads: THREE.MeshStandardMaterial[] = [];
  private pools: THREE.Mesh[] = [];
  private trucks = new Map<string, Truck>();
  private dust: Dust[] = [];
  private emitCarry = new Map<string, number>();
  private pads: THREE.Mesh[] = [];
  private disposables: { dispose: () => void }[] = [];
  private w = 1; private h = 1;
  private night = false;
  private clock = 0;
  private beamTex: THREE.Texture;
  private dustTex: THREE.Texture;
  private shadowTex: THREE.Texture;
  private envRT: THREE.WebGLRenderTarget;
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private bounds = { x0: 0, x1: 0, z0: 0, z1: 0 };
  /** مواضع بطاقات المحطات (أمام ساحاتها) */
  readonly anchors = new Map<string, THREE.Vector3>();
  cam: CamState = { tx: 0, tz: 0, dist: 4000, az: 0, el: 0.78 };
  goal: CamState | null = null;
  home: CamState = { tx: 0, tz: 0, dist: 4000, az: 0, el: 0.78 };

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    host.appendChild(this.canvas);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    this.beamTex = canvasTex(128, 64, x => {
      const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,244,200,.85)'); g.addColorStop(1, 'rgba(255,244,200,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(0, 26); x.lineTo(128, 0); x.lineTo(128, 64); x.lineTo(0, 38); x.closePath(); x.fill();
    });
    this.dustTex = radial([[0, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']]);
    this.shadowTex = radial([[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]);
    this.disposables.push(this.beamTex, this.dustTex, this.shadowTex);

    // الشمس بظلال تتبع منطقة الكاميرا (دقة جيدة على خريطة كبيرة)
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.8;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.moonLight, this.moonLight.target);

    // حدود الخريطة
    const xs = SITE_NAMES.map(n => SITE_PLANS[n].x), zs = SITE_NAMES.map(n => SITE_PLANS[n].z);
    const pad = 420;
    this.bounds = { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, z0: Math.min(...zs) - pad, z1: Math.max(...zs) + pad };

    // تسطيح الأرض تحت الطرق والساحات: شبكة شبكية لنقاط الطرق لتسريع البحث
    const roadPts: [number, number][] = [];
    NET.edges.forEach(e => { if (!e.yard) e.pts.forEach(p => roadPts.push([p[0] * WORLD_S, p[1] * WORLD_S])); });
    const CELL = 200, grid = new Map<string, [number, number][]>();
    roadPts.forEach(p => { const k = `${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(p); });
    const roadDist = (x: number, z: number) => {
      let d = Infinity; const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of grid.get(`${cx + i},${cz + j}`) ?? []) { const dd = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (dd < d) d = dd; }
      return Math.sqrt(d);
    };
    const padDist = (x: number, z: number) => Math.min(...SITE_NAMES.map(n => {
      const s = SITE_PLANS[n], dx = x - s.x, dz = z - s.z, c = Math.cos(-s.angle), sn = Math.sin(-s.angle);
      const lx = dx * c + dz * sn, lz = -dx * sn + dz * c;
      return Math.hypot(Math.max(0, Math.abs(lx) - s.w / 2), Math.max(0, Math.abs(lz) - s.d / 2));
    }));
    const flat = (x: number, z: number) => {
      const d = Math.min(padDist(x, z) - 30, roadDist(x, z) - 45);
      return d <= 0 ? 1 : d < 80 ? 1 - d / 80 : 0;
    };
    const span = Math.max(this.bounds.x1 - this.bounds.x0, this.bounds.z1 - this.bounds.z0);
    // الأرض تُبنى حول أصلها ثم تُزاح إلى مركز الخريطة: دالة التسطيح تستقبل إحداثياتها المحلية
    const ox = (this.bounds.x0 + this.bounds.x1) / 2, oz = (this.bounds.z0 + this.bounds.z1) / 2;
    this.desert = createDesert({ size: span * 3.2, segments: 320, height: 30, flat: (x, z) => flat(x + ox, z + oz), shrubs: 4200 });
    this.desert.group.position.set(ox, 0, oz);
    this.scene.add(this.desert.group);
    this.disposables.push(this.desert);

    this.buildRoads(roadDist, padDist);
    SITE_NAMES.forEach(n => this.buildSite(n, SITE_PLANS[n], roadDist));
    this.stars = this.buildStars();
    this.moon = this.buildMoon();

    for (let i = 0; i < DUST_MAX; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dustTex, transparent: true, depthWrite: false, color: 0xd8b27a, opacity: 0 }));
      sprite.visible = false;
      this.scene.add(sprite);
      this.dust.push({ sprite, x: 0, y: 0, z: 0, vx: 0, vz: 0, age: 0, life: 1, size: 1, alive: false });
    }
    this.setNight(false);
  }

  // ---------------- البناء ----------------

  private buildRoads(roadDist: (x: number, z: number) => number, padDist: (x: number, z: number) => number) {
    const asphalt = canvasTex(128, 512, x => {
      x.fillStyle = '#3b3d41'; x.fillRect(0, 0, 128, 512);
      for (let i = 0; i < 2500; i++) { const v = 45 + Math.random() * 30; x.fillStyle = `rgb(${v},${v + 1},${v + 4})`; x.fillRect(Math.random() * 128, Math.random() * 512, 1.5, 1.5); }
      x.fillStyle = '#e7e2d6'; x.fillRect(6, 0, 4, 512); x.fillRect(118, 0, 4, 512);
      x.fillStyle = '#f2c230'; x.fillRect(62, 0, 4, 300);
    });
    asphalt.wrapT = THREE.RepeatWrapping;
    this.disposables.push(asphalt);
    this.roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2 });
    const shoulder = new THREE.MeshStandardMaterial({ color: 0xa88458, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
    this.disposables.push(this.roadMat, shoulder);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.4, metalness: 0.7 });
    const poolTex = radial([[0, 'rgba(255,214,150,.75)'], [0.5, 'rgba(255,190,120,.3)'], [1, 'rgba(255,190,120,0)']]);
    this.disposables.push(poleMat, poolTex);
    NET.edges.forEach(e => {
      if (e.yard) return;
      const pts = e.pts.map(p => [p[0] * WORLD_S, p[1] * WORLD_S] as [number, number]);
      const sh = new THREE.Mesh(ribbon(pts, 82, 1, 0.25), shoulder); sh.receiveShadow = true; this.scene.add(sh); this.disposables.push(sh.geometry);
      const rd = new THREE.Mesh(ribbon(pts, 64, 60, 0.35), this.roadMat); rd.receiveShadow = true; this.scene.add(rd); this.disposables.push(rd.geometry);
      // أعمدة إنارة متباعدة بالتناوب على جانبي الطريق (بعيدًا عن الساحات)
      let acc = 140, side = 1;
      for (let i = 1; i < pts.length; i++) {
        acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (acc < 320) continue;
        acc = 0; side = -side;
        const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = (-(b[1] - a[1]) / l) * side, nz = ((b[0] - a[0]) / l) * side;
        const bx = b[0] + nx * 48, bz = b[1] + nz * 48;
        if (padDist(bx, bz) < 60 || roadDist(bx, bz) < 40) continue;
        this.lamp(bx, bz, -nx, -nz, poleMat, poolTex);
      }
    });
  }

  private lamp(x: number, z: number, dx: number, dz: number, poleMat: THREE.Material, poolTex: THREE.Texture) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 52, 8), poleMat); pole.position.set(x, 26, z); pole.castShadow = true; this.scene.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 16), poleMat); arm.position.set(x + dx * 8, 52, z + dz * 8); arm.lookAt(x + dx * 20, 52, z + dz * 20); this.scene.add(arm);
    const hm = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, emissive: 0xffd9a0, emissiveIntensity: 0 }); this.lampHeads.push(hm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 3), hm); head.position.set(x + dx * 15, 51, z + dz * 15); head.lookAt(x + dx * 30, 51, z + dz * 30); this.scene.add(head);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x + dx * 26, 0.6, z + dz * 26); pool.visible = false; this.pools.push(pool); this.scene.add(pool);
    this.disposables.push(pole.geometry, arm.geometry, head.geometry, hm, pool.geometry, pool.material as THREE.Material);
  }

  private buildSite(name: string, s: SitePlan, roadDist: (x: number, z: number) => number) {
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = s.angle; this.scene.add(g);
    const conc = canvasTex(512, 512, x => {
      x.fillStyle = '#62676c'; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 9000; i++) { const v = 82 + Math.random() * 35; x.fillStyle = `rgb(${v},${v + 3},${v + 7})`; x.fillRect(Math.random() * 512, Math.random() * 512, 1.4, 1.4); }
      x.strokeStyle = 'rgba(60,62,66,.55)'; x.lineWidth = 2;
      for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 512); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(512, i * 64); x.stroke(); }
    });
    conc.wrapS = conc.wrapT = THREE.RepeatWrapping; conc.repeat.set(1 / 120, 1 / 120);
    this.disposables.push(conc);
    const add = (m: THREE.Mesh) => { m.receiveShadow = true; g.add(m); this.disposables.push(m.geometry, m.material as THREE.Material); return m; };
    const rim = add(new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(s.w + 34, s.d + 34, 56), { depth: 1, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xcfa874, roughness: 1 })));
    rim.rotation.x = -Math.PI / 2;
    const pad = add(new THREE.Mesh(new THREE.ExtrudeGeometry(rounded(s.w, s.d, 40), { depth: PAD_Y, bevelEnabled: false }), new THREE.MeshStandardMaterial({ map: conc, roughness: 0.85 })));
    pad.rotation.x = -Math.PI / 2;
    pad.userData.site = name;
    this.pads.push(pad);

    // رصيف متصل حول الساحة بفتحة للمدخل، وطرفاه ينعطفان بانسيابية مع حافتي المدخل
    const ex = s.hand === 1 ? -140 : 170, entry = new THREE.Vector3(ex, 0, s.d / 2);
    const outline = rounded(s.w, s.d, 40).getSpacedPoints(440).map(v => new THREE.Vector3(v.x, 0, -v.y));
    const isGap = (v: THREE.Vector3) => v.distanceTo(entry) < 34;
    let start = outline.findIndex(isGap);
    while (start > 0 && isGap(outline[start - 1])) start--;
    const run = [...outline.slice(start), ...outline.slice(0, start)].filter(v => !isGap(v));
    const ret = (end: THREE.Vector3, dir: THREE.Vector3) => Array.from({ length: 8 }, (_, k) => {
      const a = ((k + 1) / 8) * (Math.PI / 2), R = 16;
      return end.clone().add(dir.clone().multiplyScalar(Math.sin(a) * R)).add(new THREE.Vector3(0, 0, (1 - Math.cos(a)) * R));
    });
    const f = run[0], l = run[run.length - 1];
    g.add(this.curb([...ret(f, f.clone().sub(run[1]).normalize()).reverse(), ...run, ...ret(l, l.clone().sub(run[run.length - 2]).normalize())]));

    // أشجار صغيرة وشجيرات خارج الرصيف بمسافة، بعيدًا عن المدخل والطرق
    outline.forEach((pt, i) => {
      if (i % 22) return;
      const w = pt.clone().add(pt.clone().normalize().multiplyScalar(30));
      const [wx, wz] = padWorld(s, w.x, w.z);
      if (roadDist(wx, wz) < 70 || w.distanceTo(entry) < 80) return;
      const o = (i / 22) % 2 === 0 ? createSmallTree(undefined, i + name.length) : createDesertShrub(undefined, i + name.length);
      o.position.copy(w); g.add(o);
    });

    const st = createStation(name, s.colors, s.depot, undefined, s.hand);
    st.group.position.set(0, PAD_Y, STATION_OFFSET_Z);
    st.group.traverse(o => { if (o instanceof THREE.Mesh && !(o.material as THREE.Material).transparent) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(st.group);
    this.stations.push(st);
    this.disposables.push(st);
    const [ax, az] = padWorld(s, 0, s.d / 2 + 34);
    this.anchors.set(name, new THREE.Vector3(ax, 2, az));
  }

  /** رصيف أصفر وأسود متصل على مسار نقاط */
  private curbMat: THREE.MeshStandardMaterial | null = null;
  private curb(pts: THREE.Vector3[]) {
    if (!this.curbMat) {
      const t = canvasTex(64, 16, x => { x.fillStyle = '#e9bf2a'; x.fillRect(0, 0, 32, 16); x.fillStyle = '#1f2328'; x.fillRect(32, 0, 32, 16); });
      t.wrapS = THREE.RepeatWrapping;
      this.curbMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
      this.disposables.push(t, this.curbMat);
    }
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    let u = 0;
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const t = b.clone().sub(a).normalize(), n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(1.3);
      if (i) u += p.distanceTo(pts[i - 1]) / 9;
      const L = p.clone().add(n), R = p.clone().sub(n);
      pos.push(L.x, 0.5, L.z, L.x, 2.8, L.z, R.x, 2.8, R.z, R.x, 0.5, R.z);
      uv.push(u, 0, u, 0.5, u, 0.5, u, 1);
      if (i) { const o = (i - 1) * 4, c = i * 4; for (let k = 0; k < 3; k++) idx.push(o + k, c + k, o + k + 1, o + k + 1, c + k, c + k + 1); }
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    this.disposables.push(geo);
    const m = new THREE.Mesh(geo, this.curbMat); m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  private buildStars() {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, e = 0.12 + rand() * 1.3, r = 15000;
      pos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xdbeafe, size: 2, sizeAttenuation: false, fog: false });
    this.disposables.push(geo, m);
    const p = new THREE.Points(geo, m); this.scene.add(p);
    return p;
  }

  private buildMoon() {
    const t = canvasTex(256, 256, x => {
      const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(235,240,255,1)'); gr.addColorStop(0.32, 'rgba(225,232,250,1)'); gr.addColorStop(0.38, 'rgba(190,205,240,.35)'); gr.addColorStop(1, 'rgba(160,180,230,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
      x.fillStyle = 'rgba(170,180,205,.35)'; [[110, 105, 14], [150, 140, 10], [120, 150, 8]].forEach(([cx, cy, rr]) => { x.beginPath(); x.arc(cx, cy, rr, 0, Math.PI * 2); x.fill(); });
    });
    const m = new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false });
    this.disposables.push(t, m);
    const s = new THREE.Sprite(m); s.scale.set(1400, 1400, 1); this.scene.add(s);
    return s;
  }

  // ---------------- نهار / ليل ----------------

  setNight(night: boolean) {
    this.night = night;
    const sky = night ? 0x0b1226 : 0xdccfb6;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(sky, night ? 2600 : 3600, night ? 9000 : 12000);
    this.hemi.color.set(night ? 0x2a3658 : 0xfff1d6);
    this.hemi.groundColor.set(night ? 0x0e0b08 : 0x8a6a3a);
    this.hemi.intensity = night ? 0.22 : 1.05;
    this.scene.environmentIntensity = night ? 0.12 : 1;
    this.sun.intensity = night ? 0 : 2.8; this.sun.castShadow = !night;
    this.moonLight.intensity = night ? 0.55 : 0; this.moonLight.castShadow = night;
    this.moon.visible = night; this.stars.visible = night;
    this.renderer.toneMappingExposure = night ? 1 : 0.95;
    // الأسفلت ليلًا أنعم قليلًا فيعكس ضوء القمر والإنارة
    this.roadMat.roughness = night ? 0.42 : 0.92; this.roadMat.metalness = night ? 0.15 : 0;
    this.lampHeads.forEach(m => { m.emissiveIntensity = night ? 4 : 0; });
    this.pools.forEach(p => { p.visible = night; });
    this.desert.setNight(night);
    this.stations.forEach(st => { st.glow.forEach(([m, d, n]) => { m.emissiveIntensity = night ? n : d; }); st.lights.forEach(l => { l.intensity = night ? 2500 : 0; }); });
    this.trucks.forEach(t => { t.beams.visible = night; });
    this.dust.forEach(d => (d.sprite.material as THREE.SpriteMaterial).color.set(night ? 0x5f5040 : 0xd8b27a));
  }

  // ---------------- الكاميرا ----------------

  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.canvas.style.width = `${this.w}px`; this.canvas.style.height = `${this.h}px`;
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    const b = this.bounds;
    this.home = this.fit(b.x0 + 80, b.x1 - 80, b.z0 + 60, b.z1 + 60, 0, 0.78);
  }

  /** مسافة الكاميرا وهدفها ليظهر مستطيل الأرض كاملًا */
  fit(xa: number, xb: number, za: number, zb: number, az = this.cam.az, el = this.cam.el): CamState {
    const vf = (this.camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const w = xb - xa, d = zb - za;
    const dist = Math.max((w / 2) / Math.tan(hf / 2), (d * Math.sin(el) / 2 + 40) / Math.tan(vf / 2)) * 1.05 + d * Math.cos(el) * 0.15;
    return { tx: (xa + xb) / 2, tz: (za + zb) / 2 + d * 0.05, dist, az, el };
  }

  private clampCam(c: CamState): CamState {
    const b = this.bounds;
    return {
      tx: Math.max(b.x0, Math.min(b.x1, c.tx)), tz: Math.max(b.z0, Math.min(b.z1, c.tz)),
      dist: Math.max(140, Math.min(this.maxDist, c.dist)), az: c.az, el: Math.max(0.3, Math.min(1.42, c.el)),
    };
  }
  get maxDist() { return this.home.dist * 1.15; }
  private applyCam() {
    const { tx, tz, dist, az, el } = this.cam;
    this.camera.position.set(tx + Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, tz + Math.cos(az) * Math.cos(el) * dist);
    this.camera.lookAt(tx, 0, tz);
    // الشمس وظلالها حول منطقة النظر، والقمر في السماء أمام الكاميرا
    const half = Math.max(500, Math.min(3200, dist * 0.8));
    const sc = this.sun.shadow.camera;
    if (sc.right !== half) { Object.assign(sc, { left: -half, right: half, top: half, bottom: -half, near: 100, far: half * 4 + 3000 }); sc.updateProjectionMatrix(); Object.assign(this.moonLight.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 100, far: half * 4 + 3000 }); this.moonLight.shadow.camera.updateProjectionMatrix(); }
    this.sun.target.position.set(tx, 0, tz); this.sun.position.set(tx - 900, 1300, tz + 700);
    this.moonLight.target.position.set(tx, 0, tz); this.moonLight.position.set(tx + 1300, 900, tz - 2400);
    this.moon.position.set(tx - Math.sin(az) * 14000 + 4000, 4200, tz - Math.cos(az) * 14000);
  }
  /** سحب الخريطة بالبكسل */
  pan(dx: number, dy: number) {
    const k = (2 * this.cam.dist * Math.tan((this.camera.fov * Math.PI) / 360)) / this.h;
    const az = this.cam.az;
    const rx = Math.cos(az), rz = -Math.sin(az), fx = -Math.sin(az), fz = -Math.cos(az);
    const f = 1 / Math.max(0.35, Math.sin(this.cam.el));
    this.cam = this.clampCam({ ...this.cam, tx: this.cam.tx - rx * dx * k + fx * dy * k * f, tz: this.cam.tz - rz * dx * k + fz * dy * k * f });
    this.goal = null; this.applyCam();
  }
  groundAt(sx: number, sy: number) {
    this.raycaster.setFromCamera(new THREE.Vector2((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1), this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.groundPlane, p) ? p : null;
  }
  /** تكبير حول نقطة الشاشة */
  zoomAt(f: number, sx = this.w / 2, sy = this.h / 2) {
    const before = this.groundAt(sx, sy);
    this.cam = this.clampCam({ ...this.cam, dist: this.cam.dist / f });
    this.applyCam();
    const after = this.groundAt(sx, sy);
    if (before && after) { this.cam = this.clampCam({ ...this.cam, tx: this.cam.tx + before.x - after.x, tz: this.cam.tz + before.z - after.z }); this.applyCam(); }
    this.goal = null;
  }
  rotate(dAz: number, dEl = 0) {
    this.cam = this.clampCam({ ...this.cam, az: this.cam.az + dAz, el: this.cam.el + dEl });
    this.goal = null; this.applyCam();
  }
  setGoal(g: Partial<CamState>) { this.goal = this.clampCam({ ...(this.goal ?? this.cam), ...g }); }
  reset() { this.goal = { ...this.home }; }
  isZoomed() { return this.cam.dist < this.home.dist * 0.95 || Math.abs(this.cam.az) > 0.05; }
  /** هدف ومسافة لتظهر نقاط (وحدات أرض) كاملة */
  fitPoints(xs: ArrayLike<number>, ys: ArrayLike<number>) {
    let xa = Infinity, xb = -Infinity, za = Infinity, zb = -Infinity;
    for (let i = 0; i < xs.length; i++) { const x = xs[i] * WORLD_S, z = ys[i] * WORLD_S; xa = Math.min(xa, x); xb = Math.max(xb, x); za = Math.min(za, z); zb = Math.max(zb, z); }
    this.goal = this.clampCam(this.fit(xa - 200, xb + 200, za - 200, zb + 200));
  }
  /** نقطة مشهد ← الشاشة (null خلف الكاميرا) */
  project(v: THREE.Vector3): [number, number] | null {
    const p = v.clone().project(this.camera);
    if (p.z > 1) return null;
    return [((p.x + 1) / 2) * this.w, ((1 - p.y) / 2) * this.h];
  }
  worldOf(x: number, y: number, h = 0) { return new THREE.Vector3(x * WORLD_S, h, y * WORLD_S); }
  /** المحطة تحت نقطة الشاشة */
  pick(sx: number, sy: number): string | null {
    this.raycaster.setFromCamera(new THREE.Vector2((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1), this.camera);
    const hit = this.raycaster.intersectObjects(this.pads, false)[0];
    return (hit?.object.userData.site as string) ?? null;
  }

  // ---------------- الصهاريج ----------------

  sync(ids: string[]) {
    const keep = new Set(ids);
    this.trucks.forEach((t, id) => {
      if (keep.has(id)) return;
      this.scene.remove(t.pivot);
      t.pivot.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
      this.trucks.delete(id); this.emitCarry.delete(id);
    });
    ids.forEach(id => {
      if (this.trucks.has(id)) return;
      const pivot = new THREE.Group();
      const model = createTanker({ cab: 0x1d3557, polished: true });
      pivot.add(model);
      const flat = (tex: THREE.Texture, w: number, d: number, x: number, y: number, add = false) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, y, 0); pivot.add(m); return m;
      };
      flat(this.shadowTex, 4.4, 1.3, -0.1, 0.02);
      const beams = flat(this.beamTex, 3.4, 1.7, 3.7, 0.03, true);
      beams.visible = this.night;
      pivot.scale.setScalar(TRUCK_WORLD / TANKER_LEN);
      this.scene.add(pivot);
      const u = model.userData as Lights & { wheels?: THREE.Object3D[] };
      this.trucks.set(id, { pivot, model, wheels: u.wheels ?? [], beams, lights: u, y: 0.4 });
    });
  }

  private emitDust(id: string, s: TruckState, dt: number) {
    let carry = (this.emitCarry.get(id) ?? 0) + s.dust * 50 * dt;
    const cx = Math.cos(s.heading), cz = Math.sin(s.heading);
    const x = s.x * WORLD_S, z = s.y * WORLD_S;
    while (carry >= 1) {
      carry -= 1;
      const d = this.dust.find(p => !p.alive);
      if (!d) { carry = 0; break; }
      const side = (rand() - 0.5) * TRUCK_WORLD * 0.2, back = TRUCK_WORLD * (0.42 + rand() * 0.08);
      d.x = x - cx * back - cz * side; d.z = z - cz * back + cx * side; d.y = 2;
      d.vx = -cx * 6 + (rand() - 0.5) * 6; d.vz = -cz * 6 + (rand() - 0.5) * 6;
      d.age = 0; d.life = 1.3 + rand() * 1.2; d.size = TRUCK_WORLD * (0.12 + rand() * 0.08); d.alive = true;
    }
    this.emitCarry.set(id, carry);
  }

  /** خطوة: انتقال الكاميرا، والصهاريج وأضواؤها، والغبار، ثم الرسم */
  render(states: Map<string, TruckState>, dt: number) {
    this.clock += dt;
    if (this.goal) {
      const k = dt ? Math.min(1, dt * 4) : 0.2, g = this.goal, c = this.cam;
      let da = g.az - c.az; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      this.cam = { tx: c.tx + (g.tx - c.tx) * k, tz: c.tz + (g.tz - c.tz) * k, dist: c.dist + (g.dist - c.dist) * k, az: c.az + da * k, el: c.el + (g.el - c.el) * k };
      if (Math.abs(g.tx - this.cam.tx) < 0.5 && Math.abs(g.tz - this.cam.tz) < 0.5 && Math.abs(g.dist - this.cam.dist) < 0.5 && Math.abs(da) < 0.002) { this.cam = { ...g }; this.goal = null; }
    }
    this.applyCam();
    const blink = this.clock % 0.7 < 0.35, flash = this.clock % 0.5 < 0.18;
    const k = TRUCK_WORLD / TANKER_LEN;
    this.trucks.forEach((t, id) => {
      const s = states.get(id);
      t.pivot.visible = !!s;
      if (!s) return;
      t.y += ((s.yard ? PAD_Y + 0.1 : 0.4) - t.y) * Math.min(1, dt * 5 || 1);
      t.pivot.position.set(s.x * WORLD_S, t.y, s.y * WORLD_S);
      t.pivot.rotation.y = -s.heading;
      const ease = Math.min(1, dt * 6);
      t.model.rotation.x += (s.roll - t.model.rotation.x) * ease;
      t.model.rotation.z += (s.pitch - t.model.rotation.z) * ease;
      const spin = (s.travel * WORLD_S) / k / WHEEL_R;
      if (spin) t.wheels.forEach(w => { w.rotation.z -= spin; });
      const L = t.lights;
      if (L.brake) L.brake.emissiveIntensity = s.brake ? 3.2 : this.night ? 1.4 : 0.7;
      if (L.signalL) L.signalL.emissiveIntensity = (s.signal === -1 || s.unloading) && blink ? 3 : 0.15;
      if (L.signalR) L.signalR.emissiveIntensity = (s.signal === 1 || s.unloading) && blink ? 3 : 0.15;
      if (L.beacon) L.beacon.emissiveIntensity = s.unloading ? (flash ? 4 : 0.4) : 0.1;
      if (L.hose) { L.hose.visible = s.unloading; L.hose.scale.z = s.hoseSide; }
      if (s.dust > 0.02 && dt) this.emitDust(id, s, dt);
    });
    this.dust.forEach(d => {
      if (!d.alive) { d.sprite.visible = false; return; }
      d.age += dt;
      if (d.age >= d.life) { d.alive = false; d.sprite.visible = false; return; }
      d.x += d.vx * dt; d.z += d.vz * dt; d.y += 4 * dt;
      const f = d.age / d.life, size = d.size * (1 + f * 2.4);
      d.sprite.position.set(d.x, d.y + size * 0.3, d.z);
      d.sprite.scale.set(size, size * 0.7, 1);
      (d.sprite.material as THREE.SpriteMaterial).opacity = (this.night ? 0.25 : 0.42) * (1 - f) * Math.min(1, f * 6);
      d.sprite.visible = true;
    });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.sync([]);
    this.dust.forEach(d => { d.sprite.material.dispose(); });
    this.disposables.forEach(d => d.dispose());
    this.envRT.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
