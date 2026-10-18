import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import type { SiteCover } from '../../lib/siteFarmsMap';
import type { SiteWeather } from '../../lib/weather';
import { MapWeather } from './MapWeather';
import type { MapTrip } from './SiteFarmsMap';
import './siteFarmsMap.css';
import './taqaStationsMap.css';

/**
 * خريطة مركز التوزيع (الطاقة): صورة المحطات الست في الصحراء (نهارًا وليلًا) والشوارع بينها،
 * وفوقها حالة كل موقع (الرصيد وأيام التغطية) وصهاريج الطلبات الجارية تسير على الشوارع من الموقع المُرسِل إلى المستلم.
 * الضغط على محطة يفتح صفحة موقعها.
 */

/** نقطة بالنسبة المئوية من عرض الصورة وارتفاعها */
type P = [number, number];
interface Art {
  src: string;
  w: number;
  h: number;
  /** pad = وسط ساحة المحطة ونصفا قطرها، card = مكان بطاقة الحالة (أعلى منتصفها) */
  sites: Record<string, { pad: P; rx: number; ry: number; card: P }>;
  /** الشوارع: من عقدة إلى عقدة (موقع أو تقاطع J1/J2) عبر نقاط الرسم */
  roads: { a: string; b: string; pts: P[] }[];
}

const DAY: Art = {
  src: '/site-map/stations-day.webp', w: 1500, h: 1152,
  sites: {
    الاجداد: { pad: [21, 13], rx: 12, ry: 4.5, card: [13, 20] },
    'امهات البياض': { pad: [69, 19], rx: 14, ry: 5, card: [71, 27] },
    البوادي: { pad: [19, 36], rx: 14, ry: 5.5, card: [13, 45] },
    التسمين: { pad: [85, 45], rx: 14, ry: 5.5, card: [80, 55] },
    البياض: { pad: [35, 63], rx: 15, ry: 6, card: [23, 72] },
    الطاقة: { pad: [79, 82], rx: 14, ry: 6.5, card: [56, 85] },
  },
  roads: [
    { a: 'الاجداد', b: 'J1', pts: [[21, 13], [22, 16], [24, 19], [27, 23], [29, 27], [31, 30]] },
    { a: 'J1', b: 'امهات البياض', pts: [[31, 30], [37, 27], [45, 23], [52, 20], [56, 19], [69, 19]] },
    { a: 'J1', b: 'J2', pts: [[31, 30], [32, 33], [33, 35]] },
    { a: 'J2', b: 'البوادي', pts: [[33, 35], [26, 36], [19, 36]] },
    { a: 'J2', b: 'التسمين', pts: [[33, 35], [40, 36], [50, 38], [60, 40], [68, 42], [73, 44], [85, 45]] },
    { a: 'البوادي', b: 'البياض', pts: [[19, 36], [26, 41], [30, 42], [33, 45], [35, 48], [34, 53], [32, 57], [35, 63]] },
    { a: 'البياض', b: 'الطاقة', pts: [[35, 63], [41, 68], [48, 71], [56, 75], [63, 79], [68, 82], [79, 82]] },
    { a: 'الطاقة', b: 'التسمين', pts: [[79, 82], [91, 85], [95, 79], [97, 68], [96, 60], [92, 53], [85, 45]] },
  ],
};

