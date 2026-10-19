import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Crosshair, Maximize2, Minus, Moon, Play, Plus, Radio, Route, Sun } from 'lucide-react';
import type { SiteCover } from '../../lib/siteFarmsMap';
import type { SiteWeather } from '../../lib/weather';
import { DAY_ROADS, NIGHT_ROADS, type RoadNet } from '../../lib/stationRoads';
import { DEFAULT_ETA_MIN, TRACK, buildRoute, buildTrack, distAtTime, planTrip, poseAt, queuedPlan, timeTrack, tripAt, type Track, type TripPhase, type TripPlan } from '../../lib/tankerTrack';
import { MapWeather } from './MapWeather';
import type { MapTrip } from './SiteFarmsMap';
import type { FillPose, TankerLayer, TruckPose } from './tankerLayer';
import './siteFarmsMap.css';
import './taqaStationsMap.css';

/**
 * خريطة مركز التوزيع (الطاقة): صورة المحطات الست (نهار/ليل) بإحداثيات موحدة لكل الطبقات —
 * الصورة وساحات المحطات وبطاقاتها والصهاريج تتحرك معًا عند التكبير والسحب.
 * لكل طلب موافَق عليه قافلة بعدد صهاريجه: كل صهريج يخرج من عند خزان محطة الانطلاق، ويسير على خط وسط الأسفلت
 * (المسار الأيمن) بسرعة أعلى في المستقيم وأقل في المنعطفات، ويدخل ساحة الوجهة ويقف عند الخزان ويفرغ.
 * الموقع تقديري بالوقت الحقيقي من وقت الموافقة ومدة الوصول (لا توجد بيانات GPS)، و«عرض الرحلة» يعيدها كاملة بسرعة القيادة.
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
/** طول الصهريج (نسبة من عرض الخريطة عند تكبير 1)، وإزاحة المسار الأيمن، والمسافة بين صهاريج القافلة في طابور التفريغ */
const TRUCK_LEN = 5.4, LANE = 0.42, QUEUE_GAP = 6.2;
/** عرض الرحلة: فاصل الانطلاق بين صهاريج القافلة ومدة التفريغ (ثوانٍ) */
const REPLAY_GAP = 2.5, REPLAY_UNLOAD = 6;

