import React, { useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';

type Metric = 'all' | 'f' | 'g';
interface MonthAgg { f: number; g: number; n: number }

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const compact = (v: number) => (v >= 1e6 ? `${Math.round(v / 1e5) / 10}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));
/** لون كل مقياس (متغيرات الصفحة، تتبع الوضع الداكن) */
const COLOR: Record<Metric, string> = { all: '#e8900a', f: 'var(--sf-farm)', g: 'var(--sf-gen)' };

/** اسم الشهر تحت العمود: الاسم المركّب (كانون الثاني، تشرين الأول…) على سطرين حتى لا تتداخل الأسماء */
const MonthTick = ({ x, y, payload }: { x?: number | string; y?: number | string; payload?: { value?: string } }) => {
  const words = String(payload?.value ?? '').split(' ');
  return (
    <text x={Number(x)} y={Number(y) + 10} textAnchor="middle" fontSize={10} fill="#94a3b8">
      {words.map((w, i) => <tspan key={i} x={Number(x)} dy={i ? 12 : 0}>{w}</tspan>)}
    </text>
  );
};

/**
 * اللوحة الشهرية بنفس شكل «الوارد الشهري»: كل الأعمدة بنفس التدرج على شبكة بقيم،
 * والشهر المحدد (أو الذي تمر عليه الفأرة، وإلا الأعلى) فوقه نقطة، وقيمته في سطر فوق الرسم.
 * الضغط على شهر يصفّي الساعة والأرقام عليه، والضغط ثانية يلغي التصفية.
 */
const SiteFarmsMonthlyChart: React.FC<{
  months: string[];
  per: MonthAgg[];
  prevPer: number[];
  hasPrev: boolean;
  year: number | null;
  metric: Metric;
  onMetric: (m: Metric) => void;
  month: number;
  inRange: (m: number) => boolean;
  fullYear: boolean;
  onPick: (m: number) => void;
}> = ({ months, per, prevPer, hasPrev, year, metric, onMetric, month, inRange, fullYear, onPick }) => {
  const { t } = useTranslation(['finance']);
  const [hover, setHover] = useState<number | null>(null);
  const val = (p: MonthAgg) => (metric === 'f' ? p.f : metric === 'g' ? p.g : p.f + p.g);
  const data = per.map((p, m) => ({ m, label: months[m], v: p.n ? val(p) : 0, f: p.f, g: p.g, n: p.n }));
  const peak = data.reduce((best, p, i) => (p.v > data[best].v ? i : best), 0);
  const active = hover ?? (month >= 0 ? month : peak);
  const cur = data[active];
  const pct = (m: number) => {
    const pp = prevPer[m], p = per[m];
    return hasPrev && pp && p.n ? ((p.f + p.g - pp) / pp) * 100 : null;
  };
  const curPct = pct(active);
  const color = COLOR[metric];

  return (
    <div className="sf-mchart">
      <div className="sf-mchart-head">
        <h2 className="sf-h2 sf-mchart-title">{t('finance:siteFarms.monthlyBoard')}</h2>
        <div className="sf-seg">
          {(['all', 'f', 'g'] as Metric[]).map(m => (
            <button key={m} type="button" aria-pressed={metric === m} onClick={() => { onMetric(m); setHover(null); }}>
              {t(m === 'all' ? 'finance:siteFarms.metricAll' : m === 'f' ? 'finance:siteFarms.metricFarms' : 'finance:siteFarms.metricGen')}
            </button>
          ))}
        </div>
      </div>
      {/* قيمة الشهر المحدد */}
      <div className="sf-mchart-cur">
        <span className="mn">{cur.label}{year !== null ? ` ${year}` : ''}</span>
        <b>{cur.n ? fmt(cur.v) : '—'}</b>
        <span className="mn">{t('finance:siteFarms.liter')}</span>
        {curPct !== null && <span className={`sf-delta-pill ${curPct > 0 ? 'up' : 'down'}`}>{curPct > 0 ? '▲' : '▼'} {Math.abs(curPct).toFixed(0)}%</span>}
        {active === peak && data[peak].v > 0 && <span className="sf-mchart-peak">{t('finance:siteFarms.peakMonth')}</span>}
        <small className="sf-mchart-hint">{t('finance:siteFarms.monthlyHint')}</small>
      </div>
      <div className="sf-mchart-plot" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 14, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%"
            onMouseMove={(s: { activeTooltipIndex?: number | string | null }) => {
              const i = s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : -1;
              setHover(data[i]?.n ? i : null);
            }}
            onMouseLeave={() => setHover(null)}
            onClick={(s: { activeTooltipIndex?: number | string | null }) => {
              const i = s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : -1;
              if (data[i]?.n) onPick(month === i ? -1 : i);
            }}
            style={{ cursor: 'pointer' }}>
            <defs>
              <linearGradient id="sf-mbar-active" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: color, stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.75 }} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="var(--sf-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} height={34} tick={MonthTick} />
            <YAxis tickLine={false} axisLine={false} width={34} tickCount={5} tickFormatter={compact} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip
              cursor={false}
              wrapperStyle={{ outline: 'none', zIndex: 20 }}
              content={({ active: on, payload }) => {
                if (!on || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                if (!p.n) return null;
                const d = pct(p.m);
                return (
                  <div dir="rtl" className="sf-mchart-tip">
                    <div className="h">
                      <div className="mn">{p.label}{year !== null ? ` ${year}` : ''}</div>
                      <div><b>{fmt(p.f + p.g)}</b> <span className="mn">{t('finance:siteFarms.liter')}</span></div>
                    </div>
                    <div className="r">
                      <div><i style={{ background: 'var(--sf-farm)' }} />{t('finance:siteFarms.farmsUse')}<b>{fmt(p.f)}</b></div>
                      <div><i style={{ background: 'var(--sf-gen)' }} />{t('finance:siteFarms.genUse')}<b>{fmt(p.g)}</b></div>
                      {d !== null && year !== null && <div className={d > 0 ? 'sf-up' : 'sf-down'}>{d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(0)}% {t('finance:siteFarms.samePeriod', { year: year - 1 })}</div>}
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="v" radius={[6, 6, 6, 6]} maxBarSize={30} isAnimationActive={false}
              label={({ x, y, width, index }: { x?: number | string; y?: number | string; width?: number | string; index?: number }) =>
                index === active && data[active].v > 0 ? (
                  <circle cx={Number(x) + Number(width) / 2} cy={Number(y)} r={4.5} fill="#fff" style={{ stroke: color }} strokeWidth={2.5} />
                ) : <g />}>
              {data.map(p => (
                <Cell key={p.m} fill="url(#sf-mbar-active)" fillOpacity={!fullYear && !inRange(p.m) && p.m !== active ? 0.45 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SiteFarmsMonthlyChart;
