import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, FileText, Upload } from 'lucide-react';
import { usePermissions } from '../../lib/usePermission';
import {
  FARM_SITES, annualFor, annualYears, farmsDates, farmsOn, saveAnnual, saveFarmsDay, useSiteFarms,
  type AnnualRecord, type SiteFarmsRecord
} from '../../lib/siteFarms';
import { readAnnualFarmsFile, readDailyFarmsFile } from '../../lib/siteFarmsFile';
import './siteFarms.css';

const YEAR_CARDS = [2025, 2026, 2027, 2028, 2029, 2030];
const DAYS = 365;
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

// ───────────────────────── الساعة الدائرية ─────────────────────────
interface DialProps {
  year: number;
  cur: YearData;
  prev: YearData | null;
  max: number;
  month: number;
  hover: number;
  months: string[];
  label: string;
  onHover: (i: number) => void;
  tip: React.ReactNode;
}

const YearDial: React.FC<DialProps> = ({ year, cur, prev, max, month, hover, months, label, onHover, tip }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  // قيم الرسم تُقرأ داخل حلقة الإطارات من المراجع حتى لا تُعاد إنشاء الحلقة مع كل تغيير
  const live = useRef({ cur, prev, max, month, hover, months });
  useEffect(() => { live.current = { cur, prev, max, month, hover, months }; });

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

    const draw = () => {
      const { cur: D, prev: P, max: MAX, month: sel, hover: hv, months: names } = live.current;
      const r = canvas.getBoundingClientRect();
      const w = r.width;
      if (!w) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = canvas.width; }
      const css = getComputedStyle(canvas);
      const v = (n: string) => css.getPropertyValue(n).trim();
      const grid = v('--sf-grid'), farm = v('--sf-farm'), gen = v('--sf-gen'), mut = v('--sf-mut'), fg = v('--sf-fg'), panel = v('--sf-panel');
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
        const on = sel === m;
        ctx.globalAlpha = 1; ctx.fillStyle = on ? fg : mut;
        ctx.font = `${on ? '700' : '400'} ${Math.max(10, w * 0.02)}px ${css.fontFamily}`;
        ctx.fillText(names[m] ?? String(m + 1), cx + Math.cos(am) * (R + w * 0.05), cx + Math.sin(am) * (R + w * 0.05));
      }
      ctx.globalAlpha = 1;
      if (P) {
        ctx.strokeStyle = mut; ctx.lineWidth = 1.2; ctx.setLineDash([1.5, 2.5]); ctx.beginPath();
        for (let i = 0; i < Math.min(P.f.length, DAYS); i++) {
          const t = Math.min(dayTotal(P, i) / MAX, 1), a = ang(i), rr = r0 + span * t;
          const x = cx + Math.cos(a) * rr, y = cx + Math.sin(a) * rr;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.globalAlpha = 0.85; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      const lw = Math.max(1.5, ((TAU * (r0 + span * 0.55)) / DAYS) * 0.6);
      const hi = hv >= 0 ? hv : hand;
      for (let i = 0; i < D.f.length; i++) {
        const a = ang(i), c = Math.cos(a), s = Math.sin(a);
        const behind = (((hi - i) % DAYS) + DAYS) % DAYS;
        const trail = behind < 46 ? 1 - behind / 46 : 0;
        const dim = sel >= 0 && dateOfIndex(year, i).month !== sel;
        const f = ((D.f[i] || 0) / MAX) * span, g = ((D.g[i] || 0) / MAX) * span;
        ctx.globalAlpha = dim ? 0.15 : Math.min(1, 0.5 + trail * 0.5);
        ctx.lineWidth = hv === i ? lw * 2.2 : lw * (1 + trail * 0.5);
        ctx.strokeStyle = farm; ctx.beginPath(); ctx.moveTo(cx + c * r0, cx + s * r0); ctx.lineTo(cx + c * (r0 + f), cx + s * (r0 + f)); ctx.stroke();
        ctx.strokeStyle = gen; ctx.beginPath(); ctx.moveTo(cx + c * (r0 + f), cx + s * (r0 + f)); ctx.lineTo(cx + c * (r0 + f + g), cx + s * (r0 + f + g)); ctx.stroke();
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
      const tipR = hv >= 0 ? r0 + span * Math.min(dayTotal(D, hv) / MAX, 1) : R + 14;
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx + Math.cos(ha) * tipR, cx + Math.sin(ha) * tipR, 4.5, 0, 7); ctx.fill();
      ctx.fillStyle = panel; ctx.beginPath(); ctx.arc(cx + Math.cos(ha) * tipR, cx + Math.sin(ha) * tipR, 1.8, 0, 7); ctx.fill();
      ctx.fillStyle = mut; ctx.font = `10px ${css.fontFamily}`;
      for (const p of [0.5, 1]) ctx.fillText(short(MAX * p), cx + 22, cx - (r0 + span * p) - 7);
    };

    const tick = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      const { hover: hv, cur: D } = live.current;
      if (hv >= 0) {
        let df = hv - hand;
        if (df > DAYS / 2) df -= DAYS;
        if (df < -DAYS / 2) df += DAYS;
        hand = (hand + df * Math.min(1, dt * 14) + DAYS) % DAYS;
      } else if (!reduce) hand = (hand + dt * (DAYS / 14)) % DAYS;
      else hand = Math.max(D.f.length - 1, 0);
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [year]);

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
  if (hover >= 0 && width) {
    const R = width / 2 - width * 0.075, r0 = R * 0.38;
    const a = -Math.PI / 2 + ((hover + 0.5) / DAYS) * TAU;
    const rr = r0 + (R - r0) * Math.min(dayTotal(cur, hover) / max, 1);
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
      {hover >= 0 && tipStyle && <div className="sf-tip" style={tipStyle}>{tip}</div>}
    </div>
  );
};

