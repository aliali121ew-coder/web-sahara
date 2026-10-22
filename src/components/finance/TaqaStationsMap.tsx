import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Crosshair, Maximize2, Minus, Moon, Navigation2, Play, Plus, Radio, RotateCcw, RotateCw, Route, Sun } from 'lucide-react';
import type { SiteCover } from '../../lib/siteFarmsMap';
import type { SiteWeather } from '../../lib/weather';
import { NET, SITE_NAMES, SITE_PLANS } from '../../lib/stationNetwork';
import { DEFAULT_ETA_MIN, TRACK, buildRoute, buildTrack, distAtTime, planTrip, poseAt, queuedPlan, timeTrack, tripAt, type Track, type TripPhase, type TripPlan } from '../../lib/tankerTrack';
import { MapWeather } from './MapWeather';
import type { MapTrip } from './SiteFarmsMap';
import type { StationsScene, TruckState } from './stationsScene';
import './siteFarmsMap.css';
import './taqaStationsMap.css';

/**
 * خريطة مركز التوزيع (الطاقة): مشهد ثلاثي الأبعاد بتخطيط المحطات الست والشوارع كما في الصورة المرجعية.
 * لكل طلب موافَق عليه قافلة بعدد صهاريجه: كل صهريج يخرج من نقطة التفريغ في محطة الانطلاق، ويسير على الشوارع
 * (المسار الأيمن) بسرعة أعلى في المستقيم وأقل في المنعطفات، ويدخل ساحة الوجهة ويقف عند نقطة التفريغ ويفرغ،
 * والصهاريج التالية تنتظر دورها. الموقع تقديري بالوقت الحقيقي من وقت الموافقة ومدة الوصول (لا توجد بيانات GPS)،
 * و«عرض الرحلة» يعيدها كاملة بسرعة القيادة. الكاميرا: سحب وتكبير وتدوير وتتبّع.
 */

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const STATUS_COLOR = { crit: '#ff2d55', warn: '#facc15', ok: '#10b981', idle: '#94a3b8' } as const;
type Status = keyof typeof STATUS_COLOR;