const NIGHT: Art = {
  src: '/site-map/stations-night.webp', w: 1600, h: 1211,
  sites: {
    الاجداد: { pad: [19, 12], rx: 12, ry: 4.5, card: [13, 20] },
    'امهات البياض': { pad: [68, 19], rx: 14, ry: 5, card: [70, 27] },
    البوادي: { pad: [18, 37], rx: 14, ry: 5, card: [13, 46] },
    التسمين: { pad: [83, 45], rx: 14, ry: 5, card: [79, 55] },
    البياض: { pad: [35, 63], rx: 15, ry: 6, card: [22, 72] },
    الطاقة: { pad: [79, 83], rx: 14, ry: 6, card: [55, 86] },
  },
  roads: [
    { a: 'الاجداد', b: 'J1', pts: [[19, 12], [22, 16], [25, 20], [27, 24], [29, 28], [30, 30]] },
    { a: 'J1', b: 'امهات البياض', pts: [[30, 30], [37, 27], [45, 23], [54, 20], [68, 19]] },
    { a: 'J1', b: 'J2', pts: [[30, 30], [31, 33], [32, 35]] },
    { a: 'J2', b: 'البوادي', pts: [[32, 35], [26, 36], [18, 37]] },
    { a: 'J2', b: 'التسمين', pts: [[32, 35], [40, 37], [50, 39], [60, 41], [68, 43], [71, 44], [83, 45]] },
    { a: 'البوادي', b: 'البياض', pts: [[18, 37], [25, 41], [29, 41], [31, 45], [34, 49], [34, 53], [31, 57], [35, 63]] },
    { a: 'البياض', b: 'الطاقة', pts: [[35, 63], [43, 68], [48, 70], [55, 74], [60, 78], [64, 81], [79, 83]] },
    { a: 'الطاقة', b: 'التسمين', pts: [[79, 83], [88, 88], [93, 84], [97, 72], [97, 63], [93, 54], [83, 45]] },
  ],
};

const dist = (a: P, b: P) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const polyLen = (pts: P[]) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);

/** أقصر طريق على الشوارع بين موقعين (نقاط الرسم متصلة) */
export const routeBetween = (roads: Art['roads'], from: string, to: string): P[] | null => {
  const adj = new Map<string, { n: string; pts: P[] }[]>();
  const add = (a: string, b: string, pts: P[]) => { if (!adj.has(a)) adj.set(a, []); adj.get(a)!.push({ n: b, pts }); };
  roads.forEach(r => { add(r.a, r.b, r.pts); add(r.b, r.a, [...r.pts].reverse()); });
  if (!adj.has(from) || !adj.has(to) || from === to) return null;
  const best = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { n: string; pts: P[] }>();
  const open = new Set([from]);
  while (open.size) {
    const cur = [...open].reduce((a, b) => (best.get(a)! <= best.get(b)! ? a : b));
    open.delete(cur);
    if (cur === to) break;
    for (const e of adj.get(cur) ?? []) {
      const d = best.get(cur)! + polyLen(e.pts);
      if (d < (best.get(e.n) ?? Infinity)) { best.set(e.n, d); prev.set(e.n, { n: cur, pts: e.pts }); open.add(e.n); }
    }
  }
  if (!prev.has(to)) return null;
  const legs: P[][] = [];
  for (let n = to; n !== from; n = prev.get(n)!.n) legs.unshift(prev.get(n)!.pts);
  return legs.reduce<P[]>((all, leg) => [...all, ...(all.length ? leg.slice(1) : leg)], []);
};

