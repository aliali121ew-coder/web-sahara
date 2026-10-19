import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createTanker } from './tankerModel';

/**
 * طبقة الصهاريج ثلاثية الأبعاد فوق صورة خريطة المحطات: سياق WebGL واحد طوال عمر الخريطة،
 * وكاميرا متعامدة مائلة بزاوية منظور الصورة، فيُوضع كل صهريج عند نقطة الشاشة على الطريق ويُدار مع اتجاهه.
 * إضاءة نهار/ليل، وبيئة انعكاس للمعدن، وظل، وأضواء أمامية ليلًا، وأضواء فرامل وإشارات انعطاف ومصباح تحذير وخرطوم عند التفريغ،
 * وميلان خفيف للهيكل في المنعطفات والتسارع، وغبار خلف العجلات بقدر السرعة (يبقى في مكانه على الخريطة عند التكبير والسحب).
 */

/** ميل الكاميرا عن الأفق (قريب من منظور صورة الخريطة) */
const TILT = (48 * Math.PI) / 180;
const SIN_T = Math.sin(TILT);
/** طول نموذج الصهريج (بعد مقياسه الداخلي) ونصف قطر العجلة بوحداته */
const MODEL_LEN = 3.95;
const WHEEL_R = 0.31 * 0.56;
const DUST_MAX = 220;

export interface TruckPose {
  /** موضع الشاشة داخل اللوحة (بكسل) وموضعه على الخريطة (وحدات) */
  sx: number; sy: number; mx: number; my: number;
  /** اتجاه الطريق (راديان، y للأسفل) */
  heading: number;
  /** طول الصهريج على الشاشة (بكسل) */
  lengthPx: number;
  /** المسافة المقطوعة منذ الإطار السابق (بكسل) لدوران العجلات */
  travelPx: number;
  brake: boolean;
  /** إشارة الانعطاف: -1 يسار، 1 يمين */
  signal: -1 | 0 | 1;
  unloading: boolean;
  /** جهة خرطوم التفريغ: 1 يمين المركبة، -1 يسارها (نحو نقطة التفريغ) */
  hoseSide: 1 | -1;
  /** ميلان جانبي وأمامي (راديان) */
  roll: number; pitch: number;
  /** شدة الغبار 0..1 */
  dust: number;
}

/** نقطة تفريغ المحطة: تُرسم حيث يصل خرطوم صهريج واقف عند sx,sy باتجاه heading */
export interface FillPose { id: string; sx: number; sy: number; heading: number; lengthPx: number; side: 1 | -1 }

/** طرف الخرطوم بوحدات المحور (بعد مقياس النموذج الداخلي 0.56): للخلف قليلًا وإلى الجانب */
const HOSE_TIP = { x: -0.5 * 0.56, z: 1.75 * 0.56 };

export interface LayerView {
  /** وحدة خريطة ← بكسل شاشة */
  toScreen: (x: number, y: number) => [number, number];
  /** بكسل لكل وحدة خريطة عند التكبير الحالي */
  ppu: number;
}

const radialTexture = (inner: string, outer: string) => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const beamTexture = () => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(255,244,200,.85)'); g.addColorStop(1, 'rgba(255,244,200,0)');
  x.fillStyle = g; x.beginPath(); x.moveTo(0, 26); x.lineTo(128, 0); x.lineTo(128, 64); x.lineTo(0, 38); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};

interface Lights { brake?: THREE.MeshStandardMaterial; signalL?: THREE.MeshStandardMaterial; signalR?: THREE.MeshStandardMaterial; beacon?: THREE.MeshStandardMaterial; hose?: THREE.Object3D }
interface Truck { pivot: THREE.Group; model: THREE.Group; wheels: THREE.Object3D[]; beam: THREE.Mesh; lights: Lights }
interface Dust { sprite: THREE.Sprite; mx: number; my: number; vx: number; vy: number; age: number; life: number; size: number; alive: boolean }