// ───────────────────────── الصفحة ─────────────────────────
export const SaharaSiteFarmsView: React.FC = () => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const perms = usePermissions();
  const canEdit = perms.canEdit('sahara.reserves');
  const records = useSiteFarms();

  const months = t('finance:siteFarms.months', { returnObjects: true }) as string[];
  const weekdays = t('finance:siteFarms.weekdays', { returnObjects: true }) as string[];

  const [site, setSite] = useState<string>('التسمين');
  const [yearPick, setYearPick] = useState<number | null>(null);
  const [month, setMonth] = useState(-1);
  const [hover, setHover] = useState(-1);
  const [cmp, setCmp] = useState(true);
  const [metric, setMetric] = useState<Metric>('all');
  const [datePick, setDatePick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const annualInput = useRef<HTMLInputElement>(null);
  const dailyInput = useRef<HTMLInputElement>(null);

  const siteYears = useMemo(() => annualYears(records, site), [records, site]);
  const year = yearPick !== null && siteYears.includes(yearPick) ? yearPick : (siteYears[siteYears.length - 1] ?? null);
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
  const prev: YearData | null = prevAnnual ? { f: prevAnnual.f, g: prevAnnual.g } : null;

  const idx = useMemo(() => {
    if (!cur || year === null) return [] as number[];
    const out: number[] = [];
    for (let i = 0; i < cur.f.length; i++) if (month < 0 || dateOfIndex(year, i).month === month) out.push(i);
    return out;
  }, [cur, year, month]);

  const yearTotal = (r: SiteFarmsRecord | null) => (r && r.kind === 'annual' ? r.f.reduce((a, b) => a + b, 0) + r.g.reduce((a, b) => a + b, 0) : 0);

  // مواقع: ملخص كل موقع من آخر كشف يومي وأحدث سنة
  const siteCards = useMemo(() => FARM_SITES.map(name => {
    const dates = farmsDates(records, name);
    const last = dates[dates.length - 1];
    const rows = last ? farmsOn(records, name, last) : [];
    const balance = rows.reduce((s, r) => s + (r.balance ?? 0), 0);
    const yrs = annualYears(records, name);
    const latest = yrs.length ? annualFor(records, name, yrs[yrs.length - 1]) : null;
    return { name, hasData: yrs.length > 0 || rows.length > 0, farms: rows.length, balance, latest };
  }), [records]);

  const datesOfSite = useMemo(() => farmsDates(records, site), [records, site]);
  const date = datePick && datesOfSite.includes(datePick) ? datePick : (datesOfSite[datesOfSite.length - 1] ?? null);
  const farmRows = useMemo(() => (date ? farmsOn(records, site, date) : []), [records, site, date]);
  const farmsTotalBalance = farmRows.reduce((s, r) => s + (r.balance ?? 0), 0);

  const onFile = async (kind: 'annual' | 'daily', file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    try {
      if (kind === 'annual') {
        const res = await readAnnualFarmsFile(file);
        const target = res.site ?? site;
        for (const y of res.years) saveAnnual(target, y.year, y.f, y.g);
        setSite(target);
        setYearPick(res.years[res.years.length - 1].year);
        setNotice({ text: t('finance:siteFarms.annualSaved', { site: target, years: res.years.map(y => y.year).join('، ') }) });
      } else {
        const res = await readDailyFarmsFile(file);
        if (!res.date) throw new Error(t('finance:siteFarms.noDate'));
        const names = Object.keys(res.sites);
        if (!names.length) throw new Error(t('finance:siteFarms.noFarms'));
        for (const n of names) saveFarmsDay(n, res.date, res.sites[n]);
        setDatePick(res.date);
        setNotice({ text: t('finance:siteFarms.dailySaved', { date: res.date, sites: names.length, farms: names.reduce((a, n) => a + res.sites[n].length, 0) }) });
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
  const monthVal = (p: { f: number; g: number }) => (metric === 'f' ? p.f : metric === 'g' ? p.g : p.f + p.g);
  const monthMax = Math.max(...perMonth.per.map(monthVal), 1);
  const peakMonth = perMonth.per.map(monthVal).indexOf(monthMax);

  // التلميح عند التمرير على يوم
  const tip = (() => {
    if (!cur || year === null || hover < 0) return null;
    const { month: mm, day, weekday } = dateOfIndex(year, hover);
    const tot = dayTotal(cur, hover);
    const fv = cur.f[hover] || 0, gv = cur.g[hover] || 0;
    const all = cur.f.map((_, i) => dayTotal(cur, i));
    const avg = all.reduce((a, b) => a + b, 0) / Math.max(all.length, 1);
    const rank = [...all].sort((a, b) => b - a).indexOf(tot) + 1;
    const vsAvg = avg ? ((tot - avg) / avg) * 100 : 0;
    const pv = prev && hover < prev.f.length ? dayTotal(prev, hover) : 0;
    const vsPrev = pv ? ((tot - pv) / pv) * 100 : null;
    return (
      <>
        <div className="d">{day} {months[mm]} {year}</div>
        <div className="w">{weekdays[weekday]} · {t('finance:siteFarms.dayOfYear', { n: hover + 1 })}</div>
        <div className="row"><span><i className="sw" style={{ background: 'var(--sf-farm)' }} />{t('finance:siteFarms.farmsUse')}</span><b>{fmt(fv)}</b></div>
        <div className="row"><span><i className="sw" style={{ background: 'var(--sf-gen)' }} />{t('finance:siteFarms.genUse')}</span><b>{fmt(gv)}</b></div>
        <div className="sp"><i style={{ width: `${tot ? (fv / tot) * 100 : 0}%`, background: 'var(--sf-farm)' }} /><i style={{ width: `${tot ? (gv / tot) * 100 : 0}%`, background: 'var(--sf-gen)' }} /></div>
        <div className="row"><span>{t('finance:siteFarms.dayTotal')}</span><b>{fmt(tot)} {t('finance:siteFarms.liter')}</b></div>
        <div className="row"><span>{t('finance:siteFarms.vsAvg')}</span><b>{vsAvg > 0 ? '▲' : '▼'} {Math.abs(vsAvg).toFixed(1)}%</b></div>
        {vsPrev !== null && <div className="row"><span>{t('finance:siteFarms.vsYear', { year: year - 1 })}</span><b>{vsPrev > 0 ? '▲' : '▼'} {Math.abs(vsPrev).toFixed(1)}%</b></div>}
        <span className="badge">{t('finance:siteFarms.rank', { rank, n: all.length })}</span>
      </>
    );
  })();

  const centerLabel = hover >= 0 && year !== null ? dayLabel(hover) : year === null ? '' : month < 0 ? t('finance:siteFarms.yearConsumption', { year }) : `${months[month]} ${year}`;
  const centerValue = hover >= 0 && cur ? dayTotal(cur, hover) : total;

  return (
    <div className="sf-root" dir={i18n.dir()}>
      <div className="sf-top">
        <div>
          <h1 className="sf-title">{t('finance:siteFarms.title')}</h1>
          <div className="sf-sub">{t('finance:siteFarms.subtitle')}</div>
        </div>
        {canEdit && (
          <div className="sf-actions">
            <button type="button" className="sf-btn" disabled={busy} onClick={() => dailyInput.current?.click()}>
              <FileText className="w-4 h-4" />{t('finance:siteFarms.uploadDaily')}
            </button>
            <button type="button" className="sf-btn" disabled={busy} onClick={() => annualInput.current?.click()}>
              <Upload className="w-4 h-4" />{t('finance:siteFarms.uploadAnnual')}
            </button>
            <input ref={dailyInput} type="file" accept=".pdf,.xlsx,.xls,.xlsm" hidden onChange={e => void onFile('daily', e.target.files?.[0])} />
            <input ref={annualInput} type="file" accept=".xlsx,.xls,.xlsm" hidden onChange={e => void onFile('annual', e.target.files?.[0])} />
          </div>
        )}
      </div>

      {busy && <div className="sf-note">{t('finance:siteFarms.reading')}</div>}
      {notice && <div className={`sf-note${notice.error ? ' err' : ''}`} role="status">{notice.text}</div>}

      <div>
        <div className="sf-sec"><span>{t('finance:siteFarms.sites')}</span></div>
        <div className="sf-sites">
          {siteCards.map(s => (
            <button key={s.name} type="button" className="sf-site" aria-pressed={s.name === site} onClick={() => { setSite(s.name); setYearPick(null); setMonth(-1); setHover(-1); setDatePick(null); }}>
              <div className="sf-site-row">
                <span className="sf-site-name">{s.name}</span>
                <span className={`sf-pill${s.hasData ? ' on' : ''}`}>{s.hasData ? (s.farms ? t('finance:siteFarms.farmsCount', { n: s.farms }) : t('finance:siteFarms.annualOnly')) : t('finance:siteFarms.waiting')}</span>
              </div>
              <div className="sf-site-bal">{s.farms ? fmt(s.balance) : '—'}<small>{t('finance:siteFarms.balanceLiter')}</small></div>
              <SiteSpark rec={s.latest} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="sf-sec">
          <span>{t('finance:siteFarms.year')}</span>
          <div className="sf-opts">
            <button type="button" className="sf-tog" aria-pressed={cmp} disabled={!prev} onClick={() => setCmp(c => !c)}>{t('finance:siteFarms.compare')}</button>
          </div>
        </div>
        <div className="sf-years">
          {YEAR_CARDS.map(y => {
            const rec = annualFor(records, site, y);
            return (
              <button key={y} type="button" className="sf-year" aria-pressed={y === year} disabled={!rec} onClick={() => { setYearPick(y); setMonth(-1); setHover(-1); }}>
                <b>{y}</b>
                <span>{rec ? `${short(yearTotal(rec))} ${t('finance:siteFarms.liter')}` : t('finance:siteFarms.noData')}</span>
                <i><u style={{ width: `${rec ? (rec.f.length / 365) * 100 : 0}%` }} /></i>
              </button>
            );
          })}
        </div>
      </div>

      {cur && year !== null ? (
        <>
          <div className="sf-main">
            <div className="sf-card">
              <h2 className="sf-h2">{t('finance:siteFarms.dialTitle')} <small>{t('finance:siteFarms.dialHint')}</small></h2>
              <div style={{ position: 'relative' }}>
                <YearDial year={year} cur={cur} prev={cmp ? prev : null} max={max} month={month} hover={hover} months={months}
                  label={t('finance:siteFarms.dialLabel')} onHover={setHover} tip={tip} />
                <div className="sf-center">
                  <div className="l">{centerLabel}</div>
                  <div className="v">{fmt(centerValue)}</div>
                  <div className="u">{t('finance:siteFarms.liter')}</div>
                </div>
              </div>
              <div className="sf-legend">
                <span><i className="sf-dot" style={{ background: 'var(--sf-farm)' }} />{t('finance:siteFarms.farmsUse')}</span>
                <span><i className="sf-dot" style={{ background: 'var(--sf-gen)' }} />{t('finance:siteFarms.genUse')}</span>
                {cmp && prev && <span><i className="sf-dot" style={{ border: '1.5px dashed var(--sf-mut)' }} />{t('finance:siteFarms.prevYear')}</span>}
              </div>
            </div>

            <div className="sf-side">
              <div className="sf-hero">
                <div className="l">{t('finance:siteFarms.totalUse')} · {month < 0 ? year : `${months[month]} ${year}`}</div>
                <div className="v">{fmt(total)}<small>{t('finance:siteFarms.liter')}</small></div>
                <div className="sf-split"><i style={{ width: `${total ? (f / total) * 100 : 0}%`, background: 'var(--sf-farm)' }} /><i style={{ width: `${total ? (g / total) * 100 : 0}%`, background: 'var(--sf-gen)' }} /></div>
                <div className="sf-split-l"><span>{t('finance:siteFarms.farmsUse')} <b>{fmt(f)}</b></span><span>{t('finance:siteFarms.genUse')} <b>{fmt(g)}</b></span></div>
                {deltaPct !== null && <div className="sf-delta">{deltaPct > 0 ? '▲' : '▼'} {Math.abs(deltaPct).toFixed(1)}% {t('finance:siteFarms.samePeriod', { year: year - 1 })}</div>}
              </div>
              <div className="sf-mini">
                <div className="sf-k"><div className="l">{t('finance:siteFarms.avgDay')}</div><div className="v">{fmt(idx.length ? total / idx.length : 0)}</div><div className="s">{t('finance:siteFarms.literPerDay')}</div></div>
                <div className="sf-k"><div className="l">{t('finance:siteFarms.peakDay')}</div><div className="v">{sortedIdx.length ? fmt(dayTotal(cur, sortedIdx[0])) : '—'}</div><div className="s">{sortedIdx.length ? dayLabel(sortedIdx[0]) : ''}</div></div>
                <div className="sf-k"><div className="l">{t('finance:siteFarms.lowDay')}</div><div className="v">{sortedIdx.length ? fmt(dayTotal(cur, sortedIdx[sortedIdx.length - 1])) : '—'}</div><div className="s">{sortedIdx.length ? dayLabel(sortedIdx[sortedIdx.length - 1]) : ''}</div></div>
                <div className="sf-k"><div className="l">{t('finance:siteFarms.recordedDays')}</div><div className="v">{idx.length}</div><div className="s">{t('finance:siteFarms.ofDays')}</div></div>
              </div>
              <div className="sf-card sf-top5">
                <h2 className="sf-h2">{t('finance:siteFarms.top5')}</h2>
                <ol>
                  {sortedIdx.slice(0, 5).map((i, k) => (
                    <li key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)}>
                      <span className="sf-rk">{k + 1}</span>
                      <div>
                        <div>{dayLabel(i)}</div>
                        <div className="sf-bar"><i style={{ width: `${(dayTotal(cur, i) / Math.max(dayTotal(cur, sortedIdx[0]), 1)) * 100}%` }} /></div>
                      </div>
                      <b>{fmt(dayTotal(cur, i))}</b>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          <div className="sf-card">
            <h2 className="sf-h2">
              <span>{t('finance:siteFarms.monthlyBoard')} <small>{t('finance:siteFarms.monthlyHint')}</small></span>
              <span className="sf-opts">
                {(['all', 'f', 'g'] as Metric[]).map(m => (
                  <button key={m} type="button" className="sf-tog" aria-pressed={metric === m} onClick={() => setMetric(m)}>
                    {t(m === 'all' ? 'finance:siteFarms.metricAll' : m === 'f' ? 'finance:siteFarms.metricFarms' : 'finance:siteFarms.metricGen')}
                  </button>
                ))}
              </span>
            </h2>
            <div className="sf-scroll">
              <div className="sf-board">
                {perMonth.per.map((p, m) => {
                  const v = monthVal(p), h = (v / monthMax) * 100, tf = p.f + p.g, fp = tf ? (p.f / tf) * 100 : 0;
                  const pp = perMonth.prevPer[m];
                  const pc = cmp && prev && pp && p.n ? ((p.f + p.g - pp) / pp) * 100 : null;
                  return (
                    <button key={m} type="button" className="sf-mc" aria-pressed={month === m} data-dim={month >= 0 && month !== m ? 1 : 0}
                      aria-label={months[m]} onClick={() => { setMonth(month === m ? -1 : m); setHover(-1); }}>
                      {m === peakMonth && monthMax > 1 && <span className="pk">{t('finance:siteFarms.peakMonth')}</span>}
                      <div className="v">{p.n ? short(v) : '—'}</div>
                      <div className="bw">
                        <div className="b" style={{ height: `${p.n ? Math.max(h, 2) : 1}%` }}>
                          {p.n > 0 && (metric === 'f' ? <i style={{ height: '100%', background: 'var(--sf-farm)' }} />
                            : metric === 'g' ? <i style={{ height: '100%', background: 'var(--sf-gen)' }} />
                              : <><i style={{ height: `${fp}%`, background: 'var(--sf-farm)' }} /><i style={{ height: `${100 - fp}%`, background: 'var(--sf-gen)' }} /></>)}
                        </div>
                      </div>
                      <div className="n">{months[m]}</div>
                      <div className="dl">{pc === null ? '—' : <span className={pc > 0 ? 'sf-up' : 'sf-down'}>{pc > 0 ? '▲' : '▼'} {Math.abs(pc).toFixed(0)}%</span>}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="sf-card sf-empty">
          <FileSpreadsheet className="w-8 h-8" />
          <b>{t('finance:siteFarms.emptyTitle', { site })}</b>
          <span>{t('finance:siteFarms.emptyBody')}</span>
          {canEdit && <button type="button" className="sf-btn" onClick={() => annualInput.current?.click()}><Upload className="w-4 h-4" />{t('finance:siteFarms.uploadAnnual')}</button>}
        </div>
      )}

      <div className="sf-card">
        <h2 className="sf-h2">
          <span>{t('finance:siteFarms.farmsTable', { site })}</span>
          {datesOfSite.length > 0 && (
            <select className="sf-select" value={date ?? ''} onChange={e => setDatePick(e.target.value)} aria-label={t('finance:siteFarms.reportDate')}>
              {[...datesOfSite].reverse().map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </h2>
        {farmRows.length ? (
          <div className="sf-table-wrap">
            <table className="sf-table">
              <thead>
                <tr>
                  <th>{t('finance:siteFarms.colFarm')}</th><th>{t('finance:siteFarms.colPrevious')}</th><th>{t('finance:siteFarms.colInbound')}</th>
                  <th>{t('finance:siteFarms.colConsumption')}</th><th>{t('finance:siteFarms.colBalance')}</th><th>{t('finance:siteFarms.colShare')}</th>
                </tr>
              </thead>
              <tbody>
                {farmRows.map(r => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.previous === null ? '—' : fmt(r.previous)}</td>
                    <td>{r.inbound === null ? '—' : fmt(r.inbound)}</td>
                    <td>{r.consumption === null ? '—' : fmt(r.consumption)}</td>
                    <td className="bal">{r.balance === null ? '—' : fmt(r.balance)}</td>
                    <td><div className="sf-meter"><i style={{ width: `${farmsTotalBalance ? Math.min(((r.balance ?? 0) / farmsTotalBalance) * 100 * 4, 100) : 0}%` }} /></div></td>
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

/** خط مصغّر لمصروف آخر سنة محفوظة لموقع (كل 4 أيام نقطة) */
const SiteSpark: React.FC<{ rec: AnnualRecord | null }> = ({ rec }) => {
  if (!rec || !rec.f.length) {
    return <svg viewBox="0 0 180 30" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="180" y1="15" y2="15" stroke="var(--sf-grid)" strokeDasharray="3 4" /></svg>;
  }
  const pts: number[] = [];
  for (let i = 0; i < rec.f.length; i += 4) {
    let s = 0;
    for (let j = i; j < Math.min(i + 4, rec.f.length); j++) s += (rec.f[j] || 0) + (rec.g[j] || 0);
    pts.push(s);
  }
  const m = Math.max(...pts, 1);
  const line = pts.map((v, i) => `${((i / Math.max(pts.length - 1, 1)) * 180).toFixed(1)},${(28 - (v / m) * 24).toFixed(1)}`).join(' ');
  return <svg viewBox="0 0 180 30" preserveAspectRatio="none" aria-hidden="true"><polyline points={line} fill="none" stroke="var(--sf-farm)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg>;
};

export default SaharaSiteFarmsView;
