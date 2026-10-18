import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, FileSpreadsheet, Sprout, Upload } from 'lucide-react';
import { usePermissions } from '../../lib/usePermission';
import {
  FARM_SITES, annualFor, annualYears, farmsDates, farmsOn, importAnnual, importFarmsDay, lastDayUse, useSiteFarms,
  type AnnualRecord, type SiteFarmsRecord
} from '../../lib/siteFarms';
import { readAnnualFarmsFile, readDailyFarmsFile } from '../../lib/siteFarmsFile';
import { siteCover } from '../../lib/siteFarmsMap';
import { saveSiteAnnualFile } from '../../lib/saharaFiles';
import { useSiteWeather } from '../../lib/weather';
import SiteFarmsField from './SiteFarmsField';
import { FarmUsageModal, SiteFarmsUsageView } from './SiteFarmsUsage';
import './siteFarms.css';
import './siteFarmsMap.css';

// الخريطة ثلاثية الأبعاد تُحمَّل (ومعها three) عند فتح الصفحة فقط
const SiteFarmsMap = lazy(() => import('./SiteFarmsMap'));
const SiteFarmsMonthlyChart = lazy(() => import('./SiteFarmsMonthlyChart'));

const DAYS = 365;
/** عدد الأيام الأعلى استهلاكًا التي تُعلَّم بنقاط حمراء في كل شهر (لكل المواقع) */
const HIGH_DAYS_PER_MONTH = 3;
/** مواقع يعتمد مصروفها على الآليات بدل المزارع */
const VEHICLE_SITES = ['الطاقة'];
const TAU = Math.PI * 2;
const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

