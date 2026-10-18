import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createTanker } from './tankerModel';

/**
 * طبقة الصهاريج ثلاثية الأبعاد فوق صورة خريطة المحطات: سياق WebGL واحد طوال عمر الخريطة،
 * وكاميرا متعامدة مائلة بزاوية منظور الصورة، فيُوضع كل صهريج عند نقطة الشاشة على الطريق ويُدار مع اتجاهه.
 * إضاءة نهار/ليل، وبيئة انعكاس للمعدن، وظل تحت المركبة، وأضواء أمامية ليلًا، ودوران العجلات مع المسافة المقطوعة.
 */

/** ميل الكاميرا عن الأفق (قريب من منظور صورة الخريطة) */
const TILT = (48 * Math.PI) / 180;
const SIN_T = Math.sin(TILT);
/** طول نموذج الصهريج (بعد مقياسه الداخلي) ونصف قطر العجلة بوحداته */
const MODEL_LEN = 3.95;
const WHEEL_R = 0.31 * 0.56;

export interface TruckPose {
  /** موضع الشاشة داخل اللوحة (بكسل) */
  sx: number; sy: number;
  /** اتجاه الطريق على الشاشة (راديان، y للأسفل) */
  heading: number;
  /** طول الصهريج على الشاشة (بكسل) */
  lengthPx: number;
  /** المسافة المقطوعة منذ الإطار السابق (بكسل) لدوران العجلات */
  travelPx: number;
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

interface Truck { pivot: THREE.Group; wheels: THREE.Object3D[]; beam: THREE.Mesh }

export class TankerLayer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  private hemi = new THREE.HemisphereLight(0xfff4e0, 0x8a5a2b, 1);
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private trucks = new Map<string, Truck>();
  private w = 1; private h = 1;
  private shadowTex = radialTexture('rgba(0,0,0,.55)', 'rgba(0,0,0,0)');
  private beamTex = beamTexture();
  private envRT: THREE.WebGLRenderTarget;

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
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w); this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.canvas.style.width = `${this.w}px`; this.canvas.style.height = `${this.h}px`;
    Object.assign(this.camera, { left: -this.w / 2, right: this.w / 2, top: this.h / 2, bottom: -this.h / 2 });
    this.camera.updateProjectionMatrix();
  }

  setNight(night: boolean) {
    this.hemi.color.set(night ? 0x7b8fb8 : 0xfff4e0);
    this.hemi.groundColor.set(night ? 0x1a120a : 0x8a5a2b);
    this.hemi.intensity = night ? 0.45 : 1.1;
    this.sun.color.set(night ? 0xa9bbff : 0xffffff);
    this.sun.intensity = night ? 0.55 : 2.3;
    this.scene.environmentIntensity = night ? 0.3 : 0.95;
    this.trucks.forEach(t => { t.beam.visible = night; });
  }

  /** إضافة صهاريج الطلبات الجديدة وإزالة المنتهية (بلا إعادة إنشاء السياق) */
  sync(ids: string[], night: boolean) {
    const keep = new Set(ids);
    this.trucks.forEach((t, id) => {
      if (keep.has(id)) return;
      this.scene.remove(t.pivot);
      t.pivot.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
      this.trucks.delete(id);
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
      beam.visible = night;
      this.scene.add(pivot);
      this.trucks.set(id, { pivot, wheels: (model.userData.wheels as THREE.Object3D[]) ?? [], beam });
    });
  }

  /** وضع كل صهريج عند موضعه واتجاهه على الشاشة ثم الرسم */
  render(poses: Map<string, TruckPose>) {
    this.trucks.forEach((t, id) => {
      const p = poses.get(id);
      t.pivot.visible = !!p;
      if (!p) return;
      // نقطة الشاشة ← نقطة على أرض المشهد (الكاميرا مائلة: محور العمق مضغوط بجيب الميل)
      t.pivot.position.set(p.sx - this.w / 2, 0, (p.sy - this.h / 2) / SIN_T);
      const gx = Math.cos(p.heading), gz = Math.sin(p.heading) / SIN_T;
      t.pivot.rotation.y = -Math.atan2(gz, gx);
      const k = p.lengthPx / MODEL_LEN;
      t.pivot.scale.setScalar(k);
      const spin = p.travelPx / k / WHEEL_R;
      if (spin) t.wheels.forEach(w => { w.rotation.z -= spin; });
    });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.sync([], false);
    this.shadowTex.dispose(); this.beamTex.dispose(); this.envRT.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
