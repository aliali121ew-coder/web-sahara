import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Sprout, X } from 'lucide-react';
import type { SiteFarmsRecord } from '../../lib/siteFarms';
import { farmDaysBetween, farmSeries, farmSummary, groupFarmDays, usageMonth, usageMonths } from '../../lib/siteFarmsUsage';
import { DateField } from '../ui/DateField';

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString('en-US'));
const compact = (v: number) => (v >= 1e6 ? `${Math.round(v / 1e5) / 10}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));
const axisTick = { fontSize: 10, fill: '#94a3b8' };

/** أعمدة يومية (لتر) بنفس شكل لوحات الصفحة؛ العمود الأعلى بلون أغمق */
const DayBars: React.FC<{ data: { label: string; full: string; v: number }[]; height?: number; unit: string }> = ({ data, height = 240, unit }) => {
  const peak = data.reduce((b, p, i) => (p.v > (data[b]?.v ?? -1) ? i : b), 0);
  return (
    <div style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="var(--sf-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={axisTick} />
          <YAxis tickLine={false} axisLine={false} width={38} tickCount={5} tickFormatter={compact} tick={axisTick} />
          <Tooltip cursor={{ fill: 'var(--sf-panel2)' }} wrapperStyle={{ outline: 'none', zIndex: 20 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof data)[number];
              return <div dir="rtl" className="sf-mchart-tip"><div className="h"><div className="mn">{p.full}</div><div><b>{fmt(p.v)}</b> <span className="mn">{unit}</span></div></div></div>;
            }} />
          <Bar dataKey="v" radius={[5, 5, 2, 2]} maxBarSize={26} isAnimationActive={false}
            shape={(props: unknown) => {
              const { x, y, width, height: h, index } = props as { x: number; y: number; width: number; height: number; index: number };
              return <rect x={x} y={y} width={width} height={Math.max(h, 0)} rx={4} fill="var(--sf-farm)" fillOpacity={index === peak ? 1 : 0.6} />;
            }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * رسم أسبوعي صغير لمزرعة في جدول الكشف اليومي: سبعة أعمدة (السبت–الجمعة) لمصروف كل يوم،
 * يوم الكشف المختار أغمق، واليوم بلا كشف خط خافت؛ المرور على عمود يعرض اليوم والمصروف.
 */
export const WeekBars: React.FC<{ values: (number | null)[]; dates: string[]; active: number; dayNames: string[] }> = ({ values, dates, active, dayNames }) => {
  const { i18n } = useTranslation();
  const [at, setAt] = useState(-1);
  const W = 112, H = 30, gap = 3, bw = (W - gap * 6) / 7;
  // بالعربية السبت يمينًا (ترتيب القراءة)
  const pos = (i: number) => (i18n.dir() === 'rtl' ? 6 - i : i) * (bw + gap);
  const max = Math.max(...values.map(v => v ?? 0), 1);
  const show = at >= 0 ? at : -1;
  return (
    <span className="sf-wk" onPointerLeave={() => setAt(-1)}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
        {values.map((v, i) => {
          const x = pos(i);
          if (v === null) return <rect key={i} x={x} y={H - 2} width={bw} height={2} rx={1} fill="var(--sf-line)" onPointerEnter={() => setAt(i)} />;
          const h = Math.max(2, (v / max) * (H - 2));
          return <rect key={i} x={x} y={H - h} width={bw} height={h} rx={2} fill="var(--sf-farm)" fillOpacity={i === active ? 1 : i === at ? 0.8 : 0.4} onPointerEnter={() => setAt(i)} />;
        })}
        {/* منطقة مرور لكل يوم بكامل الارتفاع */}
        {values.map((_, i) => <rect key={`h${i}`} x={pos(i)} y={0} width={bw} height={H} fill="transparent" onPointerEnter={() => setAt(i)} />)}
      </svg>
      {show >= 0 && (
        <span className="sf-wk-tip" style={{ left: `${((pos(show) + bw / 2) / W) * 100}%` }}>
          {dayNames[show]} {dates[show].slice(5)} · <b>{values[show] === null ? '—' : fmt(values[show])}</b>
        </span>
      )}
    </span>
  );
};

/**
 * «استهلاك المزارع»: لشهر يُختار — رسم بياني لمصروف المزارع اليومي، وجدول مصروف كل مزرعة لكل يوم.
 * الضغط على مزرعة يفتح نافذتها.
 */
export const SiteFarmsUsageView: React.FC<{ records: SiteFarmsRecord[]; site: string; onOpenFarm: (farm: string) => void }> = ({ records, site, onOpenFarm }) => {
  const { t } = useTranslation(['finance']);
  const U = (k: string, o?: Record<string, unknown>) => t(`finance:siteFarms.usage.${k}`, o);
  const months = useMemo(() => usageMonths(records, site), [records, site]);
  const [pick, setPick] = useState<string | null>(null);
  const ym = pick && months.includes(pick) ? pick : (months[0] ?? null);
  const data = useMemo(() => (ym ? usageMonth(records, site, ym) : null), [records, site, ym]);
  const monthNames = t('finance:siteFarms.months', { returnObjects: true }) as unknown;
  const monthLabel = (v: string) => (Array.isArray(monthNames) ? `${monthNames[Number(v.slice(5)) - 1]} ${v.slice(0, 4)}` : v);

  if (!ym || !data) return <div className="sf-empty"><span>{t('finance:siteFarms.noDaily')}</span></div>;
  const avg = data.dates.length ? data.total / data.dates.length : 0;
  const peakIdx = data.dayTotals.reduce((b, v, i) => (v > data.dayTotals[b] ? i : b), 0);

  return (
    <div className="sf-usage">
      <div className="sf-usage-bar">
        <select className="sf-select" value={ym} onChange={e => setPick(e.target.value)} aria-label={U('month')}>
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <div className="sf-usage-kpis">
          <span>{U('monthTotal')} <b>{fmt(data.total)}</b></span>
          <span>{U('avgDay')} <b>{fmt(avg)}</b></span>
          <span>{U('peakDay')} <b>{data.dates.length ? `${fmt(data.dayTotals[peakIdx])} · ${data.dates[peakIdx].slice(5)}` : '—'}</b></span>
          <span>{U('days')} <b>{data.dates.length}</b></span>
        </div>
      </div>

      {/* القسم الأول: الرسم البياني */}
      <section className="sf-usage-sec">
        <h3>{U('chartTitle')}</h3>
        <DayBars unit={t('finance:siteFarms.liter')} data={data.dates.map((d, i) => ({ label: d.slice(8), full: d, v: data.dayTotals[i] }))} />
      </section>

      {/* القسم الثاني: الجدول اليومي لكل مزرعة */}
      <section className="sf-usage-sec">
        <h3>{U('tableTitle')} <small>{U('tableHint')}</small></h3>
        <div className="sf-table-wrap">
          <table className="sf-table sf-usage-table">
            <thead>
              <tr>
                <th className="sticky">{t('finance:siteFarms.colFarm')}</th>
                {data.dates.map(d => <th key={d} className="num">{d.slice(8)}</th>)}
                <th className="num">{U('total')}</th>
              </tr>
            </thead>
            <tbody>
              {data.farms.map(f => (
                <tr key={f.name}>
                  <td className="sticky"><button type="button" className="sf-farm-link" onClick={() => onOpenFarm(f.name)}>{f.name}</button></td>
                  {f.days.map((v, i) => <td key={data.dates[i]} className="num">{v === null ? '—' : fmt(v)}</td>)}
                  <td className="num bal">{fmt(f.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky">{U('dayTotal')}</td>
                {data.dayTotals.map((v, i) => <td key={data.dates[i]} className="num">{fmt(v)}</td>)}
                <td className="num bal">{fmt(data.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
};

/** نافذة مزرعة: ملخصها، ورسم مصروفها لكل يوم، وجدول أيامها (الأحدث أولًا) */
export const FarmUsageModal: React.FC<{ records: SiteFarmsRecord[]; site: string; farm: string; onClose: () => void }> = ({ records, site, farm, onClose }) => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const U = (k: string, o?: Record<string, unknown>) => t(`finance:siteFarms.usage.${k}`, o);
  const days = useMemo(() => farmSeries(records, site, farm), [records, site, farm]);
  const sum = useMemo(() => farmSummary(days), [days]);
  // جدول المزرعة: أسبوعي (السبت–الجمعة) أو شهري أو فترة من/إلى
  const [mode, setMode] = useState<'week' | 'month' | 'period'>('week');
  const groups = useMemo(() => (mode === 'period' ? [] : groupFarmDays(days, mode)), [days, mode]);
  const first = days[0]?.date.replace(/\//g, '-') ?? '';
  const last = days[days.length - 1]?.date.replace(/\//g, '-') ?? '';
  const [from, setFrom] = useState(() => days[0]?.date ?? '');
  const [to, setTo] = useState(() => days[days.length - 1]?.date ?? '');
  const periodDays = useMemo(() => farmDaysBetween(days, from, to), [days, from, to]);
  const periodSum = useMemo(() => farmSummary([...periodDays].reverse()), [periodDays]);
  const monthNames = t('finance:siteFarms.months', { returnObjects: true }) as unknown;
  const monthLabel = (v: string) => (Array.isArray(monthNames) ? `${monthNames[Number(v.slice(5)) - 1]} ${v.slice(0, 4)}` : v);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="sf-fmodal-back" onClick={onClose} dir={i18n.dir()}>
      <div className="sf-root sf-fmodal" role="dialog" aria-modal="true" aria-label={farm} onClick={e => e.stopPropagation()}>
        <div className="sf-fmodal-head">
          <span className="sf-hero-icon"><Sprout className="w-5 h-5" strokeWidth={2.2} /></span>
          <div className="min-w-0">
            <h2>{farm}</h2>
            <small>{site} · {U('daysRecorded', { n: sum.days })}</small>
          </div>
          <button type="button" className="sf-fmodal-x" onClick={onClose} aria-label={t('common:actions.close')}><X className="w-4 h-4" /></button>
        </div>
        <div className="sf-fmodal-body">
          <div className="sf-mini">
            <div className="sf-k"><div className="l">{U('farmTotal')}</div><div className="v">{fmt(sum.total)}</div><div className="s">{t('finance:siteFarms.liter')}</div></div>
            <div className="sf-k"><div className="l">{U('avgDay')}</div><div className="v">{fmt(sum.avg)}</div><div className="s">{t('finance:siteFarms.literPerDay')}</div></div>
            <div className="sf-k"><div className="l">{U('peakDay')}</div><div className="v">{fmt(sum.peak?.consumption)}</div><div className="s">{sum.peak?.date ?? ''}</div></div>
            <div className="sf-k"><div className="l">{U('lastBalance')}</div><div className="v">{fmt(sum.lastBalance)}</div><div className="s">{t('finance:siteFarms.liter')}</div></div>
          </div>
          <section className="sf-usage-sec">
            <h3>{U('farmChart')}</h3>
            <DayBars height={220} unit={t('finance:siteFarms.liter')} data={days.map(d => ({ label: d.date.slice(5), full: d.date, v: d.consumption ?? 0 }))} />
          </section>
          <section className="sf-usage-sec">
            <h3>
              {U('farmTable')}
              <span className="sf-seg sf-fmodal-seg">
                {(['week', 'month', 'period'] as const).map(m => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{U(`mode.${m}`)}</button>
                ))}
              </span>
            </h3>
            {mode === 'period' && (
              <div className="sf-range sf-fmodal-range">
                <label><span>{t('finance:siteFarms.rangeFrom')}</span>
                  <DateField className="sf-select" value={from} min={first} max={to || last} onChange={setFrom} /></label>
                <label><span>{t('finance:siteFarms.rangeTo')}</span>
                  <DateField className="sf-select" value={to} min={from || first} max={last} onChange={setTo} /></label>
              </div>
            )}
            <div className="sf-table-wrap sf-fmodal-table">
              {mode === 'period' ? (
                <table className="sf-table">
                  <thead>
                    <tr>
                      <th>{U('date')}</th><th>{t('finance:siteFarms.colPrevious')}</th><th>{t('finance:siteFarms.colInbound')}</th>
                      <th>{t('finance:siteFarms.colConsumption')}</th><th>{t('finance:siteFarms.colBalance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodDays.map(d => (
                      <tr key={d.date}>
                        <td className="font-mono">{d.date}</td>
                        <td>{fmt(d.previous)}</td><td>{fmt(d.inbound)}</td>
                        <td><b>{fmt(d.consumption)}</b></td><td className="bal">{fmt(d.balance)}</td>
                      </tr>
                    ))}
                    {!periodDays.length && <tr><td colSpan={5} className="sf-fmodal-none">{U('noDays')}</td></tr>}
                  </tbody>
                  {periodDays.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={3}>{U('periodTotal', { n: periodSum.days })} · {U('avgDay')} {fmt(periodSum.avg)}</td>
                        <td><b>{fmt(periodSum.total)}</b></td><td className="bal">{fmt(periodSum.lastBalance)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              ) : (
                <table className="sf-table">
                  <thead>
                    <tr>
                      <th>{U(mode === 'week' ? 'week' : 'month')}</th><th>{U('days')}</th><th>{U('farmTotal')}</th>
                      <th>{U('avgDay')}</th><th>{U('change')}</th><th>{U('lastBalance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(g => (
                      <tr key={g.key}>
                        <td className="font-mono">{mode === 'week' ? `${g.from.slice(5)} – ${g.to.slice(5)}` : monthLabel(g.key)}</td>
                        <td>{g.days}</td>
                        <td><b>{fmt(g.total)}</b></td>
                        <td>{fmt(g.avg)}</td>
                        <td>{g.change === null ? '—' : <span className={`sf-delta-pill ${g.change > 0 ? 'up' : 'down'}`}>{g.change > 0 ? '▲' : '▼'} {Math.abs(g.change)}%</span>}</td>
                        <td className="bal">{fmt(g.lastBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
};
