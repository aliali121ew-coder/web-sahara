import * as THREE from 'three';
import { M, depotLayout } from '../../lib/stationNetwork';

/**
 * محطة وقود ثلاثية الأبعاد بمقاييس حقيقية (1 م ≈ 5.1 وحدة؛ صهريج 16.5 م = 84 وحدة):
 * مظلة بيضاء مستديرة الزوايا بحافة ملونة عليها اسم المحطة وشريط إنارة مدمج، وأعمدة سميكة بقواعد،
 * جزيرتا مضخات خرسانيتان بأربعة موزعات (شاشات، خراطيم، مسدسات) وقضبان وحواجز حماية،
 * مبنى الإدارة بواجهة زجاجية ولافتة، ولوحة المنتجات المتوفرة (بنزين، كاز)، ومستودع خلفي بخزانات عمودية
 * (سلالم، درابزين) داخل جدار احتواء وأنابيب تنزل من الخزانات وتسير على دعامات إلى صمام ثم تدخل الأرض،
 * وظلال تماس ناعمة تحت كل كتلة. الواجهة نحو +z، والمركز عند الأصل. المستودع أكبر في مركز التوزيع (depot = 4).
 */

export interface StationColors { main: number; accent: number; shop: number }
export interface StationModel {
  group: THREE.Group;
  /** موضع الاسم فوق حافة المظلة الأمامية */
  nameAnchor: THREE.Vector3;
  /** خامات تتوهج ليلًا: [الخامة، شدة النهار، شدة الليل] */
  glow: [THREE.MeshStandardMaterial, number, number][];
  /** أضواء المحطة (تُشغَّل ليلًا) */
  lights: THREE.PointLight[];
  /** نقطة وصل خرطوم الصهريج بأنابيب الخزانات (خارج جدار المستودع الأمامي) */
  fillPoint: THREE.Vector3;
  dispose: () => void;
}


const rounded = (w: number, d: number, r: number) => {
  const s = new THREE.Shape();
  const x0 = -w / 2, y0 = -d / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x0 + w, y0 + d - r); s.absarc(x0 + w - r, y0 + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x0 + r, y0 + d); s.absarc(x0 + r, y0 + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};

/** حلقة بشكل المستطيل المستدير بسماكة t (للحافة وشريط الإنارة) */
const ring = (w: number, d: number, r: number, t: number) => {
  const s = rounded(w, d, r);
  s.holes.push(rounded(w - 2 * t, d - 2 * t, Math.max(0.5, r - t)));
  return s;
};

const tex = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
};
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const font = () => (typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) || 'sans-serif';

/** ظل تماس ناعم (بقعة داكنة متدرجة) يُلصق بالأرض تحت الكتل */
let blobTex: THREE.Texture | null = null;
const contactShadow = () => {
  if (!blobTex) blobTex = tex(128, 128, x => {
    const g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.55, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  });
  return blobTex;
};

/** المنتجات المعروضة على لوحة المحطة: الاسم وهل هو متوفر */
export interface StationProduct { label: string; available: boolean }
const DEFAULT_PRODUCTS: StationProduct[] = [{ label: 'بنزين', available: true }, { label: 'كاز', available: true }];

/** نص بارز: طبقات من نفس الحروف متتالية في العمق (الأمامية بيضاء مضيئة ليلًا، والخلفية بلون المحطة الداكن) */
const extrudedText = (text: string, colors: StationColors, maxW: number, h: number, depth: number, glow: StationModel['glow'], trash: { dispose: () => void }[]) => {
  const g = new THREE.Group();
  const H = 220;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `900 180px ${font()}`;
  const W = Math.ceil(probe.measureText(text).width) + 40;
  const t = tex(W, H, x => { x.font = `900 180px ${font()}`; x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(text, W / 2, H / 2 + 8); });
  trash.push(t);
  const w = Math.min(maxW, (h * W) / H), hh = (w * H) / W;
  const plane = new THREE.PlaneGeometry(w, hh); trash.push(plane);
  const side = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, color: new THREE.Color(colors.main).multiplyScalar(0.55), roughness: 0.5, side: THREE.DoubleSide });
  const front = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, color: 0xffffff, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.05, roughness: 0.3, side: THREE.DoubleSide });
  trash.push(side, front); glow.push([front, 0.05, 1.6]);
  const layers = 14;
  for (let i = 0; i < layers; i++) {
    const m = new THREE.Mesh(plane, i === layers - 1 ? front : side);
    m.position.set(0, hh / 2, -depth + (depth * i) / (layers - 1)); m.castShadow = i === 0; g.add(m);
  }
  const back = new THREE.Mesh(plane, front); back.position.set(0, hh / 2, -depth - 0.05); back.rotation.y = Math.PI; g.add(back);
  return g;
};