interface Rig {
  id: string; trip: MapTrip; k: number; n: number; qty: number;
  /** ترتيب انطلاقه في عرض الرحلة (القوافل من نفس المحطة تتتابع) */
  order: number;
  track: Track; tc: Float32Array; T: number;
  approved: number; eta: number; etaSet: boolean;
  last: { dist: number; t: number } | null;
}
interface Info { id: string; phase: TripPhase; frac: number; msLeft: number; arrive: number }

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
  const M = useCallback((k: string, o?: Record<string, unknown>) => t(`finance:siteFarms.map.${k}`, o), [t]);
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
  const [touchHint, setTouchHint] = useState(true);

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
    viewportRef.current?.classList.toggle('zoomed', v.z > 1.01);
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
  const stopFollowing = () => { follow.current = null; setFollowing(null); };
  const resetView = () => { stopFollowing(); target.current = { z: 1, x: 0, y: 0 }; };
  const zoomBtn = (f: number) => { const { w, h } = size.current; stopFollowing(); zoomAt(w / 2, h / 2, f); };

  // ---- القوافل: صهريج لكل وحدة من عدد صهاريج الطلب، بمسار وجدول زمني ----
  const rigs = useRef(new Map<string, Rig>());
  const firstSeen = useRef(new Map<string, number>());
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [panel, setPanel] = useState<Info | null>(null);
  const [replay, setReplay] = useState<number | null>(null);
  const replayRef = useRef<number | null>(null);
  const layerRef = useRef<TankerLayer | null>(null);
  const nightRef = useRef(night); nightRef.current = night;
  const [rigsVer, setRigsVer] = useState(0);

  const tripKey = trips.map(x => `${x.id}:${x.from}:${x.to}:${x.qty}:${x.tankers ?? 1}:${x.etaMin ?? ''}:${x.since ?? ''}`).join('|');
  useEffect(() => {
    const next = new Map<string, Rig>();
    const fromCount = new Map<string, number>();
    trips.forEach(trip => {
      const route = buildRoute(art.roads, trip.from, trip.to, hRatio);
      if (!route) return;
      const track = buildTrack(route);
      const tc = timeTrack(track);
      const n = Math.min(20, Math.max(1, Math.round(trip.tankers ?? 1)));
      if (!firstSeen.current.has(trip.id)) firstSeen.current.set(trip.id, Date.now());
      const approved = (trip.since && Date.parse(trip.since)) || firstSeen.current.get(trip.id)!;
      for (let k = 0; k < n; k++) {
        const id = n > 1 ? `${trip.id}#${k}` : trip.id;
        const order = fromCount.get(trip.from) ?? 0;
        fromCount.set(trip.from, order + 1);
        next.set(id, {
          id, trip, k, n, order, qty: trip.qty / n, track, tc, T: tc[tc.length - 1],
          approved, eta: trip.etaMin ?? DEFAULT_ETA_MIN, etaSet: !!trip.etaMin,
          last: rigs.current.get(id)?.last ?? null,
        });
      }
    });
    rigs.current = next;
    layerRef.current?.sync([...next.keys()]);
    setSelected(s => (s && next.has(s) ? s : next.keys().next().value ?? null));
    setRigsVer(v => v + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey, art]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { replayRef.current = replay; }, [replay]);
  useEffect(() => { layerRef.current?.setNight(night); }, [night]);

  // نقاط التفريغ: عند نقطة وقوف كل محطة، باتجاه آخر مقطع قبلها، وجهة الخرطوم نحو الساحة الأمامية (أسفل الصورة) لتظهر بوضوح
  const fillPts = useRef<{ site: string; x: number; y: number; heading: number; side: 1 | -1 }[]>([]);
  const fillSide = useRef(new Map<string, 1 | -1>());
  useMemo(() => {
    const list = Object.entries(art.roads.yards).map(([name, y]) => {
      const before = y.pre ?? Object.values(y.from)[0]?.slice(-1)[0] ?? y.park;
      const heading = Math.atan2((y.park[1] - before[1]) * hRatio, y.park[0] - before[0]);
      const side: 1 | -1 = Math.cos(heading) > 0 ? 1 : -1;
      return { site: name, x: y.park[0], y: y.park[1] * hRatio, heading, side };
    });
    fillPts.current = list;
    fillSide.current = new Map(list.map(f => [f.site, f.side]));
  }, [art, hRatio]);

  /** جدول الصهريج: الحقيقي (الموافقة + مدة الوصول) أو عرض الرحلة (بزمن القيادة الفعلي على المسار) */
  const planOf = (r: Rig, replayAt: number | null): TripPlan => replayAt != null
    ? queuedPlan(replayAt + (r.order - r.k) * REPLAY_GAP * 1000, REPLAY_GAP * 1000, r.T * 1000, REPLAY_UNLOAD * 1000, r.k)
    : planTrip(r.approved, r.eta, r.qty, r.k);
  const nowOf = (replayAt: number | null) => (replayAt != null ? performance.now() : Date.now());

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
        layer.sync([...rigs.current.keys()]);
        layerRef.current = layer;
      } catch { layer = null; }
    }).catch(() => { /* بلا WebGL تبقى علامات الصهاريج */ });

    const measure = () => {
      const r = vp.getBoundingClientRect();
      const prevW = size.current.w;
      size.current = { w: r.width, h: r.height };
      if (prevW > 1 && prevW !== r.width) { const k = r.width / prevW; view.current = clampView({ z: view.current.z, x: view.current.x * k, y: view.current.y * k }); }
      else view.current = clampView(view.current);
      applyView();
      layer?.resize(r.width, r.height);
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(vp);

    // علامة الصهريج (HTML): للصهريج المحدد دائمًا، وللبقية عند التكبير
    const tagEls = new Map<string, HTMLButtonElement>();
    const tagFor = (id: string) => {
      let el = tagEls.get(id);
      if (!el) {
        el = document.createElement('button');
        el.type = 'button'; el.className = 'sf-tq-tag'; el.dir = 'rtl';
        el.addEventListener('click', e => { e.stopPropagation(); setSelected(id); });
        tags.appendChild(el); tagEls.set(id, el);
      }
      return el;
    };
    const setText = (el: HTMLElement, s: string) => { if (el.dataset.t !== s) { el.dataset.t = s; el.textContent = s; } };
    const liter = t('finance:siteFarms.liter');

    let raf = 0, last = 0, visible = document.visibilityState !== 'hidden', onScreen = true;
    const poses = new Map<string, TruckPose>();
    const frame = (nowPerf: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (nowPerf - last) / 1000) : 0;
      last = nowPerf;
      const ppu = size.current.w / 100;
      const replayAt = replayRef.current;
      const now = nowOf(replayAt);

      // موضع كل صهريج من جدوله
      const placed = new Map<string, { rig: Rig; dist: number; phase: TripPhase; m: ReturnType<typeof tripAt>; atFill: boolean }>();
      const moments = new Map<string, ReturnType<typeof tripAt>>();
      let allDone = true;
      rigs.current.forEach((r, id) => {
        const m = tripAt(planOf(r, replayAt), now);
        moments.set(id, m);
        if (m.phase !== 'unloaded') allDone = false;
      });
      rigs.current.forEach((r, id) => {
        const m = moments.get(id)!;
        // لم ينطلق بعد، أو أنهى التفريغ وأخلى نقطة التفريغ لمن بعده (يبقى آخر صهريج في القافلة)
        if (m.phase === 'waiting' || (m.phase === 'unloaded' && r.k < r.n - 1)) { r.last = null; return; }
        // مكانه في طابور التفريغ: عدد من سبقه من قافلته وما زال عند المحطة
        let ahead = 0;
        for (let j = 0; j < r.k; j++) {
          const pj = moments.get(r.n > 1 ? `${r.trip.id}#${j}` : r.trip.id)?.phase;
          if (pj === 'queued' || pj === 'unloading') ahead++;
        }
        const L = r.track.length;
        const spot = Math.max(L * 0.45, L - ahead * QUEUE_GAP);
        let dist: number;
        if (m.phase === 'driving') dist = Math.min(spot, distAtTime(r.track, r.tc, m.drive * r.T));
        else {
          // يتقدم بهدوء إلى مكانه (عند خلوّ نقطة التفريغ) بدل القفز
          dist = r.last && r.last.dist < spot ? Math.min(spot, r.last.dist + TRACK.vyard * dt) : spot;
        }
        placed.set(id, { rig: r, dist, phase: m.phase, m, atFill: dist >= L - 0.05 });
      });
      if (replayAt != null && allDone && now - replayAt > 2000) { replayRef.current = null; setReplay(null); }

      // التتبّع والانتقالات الناعمة
      const fid = follow.current;
      if (fid && placed.has(fid)) {
        const p = poseAt(placed.get(fid)!.rig.track, placed.get(fid)!.dist, LANE);
        const { w: W, h: Hh } = size.current;
        const z = Math.max(target.current?.z ?? view.current.z, 2.6);
        target.current = clampView({ z, x: W / 2 - p.x * ppu * z, y: Hh / 2 - p.y * ppu * z });
      }
      if (target.current) {
        const v = view.current, g = target.current, k = dt ? Math.min(1, dt * 4) : 0.15;
        view.current = clampView({ z: v.z + (g.z - v.z) * k, x: v.x + (g.x - v.x) * k, y: v.y + (g.y - v.y) * k });
        if (!fid && Math.abs(g.z - view.current.z) < 0.002 && Math.abs(g.x - view.current.x) < 0.5 && Math.abs(g.y - view.current.y) < 0.5) { view.current = g; target.current = null; }
        applyView();
      }

      poses.clear();
      const v = view.current;
      const toScreen = (x: number, y: number): [number, number] => [x * ppu * v.z + v.x, y * ppu * v.z + v.y];
      placed.forEach(({ rig, dist, phase, m, atFill }, id) => {
        const tr = rig.track;
        const p = poseAt(tr, dist, LANE);
        const [sx, sy] = toScreen(p.x, p.y);
        const persp = 0.84 + 0.28 * (p.y / H);
        const lengthPx = TRUCK_LEN * ppu * v.z * persp;
        const prev = rig.last;
        const moved = prev && dist >= prev.dist ? dist - prev.dist : 0;
        const speed = prev && dt ? moved / dt : 0;
        rig.last = { dist, t: now };
        const driving = (phase === 'driving' || moved > 1e-4) && dist < tr.length - 0.05;
        // الفرامل: الملف يتباطأ أمامه (منعطف، ساحة، وصول) — والإشارة: انعطاف حاد قادم
        const vNow = poseAt(tr, dist).speed, vAhead = poseAt(tr, Math.min(tr.length, dist + 2.5)).speed;
        const brake = !driving || vAhead < vNow * 0.82;
        const hAhead = poseAt(tr, Math.min(tr.length, dist + 4)).heading;
        let dh = hAhead - p.heading; if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI;
        const signal: -1 | 0 | 1 = driving && Math.abs(dh) > 0.5 ? (dh > 0 ? 1 : -1) : 0;
        const rel = Math.min(1, speed / TRACK.vmax);
        poses.set(id, {
          sx, sy, mx: p.x, my: p.y, heading: p.heading, lengthPx, travelPx: moved * ppu * v.z * persp,
          brake, signal, unloading: phase === 'unloading' && atFill, hoseSide: fillSide.current.get(rig.trip.to) ?? 1,
          roll: driving ? Math.max(-0.07, Math.min(0.07, -dh * 0.06 * rel)) : 0,
          pitch: driving ? (brake ? 0.025 * rel : vAhead > vNow * 1.1 ? -0.02 * rel : 0) : 0,
          dust: driving && !p.yard ? rel * (nightRef.current ? 0.6 : 1) : 0,
        });
        const show = id === selectedRef.current || v.z >= 1.7;
        const tag = tagFor(id);
        tag.hidden = !show;
        if (show) {
          tag.style.transform = `translate(${sx.toFixed(1)}px, ${(sy - lengthPx * 0.45).toFixed(1)}px) translate(-50%, -100%)`;
          tag.classList.toggle('on', id === selectedRef.current);
          tag.dataset.phase = phase;
          const label = phase === 'queued' || (phase === 'unloading' && !atFill) ? M('tagQueued')
            : phase === 'unloading' ? M('tagUnloading', { n: Math.round(m.unload * 100) })
            : phase === 'unloaded' ? M('tagUnloaded')
            : replayAt != null ? `${fmt(rig.qty)} ${liter}` : `${fmt(rig.qty)} ${liter} · ${M('minLeft', { n: Math.ceil(m.msLeft / 60000) })}`;
          setText(tag, label);
        }
      });
      tagEls.forEach((el, id) => { if (!placed.has(id)) { el.hidden = true; if (!rigs.current.has(id)) { el.remove(); tagEls.delete(id); } } });
      // نقاط التفريغ في المحطات (حيث يصل خرطوم الصهريج الواقف)
      const fills: FillPose[] = fillPts.current.map(f => {
        const [fx, fy] = toScreen(f.x, f.y);
        return { id: f.site, sx: fx, sy: fy, heading: f.heading, lengthPx: TRUCK_LEN * ppu * v.z * (0.84 + 0.28 * (f.y / H)), side: f.side };
      });
      layer?.render(poses, { toScreen, ppu: ppu * v.z }, dt, fills);
      if (visible && onScreen) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && visible && onScreen) { last = 0; raf = requestAnimationFrame(frame); } };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    // الصفحة مخفية أو الخريطة خارج الشاشة: تتوقف الحلقة (الموقع محسوب من الوقت فلا يضيع شيء)
    const onVis = () => { visible = document.visibilityState !== 'hidden'; if (visible) start(); else stop(); };
    document.addEventListener('visibilitychange', onVis);
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) start(); else stop(); });
    io.observe(vp);
    start();

    const isUi = (el: EventTarget | null) => el instanceof Element && !!el.closest('.sf-tq-ui, .sf-map-panel, .sf-map-fuel, .sf-map-wx, .sf-tq-tag');
    const stopFollow = () => { if (follow.current) { follow.current = null; setFollowing(null); } target.current = null; };
    let dragged = false;

    // ---- الماوس: سحب لتحريك الخريطة، وعجلة للتكبير (التصغير عند أقل تكبير يترك الصفحة تتمرر) ----
    let mouse: { x: number; y: number; sx: number; sy: number } | null = null;
    const local = (e: { clientX: number; clientY: number }) => { const r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || isUi(e.target) || e.button !== 0) return;
      const p = local(e); mouse = { ...p, sx: p.x, sy: p.y }; dragged = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!mouse || e.pointerType === 'touch') return;
      const p = local(e);
      if (!dragged && Math.hypot(p.x - mouse.sx, p.y - mouse.sy) > 4) {
        dragged = true; stopFollow();
        try { vp.setPointerCapture(e.pointerId); } catch { /* المؤشر انتهى */ }
        vp.classList.add('dragging');
      }
      if (dragged) { view.current = clampView({ ...view.current, x: view.current.x + p.x - mouse.x, y: view.current.y + p.y - mouse.y }); applyView(); }
      mouse.x = p.x; mouse.y = p.y;
    };
    const onUp = () => { mouse = null; vp.classList.remove('dragging'); };
    const onWheel = (e: WheelEvent) => {
      if (isUi(e.target)) return;
      const z = view.current.z;
      // عند أقل تكبير وتمرير للأسفل، أو أقصى تكبير وتمرير للأعلى: تتمرر الصفحة عاديًا
      if ((e.deltaY > 0 && z <= Z_MIN + 0.001) || (e.deltaY < 0 && z >= Z_MAX - 0.001)) return;
      e.preventDefault(); stopFollow();
      const p = local(e);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)));
    };

    // ---- اللمس: إصبع واحد يمرر الصفحة (إلا إذا كانت الخريطة مكبّرة فيحركها)، وإصبعان للتكبير والتحريك ----
    let touch: { mode: 'pan' | 'pinch'; x: number; y: number; d: number; sx: number; sy: number } | null = null;
    const two = (e: TouchEvent) => {
      const a = local(e.touches[0]), b = local(e.touches[1]);
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
    };
    const onTouchStart = (e: TouchEvent) => {
      if (isUi(e.target)) return;
      if (e.touches.length >= 2) {
        e.preventDefault();
        const g = two(e); touch = { mode: 'pinch', ...g, sx: g.x, sy: g.y }; dragged = true; stopFollow(); setTouchHint(false);
      } else if (e.touches.length === 1 && view.current.z > 1.01) {
        const p = local(e.touches[0]); touch = { mode: 'pan', ...p, d: 0, sx: p.x, sy: p.y }; dragged = false;
      } else touch = null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touch) return;
      if (touch.mode === 'pinch' && e.touches.length >= 2) {
        e.preventDefault();
        const g = two(e);
        view.current = clampView({ ...view.current, x: view.current.x + g.x - touch.x, y: view.current.y + g.y - touch.y });
        zoomAt(g.x, g.y, g.d / Math.max(1, touch.d));
        Object.assign(touch, g);
      } else if (touch.mode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        const p = local(e.touches[0]);
        if (!dragged && Math.hypot(p.x - touch.sx, p.y - touch.sy) > 6) { dragged = true; stopFollow(); }
        view.current = clampView({ ...view.current, x: view.current.x + p.x - touch.x, y: view.current.y + p.y - touch.y });
        applyView();
        touch.x = p.x; touch.y = p.y;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) touch = null;
      else if (e.touches.length === 1 && view.current.z > 1.01) { const p = local(e.touches[0]); touch = { mode: 'pan', ...p, d: 0, sx: p.x, sy: p.y }; }
      else touch = null;
    };
    // بعد السحب لا يُعدّ الإفلات ضغطًا (لا يفتح محطة)
    const onClickCapture = (e: MouseEvent) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } };

    vp.addEventListener('pointerdown', onDown);
    vp.addEventListener('pointermove', onMove);
    vp.addEventListener('pointerup', onUp);
    vp.addEventListener('pointercancel', onUp);
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('touchstart', onTouchStart, { passive: false });
    vp.addEventListener('touchmove', onTouchMove, { passive: false });
    vp.addEventListener('touchend', onTouchEnd);
    vp.addEventListener('touchcancel', onTouchEnd);
    vp.addEventListener('click', onClickCapture, true);

    // لوحة الصهريج المحدد: 4 تحديثات في الثانية فقط
    const tick = window.setInterval(() => {
      const id = selectedRef.current, r = id ? rigs.current.get(id) : null;
      if (!id || !r) { setPanel(p => (p ? null : p)); return; }
      const replayAt = replayRef.current;
      const plan = planOf(r, replayAt);
      const m = tripAt(plan, nowOf(replayAt));
      const frac = Math.round((m.phase === 'unloading' || m.phase === 'unloaded' ? m.unload : m.phase === 'queued' ? 0 : m.drive) * 100) / 100;
      const next: Info = { id, phase: m.phase, frac, msLeft: Math.round(m.msLeft / 1000) * 1000, arrive: plan.start + plan.driveMs };
      setPanel(p => (p && p.id === next.id && p.phase === next.phase && p.frac === next.frac && p.msLeft === next.msLeft ? p : next));
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
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('touchstart', onTouchStart);
      vp.removeEventListener('touchmove', onTouchMove);
      vp.removeEventListener('touchend', onTouchEnd);
      vp.removeEventListener('touchcancel', onTouchEnd);
      vp.removeEventListener('click', onClickCapture, true);
      tagEls.forEach(el => el.remove());
      layer?.dispose();
      layerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [H]);

  const all = useMemo(() => [...rigs.current.values()],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rigsVer]);
  const sel = selected ? rigs.current.get(selected) ?? null : null;
  const fitRoute = () => {
    if (!sel) return;
    stopFollowing();
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
  const startReplay = () => {
    const at = performance.now();
    replayRef.current = at; setReplay(at);
    if (selected) { follow.current = selected; setFollowing(selected); }
  };
  const stopReplay = () => { replayRef.current = null; setReplay(null); };
  const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dur = (ms: number) => {
    const m = Math.max(0, Math.ceil(ms / 60000));
    return m >= 60 ? M('durHM', { h: Math.floor(m / 60), m: String(m % 60).padStart(2, '0') }) : M('durM', { n: m });
  };
  const stateText = (p: Info, r: Rig) => {
    if (p.phase === 'waiting') return M('stWaiting', { site: r.trip.from, t: dur(p.msLeft) });
    if (p.phase === 'driving') return replay != null ? M('stMoving', { site: r.trip.to }) : M('stMovingEta', { site: r.trip.to, t: dur(p.msLeft) });
    if (p.phase === 'queued') return M('stQueued', { site: r.trip.to, t: dur(p.msLeft) });
    if (p.phase === 'unloading') return M('stUnloading', { site: r.trip.to });
    return M('stUnloaded', { site: r.trip.to });
  };

  return (
    <div className={`sf-tq-wrap${sel && panel ? ' has-trip' : ''}`}>
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
          {touchHint && <div className="sf-tq-hint">{M('touchHint')}</div>}
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

      {/* لوحة الصهريج المحدد: القافلة والحالة ووقت الوصول والتفريغ */}
      {sel && panel && panel.id === sel.id && (
        <div className="sf-tq-trip sf-tq-ui" dir="rtl">
          <div className="sf-tq-trip-head">
            <b>{sel.n > 1 ? M('tankerOf', { k: sel.k + 1, n: sel.n }) : M('tanker')} · {fmt(sel.qty)} {t('finance:siteFarms.liter')}</b>
            {replay != null
              ? <span className="sf-tq-sim replay">{M('replay')}</span>
              : <span className="sf-tq-sim" title={M('estHint')}>{M('estimated')}</span>}
          </div>
          {all.length > 1 && (
            <div className="sf-tq-trip-pick">
              {all.slice(0, 12).map(r => (
                <button key={r.id} type="button" className={r.id === selected ? 'on' : ''} onClick={() => setSelected(r.id)}>
                  {r.trip.from} ← {r.trip.to}{r.n > 1 ? ` ${r.k + 1}/${r.n}` : ''}
                </button>
              ))}
            </div>
          )}
          <div className="sf-tq-trip-route"><span>{sel.trip.from}</span><i /><span>{sel.trip.to}</span></div>
          <div className={`sf-tq-trip-state ${panel.phase}`}><i />{stateText(panel, sel)}</div>
          <div className={`sf-tq-bar ${panel.phase}`} role="progressbar" aria-valuenow={Math.round(panel.frac * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={M('progress')}>
            <span style={{ width: `${panel.frac * 100}%` }} />
          </div>
          <div className="sf-tq-trip-meta">
            {replay == null && <span>{sel.etaSet ? M('etaIs', { t: dur(sel.eta * 60000) }) : M('etaDefault', { t: dur(sel.eta * 60000) })}</span>}
            {replay == null && <span>{M('arriveAt', { time: clock(panel.arrive) })}</span>}
            {panel.phase === 'unloading' && <span>{M('unloadedL', { n: fmt(sel.qty * panel.frac), of: fmt(sel.qty) })}</span>}
          </div>
          <div className="sf-tq-trip-acts">
            {replay == null
              ? <button type="button" onClick={startReplay}><Play className="w-4 h-4" />{M('replayBtn')}</button>
              : <button type="button" className="on" onClick={stopReplay}><Radio className="w-4 h-4" />{M('liveBtn')}</button>}
            <button type="button" className={following === selected ? 'on' : ''} onClick={toggleFollow} aria-pressed={following === selected}><Crosshair className="w-4 h-4" />{M('follow')}</button>
            <button type="button" onClick={fitRoute}><Route className="w-4 h-4" />{M('showRoute')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaqaStationsMap;