/** منحنى ناعم (Catmull-Rom) عبر النقاط بوحدات المخطط */
const smoothPath = (pts: [number, number][]) => {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const STATUS_COLOR = { crit: '#ff2d55', warn: '#facc15', ok: '#10b981', idle: '#94a3b8' } as const;
type Status = keyof typeof STATUS_COLOR;

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
  // نهار/ليل: من الطقس (أو الساعة) ما لم يختر المستخدم
  const [pick, setPick] = useState<'day' | 'night' | null>(null);
  const hour = new Date().getHours();
  const night = pick ? pick === 'night' : weather ? !weather.isDay : hour < 6 || hour >= 18;
  const art = night ? NIGHT : DAY;
  const H = (100 * art.h) / art.w;
  const toVb = (p: P): [number, number] => [p[0], (p[1] * H) / 100];

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

  const routes = useMemo(() => trips.map(trip => {
    const pts = routeBetween(art.roads, trip.from, trip.to);
    if (!pts) return null;
    const vb = pts.map(p => [p[0], (p[1] * H) / 100] as [number, number]);
    const len = vb.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - vb[i - 1][0], p[1] - vb[i - 1][1]) : 0), 0);
    return { trip, d: smoothPath(vb), dur: Math.max(8, len / 5.5) };
  }).filter(Boolean) as { trip: MapTrip; d: string; dur: number }[], [trips, art, H]);

  return (
    <div className={`sf-map sf-tq${night ? ' night' : ''}`} style={{ aspectRatio: `${art.w} / ${art.h}` }} role="group" aria-label={M('stationsAria')}>
      <img className="sf-tq-img" src={art.src} alt="" draggable={false} />
      <svg className="sf-tq-svg" viewBox={`0 0 100 ${H.toFixed(2)}`} aria-hidden="true">
        <defs>
          <filter id="sf-tq-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".5" /></filter>
        </defs>
        {/* حلقة حالة كل محطة (وتفتحها بالضغط) */}
        {Object.entries(art.sites).map(([name, s]) => {
          const st = info.get(name)?.status ?? 'idle';
          const [cx, cy] = toVb(s.pad);
          const self = name === site;
          return (
            <ellipse key={name} className={`sf-tq-pad ${st}${self ? ' self' : ''}`} cx={cx} cy={cy} rx={s.rx} ry={(s.ry * H) / 100}
              style={{ '--st': STATUS_COLOR[st] } as React.CSSProperties} onClick={() => { if (!self) onOpen(name); }}>
              <title>{self ? `${name} · ${M('center')}` : M('openSite', { site: name })}</title>
            </ellipse>
          );
        })}
        {/* طريق كل صهريج جارٍ، والصهريج يسير عليه وفوقه الكمية */}
        {routes.map(({ trip, d, dur }) => {
          const pid = `sf-tq-r-${trip.id}`;
          return (
            <g key={trip.id}>
              <path id={pid} d={d} className="sf-tq-route-glow" filter="url(#sf-tq-glow)" />
              <path d={d} className="sf-tq-route" />
              <g className="sf-tq-truck">
                <animateMotion dur={`${dur}s`} repeatCount="indefinite" rotate="auto"><mpath href={`#${pid}`} /></animateMotion>
                <g transform="scale(1.6)">
                  <ellipse cx="0" cy=".25" rx="2" ry=".9" fill="rgba(0,0,0,.35)" />
                  <rect x="-1.9" y="-.62" width="2.55" height="1.24" rx=".6" className="tank" />
                  <rect x="-1.9" y="-.62" width="2.55" height=".4" rx=".2" fill="rgba(255,255,255,.55)" />
                  <rect x=".75" y="-.56" width=".95" height="1.12" rx=".22" className="cab" />
                  <rect x="1.38" y="-.46" width=".26" height=".92" rx=".08" fill="#0f172a" opacity=".75" />
                  {night && <path d="M1.7,-.4 L4.6,-1.3 L4.6,1.3 L1.7,.4 Z" className="beam" />}
                </g>
              </g>
              <g className="sf-tq-tag">
                <animateMotion dur={`${dur}s`} repeatCount="indefinite"><mpath href={`#${pid}`} /></animateMotion>
                <g transform="translate(0,-3.6) scale(.82)">
                  <rect x="-7.5" y="-1.55" width="15" height="3.5" rx=".9" />
                  <text y=".1" textAnchor="middle" className="q">{fmt(trip.qty)} {t('finance:siteFarms.liter')}</text>
                  <text y="1.45" textAnchor="middle" className="s">{trip.text}</text>
                </g>
              </g>
            </g>
          );
        })}
      </svg>

      {/* بطاقات المواقع: الرصيد وأيام التغطية */}
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
            <div className="sf-tq-dn">
              <button type="button" className={!night ? 'on' : ''} onClick={() => setPick('day')} aria-pressed={!night} title={M('dayView')} aria-label={M('dayView')}><Sun className="w-4 h-4" /></button>
              <button type="button" className={night ? 'on' : ''} onClick={() => setPick('night')} aria-pressed={night} title={M('nightView')} aria-label={M('nightView')}><Moon className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
        <div className="sf-map-foot">
          <div className="sf-map-legend">
            <span><i style={{ background: STATUS_COLOR.crit }} />{M('siteCrit')}</span>
            <span><i style={{ background: STATUS_COLOR.warn }} />{M('siteWarn')}</span>
            <span><i style={{ background: STATUS_COLOR.ok }} />{M('siteOk')}</span>
            <span><i style={{ background: '#fbbf24', height: 2, width: 14 }} />{M('fuelLine')}</span>
          </div>
          <div className="sf-map-btns">{fuelPanel}</div>
        </div>
      </div>
    </div>
  );
};

export default TaqaStationsMap;