/** boardSide: جهة لوحة المنتجات (1 شرق المحطة، -1 غربها) بعيدًا عن حارة الصهاريج */
export const createStation = (name: string, colors: StationColors, depot = 2, products: StationProduct[] = DEFAULT_PRODUCTS, boardSide: 1 | -1 = -1): StationModel => {
  const group = new THREE.Group();
  const trash: { dispose: () => void }[] = [];
  const glow: StationModel['glow'] = [];
  const lights: THREE.PointLight[] = [];
  const mat = (color: number, o: THREE.MeshStandardMaterialParameters = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o }); trash.push(m); return m; };
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group, cast = true) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; parent.add(o); trash.push(geo); return o;
  };
  const glowMat = (color: number, emissive: number, day: number, night: number, o: THREE.MeshStandardMaterialParameters = {}) => {
    const m = mat(color, { emissive, emissiveIntensity: day, ...o }); glow.push([m, day, night]); return m;
  };
  const shadowMat = new THREE.MeshBasicMaterial({ map: contactShadow(), transparent: true, depthWrite: false, opacity: 1 });
  trash.push(shadowMat);
  const blob = (x: number, z: number, w: number, d: number, k = 1) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), shadowMat);
    p.rotation.x = -Math.PI / 2; p.position.set(x, 0.12, z); p.renderOrder = 1; p.scale.setScalar(k);
    group.add(p); trash.push(p.geometry);
  };

  const white = mat(0xf4f5f7, { roughness: 0.35, metalness: 0.15 });
  const main = mat(colors.main, { roughness: 0.4, metalness: 0.15 });
  const accent = mat(colors.accent, { roughness: 0.4, metalness: 0.15 });
  const concrete = mat(0xb4b7ba, { roughness: 0.92 });
  const steel = mat(0x9ca3af, { roughness: 0.35, metalness: 0.7 });
  const dark = mat(0x1f2937, { roughness: 0.6 });
  const yellow = mat(0xf5c518, { roughness: 0.5 }), black = mat(0x111827, { roughness: 0.6 });

  // ---------------- المظلة ----------------
  const CW = 26 * M, CD = 13 * M, CH = 5.4 * M, CT = 1.1 * M;
  const cx = -8 * M, cz = 1 * M;
  const slab = add(new THREE.ExtrudeGeometry(rounded(CW, CD, 2.8 * M), { depth: CT, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 2 }), white, cx, CH + CT + 1.4 * M, cz);
  slab.rotation.x = Math.PI / 2;
  // حافة عميقة بلون المحطة، وعليها اسمها في الأمام والخلف، وشريط إنارة مدمج أسفلها
  const fascia = add(new THREE.ExtrudeGeometry(ring(CW + 1.4, CD + 1.4, 3 * M, 0.7 * M), { depth: 1.6 * M, bevelEnabled: false }), main, cx, CH + 1.6 * M, cz);
  fascia.rotation.x = Math.PI / 2;
  const nameTex = tex(1024, 160, x => {
    x.fillStyle = hex(colors.main); x.fillRect(0, 0, 1024, 160);
    x.fillStyle = hex(colors.accent); x.fillRect(0, 0, 230, 160);
    x.fillStyle = hex(colors.main); x.beginPath(); x.moveTo(115, 30); x.quadraticCurveTo(160, 92, 115, 132); x.quadraticCurveTo(70, 92, 115, 30); x.fill();
    x.fillStyle = '#fff'; x.font = `800 96px ${font()}`; x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name, 620, 86);
  });
  trash.push(nameTex);
  const nameMat = glowMat(0xffffff, 0xffffff, 0.08, 0.9, { map: nameTex, emissiveMap: nameTex, roughness: 0.4 });
  [1, -1].forEach(s => {
    const p = add(new THREE.PlaneGeometry(CW * 0.62, 1.4 * M), nameMat, cx, CH + 0.8 * M, cz + s * (CD / 2 + 0.75), group, false);
    if (s < 0) p.rotation.y = Math.PI;
  });
  // اسم المحطة بحروف بارزة ثلاثية الأبعاد فوق حافة المظلة الأمامية (طبقات متتالية) يضيء ليلًا
  const letters = extrudedText(name, colors, CW * 0.5, 3 * M, 0.9 * M, glow, trash);
  letters.position.set(cx, CH + CT + 1.4 * M + 0.2, cz + CD / 2 - 1.2 * M);
  group.add(letters);
  const led = glowMat(0xffffff, 0xffffff, 0.4, 2.6);
  add(new THREE.ExtrudeGeometry(ring(CW + 1.6, CD + 1.6, 3 * M, 0.35 * M), { depth: 0.18 * M, bevelEnabled: false }), led, cx, CH - 0.02, cz, group, false).rotation.x = Math.PI / 2;
  // سقف سفلي أبيض بمربعات إنارة
  const soffit = add(new THREE.ShapeGeometry(rounded(CW, CD, 2.8 * M)), white, cx, CH + 0.4 * M, cz, group, false);
  soffit.rotation.x = Math.PI / 2;
  const lamp = glowMat(0xffffff, 0xfff7e0, 0.35, 2.2);
  const lampGeo = new THREE.PlaneGeometry(1.3 * M, 1.3 * M); trash.push(lampGeo);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
    const l = new THREE.Mesh(lampGeo, lamp);
    l.rotation.x = Math.PI / 2; l.position.set(cx - CW / 2 + CW * (i + 0.5) / 6, CH + 0.4 * M - 0.08, cz - CD / 2 + CD * (j + 0.5) / 3);
    group.add(l);
  }
  const pl = new THREE.PointLight(0xfff1d0, 0, 60 * M, 1.6); pl.position.set(cx, CH - 2, cz); group.add(pl); lights.push(pl);
  blob(cx, cz, CW * 1.1, CD * 1.25);

  // أعمدة سميكة بقاعدة خرسانية، وجزيرة مضخات بموزعين وحواجز حماية
  const colGeo = new THREE.CylinderGeometry(0.62 * M, 0.66 * M, CH, 24); trash.push(colGeo);
  [-1, 1].forEach(s => {
    const px = cx + s * CW * 0.25;
    add(new THREE.BoxGeometry(3.4 * M, 0.7 * M, 1.8 * M), concrete, px, 1.25 * M, cz);
    [-1.05, 1.05].forEach(o => add(colGeo, white, px + o * M, CH / 2 + 0.9 * M, cz));
    add(new THREE.BoxGeometry(1.2 * M, CH - 0.9 * M, 0.45 * M), main, px, CH / 2 + 1.2 * M, cz);
    const island = add(new THREE.ExtrudeGeometry(rounded(3.6 * M, 12.5 * M, 1.6 * M), { depth: 1.2, bevelEnabled: false }), concrete, px, 1.2, cz);
    island.rotation.x = Math.PI / 2;
    const rim = add(new THREE.ExtrudeGeometry(rounded(3.8 * M, 12.7 * M, 1.7 * M), { depth: 0.6, bevelEnabled: false }), main, px, 0.6, cz);
    rim.rotation.x = Math.PI / 2;
    [-1, 1].forEach(t => dispenser(px, cz + t * 3.7 * M));
    // أعمدة حماية صفراء وسوداء عند طرفي الجزيرة
    [-1, 1].forEach(t => {
      const bz = cz + t * 6 * M;
      [-0.9, 0.9].forEach(o => {
        add(new THREE.CylinderGeometry(0.2 * M, 0.2 * M, 1.6 * M, 12), yellow, px + o * M, 1.2 + 0.8 * M, bz);
        add(new THREE.CylinderGeometry(0.205 * M, 0.205 * M, 0.3 * M, 12), black, px + o * M, 1.2 + 1.2 * M, bz, group, false);
      });
    });
  });

  function dispenser(x: number, z: number) {
    const g = new THREE.Group(); g.position.set(x, 1.2, z); group.add(g);
    add(new THREE.BoxGeometry(2.6 * M, 1.9 * M, 1.3 * M), accent, 0, 0.95 * M, 0, g);
    add(new THREE.BoxGeometry(2.6 * M, 1.1 * M, 1.3 * M), white, 0, 2.45 * M, 0, g);
    add(new THREE.BoxGeometry(2.66 * M, 0.25 * M, 1.36 * M), main, 0, 1.95 * M, 0, g);
    const scr = glowMat(0x0b1220, 0x38bdf8, 0.35, 1.5);
    const scr2 = glowMat(0x111827, 0xfacc15, 0.25, 1.2);
    [-1, 1].forEach(s => {
      add(new THREE.BoxGeometry(1.5 * M, 0.55 * M, 0.08), scr, 0, 2.5 * M, s * 0.66 * M, g, false);
      add(new THREE.BoxGeometry(0.9 * M, 0.25 * M, 0.08), scr2, 0, 2.05 * M, s * 0.66 * M, g, false);
      // مسدسات التعبئة معلقة على الجانبين وخراطيمها تتدلى
      [-1, 1].forEach(e => {
        add(new THREE.BoxGeometry(0.14 * M, 0.5 * M, 0.22 * M), dark, e * 1.36 * M, 1.6 * M, s * 0.34 * M, g, false);
        const h = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(e * 1.3 * M, 2.8 * M, s * 0.34 * M), new THREE.Vector3(e * 1.55 * M, 1.5 * M, s * 0.38 * M), new THREE.Vector3(e * 1.45 * M, 0.6 * M, s * 0.34 * M), new THREE.Vector3(e * 1.38 * M, 1.4 * M, s * 0.34 * M)]), 18, 0.055 * M, 6), dark);
        h.castShadow = true; g.add(h); trash.push(h.geometry);
      });
    });
    // مظلة صغيرة فوق الموزع
    [-1.05, 1.05].forEach(o => add(new THREE.BoxGeometry(0.16 * M, 1.2 * M, 0.16 * M), white, o * M, 3.6 * M, 0, g));
    add(new THREE.BoxGeometry(3 * M, 0.55 * M, 1.6 * M), accent, 0, 4.45 * M, 0, g);
    add(new THREE.BoxGeometry(3.06 * M, 0.18 * M, 1.66 * M), main, 0, 4.8 * M, 0, g);
  }

  // ---------------- مبنى الإدارة ----------------
  const SW = 15 * M, SD = 9 * M, SH = 4.6 * M;
  const sx = 19 * M, sz = -1.5 * M;
  add(new THREE.BoxGeometry(SW, SH, SD), mat(colors.shop, { roughness: 0.7 }), sx, SH / 2, sz);
  add(new THREE.BoxGeometry(SW + 1, 0.9 * M, SD + 1), white, sx, SH + 0.45 * M, sz);
  const signTex = tex(1024, 128, x => {
    x.fillStyle = hex(colors.main); x.fillRect(0, 0, 1024, 128);
    x.fillStyle = '#fff'; x.font = `800 80px ${font()}`;
    x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('الإدارة', 512, 68);
  });
  trash.push(signTex);
  add(new THREE.PlaneGeometry(SW * 0.9, 1.2 * M), glowMat(0xffffff, 0xffffff, 0.05, 0.8, { map: signTex, emissiveMap: signTex }), sx, SH - 0.7 * M, sz + SD / 2 + 0.2, group, false);
  const glassTex = tex(512, 128, x => {
    x.fillStyle = '#132235'; x.fillRect(0, 0, 512, 128);
    const g = x.createLinearGradient(0, 0, 512, 128); g.addColorStop(0, 'rgba(160,200,235,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(160,200,235,.25)');
    x.fillStyle = g; x.fillRect(0, 0, 512, 128);
    x.fillStyle = '#d6dbe0'; for (let i = 0; i <= 8; i++) x.fillRect(i * 64 - 2, 0, 4, 128);
    x.fillRect(0, 0, 512, 5); x.fillRect(0, 123, 512, 5);
    x.fillStyle = 'rgba(255,214,140,.55)'; x.fillRect(196, 20, 120, 108);
  });
  trash.push(glassTex);
  add(new THREE.PlaneGeometry(SW * 0.86, 2.8 * M), glowMat(0xffffff, 0xffd9a0, 0, 0.9, { map: glassTex, emissiveMap: glassTex, roughness: 0.08, metalness: 0.6 }), sx, 1.5 * M, sz + SD / 2 + 0.2, group, false);
  [-1, 1].forEach(s => add(new THREE.BoxGeometry(1.8 * M, 0.9 * M, 1.4 * M), steel, sx + s * 4 * M, SH + 1.35 * M, sz - 1.5 * M));
  const rt = add(new THREE.CylinderGeometry(1.1 * M, 1.1 * M, 5 * M, 24), mat(0xf1f5f9, { roughness: 0.3, metalness: 0.4 }), sx + 1 * M, SH + 2.1 * M, sz + 1.2 * M);
  rt.rotation.z = Math.PI / 2;
  blob(sx, sz, SW * 1.25, SD * 1.35);

  // ---------------- لوحة المنتجات المتوفرة ----------------
  const px = boardSide * 34 * M, pz = 6 * M, PW = 4.2 * M, PH = 11 * M;
  add(new THREE.BoxGeometry(PW + 0.6 * M, 1.2 * M, 1.2 * M), concrete, px, 0.6 * M, pz);
  add(new THREE.BoxGeometry(PW, PH, 0.8 * M), dark, px, PH / 2 + 1.2 * M, pz);
  const board = tex(320, 840, x => {
    x.fillStyle = '#0b1220'; x.fillRect(0, 0, 320, 840);
    x.fillStyle = hex(colors.main); x.fillRect(0, 0, 320, 270);
    x.fillStyle = hex(colors.accent); x.fillRect(0, 258, 320, 14);
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(160, 36); x.quadraticCurveTo(226, 124, 160, 180); x.quadraticCurveTo(94, 124, 160, 36); x.fill();
    x.font = `900 52px ${font()}`; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText(name, 160, 238);
    x.fillStyle = '#cbd5e1'; x.font = `700 34px ${font()}`; x.fillText('يتوفر', 160, 330);
    products.slice(0, 3).forEach((p, i) => {
      const y = 360 + i * 150;
      x.fillStyle = '#16213a'; x.fillRect(16, y, 288, 132);
      x.fillStyle = '#ffffff'; x.font = `900 58px ${font()}`; x.textAlign = 'right'; x.fillText(p.label, 280, y + 80);
      x.fillStyle = p.available ? '#22c55e' : '#ef4444';
      x.beginPath(); x.arc(64, y + 66, 26, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#e2e8f0'; x.font = `700 22px ${font()}`; x.textAlign = 'center'; x.fillText(p.available ? 'متوفر' : 'نفد', 64, y + 122);
    });
  });
  trash.push(board);
  add(new THREE.PlaneGeometry(PW - 0.4 * M, PH - 0.4 * M), glowMat(0xffffff, 0xffffff, 0.3, 1.2, { map: board, emissiveMap: board }), px, PH / 2 + 1.2 * M, pz + 0.41 * M, group, false);
  blob(px, pz, PW * 2.2, 3 * M);

  // ---------------- مستودع الخزانات ----------------
  // المقاسات من depotLayout (نفسها تحسب موقف الصهريج عند الوصلة)
  const L = depotLayout(depot);
  const n = depot, { r, th, dx, dz, cols, rows, gap, bw, bd } = L;
  const bund = mat(0xa8a29e, { roughness: 0.95 });
  [[0, -bd / 2, bw, 0.6 * M], [0, bd / 2, bw, 0.6 * M], [-bw / 2, 0, 0.6 * M, bd], [bw / 2, 0, 0.6 * M, bd]].forEach(([ox, oz, w, d]) =>
    add(new THREE.BoxGeometry(w, 1.6 * M, d), bund, dx + ox, 0.8 * M, dz + oz));
  add(new THREE.BoxGeometry(bw, 0.3, bd), concrete, dx, 0.15, dz, group, false);
  const tankMat = mat(0xf8fafc, { roughness: 0.35, metalness: 0.35 });
  const tankGeo = new THREE.CylinderGeometry(r, r, th, 40), roofGeo = new THREE.ConeGeometry(r * 1.02, r * 0.3, 40), ringGeo = new THREE.TorusGeometry(r, 0.12 * M, 6, 40);
  trash.push(tankGeo, roofGeo, ringGeo);
  // مجمع صمامات عند الجدار الأمامي: الأنابيب تنزل من الخزانات وتسير على دعامات إليه، ثم تدخل الأرض نحو الساحة
  const manX = L.manX, manZ = L.manZ, pipeY = 0.9 * M;
  const pipeR = 0.2 * M;
  const pipe = (a: THREE.Vector3, b: THREE.Vector3) => {
    const len = a.distanceTo(b);
    const m = add(new THREE.CylinderGeometry(pipeR, pipeR, len, 12), steel, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, group, true);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  };
  for (let i = 0; i < n; i++) {
    const tx = dx - (cols - 1) * gap / 2 + (i % cols) * gap, tz = dz - (rows - 1) * gap / 2 + Math.floor(i / cols) * gap;
    add(tankGeo, tankMat, tx, th / 2 + 0.3, tz);
    add(roofGeo, tankMat, tx, th + 0.3 + r * 0.15, tz);
    const ring = add(ringGeo, steel, tx, th + 0.6 * M, tz, group, false); ring.rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(r * 1.005, r * 1.005, 0.7 * M, 40, 1, true), main, tx, th * 0.72, tz, group, false);
    const lad = new THREE.Group(); lad.position.set(tx + r * 0.72, 0, tz - r * 0.72); lad.rotation.y = -Math.PI / 4; group.add(lad);
    [-0.25, 0.25].forEach(o => add(new THREE.BoxGeometry(0.06 * M, th, 0.06 * M), steel, o * M, th / 2, 0.08 * M, lad, false));
    for (let k = 1; k < th / (0.9 * M); k++) add(new THREE.BoxGeometry(0.5 * M, 0.05 * M, 0.05 * M), steel, 0, k * 0.9 * M, 0.08 * M, lad, false);
    // فوهة على جانب الخزان ← كوع للأسفل ← على دعامات إلى المجمع
    const out = new THREE.Vector3(tx, pipeY + 1.2 * M, tz + r + 0.2 * M);
    add(new THREE.CylinderGeometry(pipeR * 1.6, pipeR * 1.6, 0.4 * M, 12), steel, tx, out.y, tz + r, group, false).rotation.x = Math.PI / 2;
    const down = new THREE.Vector3(tx, pipeY, out.z);
    pipe(out, down);
    const mid = new THREE.Vector3(tx, pipeY, manZ);
    pipe(down, mid);
    pipe(mid, new THREE.Vector3(manX, pipeY, manZ));
    add(new THREE.BoxGeometry(0.5 * M, pipeY, 0.5 * M), concrete, tx, pipeY / 2, (out.z + manZ) / 2);
    blob(tx, tz, r * 2.8, r * 2.8);
  }
  add(new THREE.BoxGeometry(1.6 * M, 1.4 * M, 1.4 * M), mat(0xdc2626, { roughness: 0.5 }), manX, pipeY, manZ);
  // نقطة التفريغ: قاعدة خرسانية خارج الجدار عليها وصلة أنبوب قائمة بفلنجة وغطاء أحمر (يتصل بها خرطوم الصهريج)
  const fx = L.fx, fz = L.fz;
  add(new THREE.BoxGeometry(2.6 * M, 0.3 * M, 2.2 * M), concrete, fx, 0.15 * M, fz);
  pipe(new THREE.Vector3(manX, pipeY, manZ), new THREE.Vector3(fx, pipeY, fz));
  pipe(new THREE.Vector3(fx, pipeY, fz), new THREE.Vector3(fx, 0.3 * M, fz));
  add(new THREE.CylinderGeometry(0.34 * M, 0.34 * M, 0.12 * M, 16), steel, fx, pipeY + 0.06 * M, fz);
  add(new THREE.CylinderGeometry(0.24 * M, 0.24 * M, 0.22 * M, 16), mat(0xdc2626, { roughness: 0.5 }), fx, pipeY + 0.2 * M, fz);
  const fillPoint = new THREE.Vector3(fx, pipeY + 0.3 * M, fz);
  // غرفة المضخات
  add(new THREE.BoxGeometry(4 * M, 3 * M, 3 * M), mat(0xe5e7eb), dx + bw / 2 + 3 * M, 1.5 * M, dz + bd / 2 - 2 * M);
  blob(dx, dz, bw * 1.15, bd * 1.15);

  // أعمدة إنارة عند أطراف الساحة
  const poleGeo = new THREE.CylinderGeometry(0.14 * M, 0.2 * M, 9 * M, 8); trash.push(poleGeo);
  const head = glowMat(0xe5e7eb, 0xfff1c1, 0, 2.6);
  [[-38 * M, 14 * M], [38 * M, 14 * M], [-38 * M, -12 * M], [38 * M, -12 * M]].forEach(([lx, lz]) => {
    add(new THREE.BoxGeometry(0.9 * M, 0.6 * M, 0.9 * M), concrete, lx, 0.3 * M, lz);
    add(poleGeo, steel, lx, 4.5 * M, lz);
    add(new THREE.BoxGeometry(1.6 * M, 0.3 * M, 0.6 * M), head, lx + 0.6 * M, 9 * M, lz, group, false);
  });

  return {
    group, glow, lights, fillPoint,
    nameAnchor: new THREE.Vector3(cx, CH + CT + 3 * M, cz + CD / 2),
    dispose: () => trash.forEach(t => t.dispose()),
  };
};

