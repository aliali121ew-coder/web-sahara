import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DAY_ROADS } from '../../lib/stationRoads';
import { GROUND_D, STATIONS, WORLD_S, Y_SCALE, parkPose, toWorld, unfold, type Box, type StationLayout } from '../../lib/stationsLayout';
import { createTanker } from './tankerModel';

/**
 * مشهد محطات مركز التوزيع ثلاثي الأبعاد (WebGL واحد طوال عمر الخريطة): صحراء بشجيرات، والشوارع المتتبَّعة
 * بأسفلت وخطوط، وساحات المحطات الست بأرصفة صفراء وسوداء وأشجار، ومظلات بمضخات وأسماء، ومبانٍ ونوافذ، وخزانات،
 * ولوحات وأعمدة إنارة، وشمس بظلال نهارًا وإنارة المحطات ليلًا؛ والصهاريج (createTanker) تسير فيه وتدخل تحت المظلات.
 * الكاميرا: سحب وتكبير وتدوير وتتبّع بانتقال ناعم.
 */

/** طول الصهريج بوحدات الأرض (عرض الخريطة 100) */
export const TRUCK_LEN = 8.4;
const MODEL_LEN = 3.95;
const WHEEL_R = 0.31 * 0.56;
const HOSE_TIP = { x: -0.5 * 0.56, z: 1.75 * 0.56 };
const DUST_MAX = 260;
const CANOPY_H = 46;

