import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { createTanker } from './tankerModel';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { MapWeather } from './MapWeather';
import { siteGeometry, type FarmCover, type Pt, type SiteCover, type SiteGeometry } from '../../lib/siteFarmsMap';
import { weatherKind, type SiteWeather } from '../../lib/weather';

/**
 * خريطة الموقع ثلاثية الأبعاد (WebGL) في مركز المراقبة:
 * لوح بسطح أزرق وحدود مزارع مضيئة وجدار نيون، المزارع الحرجة حمراء نابضة، وأقواس وقود من خزان المحطة إليها.
 * الضغط يفتح حقل المزارع. في الطاقة: لوح لكل موقع بمكانه في المخطط وشوارع بينها تسير عليها الصهاريج.
 * تُحمَّل هذه الوحدة (ومعها three) عند فتح الصفحة فقط.
 */
/**
 * شاحنة جارية. خريطة الموقع: from/to = 'outside' أو 'station' (bearing = اتجاه الموقع الآخر على المخطط).
 * خريطة مركز التوزيع: from/to = اسما الموقعين (الشاحنة تسير على الشوارع بينهما). text = سطر بطاقة الشاحنة
 */
export interface MapTrip { id: string; qty: number; text: string; from: string; to: string; dir: 'in' | 'out'; bearing?: number; /** وقت الموافقة (انطلاق الصهريج) */ since?: string }
/** موقع في خريطة مركز التوزيع: مزارعه ومكانه في المخطط */
export interface WorldSite { site: string; cover: SiteCover; pos: Pt }
/** مقياس لوح الموقع في خريطة مركز التوزيع */
const WORLD_SCALE = 0.4;

interface Props {
  site: string;
  cover: SiteCover;
  onOpen: (farmName: string | null) => void;
  /** شاحنات الوقود الجارية (انظر MapTrip) */
  trips?: MapTrip[];
  /** خريطة مركز التوزيع: المواقع الستة كل منها بلوحه ومزارعه، تربطها الشوارع (cover = ملخص المواقع للعدادات والبطاقات) */
  world?: WorldSite[];
  /** زر «طلب وقود» ولوحته (تحت «فتح حقل المزارع») */
  fuelPanel?: React.ReactNode;
  /** الطقس الحقيقي للموقع (null حتى يصل أو إن تعذّر) */
  weather: SiteWeather | null;
}

const TINT: Record<string, [number, number]> = { crit: [0xff2d55, 0.55], warn: [0xfacc15, 0.32], ok: [0x10b981, 0.26], idle: [0x020617, 0.35] };
const UI = { crit: '#ff2d55', warn: '#facc15', ok: '#34d399', idle: '#94a3b8' };
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** علامة الموقع: دبوس بتدرّج ودائرة بيضاء في وسطه (أحمر للحرجة، برتقالي للتحذير) */
const pinSvg = (id: string, top: string, bottom: string, edge: string) =>
  `<svg viewBox="0 0 40 50" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>` +
  `<path d="M20 48C20 48 4 30 4 18A16 16 0 1 1 36 18C36 30 20 48 20 48Z" fill="url(#${id})" stroke="${edge}" stroke-width="1"/>` +
  `<path d="M20 4A14 14 0 0 1 33 13" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2.4" stroke-linecap="round"/>` +
  `<circle cx="20" cy="18" r="7.5" fill="#fffbeb" stroke="${edge}" stroke-width="1"/></svg>`;
const PIN_SVG = { crit: pinSvg('sf-pin-crit', '#ff4d5e', '#c8102e', '#9f1239'), warn: pinSvg('sf-pin-warn', '#fde047', '#eab308', '#a16207') };

