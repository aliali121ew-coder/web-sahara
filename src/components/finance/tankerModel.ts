import * as THREE from 'three';

/**
 * صهريج وقود ثلاثي الأبعاد لخريطة مركز المراقبة: قاطرة حمراء (زجاج أمامي وجانبي، شبكة، مصد كروم، أضواء، مرايا، عوادم)
 * ومقطورة خزان بيضاوي بنهايتين مقبّبتين، وأحزمة كروم، وخط برتقالي، وممشى علوي بفتحات تعبئة ودرابزين، وخراطيم، وسلم خلفي،
 * ولوحة مواد خطرة، وست محاور عجلات بجنوط. المقدمة باتجاه +x.
 * userData.wheels = مجموعات العجلات (تدور حول z مع سرعة المركبة). polished = خزان ستانلس لامع (يحتاج بيئة انعكاس).
 */
export interface TankerOptions { cab?: number; polished?: boolean }
export const createTanker = (opts: TankerOptions = {}): THREE.Group => {
  const g = new THREE.Group();
  const M = (color: number, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25, ...o });
  const chrome = M(0xe8eef5, { roughness: 0.22, metalness: 0.55 });
  const paint = M(opts.cab ?? 0xc81e1e, { roughness: 0.32, metalness: 0.35 });
  const dark = M(0x1f2937, { roughness: 0.8, metalness: 0.1 });
  const tire = M(0x0d0f12, { roughness: 0.95, metalness: 0 });
  const glass = M(0x0f2742, { roughness: 0.08, metalness: 0.4, emissive: 0x0b2a4a, emissiveIntensity: 0.35 });
  const tankMat = opts.polished ? M(0xd6dce4, { roughness: 0.14, metalness: 0.95 }) : M(0xdfe5ec, { roughness: 0.28, metalness: 0.45 });
  const orange = M(0xf59e0b, { roughness: 0.4, emissive: 0x7c2d12, emissiveIntensity: 0.15 });
  const lamp = (c: number) => M(c, { emissive: c, emissiveIntensity: 1.3, roughness: 0.2 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
  };
  // الهيكل
  add(new THREE.BoxGeometry(6.3, 0.18, 0.72), dark, -0.35, 0.44, 0);
  // القاطرة (المقدمة باتجاه +x)
  add(new THREE.BoxGeometry(1.25, 1.06, 1.12), paint, 2.15, 1.06, 0);
  add(new THREE.BoxGeometry(0.6, 0.64, 1.08), paint, 2.96, 0.84, 0);
  add(new THREE.BoxGeometry(1.05, 0.34, 1.04), paint, 2.05, 1.75, 0, 0, 0, 0.04);
  add(new THREE.BoxGeometry(0.05, 0.52, 1.0), glass, 2.8, 1.27, 0, 0, 0, -0.2);
  [0.57, -0.57].forEach(z => add(new THREE.BoxGeometry(0.6, 0.4, 0.02), glass, 2.33, 1.3, z));
  [0.57, -0.57].forEach(z => add(new THREE.BoxGeometry(0.02, 0.7, 0.02), dark, 1.98, 1.0, z));
  add(new THREE.BoxGeometry(0.05, 0.44, 0.8), dark, 3.27, 0.86, 0);
  for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.05, 0.03, 0.78), chrome, 3.3, 0.68 + i * 0.085, 0);
  add(new THREE.BoxGeometry(0.18, 0.17, 1.16), chrome, 3.33, 0.5, 0);
  [0.4, -0.4].forEach(z => add(new THREE.BoxGeometry(0.05, 0.11, 0.22), lamp(0xfff4c2), 3.3, 0.67, z));
  [0.42, -0.42].forEach(z => add(new THREE.BoxGeometry(0.04, 0.05, 0.1), lamp(0xfbbf24), 3.3, 1.1, z));
  [0.68, -0.68].forEach(z => {
    add(new THREE.BoxGeometry(0.05, 0.3, 0.1), dark, 2.74, 1.36, z);
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6), chrome, 2.74, 1.36, z * 0.9, Math.PI / 2);
  });
  [0.5, -0.5].forEach(z => add(new THREE.CylinderGeometry(0.055, 0.055, 1.05, 12), chrome, 1.48, 1.5, z));
  [0.52, -0.52].forEach(z => add(new THREE.CylinderGeometry(0.17, 0.17, 0.62, 16), chrome, 1.95, 0.58, z, 0, 0, Math.PI / 2));
  [0.58, -0.58].forEach(z => add(new THREE.BoxGeometry(0.4, 0.05, 0.12), dark, 1.6, 0.45, z));
  // خزان المقطورة: مقطع بيضاوي، ونهايتان مقبّبتان، وأحزمة كروم، وخط برتقالي
  const tankGeo = new THREE.CylinderGeometry(0.64, 0.64, 4.0, 40, 1); tankGeo.scale(1, 1, 0.86);
  add(tankGeo, tankMat, -1.25, 1.2, 0, 0, 0, Math.PI / 2);
  [-3.25, 0.75].forEach((x, k) => { const cap = add(new THREE.SphereGeometry(0.64, 32, 20), tankMat, x, 1.2, 0); cap.scale.set(0.3, 1, 0.86); cap.position.x += k ? 0 : 0; });
  [-2.9, -2.1, -1.25, -0.4, 0.4].forEach(x => { const b = new THREE.CylinderGeometry(0.652, 0.652, 0.06, 40, 1); b.scale(1, 1, 0.86); add(b, chrome, x, 1.2, 0, 0, 0, Math.PI / 2); });
  [0.555, -0.555].forEach(z => add(new THREE.BoxGeometry(3.7, 0.13, 0.02), orange, -1.25, 1.02, z));
  // الممشى العلوي وفتحات التعبئة والدرابزين
  add(new THREE.BoxGeometry(3.5, 0.04, 0.3), dark, -1.25, 1.86, 0);
  [-2.45, -1.25, -0.05].forEach(x => add(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 16), chrome, x, 1.9, 0));
  [0.17, -0.17].forEach(z => add(new THREE.BoxGeometry(3.5, 0.02, 0.02), chrome, -1.25, 2.06, z));
  for (let i = 0; i < 6; i++) [0.17, -0.17].forEach(z => add(new THREE.BoxGeometry(0.02, 0.2, 0.02), chrome, -2.95 + i * 0.68, 1.96, z));
  // خراطيم التفريغ على الجانبين والسلم الخلفي ولوحة المواد الخطرة
  [0.46, -0.46].forEach(z => add(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 12), chrome, -1.3, 0.66, z, 0, 0, Math.PI / 2));
  [0.12, -0.12].forEach(z => add(new THREE.BoxGeometry(0.03, 1.3, 0.03), chrome, -3.48, 1.25, z));
  for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(0.03, 0.03, 0.27), chrome, -3.48, 0.75 + i * 0.25, 0);
  const plac = M(0xdc2626, { emissive: 0x7f1d1d, emissiveIntensity: 0.4 });
  [0.56, -0.56].forEach(z => add(new THREE.BoxGeometry(0.24, 0.24, 0.01), plac, -1.25, 1.36, z, 0, 0, Math.PI / 4));
  // الإضاءة الخلفية والمصد الخلفي ورفارف الطين
  [0.42, -0.42].forEach(z => add(new THREE.BoxGeometry(0.04, 0.1, 0.2), lamp(0xef4444), -3.62, 0.62, z));
  add(new THREE.BoxGeometry(0.12, 0.12, 1.1), dark, -3.6, 0.45, 0);
  [0.5, -0.5].forEach(z => { add(new THREE.BoxGeometry(0.04, 0.32, 0.26), dark, 0.62, 0.36, z); add(new THREE.BoxGeometry(0.04, 0.32, 0.26), dark, -3.25, 0.36, z); });
  // العجلات: إطار وجنط ومحور (أمامي، اثنان للقاطرة، ثلاثة للمقطورة)
  const tireGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.24, 24), rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.25, 16), hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.26, 8);
  const lugGeo = new THREE.BoxGeometry(0.035, 0.035, 0.02);
  const wheels: THREE.Group[] = [];
  [2.75, 1.42, 0.98, -2.15, -2.7, -3.15].forEach(x => [0.47, -0.47].forEach(z => {
    const w = new THREE.Group(); w.position.set(x, 0.31, z); g.add(w); wheels.push(w);
    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, zz = 0) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = Math.PI / 2; m.position.z = zz; w.add(m); };
    part(tireGeo, tire); part(rimGeo, chrome); part(hubGeo, dark, z * 0.02);
    // صواميل الجنط على الوجه الخارجي (تُظهر دوران العجلة)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const lug = new THREE.Mesh(lugGeo, dark); lug.position.set(Math.cos(a) * 0.11, Math.sin(a) * 0.11, Math.sign(z) * 0.13); w.add(lug);
    }
  }));
  g.userData.wheels = wheels;
  g.scale.setScalar(0.56);
  return g;
};