export interface TruckState {
  /** الموضع بوحدات الأرض والاتجاه (راديان، y نحو الجنوب) */
  x: number; y: number; heading: number;
  /** المسافة المقطوعة منذ الإطار السابق (وحدات أرض) */
  travel: number;
  /** داخل ساحة محطة (أعلى قليلًا: فوق بلاطة الساحة) */
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

const W = (x: number, y: number) => toWorld(x, y);
/** صندوق بنسب الصورة ← مركزه وأبعاده في المشهد */
const boxWorld = (b: Box) => {
  const [x, z] = W(b.cx, b.cy * Y_SCALE);
  return { x, z, w: b.w * WORLD_S, d: b.d * Y_SCALE * WORLD_S };
};

let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

const canvasTex = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, srgb = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
const noise = (x: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], r: [number, number]) => {
  for (let i = 0; i < n; i++) {
    x.fillStyle = colors[(rand() * colors.length) | 0];
    x.globalAlpha = 0.25 + rand() * 0.5;
    const s = r[0] + rand() * (r[1] - r[0]);
    x.beginPath(); x.ellipse(rand() * w, rand() * h, s, s * (0.6 + rand() * 0.6), rand() * 3, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
};
const radial = (inner: string, outer: string) => canvasTex(64, 64, x => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
});

/** شريط على الأرض على طول نقاط (مشهد) بعرض ثابت، v تراكمي لتكرار الخامة */
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
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/** مستطيل بزوايا مستديرة كبيرة (شكل ساحة المحطة) */
const roundedShape = (w: number, d: number, r: number) => {
  const s = new THREE.Shape();
  const x0 = -w / 2, y0 = -d / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x0 + w, y0 + d - r); s.absarc(x0 + w - r, y0 + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y0 + d); s.absarc(x0 + r, y0 + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};

export class StationsScene {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 5, 9000);
  private hemi = new THREE.HemisphereLight(0xfff1d6, 0x8a6a3a, 1);
  private sun = new THREE.DirectionalLight(0xffffff, 2.6);
  private stationLights: THREE.PointLight[] = [];
  private nightMats: { mat: THREE.MeshStandardMaterial; day: number; night: number }[] = [];
  private stars: THREE.Points;
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
  /** مواضع بطاقات المحطات (فوق المظلة) */
  readonly anchors = new Map<string, THREE.Vector3>();
  cam: CamState = { tx: 0, tz: 0, dist: 1300, az: 0, el: 0.66 };
  goal: CamState | null = null;
  home: CamState = { tx: 0, tz: 0, dist: 1300, az: 0, el: 0.66 };

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
    this.dustTex = radial('rgba(255,255,255,.9)', 'rgba(255,255,255,0)');
    this.shadowTex = radial('rgba(0,0,0,.5)', 'rgba(0,0,0,0)');
    this.disposables.push(this.beamTex, this.dustTex, this.shadowTex);

    this.sun.position.set(-700, 1100, 520);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -760; sc.right = 760; sc.top = 760; sc.bottom = -760; sc.near = 100; sc.far = 3200;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.buildGround();
    this.buildRoads();
    Object.entries(STATIONS).forEach(([name, st]) => this.buildStation(name, st));
    this.stars = this.buildStars();

    for (let i = 0; i < DUST_MAX; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dustTex, transparent: true, depthWrite: false, color: 0xd8b27a, opacity: 0 }));
      sprite.visible = false;
      this.scene.add(sprite);
      this.dust.push({ sprite, x: 0, y: 0, z: 0, vx: 0, vz: 0, age: 0, life: 1, size: 1, alive: false });
    }
    this.setNight(false);
  }

  // ---------------- البناء ----------------

  private mat(color: number, o: THREE.MeshStandardMaterialParameters = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...o });
    this.disposables.push(m);
    return m;
  }
  private glow(mat: THREE.MeshStandardMaterial, day: number, night: number) { this.nightMats.push({ mat, day, night }); return mat; }
  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.scene, shadow = true) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true;
    parent.add(m); this.disposables.push(geo);
    return m;
  }

  private buildGround() {
    const sand = canvasTex(512, 512, x => {
      x.fillStyle = '#c4934f'; x.fillRect(0, 0, 512, 512);
      noise(x, 512, 512, 5200, ['#bd8b48', '#cc9c5a', '#b98443', '#d2a463'], [0.6, 1.8]);
      noise(x, 512, 512, 900, ['#a97a3c', '#8f6a35'], [0.5, 1.2]);
      noise(x, 512, 512, 140, ['#6f6230', '#5f532a'], [0.8, 1.6]);
    });
    sand.wrapS = sand.wrapT = THREE.RepeatWrapping; sand.repeat.set(70, 70);
    this.disposables.push(sand);
    const ground = this.mesh(new THREE.PlaneGeometry(7000, 7000), this.mat(0xffffff, { map: sand, roughness: 1 }), 0, 0, 0, this.scene, false);
    ground.rotation.x = -Math.PI / 2;

    // شجيرات صحراوية وحجارة متناثرة بعيدًا عن الشوارع والساحات
    const roadPts: [number, number][] = [];
    DAY_ROADS.edges.forEach(e => e.pts.forEach(p => roadPts.push(W(...unfold(p)))));
    const pads = Object.values(STATIONS).map(st => {
      const [x0, z0] = W(st.pad.x0, st.pad.y0 * Y_SCALE), [x1, z1] = W(st.pad.x1, st.pad.y1 * Y_SCALE);
      return { x0, z0, x1, z1 };
    });
    const free = (x: number, z: number) => {
      if (pads.some(p => x > p.x0 - 18 && x < p.x1 + 18 && z > p.z0 - 18 && z < p.z1 + 18)) return false;
      for (let i = 0; i < roadPts.length; i += 2) if (Math.abs(roadPts[i][0] - x) < 30 && Math.abs(roadPts[i][1] - z) < 30) return false;
      return true;
    };
    const shrubGeo = new THREE.IcosahedronGeometry(1, 1);
    this.disposables.push(shrubGeo);
    const shrubs = new THREE.InstancedMesh(shrubGeo, this.mat(0xffffff, { roughness: 0.95 }), 1500);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    const tones = [0x5d5a2c, 0x6b6230, 0x4f4a26, 0x7a6a38, 0x5b4b2a];
    let n = 0;
    for (let tries = 0; n < 1500 && tries < 9000; tries++) {
      const x = (rand() - 0.5) * 1500, z = (rand() - 0.5) * 1400;
      if (!free(x, z)) continue;
      const s = 2 + rand() * 4.5;
      q.setFromEuler(new THREE.Euler(0, rand() * 6, 0));
      m4.compose(new THREE.Vector3(x, s * 0.35, z), q, new THREE.Vector3(s * (1 + rand() * 0.6), s * 0.55, s));
      shrubs.setMatrixAt(n, m4);
      shrubs.setColorAt(n, c.setHex(tones[(rand() * tones.length) | 0]));
      n++;
    }
    shrubs.count = n;
    shrubs.castShadow = true; shrubs.receiveShadow = true;
    this.scene.add(shrubs);
  }

  private buildRoads() {
    const asphalt = canvasTex(128, 512, x => {
      x.fillStyle = '#3a3c40'; x.fillRect(0, 0, 128, 512);
      noise(x, 128, 512, 900, ['#2f3135', '#45474c', '#34363a', '#4d4f54'], [0.6, 1.8]);
      x.fillStyle = '#d9d4c7'; x.fillRect(7, 0, 4, 512); x.fillRect(117, 0, 4, 512);
      x.fillStyle = '#f2c230'; x.fillRect(62, 0, 4, 300);
    });
    asphalt.wrapS = THREE.ClampToEdgeWrapping; asphalt.wrapT = THREE.RepeatWrapping;
    this.disposables.push(asphalt);
    const roadMat = this.mat(0xffffff, { map: asphalt, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1 });
    const shoulderMat = this.mat(0x9c7a4a, { roughness: 1, polygonOffset: true, polygonOffsetFactor: -0.5 });
    DAY_ROADS.edges.forEach(e => {
      if (e.yard) return;
      const pts = e.pts.map(p => W(...unfold(p)));
      this.mesh(ribbon(pts, 40, 1, 0.06), shoulderMat, 0, 0, 0, this.scene, false).receiveShadow = true;
      this.mesh(ribbon(pts, 32, 60, 0.12), roadMat, 0, 0, 0, this.scene, false).receiveShadow = true;
    });
  }

  private nameTexture(text: string, color: string) {
    const font = (getComputedStyle(document.body).fontFamily || 'sans-serif');
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = `800 150px ${font}`;
    const tw = Math.ceil(probe.measureText(text).width) + 80;
    const t = canvasTex(tw, 220, x => {
      x.font = `800 150px ${font}`; x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineJoin = 'round'; x.lineWidth = 18; x.strokeStyle = 'rgba(20,24,32,.85)'; x.strokeText(text, tw / 2, 116);
      x.fillStyle = color; x.fillText(text, tw / 2, 110);
    });
    this.disposables.push(t);
    return { tex: t, aspect: tw / 220 };
  }

  private buildStation(name: string, st: StationLayout) {
    const g = new THREE.Group(); this.scene.add(g);
    const [x0, z0] = W(st.pad.x0, st.pad.y0 * Y_SCALE), [x1, z1] = W(st.pad.x1, st.pad.y1 * Y_SCALE);
    const pw = x1 - x0, pd = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = Math.min(pw, pd) * 0.32;

    // كتف رملي فاتح حول الساحة، ثم البلاطة الخرسانية بخطوط وقوف
    const berm = this.mesh(new THREE.ExtrudeGeometry(roundedShape(pw + 16, pd + 16, r + 8), { depth: 0.8, bevelEnabled: false }), this.mat(0xcfa064, { roughness: 1 }), cx, 0, cz, g, false);
    berm.rotation.x = -Math.PI / 2;
    const concrete = canvasTex(256, 256, x => {
      x.fillStyle = '#6f747b'; x.fillRect(0, 0, 256, 256);
      noise(x, 256, 256, 900, ['#676c73', '#777c83', '#62676e', '#7e838a'], [0.5, 2]);
      x.strokeStyle = 'rgba(240,240,235,.55)'; x.lineWidth = 3; x.setLineDash([22, 18]);
      x.beginPath(); x.moveTo(0, 128); x.lineTo(256, 128); x.stroke();
    });
    concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping; concrete.repeat.set(1 / 45, 1 / 45);
    this.disposables.push(concrete);
    const pad = this.mesh(new THREE.ExtrudeGeometry(roundedShape(pw, pd, r), { depth: 1.3, bevelEnabled: false }), this.mat(0xffffff, { map: concrete, roughness: 0.85 }), cx, 0, cz, g, false);
    pad.rotation.x = -Math.PI / 2;
    pad.userData.site = name;
    this.pads.push(pad);

    // رصيف أصفر وأسود حول الحافة، وأشجار سرو بينه وبين الصحراء
    const outline = roundedShape(pw, pd, r).getSpacedPoints(Math.round((pw + pd) / 3.2));
    const curbGeo = new THREE.BoxGeometry(3.6, 1.6, 1.6); this.disposables.push(curbGeo);
    const curbs = [new THREE.InstancedMesh(curbGeo, this.mat(0xf5c518, { roughness: 0.6 }), outline.length), new THREE.InstancedMesh(curbGeo, this.mat(0x1f2328, { roughness: 0.7 }), outline.length)];
    const counts = [0, 0];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    outline.forEach((p, i) => {
      const nx = outline[(i + 1) % outline.length];
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(-(nx.y - p.y), nx.x - p.x));
      m4.compose(new THREE.Vector3(cx + p.x, 1.4, cz - p.y), q, new THREE.Vector3(1, 1, 1));
      const k = i % 2; curbs[k].setMatrixAt(counts[k]++, m4);
    });
    curbs.forEach((c, k) => { c.count = counts[k]; c.receiveShadow = true; g.add(c); });
    const treeGeo = new THREE.ConeGeometry(5, 22, 8), trunkGeo = new THREE.CylinderGeometry(0.7, 0.9, 4, 6);
    this.disposables.push(treeGeo, trunkGeo);
    const trees = new THREE.InstancedMesh(treeGeo, this.mat(0x2e5a2a, { roughness: 0.9 }), outline.length);
    const trunks = new THREE.InstancedMesh(trunkGeo, this.mat(0x5b4227), outline.length);
    let tn = 0;
    const roadNear = (wx: number, wz: number) => DAY_ROADS.edges.some(e => e.pts.some(pp => { const [rx, rz] = W(...unfold(pp)); return Math.abs(rx - wx) < 26 && Math.abs(rz - wz) < 26; }));
    outline.forEach((p, i) => {
      if (i % 4 || rand() < 0.25) return;
      const wx = cx + p.x * 1.04, wz = cz - p.y * 1.04;
      if (roadNear(wx, wz)) return;
      const s = 0.8 + rand() * 0.5;
      m4.compose(new THREE.Vector3(wx, 14 * s, wz), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); trees.setMatrixAt(tn, m4);
      m4.compose(new THREE.Vector3(wx, 2, wz), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); trunks.setMatrixAt(tn, m4);
      tn++;
    });
    trees.count = trunks.count = tn; trees.castShadow = true; g.add(trees, trunks);

    // المظلة: سقف ملون بحافة، وأعمدة، وجزر مضخات، وإنارة سفلية
    const cb = boxWorld(st.canopy);
    const roof = this.mesh(new THREE.BoxGeometry(cb.w, 4, cb.d), this.mat(st.colors.roof, { roughness: 0.5, metalness: 0.2 }), cb.x, CANOPY_H + 2.5, cb.z, g);
    roof.castShadow = true;
    this.mesh(new THREE.BoxGeometry(cb.w + 1.6, 6, cb.d + 1.6), this.mat(st.colors.band, { roughness: 0.45, metalness: 0.2 }), cb.x, CANOPY_H + 0.6, cb.z, g);
    const glowMat = this.glow(this.mat(0xf8fafc, { emissive: 0xfff7e0, emissiveIntensity: 0 }), 0, 1.6);
    const panel = this.mesh(new THREE.PlaneGeometry(cb.w - 2, cb.d - 2), glowMat, cb.x, CANOPY_H - 1.6, cb.z, g, false);
    panel.rotation.x = Math.PI / 2;
    const islands = Math.max(2, Math.round(cb.w / 42));
    // إن كانت نقطة الوقوف تحت المظلة (البوادي) تُترك حارة للصهريج بين الجزر
    const pk = parkPose(name), [pkx, pkz] = pk ? W(pk.x, pk.y) : [Infinity, Infinity];
    const under = Math.abs(pkz - cb.z) < cb.d / 2 + 40 && Math.abs(pkx - cb.x) < cb.w / 2;
    const nSlots = islands + (under ? 1 : 0);
    let slots = Array.from({ length: nSlots }, (_, i) => cb.x - cb.w / 2 + (cb.w / nSlots) * (i + 0.5));
    if (under) { const drop = slots.reduce((b, v, i) => (Math.abs(v - pkx) < Math.abs(slots[b] - pkx) ? i : b), 0); slots = slots.filter((_, i) => i !== drop); }
    const colGeo = new THREE.BoxGeometry(2.4, CANOPY_H, 2.4); this.disposables.push(colGeo);
    const colMat = this.mat(0xe5e7eb, { roughness: 0.4, metalness: 0.3 });
    const islandMat = this.mat(0xb8bcc2), pumpMat = this.mat(0xf3f4f6, { roughness: 0.35, metalness: 0.2 }), pumpBand = this.mat(st.colors.band);
    const screen = this.glow(this.mat(0x0f172a, { emissive: 0x38bdf8, emissiveIntensity: 0.2 }), 0.2, 1.2);
    for (const ix of slots) {
      this.mesh(new THREE.BoxGeometry(9, 1.6, cb.d * 0.62), islandMat, ix, 2.1, cb.z, g);
      [-1, 1].forEach(sd => {
        this.mesh(colGeo, colMat, ix, CANOPY_H / 2 + 1.3, cb.z + sd * cb.d * 0.34, g);
        const pz = cb.z + sd * cb.d * 0.14;
        this.mesh(new THREE.BoxGeometry(5.5, 14, 4.4), pumpMat, ix, 9.9, pz, g);
        this.mesh(new THREE.BoxGeometry(5.6, 3, 4.5), pumpBand, ix, 15.6, pz, g, false);
        this.mesh(new THREE.BoxGeometry(3.4, 2.4, 0.2), screen, ix, 11.5, pz + sd * 2.3, g, false);
      });
    }
    // الاسم فوق المظلة كما في الصورة
    const { tex, aspect } = this.nameTexture(name, st.colors.text);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    this.disposables.push(label.material);
    const lh = 40;
    label.scale.set(lh * aspect, lh, 1);
    label.position.set(cb.x, CANOPY_H + 8, cb.z);
    label.center.set(0.5, 0.2);
    g.add(label);
    this.anchors.set(name, new THREE.Vector3(cx, 2, z1 + 14));

    // المبنى: جدران ونوافذ مضيئة ليلًا وسقف بحافة
    const sb = boxWorld(st.shop);
    this.mesh(new THREE.BoxGeometry(sb.w, 32, sb.d), this.mat(st.colors.shop, { roughness: 0.7 }), sb.x, 17.3, sb.z, g);
    this.mesh(new THREE.BoxGeometry(sb.w + 3, 2.4, sb.d + 3), this.mat(st.colors.trim), sb.x, 34.4, sb.z, g);
    const winTex = canvasTex(256, 64, x => {
      x.fillStyle = '#1f2937'; x.fillRect(0, 0, 256, 64);
      for (let i = 0; i < 6; i++) { x.fillStyle = i === 2 ? '#334155' : '#fde7b0'; x.fillRect(8 + i * 41, 10, 34, i === 2 ? 54 : 34); }
    });
    this.disposables.push(winTex);
    const win = this.glow(this.mat(0xffffff, { map: winTex, emissiveMap: winTex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.2, metalness: 0.3 }), 0.05, 1.3);
    this.mesh(new THREE.PlaneGeometry(sb.w * 0.86, 16), win, sb.x, 12.5, sb.z + sb.d / 2 + 0.15, g, false);

    // خزان الوقود الأبيض على قاعدتين
    const [tx, tz] = W(st.tank[0], st.tank[1] * Y_SCALE);
    const tank = this.mesh(new THREE.CylinderGeometry(10, 10, 46, 32), this.mat(0xeef2f6, { roughness: 0.3, metalness: 0.5 }), tx, 15, tz - 4, g);
    tank.rotation.z = Math.PI / 2;
    [-14, 14].forEach(dx => this.mesh(new THREE.BoxGeometry(3, 6, 15), this.mat(0x6b7280), tx + dx, 3, tz - 4, g));

    // عمود اللوحة بشعار مضيء
    const [sx, sz] = W(st.sign[0], st.sign[1] * Y_SCALE);
    this.mesh(new THREE.BoxGeometry(11, 52, 4), this.mat(0x111827, { roughness: 0.4 }), sx, 27, sz, g);
    const logo = canvasTex(128, 256, x => {
      x.fillStyle = '#0b1220'; x.fillRect(0, 0, 128, 256);
      x.fillStyle = '#dc2626'; x.beginPath(); x.arc(64, 70, 42, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(64, 38); x.quadraticCurveTo(92, 78, 64, 98); x.quadraticCurveTo(36, 78, 64, 38); x.fill();
      x.fillStyle = '#e5e7eb'; for (let i = 0; i < 4; i++) x.fillRect(22, 140 + i * 24, 84 - i * 12, 10);
    });
    this.disposables.push(logo);
    const logoMat = this.glow(this.mat(0xffffff, { map: logo, emissiveMap: logo, emissive: 0xffffff, emissiveIntensity: 0.15 }), 0.15, 1.1);
    this.mesh(new THREE.PlaneGeometry(9, 42), logoMat, sx, 28, sz + 2.1, g, false);

    // أعمدة إنارة عند زوايا الساحة، وإنارة المحطة ليلًا
    const poleGeo = new THREE.CylinderGeometry(0.5, 0.8, 48, 6); this.disposables.push(poleGeo);
    const headMat = this.glow(this.mat(0xe5e7eb, { emissive: 0xfff1c1, emissiveIntensity: 0 }), 0, 2.5);
    [[x0 + pw * 0.22, z0 + 6], [x1 - pw * 0.12, z0 + 6]].forEach(([px, pz]) => {
      this.mesh(poleGeo, this.mat(0x9ca3af, { metalness: 0.5 }), px, 24, pz, g);
      this.mesh(new THREE.BoxGeometry(7, 1.6, 2.6), headMat, px + 3, 48, pz, g, false);
    });
    const light = new THREE.PointLight(0xffd9a0, 0, 340, 1.4);
    light.position.set(cb.x, CANOPY_H - 6, cb.z + cb.d * 0.4);
    g.add(light); this.stationLights.push(light);

    // نقطة التفريغ حيث يصل خرطوم الصهريج الواقف
    const pp = parkPose(name);
    if (pp) {
      const pivot = new THREE.Group();
      const [px, pz] = W(pp.x, pp.y);
      pivot.position.set(px, 1.3, pz);
      pivot.rotation.y = -pp.heading;
      pivot.scale.setScalar((TRUCK_LEN * WORLD_S) / MODEL_LEN);
      const mk = this.fillMarker();
      mk.position.set(HOSE_TIP.x, 0, pp.side * HOSE_TIP.z);
      pivot.add(mk);
      g.add(pivot);
    }
  }

  private fillMarker(): THREE.Group {
    const g = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); this.disposables.push(geo); };
    add(new THREE.BoxGeometry(0.62, 0.04, 0.62), this.mat(0x6b7280, { roughness: 0.9 }), 0, 0.02, 0);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), this.mat(0xfacc15, { emissive: 0x3f2a00, emissiveIntensity: 0.4 }), 0, 0.06, 0);
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 18), this.mat(0x111827), 0, 0.09, 0);
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), this.mat(0xdc2626, { emissive: 0x450a0a, emissiveIntensity: 0.5 }), 0, 0.13, 0);
    add(new THREE.BoxGeometry(0.03, 0.5, 0.03), this.mat(0x9ca3af, { metalness: 0.6 }), 0.24, 0.27, -0.2);
    add(new THREE.BoxGeometry(0.2, 0.16, 0.02), this.mat(0xf59e0b, { emissive: 0x7c2d12, emissiveIntensity: 0.6 }), 0.24, 0.5, -0.2);
    return g;
  }

  private buildStars() {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, e = 0.12 + rand() * 1.3, r = 4200;
      pos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xdbeafe, size: 2.2, sizeAttenuation: false, fog: false });
    this.disposables.push(geo, m);
    const p = new THREE.Points(geo, m); this.scene.add(p);
    return p;
  }

  // ---------------- نهار / ليل ----------------

  setNight(night: boolean) {
    this.night = night;
    const sky = night ? 0x0a1020 : 0xd8c8a8;
    this.scene.background = new THREE.Color(sky);
    this.scene.fog = new THREE.Fog(sky, night ? 1600 : 2200, night ? 4200 : 5600);
    this.hemi.color.set(night ? 0x3b4a78 : 0xfff1d6);
    this.hemi.groundColor.set(night ? 0x1a140c : 0x8a6a3a);
    this.hemi.intensity = night ? 0.5 : 1.05;
    this.sun.color.set(night ? 0x9fb4ff : 0xfff4e0);
    this.sun.intensity = night ? 0.45 : 2.8;
    this.renderer.toneMappingExposure = night ? 1.05 : 0.92;
    this.scene.environmentIntensity = night ? 0.25 : 0.9;
    this.stationLights.forEach(l => { l.intensity = night ? 900 : 0; });
    this.nightMats.forEach(({ mat, day, night: n }) => { mat.emissiveIntensity = night ? n : day; });
    this.stars.visible = night;
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
    this.home = this.fit(-470, 470, -GROUND_D / 2 * WORLD_S + 20, GROUND_D / 2 * WORLD_S - 10, 0, 0.66);
  }

  /** مسافة الكاميرا وهدفها ليظهر مستطيل الأرض كاملًا */
  fit(xa: number, xb: number, za: number, zb: number, az = this.cam.az, el = this.cam.el): CamState {
    const vf = (this.camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const w = xb - xa, d = zb - za;
    const dist = Math.max((w / 2) / Math.tan(hf / 2), (d * Math.sin(el) / 2 + 40) / Math.tan(vf / 2)) * 1.12 + d * Math.cos(el) * 0.2;
    return { tx: (xa + xb) / 2, tz: (za + zb) / 2 + d * 0.06, dist, az, el };
  }

  private clampCam(c: CamState): CamState {
    const max = this.home.dist * 1.15;
    return {
      tx: Math.max(-560, Math.min(560, c.tx)), tz: Math.max(-580, Math.min(580, c.tz)),
      dist: Math.max(120, Math.min(max, c.dist)), az: c.az, el: Math.max(0.32, Math.min(1.42, c.el)),
    };
  }
  get maxDist() { return this.home.dist * 1.15; }
  private applyCam() {
    const { tx, tz, dist, az, el } = this.cam;
    this.camera.position.set(tx + Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, tz + Math.cos(az) * Math.cos(el) * dist);
    this.camera.lookAt(tx, 0, tz);
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
    for (let i = 0; i < xs.length; i++) { const [x, z] = W(xs[i], ys[i]); xa = Math.min(xa, x); xb = Math.max(xb, x); za = Math.min(za, z); zb = Math.max(zb, z); }
    const pad = 80;
    this.goal = this.clampCam(this.fit(xa - pad, xb + pad, za - pad, zb + pad));
  }
  /** نقطة مشهد ← الشاشة (null خلف الكاميرا) */
  project(v: THREE.Vector3): [number, number] | null {
    const p = v.clone().project(this.camera);
    if (p.z > 1) return null;
    return [((p.x + 1) / 2) * this.w, ((1 - p.y) / 2) * this.h];
  }
  worldOf(x: number, y: number, h = 0) { const [wx, wz] = W(x, y); return new THREE.Vector3(wx, h, wz); }
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
      model.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
      pivot.add(model);
      const flat = (tex: THREE.Texture, w: number, d: number, x: number, y: number, add = false) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, y, 0); pivot.add(m); return m;
      };
      flat(this.shadowTex, 4.4, 1.3, -0.1, 0.02);
      const beams = flat(this.beamTex, 3.4, 1.7, 3.65, 0.03, true);
      beams.visible = this.night;
      pivot.scale.setScalar((TRUCK_LEN * WORLD_S) / MODEL_LEN);
      this.scene.add(pivot);
      const u = model.userData as Lights & { wheels?: THREE.Object3D[] };
      this.trucks.set(id, { pivot, model, wheels: u.wheels ?? [], beams, lights: u, y: 0.2 });
    });
  }

  private emitDust(id: string, s: TruckState, dt: number) {
    let carry = (this.emitCarry.get(id) ?? 0) + s.dust * 50 * dt;
    const len = TRUCK_LEN * WORLD_S, cx = Math.cos(s.heading), cz = Math.sin(s.heading);
    const [x, z] = W(s.x, s.y);
    while (carry >= 1) {
      carry -= 1;
      const d = this.dust.find(p => !p.alive);
      if (!d) { carry = 0; break; }
      const side = (rand() - 0.5) * len * 0.24, back = len * (0.42 + rand() * 0.08);
      d.x = x - cx * back - cz * side; d.z = z - cz * back + cx * side; d.y = 2;
      d.vx = -cx * 6 + (rand() - 0.5) * 6; d.vz = -cz * 6 + (rand() - 0.5) * 6;
      d.age = 0; d.life = 1.3 + rand() * 1.2; d.size = len * (0.14 + rand() * 0.08); d.alive = true;
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
    const k = (TRUCK_LEN * WORLD_S) / MODEL_LEN;
    this.trucks.forEach((t, id) => {
      const s = states.get(id);
      t.pivot.visible = !!s;
      if (!s) return;
      const [x, z] = W(s.x, s.y);
      t.y += ((s.yard ? 1.35 : 0.15) - t.y) * Math.min(1, dt * 5 || 1);
      t.pivot.position.set(x, t.y, z);
      t.pivot.rotation.y = -s.heading;
      const ease = Math.min(1, dt * 6);
      t.model.rotation.x += (s.roll - t.model.rotation.x) * ease;
      t.model.rotation.z += (s.pitch - t.model.rotation.z) * ease;
      const spin = (s.travel * WORLD_S) / k / WHEEL_R;
      if (spin) t.wheels.forEach(w => { w.rotation.z -= spin; });
      const L = t.lights;
      if (L.brake) L.brake.emissiveIntensity = s.brake ? 3.2 : this.night ? 1.1 : 0.7;
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