type Metric = 'all' | 'f' | 'g';
interface YearData { f: number[]; g: number[] }

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}k`);
const dayTotal = (d: YearData, i: number) => (d.f[i] || 0) + (d.g[i] || 0);
/** شهر (0–11) ويوم الشهر لفهرس يوم في السنة */
const dateOfIndex = (year: number, i: number) => {
  const d = new Date(Date.UTC(year, 0, 1 + i));
  return { month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay() };
};
const sumRange = (d: YearData, idx: number[], k: 'f' | 'g') => idx.reduce((s, i) => s + (d[k][i] || 0), 0);

/** عدّاد يتحرك من القيمة السابقة إلى الجديدة (0.7 ثانية) عند تغيير السنة أو الموقع */
const lastShown = new Map<string, number>();
const useCountUp = (value: number, id: string) => {
  // البداية من آخر قيمة ظهرت لنفس الرقم، حتى لو أُعيد إنشاء العنصر مع حركة الظهور
  const [shown, setShown] = useState(() => lastShown.get(id) ?? value);
  const from = useRef(lastShown.get(id) ?? value);
  useEffect(() => {
    lastShown.set(id, value);
    const start = from.current;
    if (start === value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min((t - t0) / 700, 1);
      const v = start + (value - start) * (1 - Math.pow(1 - p, 3));
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, id]);
  return shown;
};
const Num: React.FC<{ v: number; id: string }> = ({ v, id }) => <>{fmt(useCountUp(v, id))}</>;

// ───────────────────────── الساعة الدائرية ─────────────────────────
interface DialProps {
  year: number;
  cur: YearData;
  prev: YearData | null;
  max: number;
  /** الفترة المختارة [من شهر، إلى شهر] (0–11) */
  range: [number, number];
  /** أيام الارتفاع المفاجئ (نقاط حمراء نابضة) */
  spikes: number[];
  hover: number;
  /** آخر يوم مُرِّر عليه: التلميح يبقى عليه أثناء اختفائه */
  tipIndex: number;
  months: string[];
  label: string;
  onHover: (i: number) => void;
  tip: React.ReactNode;
}

const YearDial: React.FC<DialProps> = ({ year, cur, prev, max, range, spikes, hover, tipIndex, months, label, onHover, tip }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  // قيم الرسم تُقرأ داخل حلقة الإطارات من المراجع حتى لا تُعاد إنشاء الحلقة مع كل تغيير
  const live = useRef({ year, cur, prev, max, range, spikes, hover, months });
  useEffect(() => { live.current = { year, cur, prev, max, range, spikes, hover, months }; });

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let hand = Math.max(live.current.cur.f.length - 1, 0);
    let last = performance.now();
    let raf = 0;
    // قيم الأشعة المعروضة تتحرك نحو قيم السنة المختارة: عند فتح الصفحة تنمو من المركز،
    // وعند تغيير السنة أو الموقع تتحول موجةً مع اتجاه الساعة (كل يوم يبدأ بعد الذي قبله بقليل)
    const af = new Float64Array(DAYS + 1), ag = new Float64Array(DAYS + 1);
    let aMax = live.current.max, ghostA = 0;
    let lastPrev = live.current.prev;
    let lastCur = live.current.cur, changedAt = last;

    const draw = (now: number) => {
      const { year: yr, range: [rf, rt], spikes: sp, hover: hv, months: names } = live.current;
      const full = rf === 0 && rt === 11;
      const inRange = (m: number) => m >= rf && m <= rt;
      const P = lastPrev, MAX = aMax;
      const r = canvas.getBoundingClientRect();
      const w = r.width;
      if (!w) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = canvas.width; }
      const css = getComputedStyle(canvas);
      const v = (n: string) => css.getPropertyValue(n).trim();
      const grid = v('--sf-grid'), farm = v('--sf-dial-farm'), gen = v('--sf-gen'), mut = v('--sf-mut'), fg = v('--sf-fg'), panel = v('--sf-panel');
      const cx = w / 2, R = w / 2 - w * 0.075, r0 = R * 0.38, span = R - r0;
      const ang = (i: number) => -Math.PI / 2 + ((i + 0.5) / DAYS) * TAU;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, w);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const p of [0.25, 0.5, 0.75, 1]) {
        ctx.strokeStyle = grid; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
        ctx.setLineDash(p === 1 ? [] : [2, 5]);
        ctx.beginPath(); ctx.arc(cx, cx, r0 + span * p, 0, 7); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.strokeStyle = grid;
      ctx.beginPath(); ctx.arc(cx, cx, r0, 0, 7); ctx.stroke();
      for (let m = 0; m < 12; m++) {
        const a0 = -Math.PI / 2 + (MONTH_START[m] / DAYS) * TAU, a1 = -Math.PI / 2 + (MONTH_START[m + 1] / DAYS) * TAU, am = (a0 + a1) / 2;
        if (m % 2 === 0) {
          ctx.globalAlpha = 0.045; ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(cx, cx, R + 2, a0, a1); ctx.arc(cx, cx, r0, a1, a0, true); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 0.5; ctx.strokeStyle = grid;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * (R + 2), cx + Math.sin(a0) * (R + 2)); ctx.lineTo(cx + Math.cos(a0) * (R + 10), cx + Math.sin(a0) * (R + 10)); ctx.stroke();
        const on = !full && inRange(m);
        ctx.globalAlpha = 1; ctx.fillStyle = on ? fg : mut;
        ctx.font = `${on ? '700' : '400'} ${Math.max(10, w * 0.02)}px ${css.fontFamily}`;
        ctx.fillText(names[m] ?? String(m + 1), cx + Math.cos(am) * (R + w * 0.05), cx + Math.sin(am) * (R + w * 0.05));
      }
      ctx.globalAlpha = 1;
      if (P && ghostA > 0.01) {
        ctx.strokeStyle = mut; ctx.lineWidth = 1.2; ctx.setLineDash([1.5, 2.5]); ctx.beginPath();
        for (let i = 0; i < Math.min(P.f.length, DAYS); i++) {
          const t = Math.min(dayTotal(P, i) / MAX, 1), a = ang(i), rr = r0 + span * t;
          const x = cx + Math.cos(a) * rr, y = cx + Math.sin(a) * rr;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.globalAlpha = ghostA; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      const lw = Math.max(1.5, ((TAU * (r0 + span * 0.55)) / DAYS) * 0.6);
      const hi = hv >= 0 ? hv : hand;
      for (let i = 0; i <= DAYS; i++) {
        if (af[i] + ag[i] < 1) continue;
        const a = ang(i), c = Math.cos(a), s = Math.sin(a);
        const behind = (((hi - i) % DAYS) + DAYS) % DAYS;
        const trail = behind < 46 ? 1 - behind / 46 : 0;
        const dim = !full && !inRange(dateOfIndex(yr, i).month);
        const f = (af[i] / MAX) * span, g = (ag[i] / MAX) * span;
        ctx.globalAlpha = dim ? 0.15 : Math.min(1, 0.5 + trail * 0.5);
        ctx.lineWidth = hv === i ? lw * 2.2 : lw * (1 + trail * 0.5);
        ctx.strokeStyle = farm; ctx.beginPath(); ctx.moveTo(cx + c * r0, cx + s * r0); ctx.lineTo(cx + c * (r0 + f), cx + s * (r0 + f)); ctx.stroke();
        ctx.strokeStyle = gen; ctx.beginPath(); ctx.moveTo(cx + c * (r0 + f), cx + s * (r0 + f)); ctx.lineTo(cx + c * (r0 + f + g), cx + s * (r0 + f + g)); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // نقاط حمراء نابضة فوق أيام الارتفاع المفاجئ (داخل الفترة المختارة)
      const neg = v('--sf-neg');
      const pulse = reduce ? 0.5 : (Math.sin(now / 260) + 1) / 2;
      for (const i of sp) {
        if (!full && !inRange(dateOfIndex(yr, i).month)) continue;
        const tot = af[i] + ag[i];
        if (tot < 1) continue;
        const a = ang(i), rr = r0 + span * Math.min(tot / MAX, 1) + 7;
        const x = cx + Math.cos(a) * rr, y = cx + Math.sin(a) * rr;
        ctx.globalAlpha = 0.18 + pulse * 0.22; ctx.fillStyle = neg;
        ctx.beginPath(); ctx.arc(x, y, 6 + pulse * 3, 0, 7); ctx.fill();
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill();
        ctx.strokeStyle = panel; ctx.lineWidth = 1.2; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const ha = -Math.PI / 2 + ((hi + 0.5) / DAYS) * TAU;
      for (let k = 0; k < 24; k++) {
        const a1 = ha - k * (0.9 / 24), a0 = a1 - 0.9 / 24;
        ctx.globalAlpha = 0.16 * (1 - k / 24); ctx.fillStyle = gen;
        ctx.beginPath(); ctx.moveTo(cx, cx); ctx.arc(cx, cx, R + 2, a0, a1); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.strokeStyle = fg; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(ha) * (r0 - 10), cx + Math.sin(ha) * (r0 - 10)); ctx.lineTo(cx + Math.cos(ha) * (R + 14), cx + Math.sin(ha) * (R + 14)); ctx.stroke();
      const tipR = hv >= 0 ? r0 + span * Math.min((af[hv] + ag[hv]) / MAX, 1) : R + 14;
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx + Math.cos(ha) * tipR, cx + Math.sin(ha) * tipR, 4.5, 0, 7); ctx.fill();
      ctx.fillStyle = panel; ctx.beginPath(); ctx.arc(cx + Math.cos(ha) * tipR, cx + Math.sin(ha) * tipR, 1.8, 0, 7); ctx.fill();
      ctx.fillStyle = mut; ctx.font = `10px ${css.fontFamily}`;
      // على الشاشة الصغيرة علامة الحد الأعلى تتداخل مع اسم الشهر الأول
      for (const p of w < 500 ? [0.5] : [0.5, 1]) ctx.fillText(short(MAX * p), cx + 22, cx - (r0 + span * p) - 7);
    };

    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      const { hover: hv, cur: D, prev: P, max: MAX } = live.current;
      if (D !== lastCur) { lastCur = D; changedAt = t; }
      const k = reduce ? 1 : 1 - Math.exp(-dt * 7);
      const since = t - changedAt;
      for (let i = 0; i <= DAYS; i++) {
        if (!reduce && since < (i / DAYS) * 420) continue;
        af[i] += ((D.f[i] || 0) - af[i]) * k;
        ag[i] += ((D.g[i] || 0) - ag[i]) * k;
      }
      aMax += (MAX - aMax) * k;
      if (P) lastPrev = P;
      ghostA += ((P ? 0.85 : 0) - ghostA) * k;
      if (hv >= 0) {
        let df = hv - hand;
        if (df > DAYS / 2) df -= DAYS;
        if (df < -DAYS / 2) df += DAYS;
        hand = (hand + df * Math.min(1, dt * 14) + DAYS) % DAYS;
      } else if (!reduce) hand = (hand + dt * (DAYS / 14)) % DAYS;
      else hand = Math.max(D.f.length - 1, 0);
      draw(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pick = (ev: React.PointerEvent) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - r.left - r.width / 2, y = ev.clientY - r.top - r.height / 2;
    const rad = Math.hypot(x, y), R = r.width / 2 - r.width * 0.075;
    if (rad < R * 0.3 || rad > R * 1.08) return -1;
    let a = Math.atan2(y, x) + Math.PI / 2;
    if (a < 0) a += TAU;
    const i = Math.min(Math.floor((a / TAU) * DAYS), DAYS - 1);
    return i < cur.f.length ? i : -1;
  };

  // موضع التلميح بجانب رأس الشعاع
  let tipStyle: React.CSSProperties | undefined;
  if (tipIndex >= 0 && width) {
    const R = width / 2 - width * 0.075, r0 = R * 0.38;
    const a = -Math.PI / 2 + ((tipIndex + 0.5) / DAYS) * TAU;
    const rr = r0 + (R - r0) * Math.min(dayTotal(cur, tipIndex) / max, 1);
    const x = width / 2 + Math.cos(a) * rr, y = width / 2 + Math.sin(a) * rr;
    const tw = 232, th = 200;
    let left = x + 16;
    if (left + tw > width) left = x - tw - 16;
    left = Math.max(4, Math.min(left, width - tw - 4));
    const top = Math.max(4, Math.min(y - th / 2, width - th - 4));
    const off = ((wrapRef.current?.clientWidth ?? width) - width) / 2;
    tipStyle = { left: left + off, top };
  }

  return (
    <div className="sf-dialwrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="sf-canvas"
        role="img"
        aria-label={label}
        onPointerMove={e => onHover(pick(e))}
        onPointerDown={e => onHover(pick(e))}
        onPointerLeave={() => onHover(-1)}
      />
      {tipStyle && <div className={`sf-tip${hover >= 0 ? ' on' : ''}`} style={tipStyle} aria-hidden={hover < 0}>{tip}</div>}
    </div>
  );
};

// ───────────────────────── الصفحة ─────────────────────────
export const SaharaSiteFarmsView: React.FC = () => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const perms = usePermissions();
  const canEdit = perms.canEdit('sahara.reserves');
  const records = useSiteFarms();

  // قبل تحميل ملف الترجمة تعود القيمة نصًا (اسم المفتاح) لا مصفوفة: أرقام الأشهر/الأيام بدلها حتى لا تنكسر الصفحة
  const monthsRaw = t('finance:siteFarms.months', { returnObjects: true }) as unknown;
  const weekdaysRaw = t('finance:siteFarms.weekdays', { returnObjects: true }) as unknown;
  const months: string[] = Array.isArray(monthsRaw) && monthsRaw.length === 12 ? monthsRaw as string[] : Array.from({ length: 12 }, (_, i) => String(i + 1));
  const weekdays: string[] = Array.isArray(weekdaysRaw) && weekdaysRaw.length === 7 ? weekdaysRaw as string[] : Array.from({ length: 7 }, (_, i) => String(i + 1));

  const [site, setSite] = useState<string>('التسمين');
  const [yearPick, setYearPick] = useState<number | null>(null);
  const [range, setRange] = useState<[number, number]>([0, 11]);
  const fullYear = range[0] === 0 && range[1] === 11;
  const inRange = (m: number) => m >= range[0] && m <= range[1];
  /** شهر واحد مختار (أو -1 لفترة أطول) */
  const month = range[0] === range[1] ? range[0] : -1;
  const setMonth = (m: number) => setRange(m < 0 ? [0, 11] : [m, m]);
  const [hover, setHover] = useState(-1);
  const [lastHover, setLastHover] = useState(-1);
  const onHover = (i: number) => { setHover(i); if (i >= 0) setLastHover(i); };
  // المقارنة مع السنة السابقة دائمًا مفعّلة (أُزيل زر إيقافها)
  const cmp = true;
  const [metric, setMetric] = useState<Metric>('all');
  const [datePick, setDatePick] = useState<string | null>(null);
  const [busy, setBusy] = useState<false | 'annual' | 'daily'>(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean; warn?: boolean } | null>(null);
  const annualInput = useRef<HTMLInputElement>(null);
  const dailyInput = useRef<HTMLInputElement>(null);

  const siteYears = useMemo(() => annualYears(records, site), [records, site]);
  // السنوات تُبنى من الملفات المرفوعة (بلا حد أعلى)، والسنة التالية لآخرها تظهر منقّطة
  const nextYear = siteYears.length ? siteYears[siteYears.length - 1] + 1 : new Date().getFullYear();
  // السنوات القادمة حتى 2050 على الأقل (بطاقات منقّطة تتحول لبطاقة حقيقية عند رفع ملفها)
  const LAST_PLANNED_YEAR = 2050;
  const futureYears = Array.from({ length: Math.max(LAST_PLANNED_YEAR, nextYear) - nextYear + 1 }, (_, k) => nextYear + k);
  const yearBar = useRef<HTMLDivElement>(null);
  const yearInd = useRef<HTMLSpanElement>(null);
  const year = yearPick !== null && siteYears.includes(yearPick) ? yearPick : (siteYears[siteYears.length - 1] ?? null);
  useEffect(() => {
    const bar = yearBar.current;
    if (!bar) return;
    let first = true;
    const center = () => {
      const sel = bar.querySelector<HTMLElement>('[aria-pressed="true"]');
      const b = bar.getBoundingClientRect();
      if (!sel || !b.width) return false;
      const ind = yearInd.current;
      if (ind) {
        ind.style.transition = first ? 'none' : '';
        ind.style.left = `${sel.offsetLeft}px`;
        ind.style.width = `${sel.offsetWidth}px`;
        ind.style.opacity = '1';
      }
      const r = sel.getBoundingClientRect();
      if (r.left < b.left || r.right > b.right) {
        const smooth = !first && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        bar.scrollBy({ left: r.left + r.width / 2 - (b.left + b.width / 2), behavior: smooth ? 'smooth' : 'auto' });
      }
      return true;
    };
    first = !center();
    if (!first) return;
    const ro = new ResizeObserver(() => { if (center()) ro.disconnect(); });
    ro.observe(bar);
    return () => ro.disconnect();
  }, [year, site, siteYears.length]);
  const annual: AnnualRecord | null = year !== null ? annualFor(records, site, year) : null;
  const prevAnnual = year !== null ? annualFor(records, site, year - 1) : null;

  // مقياس موحّد لكل سنوات الموقع حتى تكون الساعات قابلة للمقارنة
  const max = useMemo(() => {
    let m = 0;
    for (const r of records) {
      if (r.kind !== 'annual' || r.site !== site) continue;
      for (let i = 0; i < r.f.length; i++) m = Math.max(m, (r.f[i] || 0) + (r.g[i] || 0));
    }
    return Math.max(Math.ceil(m / 100000) * 100000, 100000);
  }, [records, site]);

  const cur: YearData | null = annual ? { f: annual.f, g: annual.g } : null;
  const yearInfo = annual ? (() => {
    const total = annual.f.reduce((x, v) => x + v, 0) + annual.g.reduce((x, v) => x + v, 0);
    const same = prevAnnual ? annual.f.reduce((a, _, i) => a + (i < prevAnnual.f.length ? (prevAnnual.f[i] || 0) + (prevAnnual.g[i] || 0) : 0), 0) : 0;
    return { total, days: annual.f.length, pc: same ? ((total - same) / same) * 100 : null };
  })() : null;
  const prev: YearData | null = prevAnnual ? { f: prevAnnual.f, g: prevAnnual.g } : null;

  const idx = useMemo(() => {
    if (!cur || year === null) return [] as number[];
    const out: number[] = [];
    for (let i = 0; i < cur.f.length; i++) { const m = dateOfIndex(year, i).month; if (m >= range[0] && m <= range[1]) out.push(i); }
    return out;
  }, [cur, year, range]);

  const yearTotal = (r: SiteFarmsRecord | null) => (r && r.kind === 'annual' ? r.f.reduce((a, b) => a + b, 0) + r.g.reduce((a, b) => a + b, 0) : 0);

  // مواقع: استهلاك آخر يوم لكل موقع (من الملف السنوي، وإلا من آخر كشف يومي) — لا الرصيد التراكمي
  const siteCards = useMemo(() => FARM_SITES.map(name => {
    const dates = farmsDates(records, name);
    const last = dates[dates.length - 1];
    const rows = last ? farmsOn(records, name, last) : [];
    const yrs = annualYears(records, name);
    const latest = yrs.length ? annualFor(records, name, yrs[yrs.length - 1]) : null;
    return { name, hasData: yrs.length > 0 || rows.length > 0, farms: rows.length, latest, use: lastDayUse(records, name) };
  }), [records]);

  const datesOfSite = useMemo(() => farmsDates(records, site), [records, site]);
  const date = datePick && datesOfSite.includes(datePick) ? datePick : (datesOfSite[datesOfSite.length - 1] ?? null);
  const farmRows = useMemo(() => (date ? farmsOn(records, site, date) : []), [records, site, date]);
  const periodLabel = year === null ? '' : fullYear ? String(year) : month >= 0 ? `${months[month]} ${year}` : `${months[range[0]]} – ${months[range[1]]} ${year}`;
  // فترة التعليم = الفترة المختارة (السنة كاملة = كل الأشهر)؛ كل شهر يُقارن بأيامه هو
  const topPeriod = range;
  const isVehicleSite = VEHICLE_SITES.includes(site);
  // أعلى 8 أيام استهلاكًا في كل شهر من الفترة (من الملف السنوي): الطاقة بمصروف الآليات، وباقي المواقع بمصروف المزارع والمولدات
  const highDays = useMemo(() => {
    const out = new Map<number, { rank: number; month: number }>();
    if (!cur || year === null) return out;
    for (let m = topPeriod[0]; m <= topPeriod[1]; m++) {
      const days: { i: number; v: number }[] = [];
      for (let i = 0; i < cur.f.length; i++) {
        if (dateOfIndex(year, i).month !== m) continue;
        const v = isVehicleSite ? (cur.g[i] || 0) : (cur.f[i] || 0) + (cur.g[i] || 0);
        if (v > 0) days.push({ i, v });
      }
      days.sort((a, b) => b.v - a.v).slice(0, HIGH_DAYS_PER_MONTH).forEach((d, k) => out.set(d.i, { rank: k + 1, month: m }));
    }
    return out;
  }, [cur, year, topPeriod, isVehicleSite]);

  // أيام التغطية لكل مزرعة (من الكشوف اليومية) للخريطة وحقل المزارع
  const cover = useMemo(() => siteCover(records, site), [records, site]);
  // الطقس الحقيقي للموقع على الخريطة (من الخادم كل 15 دقيقة)
  const weather = useSiteWeather();
  const [field, setField] = useState<{ farm: string | null } | null>(null);
  // جدول المزارع: حسب الكشف اليومي أو استهلاك المزارع (زر منزلق)، ونافذة المزرعة عند الضغط عليها
  const [farmView, setFarmView] = useState<'daily' | 'usage'>('daily');
  const [farmModal, setFarmModal] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: File; fileName: string; site: string; years: { year: number; f: number[]; g: number[] }[] } | null>(null);
  // الملف السنوي يُعاد رفعه كل يوم: يُدمج مع المحفوظ (الأيام الجديدة وقيم الملف هي الأحدث)، والملف الذي لا جديد فيه يظهر تنبيهًا
  const commitAnnual = (target: string, file: File, years: { year: number; f: number[]; g: number[] }[]) => {
    const fileName = file.name;
    const done = importAnnual(target, years);
    setSite(target);
    setYearPick(years[years.length - 1].year);
    setPending(null);
    if (!done.length) { setNotice({ text: t('finance:siteFarms.duplicateAnnual', { file: fileName, site: target }), warn: true }); return; }
    // الملف نفسه يُحفظ في أرشيف تقرير مزارع الموقع (آخر ملف لكل موقع)
    void saveSiteAnnualFile(target, file).catch(() => undefined);
    setNotice({ text: t('finance:siteFarms.annualUpdated', {
      site: target,
      years: done.map(y => y.year).join('، '),
      added: done.reduce((a, y) => a + y.added, 0),
      changed: done.reduce((a, y) => a + y.changed, 0),
    }) });
  };

  const onFile = async (kind: 'annual' | 'daily', file: File | undefined) => {
    if (!file) return;
    setBusy(kind);
    setNotice(null);
    try {
      if (kind === 'annual') {
        const res = await readAnnualFarmsFile(file);
        // الموقع غير مكتوب في الملف: لا يُحفظ شيء قبل اختيار الموقع
        if (!res.site) setPending({ file, fileName: file.name, site, years: res.years });
        else commitAnnual(res.site, file, res.years);
      } else {
        const res = await readDailyFarmsFile(file);
        if (!res.date) throw new Error(t('finance:siteFarms.noDate'));
        const names = Object.keys(res.sites);
        if (!names.length) throw new Error(t('finance:siteFarms.noFarms'));
        const changed = importFarmsDay(res.date, res.sites);
        setDatePick(res.date);
        if (!changed.length) setNotice({ text: t('finance:siteFarms.duplicateDaily', { file: file.name, date: res.date }), warn: true });
        else setNotice({ text: t('finance:siteFarms.dailySaved', { date: res.date, sites: changed.length, farms: changed.reduce((a, n) => a + res.sites[n].length, 0) }) });
      }
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(false);
      if (annualInput.current) annualInput.current.value = '';
      if (dailyInput.current) dailyInput.current.value = '';
    }
  };

  // ملخصات
  const f = cur ? sumRange(cur, idx, 'f') : 0;
  const g = cur ? sumRange(cur, idx, 'g') : 0;
  const total = f + g;
  const sortedIdx = cur ? [...idx].sort((a, b) => dayTotal(cur, b) - dayTotal(cur, a)) : [];
  const dayLabel = (i: number) => (year === null ? '' : `${dateOfIndex(year, i).day} ${months[dateOfIndex(year, i).month]}`);
  const prevSame = prev ? idx.reduce((s, i) => s + dayTotal(prev, i), 0) : 0;
  const deltaPct = cmp && prev && prevSame > 0 ? ((total - prevSame) / prevSame) * 100 : null;

  const perMonth = useMemo(() => {
    const per = Array.from({ length: 12 }, () => ({ f: 0, g: 0, n: 0 }));
    const prevPer = Array.from({ length: 12 }, () => 0);
    if (cur && year !== null) {
      for (let i = 0; i < cur.f.length; i++) { const m = dateOfIndex(year, i).month; per[m].f += cur.f[i] || 0; per[m].g += cur.g[i] || 0; per[m].n++; }
    }
    if (prev && year !== null) {
      for (let i = 0; i < prev.f.length; i++) prevPer[dateOfIndex(year - 1, i).month] += (prev.f[i] || 0) + (prev.g[i] || 0);
    }
    return { per, prevPer };
  }, [cur, prev, year]);

  // التلميح عند التمرير على يوم
  // التلميح يبقى على آخر يوم أثناء اختفائه (لا يختفي فجأة)
  const tipIdx = hover >= 0 ? hover : (cur && lastHover < cur.f.length ? lastHover : -1);
  const tip = (() => {
    if (!cur || year === null || tipIdx < 0) return null;
    const { month: mm, day, weekday } = dateOfIndex(year, tipIdx);
    const tot = dayTotal(cur, tipIdx);
    const fv = cur.f[tipIdx] || 0, gv = cur.g[tipIdx] || 0;
    const all = cur.f.map((_, i) => dayTotal(cur, i));
    const avg = all.reduce((a, b) => a + b, 0) / Math.max(all.length, 1);
    const rank = [...all].sort((a, b) => b - a).indexOf(tot) + 1;
    const vsAvg = avg ? ((tot - avg) / avg) * 100 : 0;
    const pv = prev && tipIdx < prev.f.length ? dayTotal(prev, tipIdx) : 0;
    const vsPrev = pv ? ((tot - pv) / pv) * 100 : null;
    return (
      <>
        <div className="d">{day} {months[mm]} {year}</div>
        <div className="w">{weekdays[weekday]} · {t('finance:siteFarms.dayOfYear', { n: tipIdx + 1 })}</div>
        <div className="row"><span><i className="sw" style={{ background: 'var(--sf-dial-farm)' }} />{t('finance:siteFarms.farmsUse')}</span><b>{fmt(fv)}</b></div>
        <div className="row"><span><i className="sw" style={{ background: 'var(--sf-gen)' }} />{t('finance:siteFarms.genUse')}</span><b>{fmt(gv)}</b></div>
        <div className="sp"><i style={{ width: `${tot ? (fv / tot) * 100 : 0}%`, background: 'var(--sf-dial-farm)' }} /><i style={{ width: `${tot ? (gv / tot) * 100 : 0}%`, background: 'var(--sf-gen)' }} /></div>
        <div className="row"><span>{t('finance:siteFarms.dayTotal')}</span><b>{fmt(tot)} {t('finance:siteFarms.liter')}</b></div>
        <div className="row"><span>{t('finance:siteFarms.vsAvg')}</span><b>{vsAvg > 0 ? '▲' : '▼'} {Math.abs(vsAvg).toFixed(1)}%</b></div>
        {vsPrev !== null && <div className="row"><span>{t('finance:siteFarms.vsYear', { year: year - 1 })}</span><b>{vsPrev > 0 ? '▲' : '▼'} {Math.abs(vsPrev).toFixed(1)}%</b></div>}
        {highDays.has(tipIdx) && <div className="sf-tip-spike">{t(isVehicleSite ? 'finance:siteFarms.highTipVehicles' : 'finance:siteFarms.highTip', { n: HIGH_DAYS_PER_MONTH, rank: highDays.get(tipIdx)!.rank, month: months[highDays.get(tipIdx)!.month] })}</div>}
        <span className="badge">{t('finance:siteFarms.rank', { rank, n: all.length })}</span>
      </>
    );
  })();

  // أعلى خمسة أيام مع نسبتها فوق معدل السنة
  const avgAll = cur ? cur.f.reduce((acc, _, i) => acc + dayTotal(cur, i), 0) / Math.max(cur.f.length, 1) : 0;
  const top5 = cur && year !== null ? sortedIdx.slice(0, 5).map(i => {
    const o = dateOfIndex(year, i), v = dayTotal(cur, i);
    return { i, v, f: cur.f[i] || 0, g: cur.g[i] || 0, date: `${o.day} ${months[o.month]}`, wd: weekdays[o.weekday], pct: avgAll ? ((v - avgAll) / avgAll) * 100 : 0 };
  }) : [];
  const centerLabel = hover >= 0 && year !== null ? dayLabel(hover) : year === null ? '' : fullYear ? t('finance:siteFarms.yearConsumption', { year }) : periodLabel;
  const spikesInRange = [...highDays.keys()];
  const centerValue = hover >= 0 && cur ? dayTotal(cur, hover) : total;

  return (
    <div className="sf-root" dir={i18n.dir()}>
      {/* شريط الصفحة بنفس تصميم شريط صفحة الخزانات: كارت أبيض فيه الأيقونة والعنوان (الرفع من الرفع المتعدد) */}
      <div className="p-3 sm:p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 px-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-500 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sprout className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">{t('finance:siteFarms.headerTitle', { site })}</h2>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              <CalendarDays className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>{t('finance:siteFarms.reportDate')}</span>
              <span className="font-mono font-black text-slate-800 dark:text-slate-200">{date ?? '—'}</span>
              {date && date === datesOfSite[datesOfSite.length - 1] && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px]">{t('finance:siteFarms.latest')}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* مدخل الملف لزر "رفع الملف السنوي" في الصفحة الفارغة */}
      {canEdit && (
        <>
          <input ref={dailyInput} type="file" accept=".pdf,.xlsx,.xls,.xlsm" hidden onChange={e => void onFile('daily', e.target.files?.[0])} />
          <input ref={annualInput} type="file" accept=".xlsx,.xls,.xlsm" hidden onChange={e => void onFile('annual', e.target.files?.[0])} />
        </>
      )}
      {busy && <div className="sf-note">{t('finance:siteFarms.reading')}</div>}
      {notice && <div className={`sf-note${notice.error ? ' err' : notice.warn ? ' warn' : ''}`} role={notice.warn || notice.error ? 'alert' : 'status'}>{notice.text}</div>}
      {field && <SiteFarmsField site={site} cover={cover} initialFarm={field.farm} onClose={() => setField(null)} />}
      {pending && (
        <div className="sf-confirm" role="alertdialog" aria-labelledby="sf-confirm-title">
          <div className="sf-confirm-body">
            <b id="sf-confirm-title">{t('finance:siteFarms.confirmTitle', { file: pending.fileName })}</b>
            <span>{t('finance:siteFarms.confirmUnknown', { years: pending.years.map(y => y.year).join('، ') })}</span>
            <label className="sf-confirm-site">
              <span>{t('finance:siteFarms.confirmSite')}</span>
              <select className="sf-select" value={pending.site} onChange={e => setPending({ ...pending, site: e.target.value })}>
                {FARM_SITES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="sf-confirm-actions">
            <button type="button" className="sf-confirm-ok" onClick={() => commitAnnual(pending.site, pending.file, pending.years)}>{t('finance:siteFarms.confirmSave')}</button>
            <button type="button" className="sf-confirm-cancel" onClick={() => setPending(null)}>{t('finance:siteFarms.confirmCancel')}</button>
          </div>
        </div>
      )}

      <section className="sf-band">
        <div className="sf-band-head">
          <h2>{t('finance:siteFarms.sites')}</h2>
        </div>
        <div className="sf-sites">
          {siteCards.map(s => (
            <button key={s.name} type="button" className="sf-site" aria-pressed={s.name === site} data-empty={s.hasData ? 0 : 1}
              onClick={() => { setSite(s.name); setYearPick(null); setMonth(-1); setHover(-1); setLastHover(-1); setDatePick(null); }}>
              <span className="sf-site-top">
                <span className="sf-site-name" title={s.name}>{s.name}</span>
                <span className="sf-chip">{s.hasData ? (s.farms ? t('finance:siteFarms.farmsCount', { n: s.farms }) : t('finance:siteFarms.annualOnly')) : t('finance:siteFarms.waiting')}</span>
              </span>
              {s.use
                ? <span className="sf-site-bal">{fmt(s.use.total)}<small>{t('finance:siteFarms.useLiter')}</small></span>
                : <span className="sf-site-nobal">{t('finance:siteFarms.useAfterReport')}</span>}
              <SiteSpark rec={s.latest} active={s.name === site} months={months} />
              <span className="sf-site-foot">
                <span>{t('finance:siteFarms.lastDay')} <b className="font-mono">{s.use ? s.use.date.slice(5) : '—'}</b></span>
                {s.latest && <span>{s.latest.year} <b>{short(yearTotal(s.latest))}</b></span>}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="sf-band">
        <div className="sf-band-head">
          <h2>{t('finance:siteFarms.year')}</h2>
        </div>
        {/* خط زمني للسنوات (بدل البطاقات): زر لكل سنة فيها بيانات، ومؤشر ينزلق إلى السنة المختارة، والسنوات القادمة علامات خافتة */}
        <div className="sf-tl" ref={yearBar}>
          <span className="sf-tl-ind" ref={yearInd} aria-hidden="true" />
          {siteYears.map(y => {
            const rec = annualFor(records, site, y)!;
            return (
              <button key={y} type="button" className="sf-tl-y" aria-pressed={y === year} onClick={() => { setYearPick(y); setMonth(-1); setHover(-1); setLastHover(-1); }}>
                <b>{y}</b>
                <span>{short(yearTotal(rec))}</span>
              </button>
            );
          })}
          {futureYears.map(y => (
            <span key={y} className="sf-tl-f" title={t('finance:siteFarms.nextYear')}>{y}</span>
          ))}
        </div>
        {yearInfo && (
          <div className="sf-tl-note" key={`${site}-${year}`}>
            <span><b><Num v={yearInfo.total} id="yr-total" /></b> {t('finance:siteFarms.liter')}</span>
            <span className="sf-tl-dot" aria-hidden="true" />
            <span className="sf-tl-cov"><i><u style={{ width: `${(yearInfo.days / 365) * 100}%` }} /></i>{t('finance:siteFarms.daysCount', { n: yearInfo.days })}</span>
            <span className="sf-tl-dot" aria-hidden="true" />
            {yearInfo.pc === null
              ? <span>{t('finance:siteFarms.firstYear')}</span>
              : <span className={yearInfo.pc > 0 ? 'sf-up' : 'sf-down'}>{yearInfo.pc > 0 ? '▲' : '▼'} {Math.abs(yearInfo.pc).toFixed(1)}% {t('finance:siteFarms.vsYear', { year: year! - 1 })}</span>}
          </div>
        )}
      </section>

      {cur && year !== null ? (
        <>
          <div className="sf-main sf-rise">
            <div className="sf-card">
              <h2 className="sf-h2">{t('finance:siteFarms.dialTitle')} <small>{t('finance:siteFarms.dialHint')}</small></h2>
              <div className="sf-range">
                <label>
                  <span>{t('finance:siteFarms.rangeFrom')}</span>
                  <select className="sf-select" value={range[0]} onChange={e => { const v = +e.target.value; setRange([v, Math.max(v, range[1])]); setHover(-1); }}>
                    {months.map((mn, m) => <option key={m} value={m}>{mn}</option>)}
                  </select>
                </label>
                <label>
                  <span>{t('finance:siteFarms.rangeTo')}</span>
                  <select className="sf-select" value={range[1]} onChange={e => { const v = +e.target.value; setRange([Math.min(range[0], v), v]); setHover(-1); }}>
                    {months.map((mn, m) => <option key={m} value={m}>{mn}</option>)}
                  </select>
                </label>
                {!fullYear && <button type="button" className="sf-range-reset" onClick={() => { setRange([0, 11]); setHover(-1); }}>{t('finance:siteFarms.rangeAll')}</button>}              </div>
              <div style={{ position: 'relative' }}>
                <YearDial year={year} cur={cur} prev={cmp ? prev : null} max={max} range={range} spikes={spikesInRange} hover={hover} months={months}
                  label={t('finance:siteFarms.dialLabel')} onHover={onHover} tipIndex={tipIdx} tip={tip} />
                <div className="sf-center">
                  <div className="l">{centerLabel}</div>
                  <div className="v">{hover >= 0 ? fmt(centerValue) : <Num v={centerValue} id="center" />}</div>
                  <div className="u">{t('finance:siteFarms.liter')}</div>
                </div>
              </div>
              <div className="sf-legend">
                <span><i className="sf-dot" style={{ background: 'var(--sf-dial-farm)' }} />{t('finance:siteFarms.farmsUse')}</span>
                <span><i className="sf-dot" style={{ background: 'var(--sf-gen)' }} />{t('finance:siteFarms.genUse')}</span>
                {cmp && prev && <span><i className="sf-dot" style={{ border: '1.5px dashed var(--sf-mut)' }} />{t('finance:siteFarms.prevYear')}</span>}
                <span><i className="sf-dot" style={{ background: 'var(--sf-neg)', borderRadius: '50%' }} />{t('finance:siteFarms.highLegend', { n: HIGH_DAYS_PER_MONTH })}</span>
              </div>
            </div>

            <div className="sf-side sf-rise" key={`${site}-${year}`}>
              <div className="sf-hero">
                <div className="sf-hero-head">
                  <span className="sf-hero-icon"><Sprout className="w-5 h-5" strokeWidth={2.2} /></span>
                  <div className="l">{t('finance:siteFarms.totalUse')} · {periodLabel}</div>
                </div>
                <div className="v"><Num v={total} id="total" /><small>{t('finance:siteFarms.liter')}</small></div>
                <div className="sf-split"><i style={{ width: `${total ? (f / total) * 100 : 0}%`, background: 'var(--sf-farm)' }} /><i style={{ width: `${total ? (g / total) * 100 : 0}%`, background: 'var(--sf-gen)' }} /></div>
                <div className="sf-split-l"><span>{t('finance:siteFarms.farmsUse')} <b><Num v={f} id="f" /></b></span><span>{t('finance:siteFarms.genUse')} <b><Num v={g} id="g" /></b></span></div>
                {deltaPct !== null && <div className={`sf-delta ${deltaPct > 0 ? 'sf-up' : 'sf-down'}`}>{deltaPct > 0 ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}% {t('finance:siteFarms.samePeriod', { year: year - 1 })}</div>}
              </div>
              <div className="sf-mini">
                <div className="sf-k"><div className="l">{t('finance:siteFarms.avgDay')}</div><div className="v"><Num v={idx.length ? total / idx.length : 0} id="avg" /></div><div className="s">{t('finance:siteFarms.literPerDay')}</div></div>
                <div className="sf-k"><div className="l">{t('finance:siteFarms.peakDay')}</div><div className="v">{sortedIdx.length ? <Num v={dayTotal(cur, sortedIdx[0])} id="peak" /> : '—'}</div><div className="s">{sortedIdx.length ? dayLabel(sortedIdx[0]) : ''}</div></div>
                <div className="sf-k"><div className="l">{t('finance:siteFarms.lowDay')}</div><div className="v">{sortedIdx.length ? <Num v={dayTotal(cur, sortedIdx[sortedIdx.length - 1])} id="low" /> : '—'}</div><div className="s">{sortedIdx.length ? dayLabel(sortedIdx[sortedIdx.length - 1]) : ''}</div></div>
                <div className="sf-k"><div className="l">{t('finance:siteFarms.recordedDays')}</div><div className="v">{idx.length}</div><div className="s">{t('finance:siteFarms.ofDays')}</div></div>
              </div>
              <div className="sf-card sf-top5">
                <div className="sf-top5-head">
                  <h2 className="sf-h2">{t('finance:siteFarms.top5')}</h2>
                  <span>{t('finance:siteFarms.top5Hint', { avg: fmt(avgAll) })}</span>
                </div>
                {top5.length > 0 && (
                  <button type="button" className="sf-lead" onMouseEnter={() => onHover(top5[0].i)} onMouseLeave={() => onHover(-1)} onFocus={() => onHover(top5[0].i)} onBlur={() => onHover(-1)}>
                    <span className="sf-lead-top">
                      <span className="sf-lead-badge">{t('finance:siteFarms.leader')}</span>
                      <span className="sf-delta-pill up">▲ {top5[0].pct.toFixed(0)}%</span>
                    </span>
                    <span className="sf-lead-val">{fmt(top5[0].v)}<small>{t('finance:siteFarms.liter')}</small></span>
                    <span className="sf-lead-date">{top5[0].date} · {top5[0].wd}</span>
                    <span className="sf-lead-split" aria-hidden="true">
                      <i style={{ width: `${(top5[0].f / Math.max(top5[0].v, 1)) * 100}%` }} /><i style={{ width: `${(top5[0].g / Math.max(top5[0].v, 1)) * 100}%` }} />
                    </span>
                    <span className="sf-lead-legend"><span>{t('finance:siteFarms.farmsUse')} <b>{fmt(top5[0].f)}</b></span><span>{t('finance:siteFarms.genUse')} <b>{fmt(top5[0].g)}</b></span></span>
                  </button>
                )}
                <ol>
                  {top5.slice(1).map((d, k) => (
                    <li key={d.i}>
                      <button type="button" className="sf-rank-row" onMouseEnter={() => onHover(d.i)} onMouseLeave={() => onHover(-1)} onFocus={() => onHover(d.i)} onBlur={() => onHover(-1)}>
                        <span className="sf-rank-n">{k + 2}</span>
                        <span className="sf-rank-day"><b>{d.date}</b><small>{d.wd} · {t('finance:siteFarms.behindLead', { n: fmt(top5[0].v - d.v) })}</small></span>
                        <span className="sf-rank-val"><b>{fmt(d.v)}</b><span className="sf-delta-pill up">▲ {d.pct.toFixed(0)}%</span></span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          {/* خريطة الموقع بعرض الصفحة كاملًا */}
          <section className="sf-map-section">
            {cover.farms.length > 0 ? (
              <Suspense fallback={<div className="sf-map sf-map-loading" />}>
                <SiteFarmsMap site={site} cover={cover} weather={weather} onOpen={farm => setField({ farm })} />
              </Suspense>
            ) : (
              <div className="sf-map-none">{t(cover.date ? (isVehicleSite ? 'finance:siteFarms.map.vehicleSite' : 'finance:siteFarms.map.noFarms') : 'finance:siteFarms.map.noReport', { site })}</div>
            )}
          </section>

          <div className="sf-card">
            <Suspense fallback={<div className="sf-mchart-plot" />}>
              <SiteFarmsMonthlyChart months={months} per={perMonth.per} prevPer={perMonth.prevPer} hasPrev={cmp && !!prev} year={year}
                metric={metric} onMetric={setMetric} month={month} inRange={inRange} fullYear={fullYear}
                onPick={m => { setMonth(m); setHover(-1); }} />
            </Suspense>
          </div>
        </>
      ) : (
        <div className="sf-card sf-empty sf-rise" key={`empty-${site}`}>
          <FileSpreadsheet className="w-8 h-8" />
          <b>{t('finance:siteFarms.emptyTitle', { site })}</b>
          <span>{t('finance:siteFarms.emptyBody')}</span>
          {canEdit && <button type="button" onClick={() => annualInput.current?.click()} className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-700/25 cursor-pointer active:scale-95 transition-all"><Upload className="w-4 h-4" />{t('finance:siteFarms.uploadAnnual')}</button>}
        </div>
      )}

      {farmModal && <FarmUsageModal records={records} site={site} farm={farmModal} onClose={() => setFarmModal(null)} />}
      <div className="sf-card">
        <h2 className="sf-h2">
          <span>{farmView === 'daily' ? t('finance:siteFarms.farmsTable', { site }) : t('finance:siteFarms.usage.title', { site })}</span>
          <span className="sf-switch" data-on={farmView === 'usage' ? 1 : 0} role="tablist">
            <i aria-hidden="true" />
            <button type="button" role="tab" aria-selected={farmView === 'daily'} onClick={() => setFarmView('daily')}>{t('finance:siteFarms.usage.byDaily')}</button>
            <button type="button" role="tab" aria-selected={farmView === 'usage'} onClick={() => setFarmView('usage')}>{t('finance:siteFarms.usage.tab')}</button>
          </span>
          {farmView === 'daily' && datesOfSite.length > 0 && (
            <select className="sf-select" value={date ?? ''} onChange={e => setDatePick(e.target.value)} aria-label={t('finance:siteFarms.reportDate')}>
              {[...datesOfSite].reverse().map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </h2>
        {farmView === 'usage' ? (
          <SiteFarmsUsageView records={records} site={site} onOpenFarm={setFarmModal} />
        ) : farmRows.length ? (
          <div className="sf-table-wrap">
            <table className="sf-table">
              <thead>
                <tr>
                  <th>{t('finance:siteFarms.colFarm')}</th><th>{t('finance:siteFarms.colPrevious')}</th><th>{t('finance:siteFarms.colInbound')}</th>
                  <th>{t('finance:siteFarms.colConsumption')}</th><th>{t('finance:siteFarms.colBalance')}</th>
                </tr>
              </thead>
              <tbody key={`${site}-${date}`} className="sf-rows">
                {farmRows.map(r => (
                  <tr key={r.name}>
                    <td><button type="button" className="sf-farm-link" onClick={() => setFarmModal(r.name)} title={t('finance:siteFarms.usage.openFarm')}>{r.name}</button></td>
                    <td>{r.previous === null ? '—' : fmt(r.previous)}</td>
                    <td>{r.inbound === null ? '—' : fmt(r.inbound)}</td>
                    <td>{r.consumption === null ? '—' : fmt(r.consumption)}</td>
                    <td className="bal">{r.balance === null ? '—' : fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sf-empty"><span>{t('finance:siteFarms.noDaily')}</span></div>
        )}
      </div>
    </div>
  );
};

/** منحنى مصغّر لمصروف آخر سنة محفوظة لموقع (متوسط يومي لكل أسبوع)؛ يتبع الماوس بخط ونقطة وقيمة الأسبوع */
const SiteSpark: React.FC<{ rec: AnnualRecord | null; active: boolean; months: string[] }> = ({ rec, active, months }) => {
  const gid = `sf-spark-${React.useId().replace(/:/g, '')}`;
  const [at, setAt] = useState(-1);
  const W = 200, H = 46;
  if (!rec || !rec.f.length) {
    return <svg className="sf-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><line x1="0" x2={W} y1={H - 6} y2={H - 6} stroke="var(--sf-grid)" strokeDasharray="3 5" /></svg>;
  }
  const pts: number[] = [];
  for (let i = 0; i < rec.f.length; i += 7) {
    let s = 0, n = 0;
    for (let j = i; j < Math.min(i + 7, rec.f.length); j++) { s += (rec.f[j] || 0) + (rec.g[j] || 0); n++; }
    pts.push(s / n);
  }
  const m = Math.max(...pts, 1);
  const xy = pts.map((v, i) => [(i / Math.max(pts.length - 1, 1)) * (W - 8) + 4, H - 6 - (v / m) * (H - 14)] as const);
  let d = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`;
  for (let i = 1; i < xy.length; i++) {
    const mx = (xy[i - 1][0] + xy[i][0]) / 2, my = (xy[i - 1][1] + xy[i][1]) / 2;
    d += `Q${xy[i - 1][0].toFixed(1)},${xy[i - 1][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const last = xy[xy.length - 1];
  d += `L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
  const color = 'var(--sf-spark-line)';
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    setAt(Math.max(0, Math.min(pts.length - 1, Math.round(((x - 4) / (W - 8)) * (pts.length - 1)))));
  };
  const p = at >= 0 ? xy[at] : last;
  const day = at >= 0 ? dateOfIndex(rec.year, at * 7) : null;
  return (
    <span className="sf-spark-wrap">
      <svg className="sf-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" onPointerMove={onMove} onPointerLeave={() => setAt(-1)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={active ? 0.05 : 0.03} />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d}L${last[0].toFixed(1)},${H}L${xy[0][0].toFixed(1)},${H}Z`} fill={`url(#${gid})`} />
        <path d={d} fill="none" stroke={color} strokeOpacity={active ? 1 : 0.85} strokeWidth={active ? 0.6 : 0.5} strokeLinejoin="round" strokeLinecap="round" />
        <g className="sf-spark-cursor" style={{ transform: `translate(${p[0]}px, ${p[1]}px)` }}>
          {at >= 0 && <line x1="0" x2="0" y1={-p[1] + 2} y2={H - p[1]} stroke="var(--sf-mut)" strokeWidth="1" strokeDasharray="2 3" />}
          <circle r={at >= 0 ? 2.2 : 1.5} fill="var(--sf-panel)" stroke={color} strokeWidth="0.6" />
        </g>
      </svg>
      {at >= 0 && day && (
        <span className="sf-spark-tip" style={{ left: `${(p[0] / W) * 100}%` }}>{day.day} {months[day.month]} · {short(pts[at])}</span>
      )}
    </span>
  );
};

export default SaharaSiteFarmsView;
