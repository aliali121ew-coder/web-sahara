import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Crosshair, Maximize2, Minus, Moon, Pause, Play, Plus, Route, Sun } from 'lucide-react';
import type { SiteCover } from '../../lib/siteFarmsMap';
import type { SiteWeather } from '../../lib/weather';
import { DAY_ROADS, NIGHT_ROADS, type RoadNet } from '../../lib/stationRoads';
import { buildRoute, buildTrack, poseAt, stepSim, type SimState, type Track } from '../../lib/tankerTrack';
import { MapWeather } from './MapWeather';
import type { MapTrip } from './SiteFarmsMap';
import type { TankerLayer, TruckPose } from './tankerLayer';
import './siteFarmsMap.css';
import './taqaStationsMap.css';

/**
 * خريطة مركز التوزيع (الطاقة): صورة المحطات الست (نهار/ليل) بإحداثيات موحدة لكل الطبقات —
 * الصورة وساحات المحطات وبطاقاتها والمسار والصهاريج تتحرك معًا عند التكبير والسحب.
 * الصهاريج نماذج ثلاثية الأبعاد (طبقة WebGL واحدة) تسير على خط وسط الأسفلت المتتبَّع من الصورة،
 * بالمسار الأيمن، مع تسارع وتباطؤ وسرعة أقل في المنعطفات. لا توجد بيانات GPS: الحركة محاكاة معلنة.
 */

type P = [number, number];
interface Art {
  src: string; w: number; h: number; roads: RoadNet;
  /** pad = وسط ساحة المحطة ونصفا قطرها (منطقة الضغط)، card = مكان بطاقة الحالة */
  sites: Record<string, { pad: P; rx: number; ry: number; card: P }>;
}

