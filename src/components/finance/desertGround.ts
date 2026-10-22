import * as THREE from 'three';

/**
 * أرض صحراوية واقعية: كثبان منخفضة بارتفاع حقيقي (ضوضاء متعددة الطبقات)، وألوان رمل تتغير مع الارتفاع والميل،
 * وخامة تفاصيل بتموجات رمل وحبيبات، وبقع حصى، وشجيرات جافة متفرقة بأحجام وألوان مختلفة وحجارة.
 * flat(x, z) من 0 إلى 1 يسطّح الأرض تحت الشوارع والساحات (1 = مستوية تمامًا ولا شجيرات).
 */

const hash = (x: number, y: number, s: number) => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const smooth = (t: number) => t * t * (3 - 2 * t);
const vnoise = (x: number, y: number, s: number) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
export const fbm = (x: number, y: number, oct = 4, s = 1) => {
  let f = 0, amp = 0.5, fr = 1;
  for (let i = 0; i < oct; i++) { f += amp * vnoise(x * fr, y * fr, s + i * 17); amp *= 0.5; fr *= 2.03; }
  return f;
};

export interface DesertOptions {
  size: number;
  segments?: number;
  /** ارتفاع الكثبان الأقصى */
  height?: number;
  flat?: (x: number, z: number) => number;
  /** عدد الشجيرات */
  shrubs?: number;
  seed?: number;
}
export interface Desert {
  group: THREE.Group;
  heightAt: (x: number, z: number) => number;
  setNight: (night: boolean) => void;
  dispose: () => void;
}