/** إزاحة المسار الأيمن عن خط وسط الشارع، والمسافة بين صهاريج القافلة في طابور التفريغ (وحدات أرض) */
const LANE = 1.6, QUEUE_GAP = 11;
/** مسافة الأمان بين صهريج والذي أمامه في القافلة (وحدات أرض، الصهريج 8.4) */
const FOLLOW_GAP = 11.5;
/** عرض الرحلة: فاصل الانطلاق بين صهاريج القافلة ومدة التفريغ (ثوانٍ) */
const REPLAY_GAP = 3, REPLAY_UNLOAD = 6;
const SITES = SITE_NAMES;

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
  /** العرض: ثلاثي الأبعاد (منظور مائل) أو ثنائي الأبعاد (من الأعلى) */
  const [view3d, setView3d] = useState(true);
  const hour = new Date().getHours();
  const night = pick ? pick === 'night' : weather ? !weather.isDay : hour < 6 || hour >= 18;

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

  const viewportRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const sceneRef = useRef<StationsScene | null>(null);
  const compassRef = useRef<HTMLSpanElement>(null);
  const [glFailed, setGlFailed] = useState(false);
  const follow = useRef<string | null>(null);
  const [following, setFollowing] = useState<string | null>(null);
  const [touchHint, setTouchHint] = useState(true);
  const stopFollowing = () => { follow.current = null; setFollowing(null); };

  // ---- القوافل: صهريج لكل وحدة من عدد صهاريج الطلب، بمسار وجدول زمني ----
  const rigs = useRef(new Map<string, Rig>());
  const firstSeen = useRef(new Map<string, number>());
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [panel, setPanel] = useState<Info | null>(null);
  const [replay, setReplay] = useState<number | null>(null);
  const replayRef = useRef<number | null>(null);
  const nightRef = useRef(night); nightRef.current = night;
  const [rigsVer, setRigsVer] = useState(0);
  /** جهة نقطة التفريغ لكل محطة (خرطوم الصهريج نحوها) */
  const fillSide = useMemo(() => new Map(SITES.map(s => [s, SITE_PLANS[s].hoseSide] as const)), []);

  const tripKey = trips.map(x => `${x.id}:${x.from}:${x.to}:${x.qty}:${x.tankers ?? 1}:${x.etaMin ?? ''}:${x.since ?? ''}`).join('|');
  useEffect(() => {
    const next = new Map<string, Rig>();
    const fromCount = new Map<string, number>();
    trips.forEach(trip => {
      const route = buildRoute(NET, trip.from, trip.to, 1);
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
    sceneRef.current?.sync([...next.keys()]);
    setSelected(s => (s && next.has(s) ? s : next.keys().next().value ?? null));
    setRigsVer(v => v + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { replayRef.current = replay; }, [replay]);
  useEffect(() => { sceneRef.current?.setNight(night); }, [night]);

  /** جدول الصهريج: الحقيقي (الموافقة + مدة الوصول) أو عرض الرحلة (بزمن القيادة الفعلي على المسار) */
  const planOf = (r: Rig, replayAt: number | null): TripPlan => replayAt != null
    ? queuedPlan(replayAt + (r.order - r.k) * REPLAY_GAP * 1000, REPLAY_GAP * 1000, r.T * 1000, REPLAY_UNLOAD * 1000, r.k)
    : planTrip(r.approved, r.eta, r.qty, r.k);
  const nowOf = (replayAt: number | null) => (replayAt != null ? performance.now() : Date.now());

  // المشهد مرة واحدة + حلقة الرسم + التحكم بالمؤشر واللمس والعجلة
  useEffect(() => {
    const vp = viewportRef.current, gl = glRef.current, tags = tagsRef.current;
    if (!vp || !gl || !tags) return;
    let scene: StationsScene | null = null;
    let disposed = false;
    const size = { w: 1, h: 1 };
    import('./stationsScene').then(({ StationsScene: S }) => {
      if (disposed) return;
      try {
        scene = new S(gl);
        scene.resize(size.w, size.h);
        scene.cam = { ...scene.home };
        scene.setNight(nightRef.current);
        scene.sync([...rigs.current.keys()]);
        sceneRef.current = scene;
      } catch { scene = null; setGlFailed(true); }
    }).catch(() => setGlFailed(true));

    const measure = () => {
      const r = vp.getBoundingClientRect();
      size.w = r.width; size.h = r.height;
      if (scene) {
        const wasHome = !scene.isZoomed();
        scene.resize(r.width, r.height);
        if (wasHome) scene.cam = { ...scene.home };
      }
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(vp);

    // علامة الصهريج (HTML): للصهريج المحدد دائمًا، وللبقية عند الاقتراب
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
    /** آخر رسم فعلي: عند السكون يُرسم المشهد نحو 8 مرات في الثانية فقط (الصهاريج المباشرة بطيئة) */
    let lastDraw = 0, pendingDt = 0;
    const IDLE_MS = 120;
    const states = new Map<string, TruckState>();
    const frame = (nowPerf: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (nowPerf - last) / 1000) : 0;
      last = nowPerf;
      const replayAt = replayRef.current;
      const now = nowOf(replayAt);

      // موضع كل صهريج من جدوله
      const moments = new Map<string, ReturnType<typeof tripAt>>();
      let allDone = true;
      rigs.current.forEach((r, id) => {
        const m = tripAt(planOf(r, replayAt), now);
        moments.set(id, m);
        if (m.phase !== 'unloaded') allDone = false;
      });
      if (replayAt != null && allDone && now - replayAt > 2000) { replayRef.current = null; setReplay(null); }

      states.clear();
      const closeUp = scene ? scene.cam.dist < scene.home.dist * 0.6 : false;
      const lead = new Map<string, number>();
      rigs.current.forEach((r, id) => {
        const m = moments.get(id)!;
        const tag = tagFor(id);
        // لم ينطلق بعد، أو أنهى التفريغ وأخلى نقطة التفريغ لمن بعده (يبقى آخر صهريج في القافلة)
        if (m.phase === 'waiting' || (m.phase === 'unloaded' && r.k < r.n - 1)) { r.last = null; tag.hidden = true; return; }
        // مكانه في طابور التفريغ: عدد من سبقه من قافلته وما زال عند المحطة
        let ahead = 0;
        for (let j = 0; j < r.k; j++) {
          const pj = moments.get(r.n > 1 ? `${r.trip.id}#${j}` : r.trip.id)?.phase;
          if (pj === 'queued' || pj === 'unloading') ahead++;
        }
        const tr = r.track, L = tr.length;
        const spot = Math.max(L * 0.45, L - ahead * QUEUE_GAP);
        let dist: number;
        if (m.phase === 'driving') dist = Math.min(spot, distAtTime(tr, r.tc, m.drive * r.T));
        // يتقدم بهدوء إلى مكانه (عند خلوّ نقطة التفريغ) بدل القفز
        else dist = r.last && r.last.dist < spot ? Math.min(spot, r.last.dist + TRACK.vyard * dt) : spot;
        // مسافة أمان خلف الصهريج الذي أمامه في القافلة (تنطلق بفارق 3 ثوانٍ فلا تتراكب)
        const front = lead.get(r.trip.id);
        if (front != null) dist = Math.max(0, Math.min(dist, front - FOLLOW_GAP));
        lead.set(r.trip.id, dist);
        const atFill = dist >= L - 0.05;
        const p = poseAt(tr, dist, LANE);
        const prev = r.last;
        const moved = prev && dist >= prev.dist ? dist - prev.dist : 0;
        const speed = prev && dt ? moved / dt : 0;
        r.last = { dist, t: now };
        const driving = (m.phase === 'driving' || moved > 1e-4) && dist < L - 0.05;
        // الفرامل: الملف يتباطأ أمامه (منعطف، ساحة، وصول) — والإشارة: انعطاف حاد قادم
        const vNow = poseAt(tr, dist).speed, vAhead = poseAt(tr, Math.min(L, dist + 3)).speed;
        const brake = !driving || vAhead < vNow * 0.82;
        const hAhead = poseAt(tr, Math.min(L, dist + 5)).heading;
        let dh = hAhead - p.heading; if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI;
        const rel = Math.min(1, speed / TRACK.vmax);
        states.set(id, {
          x: p.x, y: p.y, heading: p.heading, travel: moved, yard: p.yard,
          brake, signal: driving && Math.abs(dh) > 0.5 ? (dh > 0 ? 1 : -1) : 0,
          unloading: m.phase === 'unloading' && atFill, hoseSide: fillSide.get(r.trip.to) ?? 1,
          roll: driving ? Math.max(-0.06, Math.min(0.06, -dh * 0.05 * rel)) : 0,
          pitch: driving ? (brake ? 0.02 * rel : vAhead > vNow * 1.1 ? -0.015 * rel : 0) : 0,
          dust: driving && !p.yard ? rel * (nightRef.current ? 0.6 : 1) : 0,
        });
        // علامة فوق الصهريج
        const show = id === selectedRef.current || closeUp;
        const sp = show && scene ? scene.project(scene.worldOf(p.x, p.y, 40)) : null;
        tag.hidden = !sp;
        if (sp) {
          tag.style.transform = `translate(${sp[0].toFixed(1)}px, ${sp[1].toFixed(1)}px) translate(-50%, -100%)`;
          tag.classList.toggle('on', id === selectedRef.current);
          const phase = m.phase === 'unloading' && !atFill ? 'queued' : m.phase;
          tag.dataset.phase = phase;
          setText(tag, phase === 'queued' ? M('tagQueued')
            : phase === 'unloading' ? M('tagUnloading', { n: Math.round(m.unload * 100) })
            : phase === 'unloaded' ? M('tagUnloaded')
            : replayAt != null ? `${fmt(r.qty)} ${liter}` : `${fmt(r.qty)} ${liter} · ${M('minLeft', { n: Math.ceil(m.msLeft / 60000) })}`);
        }
      });
      tagEls.forEach((el, id) => { if (!rigs.current.has(id)) { el.remove(); tagEls.delete(id); } });

      if (scene) {
        // تتبّع الصهريج: الكاميرا تلحق به بنعومة
        const fid = follow.current, fs = fid ? states.get(fid) : null;
        if (fs) {
          const v = scene.worldOf(fs.x, fs.y);
          scene.setGoal({ tx: v.x, tz: v.z, dist: Math.min(scene.goal?.dist ?? scene.cam.dist, 520) });
        }
        // رسم كامل أثناء حركة الكاميرا أو السحب أو عرض الرحلة، وإلا بمعدل منخفض (توفير المعالج والبطارية)
        pendingDt += dt;
        const busy = replayRef.current != null || !!scene.goal || (mouse != null && dragged) || touch != null;
        if (busy || nowPerf - lastDraw >= IDLE_MS) {
          scene.render(states, Math.min(0.25, pendingDt));
          lastDraw = nowPerf; pendingDt = 0;
          // البوصلة تدور مع اتجاه الكاميرا (السهم يشير إلى الشمال)
          if (compassRef.current) compassRef.current.style.transform = `rotate(${(-scene.cam.az * 180) / Math.PI}deg)`;
        }
        // بطاقات المحطات أمام ساحاتها
        cardRefs.current.forEach((el, name) => {
          const a = scene!.anchors.get(name);
          // عند الاقتراب تختفي (البطاقات للنظرة العامة، والأسماء على المظلات)
          const sp = a && !closeUp ? scene!.project(a) : null;
          el.hidden = !sp;
          if (sp) el.style.transform = `translate(${sp[0].toFixed(1)}px, ${sp[1].toFixed(1)}px) translate(-50%, 0)`;
        });
      }
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

    const isUi = (el: EventTarget | null) => el instanceof Element && !!el.closest('.sf-tq-ui, .sf-map-panel, .sf-map-fuel, .sf-map-wx, .sf-tq-tag, .sf-tq-card');
    const stopFollow = () => { if (follow.current) { follow.current = null; setFollowing(null); } if (scene) scene.goal = null; };
    const local = (e: { clientX: number; clientY: number }) => { const r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    let dragged = false;

    // ---- الماوس: سحب لتحريك الخريطة، وبالزر الأيمن (أو Shift) للتدوير، والعجلة للتكبير ----
    let mouse: { x: number; y: number; sx: number; sy: number; rot: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || isUi(e.target) || (e.button !== 0 && e.button !== 2)) return;
      const p = local(e); mouse = { ...p, sx: p.x, sy: p.y, rot: e.button === 2 || e.shiftKey }; dragged = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!mouse || e.pointerType === 'touch' || !scene) return;
      const p = local(e);
      if (!dragged && Math.hypot(p.x - mouse.sx, p.y - mouse.sy) > 4) {
        dragged = true; stopFollow();
        try { vp.setPointerCapture(e.pointerId); } catch { /* المؤشر انتهى */ }
        vp.classList.add('dragging');
      }
      if (dragged) {
        // السحب يتبع المؤشر مباشرة (بلا تأخير)
        if (mouse.rot) scene.rotate((p.x - mouse.x) * 0.006, (p.y - mouse.y) * 0.004, true);
        else scene.pan(p.x - mouse.x, p.y - mouse.y, true);
      }
      mouse.x = p.x; mouse.y = p.y;
    };
    const onUp = () => { mouse = null; vp.classList.remove('dragging'); };
    const onContext = (e: MouseEvent) => { if (!isUi(e.target)) e.preventDefault(); };
    const onWheel = (e: WheelEvent) => {
      if (isUi(e.target) || !scene) return;
      // عند أبعد مسافة وتمرير للأسفل: تتمرر الصفحة عاديًا
      if (e.deltaY > 0 && scene.cam.dist >= scene.maxDist - 0.5) return;
      e.preventDefault(); stopFollow();
      const p = local(e);
      scene.zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)), p.x, p.y);
    };
    // ضغط بلا سحب: يفتح المحطة تحت المؤشر
    const onClick = (e: MouseEvent) => {
      if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; return; }
      if (isUi(e.target) || !scene) return;
      const p = local(e);
      const hit = scene.pick(p.x, p.y);
      if (hit && hit !== site) onOpen(hit);
    };

    // ---- اللمس: إصبع واحد يمرر الصفحة (إلا عند الاقتراب فيحرك الخريطة)، وإصبعان للتكبير والتحريك والتدوير ----
    let touch: { mode: 'pan' | 'pinch'; x: number; y: number; d: number; a: number; sx: number; sy: number } | null = null;
    const two = (e: TouchEvent) => {
      const a = local(e.touches[0]), b = local(e.touches[1]);
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x) };
    };
    const onTouchStart = (e: TouchEvent) => {
      if (isUi(e.target) || !scene) return;
      if (e.touches.length >= 2) {
        e.preventDefault();
        const g = two(e); touch = { mode: 'pinch', ...g, sx: g.x, sy: g.y }; dragged = true; stopFollow(); setTouchHint(false);
      } else if (e.touches.length === 1 && scene.isZoomed()) {
        const p = local(e.touches[0]); touch = { mode: 'pan', ...p, d: 0, a: 0, sx: p.x, sy: p.y }; dragged = false;
      } else touch = null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touch || !scene) return;
      if (touch.mode === 'pinch' && e.touches.length >= 2) {
        e.preventDefault();
        const g = two(e);
        // الإصبعان: تكبير فوري بنسبة تغير المسافة بينهما، وتحريك بمنتصفهما، وتدوير بزاوية الخط بينهما
        scene.pan(g.x - touch.x, g.y - touch.y, true);
        scene.zoomAt(g.d / Math.max(1, touch.d), g.x, g.y, true);
        let da = g.a - touch.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
        if (Math.abs(da) > 0.002) scene.rotate(-da, 0, true);
        Object.assign(touch, g);
      } else if (touch.mode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        const p = local(e.touches[0]);
        if (!dragged && Math.hypot(p.x - touch.sx, p.y - touch.sy) > 6) { dragged = true; stopFollow(); }
        scene.pan(p.x - touch.x, p.y - touch.y, true);
        touch.x = p.x; touch.y = p.y;
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) touch = null;
      else if (e.touches.length === 1 && scene?.isZoomed()) { const p = local(e.touches[0]); touch = { mode: 'pan', ...p, d: 0, a: 0, sx: p.x, sy: p.y }; }
      else touch = null;
    };

    vp.addEventListener('pointerdown', onDown);
    vp.addEventListener('pointermove', onMove);
    vp.addEventListener('pointerup', onUp);
    vp.addEventListener('pointercancel', onUp);
    vp.addEventListener('contextmenu', onContext);
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('touchstart', onTouchStart, { passive: false });
    vp.addEventListener('touchmove', onTouchMove, { passive: false });
    vp.addEventListener('touchend', onTouchEnd);
    vp.addEventListener('touchcancel', onTouchEnd);
    vp.addEventListener('click', onClick, true);

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
      vp.removeEventListener('contextmenu', onContext);
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('touchstart', onTouchStart);
      vp.removeEventListener('touchmove', onTouchMove);
      vp.removeEventListener('touchend', onTouchEnd);
      vp.removeEventListener('touchcancel', onTouchEnd);
      vp.removeEventListener('click', onClick, true);
      tagEls.forEach(el => el.remove());
      scene?.dispose();
      sceneRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const all = useMemo(() => [...rigs.current.values()],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rigsVer]);
  const sel = selected ? rigs.current.get(selected) ?? null : null;
  const cam = (fn: (s: StationsScene) => void) => { const s = sceneRef.current; if (s) { stopFollowing(); fn(s); } };
  /** زر بضغط مستمر: ينفّذ الحركة فورًا ثم يكررها ما دام مضغوطًا (الكاميرا تنزلق بينها بنعومة) */
  const holdTimer = useRef<number | null>(null);
  const holdStop = () => { if (holdTimer.current != null) { window.clearInterval(holdTimer.current); holdTimer.current = null; } };
  useEffect(() => holdStop, []);
  const hold = (fn: (s: StationsScene) => void) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); holdStop(); cam(fn); holdTimer.current = window.setInterval(() => cam(fn), 70); },
    onPointerUp: holdStop, onPointerLeave: holdStop, onPointerCancel: holdStop,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cam(fn); } },
  });
  const fitRoute = () => { if (sel) cam(s => s.fitPoints(sel.track.x, sel.track.y)); };
  const toggleFollow = () => {
    if (!selected) return;
    const on = follow.current !== selected;
    follow.current = on ? selected : null;
    setFollowing(on ? selected : null);
    if (!on && sceneRef.current) sceneRef.current.goal = null;
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
      <div ref={viewportRef} className={`sf-map sf-tq${night ? ' night' : ''}`} role="group" aria-label={M('stationsAria')}>
        <div ref={glRef} className="sf-tq-gl" aria-hidden="true" />
        {glFailed && <div className="sf-tq-nogl">{M('noGl')}</div>}
        {/* بطاقات المحطات أمام ساحاتها: الرصيد وأيام التغطية */}
        <div className="sf-tq-cards">
          {SITES.map(name => {
            const v = info.get(name);
            const st: Status = v?.status ?? 'idle';
            const self = name === site;
            return (
              <button key={name} ref={el => { if (el) cardRefs.current.set(name, el); else cardRefs.current.delete(name); }}
                type="button" className={`sf-tq-card ${st}${self ? ' self' : ''}`} dir="rtl" hidden
                style={{ '--st': STATUS_COLOR[st] } as React.CSSProperties}
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
            <div className="sf-tq-mode" role="group" aria-label={M('viewMode')}>
              <button type="button" className={view3d ? 'on' : ''} aria-pressed={view3d} onClick={() => { setView3d(true); sceneRef.current?.setMode('3d'); }}>3D</button>
              <button type="button" className={!view3d ? 'on' : ''} aria-pressed={!view3d} onClick={() => { setView3d(false); sceneRef.current?.setMode('2d'); }}>2D</button>
            </div>
            <button type="button" onClick={() => cam(s => s.zoomAt(1.4))} aria-label={M('zoomIn')} title={M('zoomIn')}><Plus className="w-4 h-4" /></button>
            <button type="button" onClick={() => cam(s => s.zoomAt(1 / 1.4))} aria-label={M('zoomOut')} title={M('zoomOut')}><Minus className="w-4 h-4" /></button>
            <button type="button" onClick={() => cam(s => s.reset())} aria-label={M('reset')} title={M('reset')}><Maximize2 className="w-4 h-4" /></button>
            {/* لوحة التنقل: تحريك الخريطة في الاتجاهات الأربعة (بالضغط المستمر)، وتدوير، وبوصلة تعيد الشمال */}
            <div className="sf-tq-nav" role="group" aria-label={M('navigate')}>
              <button type="button" {...hold(s => s.rotate(0.06))} aria-label={M('rotateLeft')} title={M('rotateLeft')}><RotateCcw className="w-3.5 h-3.5" /></button>
              <button type="button" {...hold(s => s.pan(0, s.viewH * 0.06))} aria-label={M('moveUp')} title={M('moveUp')}><ChevronUp className="w-4 h-4" /></button>
              <button type="button" {...hold(s => s.rotate(-0.06))} aria-label={M('rotateRight')} title={M('rotateRight')}><RotateCw className="w-3.5 h-3.5" /></button>
              <button type="button" {...hold(s => s.pan(s.viewH * 0.06, 0))} aria-label={M('moveLeft')} title={M('moveLeft')}><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" className="compass" onClick={() => cam(s => s.setGoal({ az: 0 }))} aria-label={M('north')} title={M('north')}><span ref={compassRef}><Navigation2 className="w-4 h-4" /></span></button>
              <button type="button" {...hold(s => s.pan(-s.viewH * 0.06, 0))} aria-label={M('moveRight')} title={M('moveRight')}><ChevronRight className="w-4 h-4" /></button>
              <span />
              <button type="button" {...hold(s => s.pan(0, -s.viewH * 0.06))} aria-label={M('moveDown')} title={M('moveDown')}><ChevronDown className="w-4 h-4" /></button>
              <span />
            </div>
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