const SiteFarmsMap: React.FC<Props> = ({ site, cover, onOpen, weather, trips = [], fuelPanel, world: worldSites }) => {
  const isWorld = !!worldSites;
  const { t } = useTranslation(['finance']);
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const onOpenRef = useRef(onOpen);
  /** أزرار التكبير والتصغير والإرجاع (تُربط بالمشهد داخل الأثر) */
  const ctrlRef = useRef<{ zoomIn: () => void; zoomOut: () => void; reset: () => void } | null>(null);
  useEffect(() => { onOpenRef.current = onOpen; });
  // الطقس يُقرأ داخل حلقة الرسم من مرجع (تغيّره لا يعيد بناء المشهد)
  const weatherRef = useRef(weather);
  useEffect(() => { weatherRef.current = weather; });

  const geo = useMemo(() => siteGeometry(cover.farms.length, site), [cover.farms.length, site]);
  // تتغير الشاحنات بتغيّر الطلبات فقط (لا بكل رسم)
  const tripsKey = trips.map(x => `${x.id}:${x.from}:${x.to}:${x.qty}:${x.text}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tripList = useMemo(() => trips, [tripsKey]);
  const counts = useMemo(() => {
    const c = { crit: 0, warn: 0, ok: 0, idle: 0 };
    cover.farms.forEach(f => { c[f.status]++; });
    return c;
  }, [cover.farms]);
  const words = useMemo(() => ({
    farm: t('finance:siteFarms.map.farm'), day: t('finance:siteFarms.map.day'), liter: t('finance:siteFarms.liter'),
    tank: t('finance:siteFarms.map.tank'), center: t('finance:siteFarms.map.center'), dayUnit: t('finance:siteFarms.map.daysShort'), status: { crit: t('finance:siteFarms.map.crit'), warn: t('finance:siteFarms.map.warn'), ok: t('finance:siteFarms.map.ok'), idle: t('finance:siteFarms.map.idle') },
    empty: t('finance:siteFarms.map.empty'), noUse: t('finance:siteFarms.map.noUse'), noGl: t('finance:siteFarms.map.noGl'),
  }), [t]);

  useEffect(() => {
    const host = hostRef.current, labelsEl = labelsRef.current, tip = tipRef.current;
    if (!host || !labelsEl || !tip) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch {
      labelsEl.textContent = words.noGl;
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = 'sf-map-canvas';
    host.prepend(renderer.domElement);

    const worldList = worldSites ?? null;
    // ملخص كل موقع (الرصيد وأيام التغطية والحالة) لبطاقات خريطة مركز التوزيع
    const worldInfo = new Map(cover.farms.map(f => [f.name, f]));
    // نصف عرض المشهد الذي تُضبط عليه الكاميرا والتحريك والطقس (خريطة المواقع أوسع)
    const fitHalf = worldList ? 50 : 33, kk = fitHalf / 33;
    const DEPTH = 3.2;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x040b17, 80, 170);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
    const amb = new THREE.AmbientLight(0x6aa6e8, 0.75 * Math.PI);
    scene.add(amb);
    const key = new THREE.DirectionalLight(0xcfe9ff, 0.55 * Math.PI);
    key.position.set(-30, 50, 30);
    scene.add(key);
    const world = new THREE.Group();
    scene.add(world);

    const shapeOf = (pts: Pt[]) => { const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1]))); s.closePath(); return s; };
    const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); if (g) draw(g);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx;
    };
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const at = (p: Pt, y: number) => new THREE.Vector3(p[0], y, -p[1]);
    const lineOf = (pts: Pt[], y: number, color: number, opacity: number) =>
      new THREE.Line(new THREE.BufferGeometry().setFromPoints([...pts, pts[0]].map(p => at(p, y))), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));

    // الأرضية المحيطة (تضاريس داكنة وشبكة خافتة) والتوهج تحت الخريطة
    const groundTex = canvasTex(512, 512, g => {
      g.fillStyle = '#071426'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(120,170,220,${rnd() * 0.08})`; g.fillRect(rnd() * 512, rnd() * 512, 1.4, 1.4); }
      g.strokeStyle = 'rgba(56,140,220,.08)';
      for (let i = 0; i <= 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    });
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(6, 6);
    const groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ map: groundTex }));
    groundPlane.rotation.x = -Math.PI / 2; groundPlane.position.y = -0.05; scene.add(groundPlane);
    const glowTex = canvasTex(256, 256, g => {
      const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(56,189,248,.55)'); gr.addColorStop(0.5, 'rgba(56,189,248,.15)'); gr.addColorStop(1, 'rgba(56,189,248,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(80, 52), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; scene.add(glow);

    // ── لوح الموقع: سطح أزرق بنسيج وشبكة، وجدار نيون، ومناطق المزارع ملوّنة بالحالة، وخزان المحطة وأقواس الوقود ──
    // خريطة الموقع: لوح واحد. خريطة مركز التوزيع (الطاقة): لوح لكل موقع بمكانه في المخطط، تربطها الشوارع
    labelsEl.textContent = '';
    const el = (tag: string, cls: string, text?: string) => { const e = document.createElement(tag); e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const labels: { node: HTMLElement; pos: THREE.Vector3 }[] = [];
    const pick: THREE.Mesh[] = [];
    const crit: { fill: THREE.Mesh; phase: number }[] = [];
    const beacons: { ring: THREE.Mesh; phase: number }[] = [];
    const stRings: THREE.Mesh[] = [];
    const arcs: { curve: THREE.Curve<THREE.Vector3>; s: THREE.Mesh; o: number }[] = [];
    const sideTex = canvasTex(4, 128, g => {
      const gr = g.createLinearGradient(0, 128, 0, 0);
      gr.addColorStop(0, 'rgba(140,225,255,1)'); gr.addColorStop(0.25, 'rgba(56,189,248,.85)'); gr.addColorStop(0.7, 'rgba(30,120,200,.55)'); gr.addColorStop(1, 'rgba(120,210,255,.9)');
      g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    });
    sideTex.repeat.set(1, 1 / DEPTH);
    interface Slab { site: string; pos: Pt; scale: number; ST: Pt; edge: Pt; ctr: Pt; outline: Pt[]; cells: SiteGeometry['cells']; farms: FarmCover[]; toWorld: (p: Pt, y: number) => THREE.Vector3 }
    const buildSlab = (spec: { site: string; geo: SiteGeometry; farms: FarmCover[]; pos: Pt; scale: number; side: 'left' | 'right'; farmLabels: boolean }): Slab => {
      const { outline, cells, bounds } = spec.geo;
      const farms = spec.farms;
      const g = new THREE.Group();
      g.position.copy(at(spec.pos, 0)); g.scale.setScalar(spec.scale); world.add(g); g.updateMatrixWorld(true);
      const toWorld = (p: Pt, y: number) => g.localToWorld(at(p, y));
      const W = bounds[2] - bounds[0], H = bounds[3] - bounds[1];
      const small = spec.scale < 1;
      const topTex = canvasTex(small ? 512 : 1024, small ? 300 : 600, gx => {
        const w = small ? 512 : 1024, h = small ? 300 : 600;
        const gr = gx.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, '#1d4f86'); gr.addColorStop(0.55, '#123a68'); gr.addColorStop(1, '#0c2c52');
        gx.fillStyle = gr; gx.fillRect(0, 0, w, h);
        for (let i = 0; i < (small ? 7000 : 26000); i++) { gx.fillStyle = `rgba(${150 + rnd() * 80 | 0},${190 + rnd() * 50 | 0},255,${rnd() * 0.07})`; gx.fillRect(rnd() * w, rnd() * h, 1.6, 1.6); }
        gx.strokeStyle = 'rgba(140,200,255,.10)';
        const step = small ? 12 : 18;
        for (let i = 0; i <= w; i += step) { gx.beginPath(); gx.moveTo(i, 0); gx.lineTo(i, h); gx.stroke(); }
        for (let i = 0; i <= h; i += step) { gx.beginPath(); gx.moveTo(0, i); gx.lineTo(w, i); gx.stroke(); }
      });
      topTex.repeat.set(1 / W, 1 / H); topTex.offset.set(-bounds[0] / W, -bounds[1] / H);
      const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeOf(outline), { depth: DEPTH, bevelEnabled: false, curveSegments: 1 }), [
        new THREE.MeshPhongMaterial({ map: topTex, transparent: true, opacity: 0.96, shininess: 20, specular: 0x0a2a4a, emissive: 0x0a2747, emissiveIntensity: 0.6 }),
        new THREE.MeshBasicMaterial({ map: sideTex, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      ]);
      slab.rotation.x = -Math.PI / 2; g.add(slab);
      g.add(lineOf(outline, DEPTH + 0.03, 0xe0f7ff, 1));
      g.add(lineOf(outline, DEPTH + 0.05, 0x7dd3fc, 0.6));
      g.add(lineOf(outline, 0.04, 0xbdf0ff, 0.9));

      // مناطق المزارع: حدود بيضاء رفيعة وتلوين حسب الحالة
      const critCt: Pt[] = [];
      cells.forEach((c, i) => {
        const f = farms[i];
        if (!f || c.poly.length < 3) return;
        g.add(lineOf(c.poly, DEPTH + 0.035, 0xd6f1ff, 0.55));
        const tint = TINT[f.status];
        const fill = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(c.poly)), new THREE.MeshBasicMaterial({
          color: tint ? tint[0] : 0xffffff, transparent: true, opacity: tint ? tint[1] : 0, depthWrite: false,
          blending: f.status === 'idle' ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide,
        }));
        fill.rotation.x = -Math.PI / 2; fill.position.y = DEPTH + 0.02;
        fill.userData = { f, base: tint ? tint[1] : 0, site: spec.site };
        g.add(fill); pick.push(fill);
        if (f.status === 'crit') {
          crit.push({ fill, phase: rnd() * 6.28 }); critCt.push(c.ct);
          g.add(lineOf(c.poly, DEPTH + 0.04, 0xff8fa3, 0.95));
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 40), new THREE.MeshBasicMaterial({ color: 0xff4d6d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          ring.rotation.x = -Math.PI / 2; ring.position.copy(at(c.ct, DEPTH + 0.06)); g.add(ring);
          beacons.push({ ring, phase: rnd() * 6.28 });
        }
      });

      // خزان المحطة (في جهة الشارع) وأقواس الوقود منه إلى المزارع الحرجة
      const edge = spec.side === 'left'
        ? outline.reduce((a, p) => (p[0] + p[1] * 0.5 < a[0] + a[1] * 0.5 ? p : a))
        : outline.reduce((a, p) => (p[0] - p[1] * 0.5 > a[0] - a[1] * 0.5 ? p : a));
      const ST: Pt = [edge[0] * 0.84, edge[1] * 0.84];
      const stDot = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 20), new THREE.MeshBasicMaterial({ color: 0xfde68a }));
      stDot.position.copy(at(ST, DEPTH + 0.45)); g.add(stDot);
      const stRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 48), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      stRing.rotation.x = -Math.PI / 2; stRing.position.copy(at(ST, DEPTH + 0.06)); g.add(stRing); stRings.push(stRing);
      critCt.forEach(ct => {
        const a = at(ST, DEPTH + 0.45), z = at(ct, DEPTH + 0.3);
        const mid = a.clone().lerp(z, 0.5); mid.y += a.distanceTo(z) * 0.32 + 1.2;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, z);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.045, 6, false), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.9 })));
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.16, 6, false), new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })));
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfff7d1, transparent: true }));
        g.add(s);
        arcs.push({ curve, s, o: rnd() });
      });

      // أسماء المناطق (خريطة الموقع فقط؛ النصوص من الكشف تُكتب نصًا لا HTML)
      if (spec.farmLabels) cells.forEach((c, i) => {
        const f = farms[i];
        if (!f || c.poly.length < 3) return;
        // الحرجة والتحذيرية: علامة موقع واقفة على المنطقة (أحمر / برتقالي) وفوقها الاسم
        if (f.status === 'crit' || f.status === 'warn') {
          const node = el('div', `sf-map-pin ${f.status}`);
          node.dir = 'rtl';
          const tag = el('div', 'sf-map-pin-tag');
          if (f.status === 'crit') tag.append(el('b', '', `${words.farm} ${f.label}`), el('small', '', `${fmt(f.balance)} ${words.liter}`));
          else tag.append(el('b', '', f.label));
          const icon = el('div', 'sf-map-pin-icon');
          icon.innerHTML = PIN_SVG[f.status]; // رسم ثابت من الكود (لا بيانات من الملف)
          node.append(tag, icon, el('i', 'sf-map-pin-ground'));
          labelsEl.appendChild(node);
          labels.push({ node, pos: toWorld(c.ct, DEPTH + 0.05) });
          return;
        }
        const node = el('div', `sf-map-lbl ${f.status}`);
        node.append(el('span', '', f.label));
        node.dir = 'rtl';
        labelsEl.appendChild(node);
        labels.push({ node, pos: toWorld(c.ct, DEPTH + 0.1) });
      });
      const ctr = outline.reduce<Pt>((a, p) => [a[0] + p[0] / outline.length, a[1] + p[1] / outline.length], [0, 0]);
      return { site: spec.site, pos: spec.pos, scale: spec.scale, ST, edge, ctr, outline, cells, farms, toWorld };
    };

    const slabs: Slab[] = worldList
      ? worldList.map(w => buildSlab({ site: w.site, geo: siteGeometry(w.cover.farms.length, w.site), farms: w.cover.farms, pos: w.pos, scale: WORLD_SCALE, side: w.pos[0] > 0 ? 'left' : 'right', farmLabels: false }))
      : [buildSlab({ site, geo, farms: cover.farms, pos: [0, 0], scale: 1, side: 'left', farmLabels: true })];
    const main = slabs[0];

    if (!worldList && cover.station) {
      const node = el('div', 'sf-map-lbl st');
      node.dir = 'rtl';
      node.append(el('b', '', words.tank), el('small', '', `${fmt(cover.station.balance ?? 0)} ${words.liter}`));
      labelsEl.appendChild(node);
      labels.push({ node, pos: at(main.ST, DEPTH + 1.6) });
    }

    // ── خريطة مركز التوزيع: بطاقة كل موقع، والشوارع (شارع رئيسي من الطاقة إلى الأمام وفروع إلى خزان كل موقع) ──
    const deck = DEPTH * WORLD_SCALE;
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.92, metalness: 0.05, emissive: 0x0b1220, emissiveIntensity: 0.4 });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 });
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    /** قطعة شارع بين نقطتين (قد تكون مائلة: منحدر من اللوح إلى الأرض) مع حافتين وخط وسط متقطع */
    const roadPiece = (a: THREE.Vector3, b: THREE.Vector3, w = 1.7) => {
      const len = a.distanceTo(b);
      const mid = a.clone().lerp(b, 0.5);
      const seg = new THREE.Group();
      seg.position.copy(mid); seg.lookAt(b); world.add(seg);
      seg.add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, len + w * 0.5), roadMat));
      [-1, 1].forEach(sd => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, len + w * 0.5), edgeMat); e.position.x = sd * (w / 2 - 0.08); seg.add(e); });
      for (let s = -len / 2 + 0.5; s < len / 2 - 0.3; s += 1.3) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.6), dashMat); d.position.set(0, 0.01, s + 0.3); seg.add(d); }
    };
    const routes = new Map<string, { st: THREE.Vector3; edge: THREE.Vector3; out: THREE.Vector3; junc: THREE.Vector3 }>();
    if (worldList) {
      slabs.forEach(s => {
        // بطاقة الموقع؛ والطاقة (مركز التوزيع) بطاقة خزانها
        const label = worldInfo.get(s.site) ?? (s.site === site && cover.station
          ? { status: 'ok' as const, days: Infinity, balance: cover.station.balance ?? 0 } : null);
        if (label) {
          const node = el('div', `sf-map-pin sf-map-site ${label.status}`);
          node.dir = 'rtl';
          const tag = el('div', 'sf-map-pin-tag');
          const days = Number.isFinite(label.days) ? ` · ${label.days.toFixed(1)} ${words.dayUnit}` : '';
          tag.append(el('b', '', s.site === site ? `${s.site} · ${words.center}` : s.site), el('small', '', `${fmt(label.balance)} ${words.liter}${days}`));
          node.append(tag, el('i', 'sf-map-site-dot'));
          labelsEl.appendChild(node);
          labels.push({ node, pos: s.toWorld(s.ctr, DEPTH + 2.6) });
        }
        // خزان الموقع ← حافة اللوح (منحدر) ← الأرض ← تقاطع الشارع الرئيسي (x = 0)
        const st = s.toWorld(s.ST, DEPTH + 0.05), edgeW = s.toWorld(s.edge, DEPTH + 0.02);
        const toward = edgeW.x > 0 ? -1 : 1;
        const out = new THREE.Vector3(edgeW.x + toward * 2.2, 0.04, edgeW.z);
        const junc = new THREE.Vector3(0, 0.04, edgeW.z);
        routes.set(s.site, { st, edge: edgeW, out, junc });
        roadPiece(new THREE.Vector3(st.x, deck + 0.02, st.z), new THREE.Vector3(edgeW.x, deck + 0.02, edgeW.z), 1.2);
        roadPiece(new THREE.Vector3(edgeW.x, deck + 0.02, edgeW.z), out, 1.5);
        roadPiece(out, junc);
      });
      const zs = [...routes.values()].map(r => r.junc.z);
      roadPiece(new THREE.Vector3(0, 0.04, Math.max(...zs) + 3), new THREE.Vector3(0, 0.04, Math.min(...zs) - 3), 2.2);
    }

    // ── شاحنات الوقود: صهريج واقعي على طريق متقطع ──
    const trucks = tripList.flatMap((trip, i) => {
      const lane = (i - (tripList.length - 1) / 2) * 0.28;
      let pts: THREE.Vector3[];
      if (worldList) {
        // على الشوارع: خزان المرسِل ← فرعه ← الشارع الرئيسي ← فرع المستلم ← خزانه
        const A = routes.get(trip.from), B = routes.get(trip.to);
        if (!A || !B) return [];
        const up = (v: THREE.Vector3) => new THREE.Vector3(v.x, deck + 0.05, v.z);
        pts = [up(A.st), up(A.edge), A.out.clone(), A.junc.clone(), B.junc.clone(), B.out.clone(), up(B.edge), up(B.st)];
        const off = lane * 1.2;
        pts.forEach(p => { p.x += off * 0.3; p.y += 0.02; });
      } else {
        // من خارج الموقع إلى الخزان (يصعد إلى اللوح)، باتجاه الموقع الآخر على المخطط إن عُرف
        const { ST, ctr } = main;
        const ang = (trip.bearing ?? Math.atan2(ST[1] - ctr[1], ST[0] - ctr[0])) + lane;
        const dist = Math.hypot(ST[0] - ctr[0], ST[1] - ctr[1]) || 10;
        const out = (k: number): Pt => [ctr[0] + Math.cos(ang) * dist * k, ctr[1] + Math.sin(ang) * dist * k];
        pts = [at(out(2.1), 0.3), at(out(1.55), 0.3), at(out(1.18), DEPTH + 0.3), at(ST, DEPTH + 0.3)];
        if (trip.from !== 'outside') pts.reverse();
      }
      const path = new THREE.CurvePath<THREE.Vector3>();
      for (let k = 1; k < pts.length; k++) path.add(new THREE.LineCurve3(pts[k - 1], pts[k]));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.getSpacedPoints(160)), new THREE.LineDashedMaterial({ color: trip.dir === 'in' ? 0x38bdf8 : 0xf59e0b, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.9 }));
      line.computeLineDistances(); world.add(line);
      const truck = createTanker();
      if (worldList) truck.scale.multiplyScalar(0.62);
      world.add(truck);
      return [{ path, truck, o: i * 0.37, trip }];
    });
    // بطاقة كل شاحنة: الكمية ومن أين وإلى أين (تتبع الشاحنة)
    trucks.forEach(k => {
      const node = el('div', `sf-map-truck ${k.trip.dir}`);
      node.dir = 'rtl';
      node.append(el('b', '', `${fmt(k.trip.qty)} ${words.liter}`), el('small', '', k.trip.text));
      labelsEl.appendChild(node);
      labels.push({ node, pos: k.truck.position });
    });

    // الكاميرا: تحريك بالسحب، تكبير بالعجلة أو بإصبعين أو بالأزرار، تدوير بالزر الأيمن أو مع Shift
    const pitch = 0.72, HOME_YAW = -0.18;
    let yaw = HOME_YAW, targetYaw = yaw, base = 74, zoom = 1, targetZoom = 1;
    const pan = new THREE.Vector2(0, 0), targetPan = new THREE.Vector2(0, 0);
    let drag: { x: number; y: number; yaw: number; px: number; pz: number; rotate: boolean } | null = null;
    let moved = false, hover: THREE.Mesh | null = null;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; z: number } | null = null;
    const clampZoom = (z: number) => Math.max(0.7, Math.min(3.2, z));
    const clampPan = () => { targetPan.x = Math.max(-28 * kk, Math.min(28 * kk, targetPan.x)); targetPan.y = Math.max(-18 * kk * (worldList ? 1.8 : 1), Math.min(18 * kk * (worldList ? 1.8 : 1), targetPan.y)); };
    const placeCam = () => {
      // خريطة المواقع: مركز النظر أقرب قليلًا حتى تظهر الطاقة (أول الشارع) كاملة
      const d = base / zoom, tx = pan.x, tz = pan.y + (worldList ? 7 : 3);
      cam.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, tz + Math.cos(yaw) * Math.cos(pitch) * d);
      cam.lookAt(tx, 0, tz);
    };
    ctrlRef.current = {
      zoomIn: () => { targetZoom = clampZoom(targetZoom * 1.3); },
      zoomOut: () => { targetZoom = clampZoom(targetZoom / 1.3); },
      reset: () => { targetZoom = 1; targetPan.set(0, 0); targetYaw = HOME_YAW; },
    };
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const setHover = (m: THREE.Mesh | null) => {
      if (hover && hover !== m) (hover.material as THREE.MeshBasicMaterial).opacity = hover.userData.base;
      hover = m;
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, .sf-map-panel')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: targetZoom };
        drag = null;
        return;
      }
      drag = { x: e.clientX, y: e.clientY, yaw: targetYaw, px: targetPan.x, pz: targetPan.y, rotate: e.button === 2 || e.shiftKey };
      moved = false;
      host.setPointerCapture(e.pointerId);
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!pointers.size) drag = null;
    };
    const onMove = (e: PointerEvent) => {
      if (!drag && !pinch && (e.target as HTMLElement).closest('.sf-map-panel')) { tip.classList.remove('on'); return; }
      const r = host.getBoundingClientRect();
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        targetZoom = clampZoom(pinch.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
        moved = true; tip.classList.remove('on');
        return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) > 3) moved = true;
        if (drag.rotate) targetYaw = Math.max(-1.2, Math.min(0.8, drag.yaw - dx * 0.005));
        else {
          // تحريك: الخريطة تتبع اليد (المسافة بوحدات المشهد حسب التكبير)
          const k = (2 * (base / zoom) * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / r.height;
          const sy = Math.sin(yaw), cy = Math.cos(yaw);
          targetPan.x = drag.px + (-dx * cy - (dy / Math.sin(pitch)) * sy) * k;
          targetPan.y = drag.pz + (dx * sy - (dy / Math.sin(pitch)) * cy) * k;
          clampPan();
        }
        tip.classList.remove('on');
        return;
      }
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const m = (ray.intersectObjects(pick)[0]?.object as THREE.Mesh | undefined) ?? null;
      setHover(m);
      if (m) {
        (m.material as THREE.MeshBasicMaterial).opacity = Math.max(m.userData.base, 0) + 0.22;
        const f = m.userData.f as FarmCover;
        tip.textContent = '';
        const days = f.balance <= 0 ? words.empty : f.rate <= 0 ? words.noUse : `${f.days.toFixed(1)} ${words.day}`;
        const st = el('span', '', words.status[f.status]); st.style.color = UI[f.status];
        tip.append(el('b', '', worldList ? `${m.userData.site} · ${words.farm} ${f.label}` : `${words.farm} ${f.label}`), ' · ', st, ' · ', `${fmt(f.balance)} ${words.liter}`, ' · ', days);
        tip.style.left = `${e.clientX - r.left}px`; tip.style.top = `${e.clientY - r.top}px`;
        tip.classList.add('on'); host.style.cursor = 'pointer';
      } else { tip.classList.remove('on'); host.style.cursor = ''; }
    };
    const onLeave = () => { tip.classList.remove('on'); setHover(null); };
    const onClick = (e: MouseEvent) => {
      if (moved || (e.target as HTMLElement).closest('button, .sf-map-panel')) return;
      // خريطة المواقع: الضغط على موقع يفتح صفحته؛ خريطة الموقع: يفتح حقل المزارع
      onOpenRef.current(hover ? (worldList ? (hover.userData.site as string) : (hover.userData.f as FarmCover).name) : null);
    };
    // التكبير بفتح/ضم الإصبعين فقط: لوحة اللمس ترسله عجلةً مع ctrlKey (ومثله Ctrl + عجلة الماوس).
    // تمرير الإصبعين (عجلة بلا ctrlKey) لا يكبّر ويترك الصفحة تتحرك كالمعتاد
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || (e.target as HTMLElement).closest('.sf-map-panel')) return;
      e.preventDefault();
      targetZoom = clampZoom(targetZoom * Math.exp(-e.deltaY * 0.01));
    };
    // Safari على الماك يرسل فتح الإصبعين كإيماءة مستقلة
    let gestureStart = 1;
    const onGestureStart = (e: Event) => { e.preventDefault(); gestureStart = targetZoom; };
    const onGestureChange = (e: Event) => { e.preventDefault(); targetZoom = clampZoom(gestureStart * ((e as Event & { scale?: number }).scale ?? 1)); };
    const onMenu = (e: MouseEvent) => e.preventDefault();
    host.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('click', onClick);
    host.addEventListener('wheel', onWheel, { passive: false });
    host.addEventListener('gesturestart', onGestureStart);
    host.addEventListener('gesturechange', onGestureChange);
    host.addEventListener('contextmenu', onMenu);

    const resize = () => {
      const r = host.getBoundingClientRect();
      if (!r.width) return;
      renderer.setSize(r.width, r.height, false);
      cam.aspect = r.width / r.height;
      // بُعد الكاميرا عند التكبير 1: الموقع يملأ الإطار (نصف عرضه مع هامش ≈ 33 وحدة)
      base = Math.max(56 * kk, fitHalf / (Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect));
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(host); resize();

    // ── الطقس: خطوط ريح تتحرك باتجاه الريح الحقيقي وسرعتها، ومطر عند الهطول، وضباب غبار ──
    const WIND_N = 420, RAIN_N = 700, AREA_X = 46 * kk, AREA_Z = 30 * kk * (worldSites ? 1.6 : 1);
    const windGeo = new THREE.BufferGeometry();
    const windPos = new Float32Array(WIND_N * 6);
    const windSeed = Array.from({ length: WIND_N }, () => ({ x: (rnd() * 2 - 1) * AREA_X, z: (rnd() * 2 - 1) * AREA_Z, y: DEPTH + 0.6 + rnd() * 6, k: 0.6 + rnd() * 0.8 }));
    windGeo.setAttribute('position', new THREE.BufferAttribute(windPos, 3));
    const windMat = new THREE.LineBasicMaterial({ color: 0xcdeeff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const windLines = new THREE.LineSegments(windGeo, windMat);
    windLines.frustumCulled = false;
    scene.add(windLines);
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(RAIN_N * 6);
    const rainSeed = Array.from({ length: RAIN_N }, () => ({ x: (rnd() * 2 - 1) * AREA_X, z: (rnd() * 2 - 1) * AREA_Z, y: rnd() * 30 }));
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0, depthWrite: false });
    const rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.frustumCulled = false;
    scene.add(rainLines);
    const fogNight = new THREE.Color(0x040b17), fogDust = new THREE.Color(0x8a6a3a), fogCol = new THREE.Color();
    let wxLight = 1, wxHaze = 0, lastT = 0;

    const v3 = new THREE.Vector3();
    let raf = 0;
    const tick = (time: number) => {
      const s = time / 1000;
      const dt = Math.min(0.05, lastT ? s - lastT : 0.016);
      lastT = s;
      const wx = weatherRef.current;
      // الإضاءة: نهار/ليل وغيوم (تتغير بنعومة)
      const lightT = wx ? (wx.isDay ? 1 : 0.5) * (1 - Math.min(wx.cloud, 100) * 0.0025) : 1;
      wxLight += (lightT - wxLight) * 0.03;
      amb.intensity = 0.75 * Math.PI * wxLight;
      key.intensity = 0.55 * Math.PI * (wx && !wx.isDay ? 0.35 : 1) * wxLight;
      // الغبار: ضباب بلون التراب يقرّب مدى الرؤية
      const hazeT = wx && wx.dust !== null ? Math.min(1, Math.max(0, (wx.dust - 40) / 360)) : 0;
      wxHaze += (hazeT - wxHaze) * 0.03;
      fogCol.copy(fogNight).lerp(fogDust, wxHaze * 0.85);
      (scene.fog as THREE.Fog).color.copy(fogCol);
      (scene.fog as THREE.Fog).near = (80 - 55 * wxHaze) * kk;
      (scene.fog as THREE.Fog).far = (170 - 95 * wxHaze) * kk;
      // الريح: الاتجاه الذي تهب نحوه = اتجاه القدوم + 180° (الشمال = أعلى الخريطة)
      const windKmh = wx ? wx.wind : 0;
      const toward = THREE.MathUtils.degToRad((wx ? wx.windDir : 0) + 180);
      const wx_ = Math.sin(toward), wz_ = -Math.cos(toward);
      const speed = reduce ? 0 : 2 + windKmh * 0.55;
      const len = 0.6 + windKmh * 0.06;
      windMat.opacity = wx ? Math.min(0.55, 0.12 + windKmh / 60) : 0;
      if (wxHaze > 0.2) windMat.color.setHex(0xe8c48a); else windMat.color.setHex(0xcdeeff);
      windSeed.forEach((p, i) => {
        p.x += wx_ * speed * p.k * dt; p.z += wz_ * speed * p.k * dt;
        if (p.x > AREA_X) p.x -= AREA_X * 2; if (p.x < -AREA_X) p.x += AREA_X * 2;
        if (p.z > AREA_Z) p.z -= AREA_Z * 2; if (p.z < -AREA_Z) p.z += AREA_Z * 2;
        const o = i * 6;
        windPos[o] = p.x; windPos[o + 1] = p.y; windPos[o + 2] = p.z;
        windPos[o + 3] = p.x - wx_ * len * p.k; windPos[o + 4] = p.y; windPos[o + 5] = p.z - wz_ * len * p.k;
      });
      windGeo.attributes.position.needsUpdate = true;
      // المطر: عند الهطول فعليًا (كثافته حسب كمية المطر)
      const raining = !!wx && (wx.precipitation > 0 || ['rain', 'showers', 'storm', 'drizzle'].includes(weatherKind(wx.code)));
      rainMat.opacity += ((raining ? Math.min(0.75, 0.3 + (wx?.precipitation ?? 0) * 0.15) : 0) - rainMat.opacity) * 0.05;
      if (rainMat.opacity > 0.01) {
        const fall = reduce ? 0 : 22;
        rainSeed.forEach((p, i) => {
          p.y -= fall * dt; p.x += wx_ * speed * 0.3 * dt; p.z += wz_ * speed * 0.3 * dt;
          if (p.y < 0) { p.y += 30; p.x = (rnd() * 2 - 1) * AREA_X; p.z = (rnd() * 2 - 1) * AREA_Z; }
          const o = i * 6;
          rainPos[o] = p.x; rainPos[o + 1] = p.y; rainPos[o + 2] = p.z;
          rainPos[o + 3] = p.x - wx_ * 0.15; rainPos[o + 4] = p.y + 0.9; rainPos[o + 5] = p.z - wz_ * 0.15;
        });
        rainGeo.attributes.position.needsUpdate = true;
      }
      if (!drag && !reduce && Math.abs(targetZoom - 1) < 0.01) targetYaw += Math.sin(s * 0.22) * 0.0005;
      const ease = reduce ? 1 : 0.15;
      yaw += (targetYaw - yaw) * (reduce ? 1 : 0.08);
      zoom += (targetZoom - zoom) * ease;
      pan.lerp(targetPan, reduce ? 1 : 0.2);
      placeCam();
      crit.forEach(k => { if (k.fill !== hover) (k.fill.material as THREE.MeshBasicMaterial).opacity = reduce ? 0.55 : 0.38 + 0.3 * (0.5 + 0.5 * Math.sin(s * 3 + k.phase)); });
      beacons.forEach(b => { const p = reduce ? 0.5 : (s * 0.7 + b.phase) % 1; b.ring.scale.setScalar(1 + p * 2.6); (b.ring.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - p); });
      const sp = reduce ? 0 : (s * 0.6) % 1;
      stRings.forEach(rg => { rg.scale.setScalar(1 + sp * 1.6); (rg.material as THREE.MeshBasicMaterial).opacity = reduce ? 0.6 : 0.9 * (1 - sp); });
      arcs.forEach(a => { const u = reduce ? a.o : (s * 0.3 + a.o) % 1; a.curve.getPoint(u, v3); a.s.position.copy(v3); (a.s.material as THREE.MeshBasicMaterial).opacity = Math.sin(u * Math.PI); });
      trucks.forEach(k => {
        // رحلة كل 12 ثانية تقريبًا، وتقف لحظة عند نهايتها قبل أن تعيد
        const u = reduce ? 0.6 : Math.min(1, ((s * 0.075 + k.o) % 1.15));
        k.truck.position.copy(k.path.getPointAt(u));
        v3.copy(k.path.getTangentAt(Math.min(u, 0.999)));
        k.truck.rotation.y = Math.atan2(-v3.z, v3.x);
      });
      const r = host.getBoundingClientRect();
      labels.forEach(l => { v3.copy(l.pos).project(cam); l.node.style.left = `${((v3.x + 1) / 2) * r.width}px`; l.node.style.top = `${((1 - v3.y) / 2) * r.height}px`; l.node.style.opacity = v3.z < 1 ? '1' : '0'; });
      renderer.render(scene, cam);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('gesturestart', onGestureStart);
      host.removeEventListener('gesturechange', onGestureChange);
      host.removeEventListener('contextmenu', onMenu);
      ctrlRef.current = null;
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('click', onClick);
      scene.traverse(o => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach(mt => { (mt as THREE.MeshBasicMaterial).map?.dispose(); mt.dispose(); });
      });
      renderer.dispose();
      renderer.domElement.remove();
      labelsEl.textContent = '';
    };
  }, [geo, cover, words, tripList, worldSites, site]);

  return (
    <div className="sf-map" ref={hostRef} tabIndex={0} role="button" aria-label={t('finance:siteFarms.map.aria', { site })}
      onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(null); } }}>
      <div className="sf-map-hud">
        <div className="sf-map-scan" />
        <i className="sf-map-corner tl" /><i className="sf-map-corner tr" /><i className="sf-map-corner bl" /><i className="sf-map-corner br" />
        <div className="sf-map-head">
          <div>
            <b>{t('finance:siteFarms.map.title', { site })}</b>          </div>
          <div className="sf-map-side">
            {weather && <MapWeather weather={weather} />}
            <div className="sf-map-stats">
            {(['crit', 'warn', 'ok'] as const).map(k => (
              <div key={k}><b style={{ color: UI[k] }}>{counts[k]}</b><span>{words.status[k]}</span></div>
            ))}
            </div>
          </div>
        </div>
        <div className="sf-map-labels" ref={labelsRef} />
        {weather && weather.dust !== null && (
          <div className="sf-map-dust" style={{ opacity: Math.min(1, Math.max(0, (weather.dust - 40) / 360)) * 0.55 }} />
        )}
        <div className="sf-map-foot">
          <div className="sf-map-legend">
            <span><i style={{ background: '#ff2d55' }} />{t(isWorld ? 'finance:siteFarms.map.siteCrit' : 'finance:siteFarms.map.critRange')}</span>
            <span><i style={{ background: '#facc15' }} />{t(isWorld ? 'finance:siteFarms.map.siteWarn' : 'finance:siteFarms.map.warnRange')}</span>
            <span><i style={{ background: '#10b981' }} />{t(isWorld ? 'finance:siteFarms.map.siteOk' : 'finance:siteFarms.map.okRange')}</span>
            <span><i style={{ background: '#fbbf24', height: 2, width: 14 }} />{t('finance:siteFarms.map.fuelLine')}</span>          </div>
          <div className="sf-map-btns">
            {!isWorld && <button type="button" className="sf-map-open" onClick={() => onOpen(null)}>{t('finance:siteFarms.map.open')}</button>}
            {fuelPanel}
          </div>
        </div>
        <div className="sf-map-zoom">
          <button type="button" onClick={() => ctrlRef.current?.zoomIn()} aria-label={t('finance:siteFarms.map.zoomIn')} title={t('finance:siteFarms.map.zoomIn')}><Plus className="w-4 h-4" /></button>
          <button type="button" onClick={() => ctrlRef.current?.zoomOut()} aria-label={t('finance:siteFarms.map.zoomOut')} title={t('finance:siteFarms.map.zoomOut')}><Minus className="w-4 h-4" /></button>
          <button type="button" onClick={() => ctrlRef.current?.reset()} aria-label={t('finance:siteFarms.map.reset')} title={t('finance:siteFarms.map.reset')}><Maximize2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="sf-map-tip" ref={tipRef} />
    </div>
  );
};

export default SiteFarmsMap;
