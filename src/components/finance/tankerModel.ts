import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeStatic } from './mergeStatic';

/**
 * صهريج وقود واقعي (قاطرة ومقطورة نصفية) مبني بالأمتار على مقاسات حقيقية (الطول الكلي 16.5 م)، ثم مصغّر إلى 3.95 وحدة
 * ليبقى متوافقًا مع الخرائط. المقدمة باتجاه +x، والعجلات على الأرض (y = 0).
 * القاطرة: كابينة أوروبية عالية بزوايا مستديرة، وعاكس هواء على السقف، وزجاج أمامي مائل وجانبي، وواقية شمس،
 * وشبكة كروم، ومصد بأضواء أمامية وضباب، ومرايا بأذرع، ودرجات، وخزانا وقود وهواء، وعادم عمودي، وصحن قاطرة، و3 محاور.
 * المقطورة: خزان بيضاوي بنهايتين مقبّبتين وأحزمة، وممشى علوي بفتحات تعبئة ودرابزين، وسلم خلفي، وخزانة صمامات،
 * وأنابيب الخراطيم على الجانبين، وأرجل الإسناد (الساق) بأقدامها ومقبض التدوير، وحواجز جانبية، ورفارف، و3 محاور بعجلات مزدوجة،
 * ومصد خلفي بالأضواء، ولوحتا مواد خطرة.
 * userData: wheels (تدور حول z)، brake / signalL / signalR / beacon (خامات أضواء)، hose (خرطوم التفريغ، مخفي)، hoseTip (طرفه).
 */
export interface TankerOptions { cab?: number; polished?: boolean }

/** طول النموذج بعد التصغير (يُستعمل لضبط مقياسه في المشاهد) */
export const TANKER_LEN = 3.95;
const REAL_LEN = 16.5;