export const createDesert = (o: DesertOptions): Desert => {
  const { size, segments = 220, height = 14, flat = () => 0, shrubs = 2600, seed = 3 } = o;
  const trash: { dispose: () => void }[] = [];
  const group = new THREE.Group();
  // كثبان: موجات طويلة باتجاه الريح + ضوضاء
  const heightAt = (x: number, z: number) => {
    const k = 1 - Math.min(1, Math.max(0, flat(x, z)));
    if (k <= 0) return 0;
    const dune = Math.pow(Math.abs(Math.sin((x * 0.6 + z) / 210 + fbm(x / 400, z / 400, 3, seed) * 3)), 2.2);
    const roll = fbm(x / 260, z / 260, 4, seed + 5);
    return (dune * 0.55 + roll * 0.6 - 0.3) * height * k;
  };

  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), sandA = new THREE.Color(0xb98549), sandB = new THREE.Color(0xc79a5e), sandC = new THREE.Color(0x9e7040), grit = new THREE.Color(0x8c7a62);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const t = THREE.MathUtils.clamp(y / height + 0.35, 0, 1);
    c.copy(sandC).lerp(sandA, t).lerp(sandB, Math.max(0, t - 0.55) * 1.6);
    const n = fbm(x / 90, z / 90, 3, seed + 9);
    if (n > 0.62) c.lerp(grit, (n - 0.62) * 1.8);
    c.multiplyScalar(0.93 + fbm(x / 30, z / 30, 2, seed + 11) * 0.14);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  trash.push(geo);

  // خامة التفاصيل: تموجات رمل وحبيبات (تُضرب في لون الرأس)
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const x = cv.getContext('2d')!;
  x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    const y0 = (i / 70) * 512 + Math.random() * 4;
    x.strokeStyle = `rgba(150,120,90,${0.1 + Math.random() * 0.12})`; x.lineWidth = 1.2 + Math.random() * 1.4;
    x.beginPath();
    for (let px = 0; px <= 512; px += 8) x.lineTo(px, y0 + Math.sin(px / 38 + i) * 3 + Math.sin(px / 11) * 0.8);
    x.stroke();
  }
  for (let i = 0; i < 9000; i++) {
    const v = 150 + Math.random() * 105;
    x.fillStyle = `rgba(${v},${v * 0.92},${v * 0.8},${0.25 + Math.random() * 0.35})`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 1.4, 1 + Math.random() * 1.4);
  }
  // نقاط داكنة دقيقة (شجيرات بعيدة وحصى) كما في الصورة
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = `rgba(${90 + Math.random() * 30},${74 + Math.random() * 25},${46 + Math.random() * 15},${0.12 + Math.random() * 0.18})`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 0.8 + Math.random(), 0.8 + Math.random());
  }
  const detail = new THREE.CanvasTexture(cv); detail.colorSpace = THREE.SRGBColorSpace;
  detail.wrapS = detail.wrapT = THREE.RepeatWrapping; detail.repeat.set(size / 90, size / 90); detail.anisotropy = 8;
  trash.push(detail);
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 1, metalness: 0 });
  trash.push(groundMat);
  const ground = new THREE.Mesh(geo, groundMat); ground.receiveShadow = true; group.add(ground);

  // شجيرات جافة (عناقيد كرات مضغوطة) وحجارة صغيرة، في تجمعات طبيعية
  const rnd = (() => { let s = seed * 9301 + 49297; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  // أشكال منخفضة المضلعات: آلاف النسخ دون ثقل
  const bushGeo = new THREE.IcosahedronGeometry(1, 0), rockGeo = new THREE.DodecahedronGeometry(1, 0), pebbleGeo = new THREE.TetrahedronGeometry(1, 0);
  trash.push(bushGeo, rockGeo, pebbleGeo);
  const bushMat = new THREE.MeshStandardMaterial({ roughness: 0.95 }), rockMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  trash.push(bushMat, rockMat);
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, shrubs), rocks = new THREE.InstancedMesh(rockGeo, rockMat, Math.round(shrubs / 3));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const tones = [0x6b6530, 0x5c5a2b, 0x7a6b36, 0x4e4a25, 0x8a7440, 0x6f5d32];
  const rockTones = [0x8a7a64, 0x9c8a70, 0x766653, 0xa8977c];
  let nb = 0, nr = 0;
  const half = size / 2 * 0.92;
  for (let tries = 0; nb < shrubs && tries < shrubs * 6; tries++) {
    // مركز تجمع ثم انتشار حوله
    const ccx = (rnd() - 0.5) * 2 * half, ccz = (rnd() - 0.5) * 2 * half;
    const count = 2 + Math.floor(rnd() * 6);
    for (let k = 0; k < count && nb < shrubs; k++) {
      const px = ccx + (rnd() - 0.5) * 60, pz = ccz + (rnd() - 0.5) * 60;
      if (Math.abs(px) > half || Math.abs(pz) > half || flat(px, pz) > 0.05) continue;
      const s = 1.4 + Math.pow(rnd(), 3) * 3.6;
      e.set(0, rnd() * 6, 0); q.setFromEuler(e);
      m4.compose(v3.set(px, heightAt(px, pz) + s * 0.3, pz), q, s3.set(s * (0.9 + rnd() * 0.7), s * (0.45 + rnd() * 0.3), s * (0.9 + rnd() * 0.6)));
      bushes.setMatrixAt(nb, m4); bushes.setColorAt(nb, new THREE.Color(tones[(rnd() * tones.length) | 0]).multiplyScalar(0.85 + rnd() * 0.3)); nb++;
    }
    if (nr < rocks.instanceMatrix.count && rnd() < 0.5) {
      const px = ccx + (rnd() - 0.5) * 40, pz = ccz + (rnd() - 0.5) * 40;
      if (Math.abs(px) < half && Math.abs(pz) < half && flat(px, pz) < 0.05) {
        const s = 0.8 + rnd() * 2.2;
        e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
        m4.compose(v3.set(px, heightAt(px, pz) + s * 0.2, pz), q, s3.set(s, s * 0.6, s * 0.9));
        rocks.setMatrixAt(nr, m4); rocks.setColorAt(nr, new THREE.Color(rockTones[(rnd() * rockTones.length) | 0])); nr++;
      }
    }
  }
  bushes.count = nb; rocks.count = nr;
  // خصلات عشب جاف صغيرة كثيفة موزعة على كل الأرض (ملمس الصورة)
  const tuftGeo = new THREE.ConeGeometry(1, 1.4, 4); trash.push(tuftGeo);
  const tuftMat = new THREE.MeshStandardMaterial({ roughness: 1 }); trash.push(tuftMat);
  const TUFTS = shrubs * 4;
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, TUFTS);
  let nt = 0;
  for (let tries = 0; nt < TUFTS && tries < TUFTS * 2; tries++) {
    const px = (rnd() - 0.5) * 2 * half, pz = (rnd() - 0.5) * 2 * half;
    if (flat(px, pz) > 0.05 || fbm(px / 160, pz / 160, 2, seed + 21) < 0.35) continue;
    const s = 0.7 + rnd() * 1.3;
    e.set(0, rnd() * 6, 0); q.setFromEuler(e);
    m4.compose(v3.set(px, heightAt(px, pz) + s * 0.4, pz), q, s3.set(s, s * (0.6 + rnd() * 0.6), s));
    tufts.setMatrixAt(nt, m4); tufts.setColorAt(nt, new THREE.Color(tones[(rnd() * tones.length) | 0]).multiplyScalar(0.7 + rnd() * 0.3)); nt++;
  }
  tufts.count = nt;
  group.add(tufts);
  // حصى: حجارة صغيرة مجسمة بأحجام متفاوتة في بقع الحصى
  const GRAVEL = shrubs * 2;
  const gravel = new THREE.InstancedMesh(pebbleGeo, rockMat, GRAVEL);
  let ng = 0;
  for (let tries = 0; ng < GRAVEL && tries < GRAVEL * 4; tries++) {
    const px = (rnd() - 0.5) * 2 * half, pz = (rnd() - 0.5) * 2 * half;
    if (flat(px, pz) > 0.05 || fbm(px / 90, pz / 90, 3, seed + 9) < 0.58) continue;
    const s = 0.35 + Math.pow(rnd(), 2) * 1.4;
    e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
    m4.compose(v3.set(px, heightAt(px, pz) + s * 0.15, pz), q, s3.set(s, s * 0.55, s * 0.85));
    gravel.setMatrixAt(ng, m4); gravel.setColorAt(ng, new THREE.Color(rockTones[(rnd() * rockTones.length) | 0]).multiplyScalar(0.8 + rnd() * 0.35)); ng++;
  }
  gravel.count = ng;
  gravel.receiveShadow = true;
  group.add(gravel);
  bushes.castShadow = true; bushes.receiveShadow = true; rocks.castShadow = true;
  group.add(bushes, rocks);

  return {
    group, heightAt,
    setNight: night => { groundMat.color.set(night ? 0x4a4440 : 0xffffff); bushMat.color.set(night ? 0x6a6560 : 0xffffff); },
    dispose: () => trash.forEach(t => t.dispose()),
  };
};