export class TankerLayer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  private hemi = new THREE.HemisphereLight(0xfff4e0, 0x8a5a2b, 1);
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private trucks = new Map<string, Truck>();
  private w = 1; private h = 1;
  private night = false;
  private clock = 0;
  private shadowTex = radialTexture('rgba(0,0,0,.55)', 'rgba(0,0,0,0)');
  private dustTex = radialTexture('rgba(255,255,255,.9)', 'rgba(255,255,255,0)');
  private beamTex = beamTexture();
  private envRT: THREE.WebGLRenderTarget;
  private dust: Dust[] = [];
  private fills = new Map<string, THREE.Group>();
  private emitCarry = new Map<string, number>();

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    host.appendChild(this.canvas);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();
    this.camera.position.set(0, Math.sin(TILT) * 1000, Math.cos(TILT) * 1000);
    this.camera.lookAt(0, 0, 0);
    this.sun.position.set(-300, 900, 500);
    this.scene.add(this.hemi, this.sun);
    for (let i = 0; i < DUST_MAX; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dustTex, transparent: true, depthWrite: false, color: 0xd8b27a, opacity: 0 }));
      sprite.visible = false;
      this.scene.add(sprite);
      this.dust.push({ sprite, mx: 0, my: 0, vx: 0, vy: 0, age: 0, life: 1, size: 1, alive: false });
    }
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.canvas.style.width = `${this.w}px`; this.canvas.style.height = `${this.h}px`;
    Object.assign(this.camera, { left: -this.w / 2, right: this.w / 2, top: this.h / 2, bottom: -this.h / 2 });
    this.camera.updateProjectionMatrix();
  }

  setNight(night: boolean) {
    this.night = night;
    this.hemi.color.set(night ? 0x7b8fb8 : 0xfff4e0);
    this.hemi.groundColor.set(night ? 0x1a120a : 0x8a5a2b);
    this.hemi.intensity = night ? 0.45 : 1.1;
    this.sun.color.set(night ? 0xa9bbff : 0xffffff);
    this.sun.intensity = night ? 0.55 : 2.3;
    this.scene.environmentIntensity = night ? 0.3 : 0.95;
    this.trucks.forEach(t => { t.beam.visible = night; });
    this.dust.forEach(d => (d.sprite.material as THREE.SpriteMaterial).color.set(night ? 0x5f5040 : 0xd8b27a));
  }

  /** إضافة صهاريج الطلبات الجديدة وإزالة المنتهية (بلا إعادة إنشاء السياق) */
  sync(ids: string[]) {
    const keep = new Set(ids);
    this.trucks.forEach((t, id) => {
      if (keep.has(id)) return;
      this.scene.remove(t.pivot);
      t.pivot.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
      this.trucks.delete(id);
      this.emitCarry.delete(id);
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
      flat(this.shadowTex, 4.6, 1.25, -0.1, 0.01).position.z = 0.08;
      const beam = flat(this.beamTex, 3.4, 1.7, 1.95 + 1.7, 0.02, true);
      beam.visible = this.night;
      this.scene.add(pivot);
      const u = model.userData as Lights & { wheels?: THREE.Object3D[] };
      this.trucks.set(id, { pivot, model, wheels: u.wheels ?? [], beam, lights: u });
    });
  }

  /** نقطة التفريغ: قاعدة خرسانية، وحلقة صفراء وسوداء، وغطاء فتحة الخزان، ولوحة صغيرة */
  private fillMarker(): THREE.Group {
    const g = new THREE.Group();
    const mat = (c: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.2, ...o });
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    add(new THREE.BoxGeometry(0.62, 0.04, 0.62), mat(0x6b7280, { roughness: 0.9 }), 0, 0.02, 0);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), mat(0xfacc15, { emissive: 0x3f2a00, emissiveIntensity: 0.4 }), 0, 0.06, 0);
    add(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 18), mat(0x111827), 0, 0.09, 0);
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), mat(0xdc2626, { emissive: 0x450a0a, emissiveIntensity: 0.5 }), 0, 0.13, 0);
    add(new THREE.BoxGeometry(0.03, 0.5, 0.03), mat(0x9ca3af, { metalness: 0.6 }), 0.24, 0.27, -0.2);
    add(new THREE.BoxGeometry(0.2, 0.16, 0.02), mat(0xf59e0b, { emissive: 0x7c2d12, emissiveIntensity: 0.6 }), 0.24, 0.5, -0.2);
    return g;
  }

  /** يضع كائنًا بإطار صهريج واقف (نفس التحويل) */
  private place(o: THREE.Object3D, sx: number, sy: number, heading: number, lengthPx: number) {
    o.position.set(sx - this.w / 2, 0, (sy - this.h / 2) / SIN_T);
    o.rotation.y = -Math.atan2(Math.sin(heading) / SIN_T, Math.cos(heading));
    o.scale.setScalar(lengthPx / MODEL_LEN);
  }

  /** غبار خلف العجلات الخلفية بقدر شدة الحركة (بوحدات الخريطة) */
  private emitDust(id: string, p: TruckPose, ppu: number, dt: number) {
    let carry = (this.emitCarry.get(id) ?? 0) + p.dust * 46 * dt;
    const len = p.lengthPx / Math.max(1e-6, ppu);
    const cx = Math.cos(p.heading), cy = Math.sin(p.heading);
    while (carry >= 1) {
      carry -= 1;
      const d = this.dust.find(x => !x.alive);
      if (!d) { carry = 0; break; }
      const side = (Math.random() - 0.5) * len * 0.22, back = len * (0.42 + Math.random() * 0.1);
      d.mx = p.mx - cx * back - cy * side;
      d.my = p.my - cy * back + cx * side;
      d.vx = -cx * 0.35 + (Math.random() - 0.5) * 0.3;
      d.vy = -cy * 0.35 + (Math.random() - 0.5) * 0.3 - 0.08;
      d.age = 0; d.life = 1.2 + Math.random() * 1.1; d.size = len * (0.16 + Math.random() * 0.08); d.alive = true;
    }
    this.emitCarry.set(id, carry);
  }

  /** وضع كل صهريج عند موضعه واتجاهه على الشاشة، وتحديث الأضواء والغبار، ثم الرسم */
  render(poses: Map<string, TruckPose>, view: LayerView, dt: number, fills: FillPose[] = []) {
    this.clock += dt;
    // نقاط التفريغ: عند طرف خرطوم صهريج واقف في نقطة الوقوف
    const seen = new Set<string>();
    fills.forEach(f => {
      seen.add(f.id);
      let pivot = this.fills.get(f.id);
      if (!pivot) {
        pivot = new THREE.Group();
        const m = this.fillMarker(); m.name = 'marker'; pivot.add(m);
        this.scene.add(pivot); this.fills.set(f.id, pivot);
      }
      this.place(pivot, f.sx, f.sy, f.heading, f.lengthPx);
      pivot.getObjectByName('marker')!.position.set(HOSE_TIP.x, 0, f.side * HOSE_TIP.z);
    });
    this.fills.forEach((g, id) => { g.visible = seen.has(id); });
    const blink = this.clock % 0.7 < 0.35;
    const flash = this.clock % 0.5 < 0.18;
    this.trucks.forEach((t, id) => {
      const p = poses.get(id);
      t.pivot.visible = !!p;
      if (!p) return;
      // نقطة الشاشة ← نقطة على أرض المشهد (الكاميرا مائلة: محور العمق مضغوط بجيب الميل)
      this.place(t.pivot, p.sx, p.sy, p.heading, p.lengthPx);
      const k = p.lengthPx / MODEL_LEN;
      const ease = Math.min(1, dt * 6);
      t.model.rotation.x += (p.roll - t.model.rotation.x) * ease;
      t.model.rotation.z += (p.pitch - t.model.rotation.z) * ease;
      const spin = p.travelPx / k / WHEEL_R;
      if (spin) t.wheels.forEach(w => { w.rotation.z -= spin; });
      const L = t.lights;
      if (L.brake) L.brake.emissiveIntensity = p.brake ? 3.2 : this.night ? 1.1 : 0.7;
      if (L.signalL) L.signalL.emissiveIntensity = (p.signal === -1 || p.unloading) && blink ? 3 : 0.15;
      if (L.signalR) L.signalR.emissiveIntensity = (p.signal === 1 || p.unloading) && blink ? 3 : 0.15;
      if (L.beacon) L.beacon.emissiveIntensity = p.unloading ? (flash ? 4 : 0.4) : 0.1;
      if (L.hose) { L.hose.visible = p.unloading; L.hose.scale.z = p.hoseSide; }
      if (p.dust > 0.02 && dt) this.emitDust(id, p, view.ppu, dt);
    });
    // الغبار: يتحرك ويتلاشى في إحداثيات الخريطة ثم يُسقط على الشاشة
    this.dust.forEach(d => {
      if (!d.alive) { d.sprite.visible = false; return; }
      d.age += dt;
      if (d.age >= d.life) { d.alive = false; d.sprite.visible = false; return; }
      d.mx += d.vx * dt; d.my += d.vy * dt;
      const f = d.age / d.life;
      const [sx, sy] = view.toScreen(d.mx, d.my);
      d.sprite.position.set(sx - this.w / 2, (0.2 + f * 0.6) * d.size * view.ppu, (sy - this.h / 2) / SIN_T);
      const s = d.size * (1 + f * 2.2) * view.ppu;
      d.sprite.scale.set(s, s * 0.7, 1);
      (d.sprite.material as THREE.SpriteMaterial).opacity = (this.night ? 0.28 : 0.45) * (1 - f) * Math.min(1, f * 6);
      d.sprite.visible = true;
    });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.sync([]);
    this.fills.forEach(g => { this.scene.remove(g); g.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } }); });
    this.dust.forEach(d => { d.sprite.material.dispose(); this.scene.remove(d.sprite); });
    this.shadowTex.dispose(); this.dustTex.dispose(); this.beamTex.dispose(); this.envRT.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