/** شجرة صغيرة مزروعة: جذع قصير وتاج كثيف من كتل خضراء زيتونية */
export const createSmallTree = (h = 3.2 * M, seed = 1): THREE.Group => {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * M, 0.24 * M, h * 0.5, 7), new THREE.MeshStandardMaterial({ color: 0x6b4f32, roughness: 0.95 }));
  trunk.position.y = h * 0.25; trunk.castShadow = true; g.add(trunk);
  const tones = [0x56703a, 0x617d40, 0x4b6332, 0x6d8748];
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1 + seed, rr = (0.55 + ((seed * (i + 2)) % 5) / 20) * M;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 1), new THREE.MeshStandardMaterial({ color: tones[(seed + i) % tones.length], roughness: 0.9 }));
    m.position.set(Math.cos(a) * 0.55 * M, h * 0.62 + (i % 3) * 0.25 * M, Math.sin(a) * 0.55 * M); m.scale.y = 0.8; m.castShadow = true; g.add(m);
  }
  return g;
};

/** شجيرة صحراوية: كتلة كرات مضغوطة رمادية مخضرة */
export const createDesertShrub = (s = 1.6 * M, seed = 1): THREE.Group => {
  const g = new THREE.Group();
  const tones = [0x7d8461, 0x8a8a63, 0x6e7653, 0x9a9070];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s * (0.45 + ((seed * (i + 3)) % 7) / 20), 1), new THREE.MeshStandardMaterial({ color: tones[(seed + i) % tones.length], roughness: 0.95 }));
    const a = i * 1.3 + seed;
    m.position.set(Math.cos(a) * s * 0.45, s * 0.35, Math.sin(a) * s * 0.45); m.scale.y = 0.7; m.castShadow = true; g.add(m);
  }
  return g;
};