export const createTanker = (opts: TankerOptions = {}): THREE.Group => {
  const root = new THREE.Group();
  const g = new THREE.Group(); root.add(g);
  const M = (color: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25, ...o });
  const paint = M(opts.cab ?? 0xc81e1e, { roughness: 0.28, metalness: 0.45 });
  const chrome = M(0xe9eef4, { roughness: 0.16, metalness: 0.9 });
  const dark = M(0x1c2129, { roughness: 0.75, metalness: 0.1 });
  const plastic = M(0x2b3038, { roughness: 0.6, metalness: 0.05 });
  const glass = M(0x0d1b2a, { roughness: 0.05, metalness: 0.6, emissive: 0x0b2238, emissiveIntensity: 0.25 });
  const tire = M(0x111214, { roughness: 0.95, metalness: 0 });
  const rimMat = M(0xcfd5dc, { roughness: 0.3, metalness: 0.75 });
  const tankMat = opts.polished ? M(0xd9dee5, { roughness: 0.12, metalness: 0.95 }) : M(0xe5e9ee, { roughness: 0.3, metalness: 0.45 });
  const lamp = (c: number, i = 1.4) => M(c, { emissive: c, emissiveIntensity: i, roughness: 0.2 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, rz = 0) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, 0, 0, rz);
  const rbox = (w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number) => add(new RoundedBoxGeometry(w, h, d, 3, r), mat, x, y, z);
  const cyl = (r: number, len: number, mat: THREE.Material, x: number, y: number, z: number, axis: 'x' | 'y' | 'z', seg = 20) => {
    const m = add(new THREE.CylinderGeometry(r, r, len, seg), mat, x, y, z);
    if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2;
    return m;
  };

  // ======================= القاطرة (من x = 2.0 إلى 8.25) =======================
  box(6.1, 0.28, 0.86, dark, 5.1, 0.98, 0);                                     // الشاسيه
  rbox(2.3, 2.62, 2.5, 0.16, paint, 7.05, 2.46, 0);                              // الكابينة
  rbox(1.95, 0.62, 2.36, 0.22, paint, 6.85, 4.02, 0).rotation.z = 0.12;          // عاكس الهواء
  // الزجاج الأمامي المائل والجانبي، وواقية الشمس، وأضواء السقف
  add(new THREE.BoxGeometry(0.06, 1.12, 2.22), glass, 8.18, 3.0, 0, 0, 0, -0.08);
  [1.255, -1.255].forEach(z => { box(1.25, 0.9, 0.04, glass, 7.4, 3.05, z); box(0.9, 0.8, 0.03, plastic, 6.5, 2.0, z); });
  add(new THREE.BoxGeometry(0.42, 0.06, 2.3), plastic, 8.26, 3.66, 0, 0, 0, -0.18);
  for (let i = 0; i < 5; i++) box(0.08, 0.06, 0.12, lamp(0xfbbf24, 0.9), 8.12, 3.74, -0.6 + i * 0.3);
  // الشبكة والشعار والمصد بالأضواء
  box(0.06, 1.0, 1.6, dark, 8.22, 1.95, 0);
  for (let i = 0; i < 6; i++) box(0.07, 0.05, 1.56, chrome, 8.25, 1.55 + i * 0.16, 0);
  box(0.4, 0.55, 2.5, plastic, 8.12, 1.0, 0);
  box(0.04, 0.12, 2.4, chrome, 8.33, 1.2, 0);
  const head = lamp(0xfff6d5, 1.6);
  [0.92, -0.92].forEach(z => { box(0.05, 0.2, 0.42, head, 8.33, 1.0, z); box(0.05, 0.1, 0.16, lamp(0xfff6d5, 1), 8.33, 0.8, z * 0.8); });
  const signalL = lamp(0xf59e0b, 0.15), signalR = lamp(0xf59e0b, 0.15);
  signalL.name = 'signalL'; signalR.name = 'signalR';
  box(0.05, 0.14, 0.14, signalL, 8.33, 1.0, -1.18); box(0.05, 0.14, 0.14, signalR, 8.33, 1.0, 1.18);
  box(0.03, 0.22, 0.5, M(0xf97316, { emissive: 0x7c2d12, emissiveIntensity: 0.2 }), 8.35, 0.62, 0);  // لوحة المواد الخطرة
  // المرايا بأذرعها، والدرجات، والرفارف
  [1, -1].forEach(s => {
    box(0.06, 0.06, 0.45, chrome, 7.95, 3.2, s * 1.42);
    box(0.12, 0.62, 0.28, plastic, 7.95, 2.95, s * 1.62);
    box(0.5, 0.06, 0.3, chrome, 7.25, 0.75, s * 1.17); box(0.5, 0.06, 0.3, chrome, 7.25, 1.1, s * 1.17);
    const fender = add(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 20, 1, true, 0, Math.PI), plastic, 7.3, 0.55, s * 1.06, Math.PI / 2, 0, Math.PI / 2);
    fender.scale.set(1, 1, 1);
  });
  // خزان الوقود، خزان الهواء، والعادم، وصحن القاطرة، وواقيات طين
  cyl(0.34, 1.3, chrome, 5.3, 0.95, -1.0, 'x', 24);
  cyl(0.22, 0.9, M(0x3f4651), 5.3, 0.9, 1.0, 'x');
  cyl(0.09, 2.2, chrome, 5.78, 2.75, 1.12, 'y');
  box(1.3, 0.12, 1.6, dark, 3.9, 1.35, 0);
  [1, -1].forEach(s => box(0.05, 0.5, 0.55, dark, 1.8, 0.55, s * 1.0));

  // ======================= المقطورة (من x = -8.25 إلى 3.6) =======================
  box(11.4, 0.22, 0.9, dark, -2.45, 1.12, 0);                                   // الإطار
  // الخزان البيضاوي بنهايتين مقبّبتين وأحزمة
  const TX0 = -7.75, TX1 = 3.05, TY = 2.4, RZ = 1.25, RY = 1.06;
  const shell = new THREE.CylinderGeometry(1, 1, TX1 - TX0, 56, 1, true); shell.scale(RY, 1, RZ);
  add(shell, tankMat, (TX0 + TX1) / 2, TY, 0, 0, 0, Math.PI / 2);
  [TX0, TX1].forEach((x, k) => { const cap = add(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), tankMat, x, TY, 0, 0, 0, k ? -Math.PI / 2 : Math.PI / 2); cap.scale.set(RY, 0.38, RZ); });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.TorusGeometry(1, 0.035, 8, 56); b.scale(RY + 0.01, RZ + 0.01, 1);
    add(b, chrome, TX0 + 0.6 + i * ((TX1 - TX0 - 1.2) / 5), TY, 0, 0, Math.PI / 2, 0);
  }
  // شريط بلون الشركة على الجانبين
  [1, -1].forEach(s => box(TX1 - TX0 - 0.4, 0.16, 0.02, M(0xf59e0b, { roughness: 0.4 }), (TX0 + TX1) / 2, TY - 0.25, s * (RZ + 0.005)));
  // الممشى العلوي والفتحات والدرابزين القابل للطي
  box(TX1 - TX0 - 1.2, 0.05, 0.55, dark, (TX0 + TX1) / 2, TY + RY + 0.05, 0);
  for (let i = 0; i < 4; i++) cyl(0.28, 0.14, chrome, TX0 + 1.4 + i * 2.6, TY + RY + 0.1, 0, 'y', 24);
  [0.3, -0.3].forEach(z => box(TX1 - TX0 - 1.4, 0.04, 0.04, M(0xfacc15, { roughness: 0.4 }), (TX0 + TX1) / 2, TY + RY + 0.42, z));
  for (let i = 0; i < 9; i++) [0.3, -0.3].forEach(z => box(0.04, 0.38, 0.04, chrome, TX0 + 1 + i * 1.15, TY + RY + 0.23, z));
  // السلم الخلفي
  [0.18, -0.18].forEach(z => box(0.05, 2.2, 0.05, chrome, TX0 - 0.42, 2.0, z));
  for (let i = 0; i < 7; i++) box(0.05, 0.04, 0.36, chrome, TX0 - 0.42, 1.0 + i * 0.3, 0);
  // خزانة الصمامات وأنابيب الخراطيم على الجانبين
  box(1.6, 0.75, 2.2, M(0x9aa1ab, { roughness: 0.4, metalness: 0.6 }), -2.2, 0.95, 0);
  [1, -1].forEach(s => cyl(0.14, 4.4, M(0xb8bec6, { roughness: 0.3, metalness: 0.7 }), 1.0, 1.05, s * 1.12, 'x'));
  // أرجل الإسناد (الساق) بأقدامها ومقبض التدوير
  [0.82, -0.82].forEach(z => { box(0.16, 1.05, 0.16, dark, 1.65, 0.6, z); box(0.4, 0.06, 0.4, dark, 1.65, 0.05, z); });
  box(0.1, 0.1, 1.7, dark, 1.65, 0.75, 0);
  cyl(0.03, 0.4, chrome, 1.65, 0.75, -1.05, 'z');
  // الحواجز الجانبية والرفارف
  [1, -1].forEach(s => {
    [0.5, 0.82].forEach(y => box(4.6, 0.06, 0.04, M(0x9ca3af, { roughness: 0.4, metalness: 0.6 }), -1.6, y, s * 1.15));
    box(4.3, 0.1, 0.62, dark, -5.95, 1.15, s * 0.98);
    box(0.04, 0.55, 0.6, dark, -8.05, 0.62, s * 1.0);
  });
  // المصد الخلفي وأضواء الفرامل والإشارات والعواكس
  box(0.15, 0.18, 2.4, M(0x9ca3af, { roughness: 0.4, metalness: 0.6 }), -8.2, 0.5, 0);
  const brake = lamp(0xef4444, 0.7); brake.name = 'brake';
  [0.95, -0.95].forEach(z => box(0.05, 0.16, 0.36, brake, -8.28, 0.82, z));
  box(0.05, 0.14, 0.14, signalL, -8.28, 0.82, -0.62); box(0.05, 0.14, 0.14, signalR, -8.28, 0.82, 0.62);
  box(0.03, 0.22, 0.5, M(0xf97316, { emissive: 0x7c2d12, emissiveIntensity: 0.2 }), -8.3, 1.2, 0);

  // ======================= العجلات =======================
  const wheels: THREE.Group[] = [];
  const tireGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.3, 30), rimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.31, 20), lugGeo = new THREE.BoxGeometry(0.05, 0.05, 0.03);
  const wheel = (x: number, z: number, dual: boolean) => {
    const w = new THREE.Group(); w.position.set(x, 0.52, z); g.add(w); wheels.push(w);
    const side = Math.sign(z);
    (dual ? [-0.17, 0.17] : [0]).forEach(o => {
      const t = new THREE.Mesh(tireGeo, tire); t.rotation.x = Math.PI / 2; t.position.z = o; w.add(t);
      const r = new THREE.Mesh(rimGeo, rimMat); r.rotation.x = Math.PI / 2; r.position.z = o; w.add(r);
    });
    const face = side * (dual ? 0.33 : 0.16);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const l = new THREE.Mesh(lugGeo, dark); l.position.set(Math.cos(a) * 0.18, Math.sin(a) * 0.18, face); w.add(l); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), chrome); hub.rotation.x = Math.PI / 2; hub.position.z = face; w.add(hub);
  };
  [1.06, -1.06].forEach(z => wheel(7.3, z, false));
  [3.55, 2.25].forEach(x => [0.92, -0.92].forEach(z => wheel(x, z, true)));
  [-4.6, -5.95, -7.3].forEach(x => [0.92, -0.92].forEach(z => wheel(x, z, true)));

  // مصباح التحذير على السقف، وخرطوم التفريغ (من خزانة الصمامات إلى نقطة التفريغ)
  const beacon = lamp(0xf59e0b, 0.1); beacon.name = 'beacon';
  cyl(0.12, 0.16, beacon, 6.4, 4.38, 0, 'y');
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.2, 0.8, 1.1), new THREE.Vector3(-2.0, 0.2, 2.0), new THREE.Vector3(-1.6, 0.12, 3.3), new THREE.Vector3(-1.3, 0.6, 3.95), new THREE.Vector3(-1.17, 1.15, 4.09)]), 32, 0.075, 8), M(0x111827, { roughness: 0.7 }));
  hose.visible = false; g.add(hose);
  // طرف الخرطوم (لحساب موقف الصهريج بحيث يصل الطرف إلى وصلة الخزانات)
  const hoseTip = new THREE.Object3D(); hoseTip.position.set(-1.17, 1.15, 4.09); g.add(hoseTip);

  g.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  // دمج الأجزاء الثابتة حسب الخامة (مئات القطع تصير بضع عشرات)، مع إبقاء العجلات (تدور) والخرطوم وطرفه مستقلة
  wheels.forEach(w => { mergeStatic(w); w.userData.keep = true; });
  hose.userData.keep = true;
  mergeStatic(g);
  g.scale.setScalar(TANKER_LEN / REAL_LEN);
  Object.assign(root.userData, { wheels, brake, signalL, signalR, beacon, hose, hoseTip });
  return root;
};