const DAY: Art = {
  src: '/site-map/stations-day.webp', w: 1500, h: 1152, roads: DAY_ROADS,
  sites: {
    الاجداد: { pad: [20, 12], rx: 12, ry: 4.5, card: [13, 20] },
    'امهات البياض': { pad: [69, 18], rx: 14, ry: 5, card: [71, 27] },
    البوادي: { pad: [18, 36], rx: 13, ry: 5.5, card: [13, 45] },
    التسمين: { pad: [85, 45], rx: 13, ry: 5.5, card: [80, 55] },
    البياض: { pad: [36, 62], rx: 14, ry: 6, card: [23, 72] },
    الطاقة: { pad: [79, 81], rx: 13, ry: 6, card: [56, 86] },
  },
};
const NIGHT: Art = {
  src: '/site-map/stations-night.webp', w: 1600, h: 1211, roads: NIGHT_ROADS,
  sites: {
    الاجداد: { pad: [19, 11], rx: 12, ry: 4.5, card: [13, 20] },
    'امهات البياض': { pad: [68, 18], rx: 14, ry: 5, card: [70, 27] },
    البوادي: { pad: [18, 36], rx: 13, ry: 5, card: [13, 46] },
    التسمين: { pad: [83, 45], rx: 13, ry: 5, card: [79, 55] },
    البياض: { pad: [36, 62], rx: 14, ry: 6, card: [22, 72] },
    الطاقة: { pad: [79, 82], rx: 13, ry: 6, card: [55, 87] },
  },
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const STATUS_COLOR = { crit: '#ff2d55', warn: '#facc15', ok: '#10b981', idle: '#94a3b8' } as const;
type Status = keyof typeof STATUS_COLOR;

const Z_MIN = 1, Z_MAX = 4;
/** طول الصهريج على الخريطة (نسبة من عرضها عند تكبير 1) وإزاحة المسار الأيمن عن خط الوسط */
const TRUCK_LEN = 4.8, LANE = 0.38;
const SPEEDS = [1, 2, 4] as const;

interface Live { track: Track; sim: SimState; trip: MapTrip }
interface Info { id: string; phase: 'depart' | 'moving' | 'arrived'; progress: number }

interface Props {
  /** الطاقة (الموقع الحالي) */
  site: string;
  /** ملخص المواقع: farms = المواقع الأخرى (الرصيد وأيام التغطية والحالة)، station = رصيد الطاقة */
  cover: SiteCover;
  trips: MapTrip[];
  weather: SiteWeather | null;
  onOpen: (site: string) => void;
  fuelPanel?: React.ReactNode;
}

const TaqaStationsMap: React.FC<Props> = ({ site, cover, trips, weather, onOpen, fuelPanel }) => {
  const { t } = useTranslation(['finance']);
  const M = (k: string, o?: Record<string, unknown>) => t(`finance:siteFarms.map.${k}`, o);
  const [pick, setPick] = useState<'day' | 'night' | null>(null);
  const hour = new Date().getHours();
  const night = pick ? pick === 'night' : weather ? !weather.isDay : hour < 6 || hour >= 18;
  const art = night ? NIGHT : DAY;
  const hRatio = art.h / art.w;
  const H = 100 * hRatio;

  const info = useMemo(() => {
    const m = new Map<string, { status: Status; balance: number; days: number | null }>();
    cover.farms.forEach(f => m.set(f.name, { status: f.status as Status, balance: f.balance, days: Number.isFinite(f.days) ? f.days : null }));
    m.set(site, { status: cover.station ? 'ok' : 'idle', balance: cover.station?.balance ?? 0, days: null });
    return m;
  }, [cover, site]);
  const counts = useMemo(() => {
    const c = { crit: 0, warn: 0, ok: 0 };
    cover.farms.forEach(f => { if (f.status in c) c[f.status as keyof typeof c]++; });
    return c;
  }, [cover]);

  // ---- العرض (تكبير/سحب) في ref: يُطبَّق مباشرة على الطبقة دون إعادة رسم React ----
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const view = useRef({ z: 1, x: 0, y: 0 });
  const target = useRef<{ z: number; x: number; y: number } | null>(null);
  const size = useRef({ w: 1, h: 1 });
  const follow = useRef<string | null>(null);
  const [following, setFollowing] = useState<string | null>(null);

  const clampView = (v: { z: number; x: number; y: number }) => {
    const { w, h } = size.current;
    const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z));
    return { z, x: Math.min(0, Math.max(w - w * z, v.x)), y: Math.min(0, Math.max(h - h * z, v.y)) };
  };
  const applyView = useCallback(() => {
    const s = stageRef.current; if (!s) return;
    const v = view.current;
    s.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.z})`;
    s.style.setProperty('--iz', String(1 / v.z));
  }, []);
  const zoomAt = useCallback((px: number, py: number, f: number) => {
    const v = view.current;
    const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z * f));
    view.current = clampView({ z, x: px - (px - v.x) * (z / v.z), y: py - (py - v.y) * (z / v.z) });
    target.current = null;
    applyView();
  }, [applyView]);
  /** يركّز العرض على مستطيل بوحدات الخريطة (انتقال ناعم) */
  const fitBox = useCallback((x0: number, y0: number, x1: number, y1: number, pad = 6) => {
    const { w, h } = size.current;
    const ppu = w / 100;
    const bw = (x1 - x0 + pad * 2) * ppu, bh = (y1 - y0 + pad * 2) * ppu;
    const z = Math.min(Z_MAX, Math.max(Z_MIN, Math.min(w / bw, h / bh)));
    const cx = ((x0 + x1) / 2) * ppu, cy = ((y0 + y1) / 2) * ppu;
    target.current = clampView({ z, x: w / 2 - cx * z, y: h / 2 - cy * z });
  }, []);
  const resetView = () => { follow.current = null; setFollowing(null); target.current = { z: 1, x: 0, y: 0 }; };
  const zoomBtn = (f: number) => { const { w, h } = size.current; follow.current = null; setFollowing(null); zoomAt(w / 2, h / 2, f); };

  // ---- الصهاريج: مسار كل طلب جارٍ وحالة محاكاته (refs؛ React يُحدَّث 4 مرات في الثانية فقط للوحة) ----
  const live = useRef(new Map<string, Live>());
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false); pausedRef.current = paused;
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const speedRef = useRef(1); speedRef.current = speed;
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [panel, setPanel] = useState<Info | null>(null);
  const layerRef = useRef<TankerLayer | null>(null);
  const nightRef = useRef(night); nightRef.current = night;

  const tripKey = trips.map(x => `${x.id}:${x.from}:${x.to}:${x.qty}`).join('|');
  useEffect(() => {
    const next = new Map<string, Live>();
    const fromCount = new Map<string, number>();
    trips.forEach(trip => {
      const route = buildRoute(art.roads, trip.from, trip.to, hRatio);
      if (!route) return;
      const track = buildTrack(route);
      const old = live.current.get(trip.id);
      // نفس الطلب بعد تحديث البيانات أو تبديل نهار/ليل: يكمل من نفس نسبة التقدم (بلا قفزة للبداية)
      const sim: SimState = old
        ? { ...old.sim, dist: (old.sim.dist / Math.max(1e-6, old.track.length)) * track.length }
        // صهاريج تنطلق من نفس المحطة: تتتابع بفاصل حتى لا تتراكب
        : (() => { const k = fromCount.get(trip.from) ?? 0; return { dist: 0, phase: k ? 'loading' : 'moving', dwell: k * 6, speed: 0 } as SimState; })();
      if (!old) fromCount.set(trip.from, (fromCount.get(trip.from) ?? 0) + 1);
      next.set(trip.id, { track, sim, trip });
    });
    live.current = next;
    layerRef.current?.sync([...next.keys()], nightRef.current);
    setSelected(s => (s && next.has(s) ? s : next.keys().next().value ?? null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey, art]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { layerRef.current?.setNight(night); }, [night]);

  // طبقة WebGL مرة واحدة + حلقة الرسم + التحكم بالمؤشر واللمس والعجلة
  useEffect(() => {
    const vp = viewportRef.current, gl = glRef.current, tags = tagsRef.current;
    if (!vp || !gl || !tags) return;
    let layer: TankerLayer | null = null;
    let disposed = false;
    import('./tankerLayer').then(({ TankerLayer: L }) => {
      if (disposed) return;
      try {
        layer = new L(gl);
        layer.resize(size.current.w, size.current.h);
        layer.setNight(nightRef.current);
        layer.sync([...live.current.keys()], nightRef.current);
        layerRef.current = layer;
      } catch { layer = null; }
    }).catch(() => { /* بلا WebGL تبقى علامات الصهاريج */ });

    const measure = () => {
      const r = vp.getBoundingClientRect();
      const prevW = size.current.w;
      size.current = { w: r.width, h: r.height };
      // تغيّر العرض: يُحافظ على موضع العرض بنسبته
      if (prevW > 1 && prevW !== r.width) { const k = r.width / prevW; view.current = clampView({ z: view.current.z, x: view.current.x * k, y: view.current.y * k }); }
      else view.current = clampView(view.current);
      applyView();
      layer?.resize(r.width, r.height);
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(vp);

    // علامات الصهاريج (HTML فوق الطبقة) تُنشأ وتُحدَّث يدويًا
    const tagEls = new Map<string, HTMLButtonElement>();
    const tagFor = (id: string, l: Live) => {
      let el = tagEls.get(id);
      if (!el) {
        el = document.createElement('button');
        el.type = 'button'; el.className = 'sf-tq-tag'; el.dir = 'rtl';
        el.addEventListener('click', e => { e.stopPropagation(); setSelected(id); });
        tags.appendChild(el); tagEls.set(id, el);
      }
      const label = `${fmt(l.trip.qty)} ${t('finance:siteFarms.liter')}`;
      if (el.dataset.label !== label) { el.dataset.label = label; el.textContent = label; }
      return el;
    };

    let raf = 0, last = 0, visible = document.visibilityState !== 'hidden', onScreen = true;
    const poses = new Map<string, TruckPose>();
    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const ppu = size.current.w / 100;
      // التتبّع والانتقالات الناعمة أولًا ثم الصهاريج بموضع العرض النهائي لهذا الإطار
      const fid = follow.current;
      if (fid && live.current.has(fid)) {
        const l = live.current.get(fid)!;
        const p = poseAt(l.track, l.sim.dist, LANE);
        const { w: W, h: Hh } = size.current;
        const z = Math.max(target.current?.z ?? view.current.z, 2.4);
        target.current = clampView({ z, x: W / 2 - p.x * ppu * z, y: Hh / 2 - p.y * ppu * z });
      }
      if (target.current) {
        const v = view.current, g = target.current, k = dt ? Math.min(1, dt * 5) : 0.15;
        view.current = clampView({ z: v.z + (g.z - v.z) * k, x: v.x + (g.x - v.x) * k, y: v.y + (g.y - v.y) * k });
        if (!fid && Math.abs(g.z - view.current.z) < 0.002 && Math.abs(g.x - view.current.x) < 0.5 && Math.abs(g.y - view.current.y) < 0.5) { view.current = g; target.current = null; }
        applyView();
      }
      poses.clear();
      const v = view.current;
      live.current.forEach((l, id) => {
        const before = l.sim.dist;
        if (!pausedRef.current && dt) l.sim = stepSim(l.sim, l.track, dt, speedRef.current);
        const p = poseAt(l.track, l.sim.dist, LANE);
        const sx = p.x * ppu * v.z + v.x, sy = p.y * ppu * v.z + v.y;
        // الأبعد (أعلى الصورة) أصغر قليلًا كما في منظور الصورة
        const persp = 0.84 + 0.28 * (p.y / H);
        const lengthPx = TRUCK_LEN * ppu * v.z * persp;
        const moved = l.sim.dist >= before ? l.sim.dist - before : 0;
        poses.set(id, { sx, sy, heading: p.heading, lengthPx, travelPx: moved * ppu * v.z * persp });
        const tag = tagFor(id, l);
        tag.style.transform = `translate(${sx.toFixed(1)}px, ${(sy - lengthPx * 0.42).toFixed(1)}px) translate(-50%, -100%)`;
        tag.classList.toggle('on', id === selectedRef.current);
      });
      tagEls.forEach((el, id) => { if (!live.current.has(id)) { el.remove(); tagEls.delete(id); } });
      layer?.render(poses);
      if (visible && onScreen) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && visible && onScreen) { last = 0; raf = requestAnimationFrame(frame); } };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    // الصفحة مخفية أو الخريطة خارج الشاشة: تتوقف الحلقة (لا رسم ولا محاكاة)
    const onVis = () => { visible = document.visibilityState !== 'hidden'; if (visible) start(); else stop(); };
    document.addEventListener('visibilitychange', onVis);
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) start(); else stop(); });
    io.observe(vp);
    start();

    // ---- المؤشر: سحب بإصبع/ماوس، وتكبير بإصبعين، وعجلة الماوس ----
    const pts = new Map<number, { x: number; y: number }>();
    let dragged = false, downAt: { x: number; y: number } | null = null, pinch: { d: number; mx: number; my: number } | null = null;
    const local = (e: PointerEvent | WheelEvent) => { const r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const isUi = (el: EventTarget | null) => el instanceof Element && !!el.closest('.sf-tq-ui, .sf-map-panel, .sf-map-fuel, .sf-map-wx, .sf-tq-tag');
    const stopFollow = () => { if (follow.current) { follow.current = null; setFollowing(null); } target.current = null; };
    const onDown = (e: PointerEvent) => {
      if (isUi(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      pts.set(e.pointerId, local(e));
      if (pts.size === 1) { downAt = local(e); dragged = false; }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        dragged = true; stopFollow();
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId)!, cur = local(e);
      pts.set(e.pointerId, cur);
      if (pts.size >= 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        view.current = clampView({ ...view.current, x: view.current.x + (mx - pinch.mx), y: view.current.y + (my - pinch.my) });
        zoomAt(mx, my, d / Math.max(1, pinch.d));
        pinch = { d, mx, my };
        return;
      }
      if (!dragged && downAt && Math.hypot(cur.x - downAt.x, cur.y - downAt.y) > 4) {
        dragged = true; stopFollow();
        try { vp.setPointerCapture(e.pointerId); } catch { /* المؤشر انتهى */ }
        vp.classList.add('dragging');
      }
      if (dragged) {
        view.current = clampView({ ...view.current, x: view.current.x + cur.x - prev.x, y: view.current.y + cur.y - prev.y });
        applyView();
      }
    };
    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) { downAt = null; vp.classList.remove('dragging'); }
    };
    // بعد السحب لا يُعدّ الإفلات ضغطًا (لا يفتح محطة)
    const onClickCapture = (e: MouseEvent) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } };
    const onWheel = (e: WheelEvent) => {
      if (isUi(e.target)) return;
      e.preventDefault(); stopFollow();
      const p = local(e);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)));
    };
    vp.addEventListener('pointerdown', onDown);
    vp.addEventListener('pointermove', onMove);
    vp.addEventListener('pointerup', onUp);
    vp.addEventListener('pointercancel', onUp);
    vp.addEventListener('click', onClickCapture, true);
    vp.addEventListener('wheel', onWheel, { passive: false });

    // لوحة الصهريج المحدد: 4 تحديثات في الثانية فقط
    const tick = window.setInterval(() => {
      const id = selectedRef.current, l = id ? live.current.get(id) : null;
      if (!id || !l) { setPanel(p => (p ? null : p)); return; }
      const progress = Math.round((l.sim.dist / Math.max(1e-6, l.track.length)) * 100);
      const phase: Info['phase'] = l.sim.phase === 'arrived' ? 'arrived' : l.sim.phase === 'loading' || l.sim.dist < 1.2 ? 'depart' : 'moving';
      setPanel(p => (p && p.id === id && p.progress === progress && p.phase === phase ? p : { id, phase, progress }));
    }, 250);

    return () => {
      disposed = true;
      stop();
      window.clearInterval(tick);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      vp.removeEventListener('pointerdown', onDown);
      vp.removeEventListener('pointermove', onMove);
      vp.removeEventListener('pointerup', onUp);
      vp.removeEventListener('pointercancel', onUp);
      vp.removeEventListener('click', onClickCapture, true);
      vp.removeEventListener('wheel', onWheel);
      tagEls.forEach(el => el.remove());
      layer?.dispose();
      layerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [H]);

  const sel = selected ? live.current.get(selected) ?? null : null;
  const fitRoute = () => {
    if (!sel) return;
    follow.current = null; setFollowing(null);
    const tr = sel.track;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < tr.x.length; i++) { x0 = Math.min(x0, tr.x[i]); x1 = Math.max(x1, tr.x[i]); y0 = Math.min(y0, tr.y[i]); y1 = Math.max(y1, tr.y[i]); }
    fitBox(x0, y0, x1, y1);
  };
  const toggleFollow = () => {
    if (!selected) return;
    const on = follow.current !== selected;
    follow.current = on ? selected : null;
    setFollowing(on ? selected : null);
    if (!on) target.current = null;
  };
  const stateText = (p: Info, trip: MapTrip) => paused
    ? M('stPaused')
    : p.phase === 'arrived' ? M('stArrived', { site: trip.to }) : p.phase === 'depart' ? M('stDepart', { site: trip.from }) : M('stMoving', { site: trip.to });

  return (
    <div className="sf-tq-wrap">
      <div ref={viewportRef} className={`sf-map sf-tq${night ? ' night' : ''}`} style={{ aspectRatio: `${art.w} / ${art.h}` }} role="group" aria-label={M('stationsAria')}>
        <div ref={stageRef} className="sf-tq-stage">
          <img className="sf-tq-img" src={art.src} alt="" draggable={false} />
          <svg className="sf-tq-svg" viewBox={`0 0 100 ${H.toFixed(2)}`} aria-hidden="true">
            {/* ساحات المحطات: منطقة ضغط تفتح الموقع (بلا حدود مرسومة) */}
            {Object.entries(art.sites).map(([name, s]) => (
              <ellipse key={name} className={`sf-tq-pad${name === site ? ' self' : ''}`} cx={s.pad[0]} cy={(s.pad[1] * H) / 100} rx={s.rx} ry={(s.ry * H) / 100}
                onClick={() => { if (name !== site) onOpen(name); }}>
                <title>{name === site ? `${name} · ${M('center')}` : M('openSite', { site: name })}</title>
              </ellipse>
            ))}
          </svg>
          {/* بطاقات المواقع: الرصيد وأيام التغطية (حجمها ثابت مع التكبير) */}
          {Object.entries(art.sites).map(([name, s]) => {
            const v = info.get(name);
            const st: Status = v?.status ?? 'idle';
            const self = name === site;
            return (
              <button key={name} type="button" className={`sf-tq-card ${st}${self ? ' self' : ''}`} dir="rtl"
                style={{ left: `${s.card[0]}%`, top: `${s.card[1]}%`, '--st': STATUS_COLOR[st] } as React.CSSProperties}
                onClick={() => { if (!self) onOpen(name); }} title={self ? undefined : M('openSite', { site: name })} disabled={self}>
                <i />
                <span>
                  <b>{self ? `${name} · ${M('center')}` : name}</b>
                  <small>
                    {v && (v.balance || st !== 'idle') ? `${fmt(v.balance)} ${t('finance:siteFarms.liter')}` : M('noData')}
                    {v?.days != null ? ` · ${v.days.toFixed(1)} ${M('daysShort')}` : ''}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
        <div ref={glRef} className="sf-tq-gl" aria-hidden="true" />
        <div ref={tagsRef} className="sf-tq-tags" />

        <div className="sf-map-hud">
          <div className="sf-map-head">
            <div><b>{M('title', { site })}</b></div>
            <div className="sf-map-side">
              {weather && <MapWeather weather={weather} />}
              <div className="sf-map-stats">
                {(['crit', 'warn', 'ok'] as const).map(k => (
                  <div key={k}><b style={{ color: STATUS_COLOR[k] }}>{counts[k]}</b><span>{M(k)}</span></div>
                ))}
              </div>
              <div className="sf-tq-dn sf-tq-ui">
                <button type="button" className={!night ? 'on' : ''} onClick={() => setPick('day')} aria-pressed={!night} title={M('dayView')} aria-label={M('dayView')}><Sun className="w-4 h-4" /></button>
                <button type="button" className={night ? 'on' : ''} onClick={() => setPick('night')} aria-pressed={night} title={M('nightView')} aria-label={M('nightView')}><Moon className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          <div className="sf-map-zoom sf-tq-ui">
            <button type="button" onClick={() => zoomBtn(1.4)} aria-label={M('zoomIn')} title={M('zoomIn')}><Plus className="w-4 h-4" /></button>
            <button type="button" onClick={() => zoomBtn(1 / 1.4)} aria-label={M('zoomOut')} title={M('zoomOut')}><Minus className="w-4 h-4" /></button>
            <button type="button" onClick={resetView} aria-label={M('reset')} title={M('reset')}><Maximize2 className="w-4 h-4" /></button>
          </div>
          <div className="sf-map-foot">
            <div className="sf-map-legend">
              <span><i style={{ background: STATUS_COLOR.crit }} />{M('siteCrit')}</span>
              <span><i style={{ background: STATUS_COLOR.warn }} />{M('siteWarn')}</span>
              <span><i style={{ background: STATUS_COLOR.ok }} />{M('siteOk')}</span>
            </div>
            <div className="sf-map-btns sf-tq-ui">{fuelPanel}</div>
          </div>
        </div>
      </div>
      {/* لوحة الصهريج المحدد: الحالة والتقدم والتحكم بالمحاكاة */}
      {sel && panel && panel.id === sel.trip.id && (
        <div className="sf-tq-trip sf-tq-ui" dir="rtl">
          <div className="sf-tq-trip-head">
            <b>{M('tanker')} · {fmt(sel.trip.qty)} {t('finance:siteFarms.liter')}</b>
            <span className="sf-tq-sim" title={M('simHint')}>{M('sim')}</span>
          </div>
          {live.current.size > 1 && (
            <div className="sf-tq-trip-pick">
              {[...live.current.values()].map(l => (
                <button key={l.trip.id} type="button" className={l.trip.id === selected ? 'on' : ''} onClick={() => setSelected(l.trip.id)}>
                  {l.trip.from} ← {l.trip.to}
                </button>
              ))}
            </div>
          )}
          <div className="sf-tq-trip-route"><span>{sel.trip.from}</span><i /><span>{sel.trip.to}</span></div>
          <div className={`sf-tq-trip-state ${paused ? 'paused' : panel.phase}`}><i />{stateText(panel, sel.trip)}</div>
          <div className="sf-tq-bar" role="progressbar" aria-valuenow={panel.progress} aria-valuemin={0} aria-valuemax={100} aria-label={M('progress')}>
            <span style={{ width: `${panel.progress}%` }} />
          </div>
          <div className="sf-tq-trip-meta">
            <span>{M('progress')} {panel.progress}%</span>
            {sel.trip.since && <span>{M('approvedAt', { time: sel.trip.since.slice(5, 16).replace('T', ' ').replace(/-/g, '/') })}</span>}
          </div>
          <div className="sf-tq-trip-acts">
            <button type="button" onClick={() => setPaused(p => !p)} title={paused ? M('play') : M('pause')} aria-label={paused ? M('play') : M('pause')}>
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <div className="sf-tq-speed" role="group" aria-label={M('speed')}>
              {SPEEDS.map(s => <button key={s} type="button" className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>×{s}</button>)}
            </div>
            <button type="button" className={following === selected ? 'on' : ''} onClick={toggleFollow} aria-pressed={following === selected}><Crosshair className="w-4 h-4" />{M('follow')}</button>
            <button type="button" onClick={fitRoute}><Route className="w-4 h-4" />{M('showRoute')}</button>
          </div>
          <small className="sf-tq-trip-note">{M('simHint')}</small>
        </div>
      )}
    </div>
  );
};

export default TaqaStationsMap;
