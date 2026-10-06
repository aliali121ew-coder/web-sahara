import React, { useMemo, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '../../i18n/format';
import { formatNumber } from '../../lib/utils';
import type { InboundDelivery } from '../../types';
import type { Company } from './supplierUi';
import { Maximize2 } from 'lucide-react';
import { SupplierChartExpanded } from './SupplierChartExpanded';

/** لونا الشركتين في الرسوم (مُتحقَّق منهما لعمى الألوان والتباين في الوضعين الفاتح والداكن) */
export const COMPANY_COLOR: Record<Company, string> = { sahara: '#d97706', etihad: '#0284c7' };

interface Row { d: InboundDelivery; co: Company }
interface Point { key: string; label: string; full: string; qty: number; n: number; sahara: number; etihad: number; saharaN: number; etihadN: number; avgPrice: number }

const ACCENT = '#0d9488';
const compact = (v: number) => (v >= 1e6 ? `${Math.round(v / 1e5) / 10}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));
const priceOf = (d: InboundDelivery) => d.productPrice || d.pricePerLiter || 0;

/** أعمدة الوارد الشهري (آخر 12 شهرًا فيها وارد): أعمدة ناعمة متدرجة، وأعلى شهر (أو الذي تمر عليه الفأرة) بلون غامق مع نقطة وقيمته */
export const SupplierMonthlyChart: React.FC<{ rows: Row[]; name: string }> = ({ rows, name }) => {
  const { t, i18n } = useTranslation(['suppliers', 'common']);
  const [hover, setHover] = useState<number | null>(null);
  // عدد الأشهر المعروضة (0 = الكل) ونافذة التكبير
  const [months, setMonths] = useState<6 | 12 | 0>(12);
  const [expanded, setExpanded] = useState(false);

  const data = useMemo<Point[]>(() => {
    const by = new Map<string, Point & { cost: number; pq: number }>();
    rows.forEach(({ d, co }) => {
      const key = (d.receiptUnloadDate || d.date || '').replace(/-/g, '/').slice(0, 7);
      if (!/^\d{4}\/\d{2}$/.test(key)) return;
      const p = by.get(key) ?? { key, label: '', full: '', qty: 0, n: 0, sahara: 0, etihad: 0, saharaN: 0, etihadN: 0, avgPrice: 0, cost: 0, pq: 0 };
      const q = d.receivedQuantity || d.volumeLiters || 0;
      p.qty += q; p.n += 1; p[co] += q;
      if (co === 'sahara') p.saharaN += 1; else p.etihadN += 1;
      if (priceOf(d) > 0) { p.cost += q * priceOf(d); p.pq += q; }
      by.set(key, p);
    });
    const list = [...by.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(months ? -months : 0);
    const multiYear = new Set(list.map(p => p.key.slice(0, 4))).size > 1;
    return list.map(({ cost, pq, ...p }) => {
      const [y, m] = p.key.split('/').map(Number);
      const date = new Date(y, m - 1, 1);
      return { ...p, avgPrice: pq ? Math.round((cost / pq) * 10) / 10 : 0, label: fmtDate(date, multiYear ? { month: 'short', year: '2-digit' } : { month: 'short' }), full: fmtDate(date, { month: 'long', year: 'numeric' }) };
    });
  }, [rows, months]);

  if (!data.length) return null;
  // الشهر المحدد: الذي تمر عليه الفأرة، وإلا الشهر صاحب أعلى وارد
  const peak = data.reduce((best, p, i) => (p.qty > data[best].qty ? i : best), 0);
  const active = hover ?? peak;
  const cur = data[active];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{t('profile.chartTitle')}</span>
        <div className="flex items-center gap-1.5">
          {/* الفترة: 6 أشهر / 12 شهرًا / الكل */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10.5px] font-semibold">
            {([6, 12, 0] as const).map(m => (
              <button key={m} type="button" onClick={() => { setMonths(m); setHover(null); }} aria-pressed={months === m}
                className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${months === m ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                {m === 6 ? t('profile.period.m6') : m === 12 ? t('profile.period.m12') : t('profile.period.all')}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setExpanded(true)} aria-label={t('profile.expand')} title={t('profile.expand')}
            className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-teal-600 hover:border-teal-400 flex items-center justify-center cursor-pointer">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && <SupplierChartExpanded name={name} rows={rows} initialPeriod={months === 0 ? 'all' : 'm12'} onClose={() => setExpanded(false)} />}
      {/* بطاقة قيمة الشهر المحدد */}
      <div className="flex items-baseline gap-2 mb-1 tabular-nums">
        <span className="text-[11px] text-slate-400">{cur.full}</span>
        <span className="text-sm font-bold text-slate-900 dark:text-white">{formatNumber(cur.qty)}</span>
        <span className="text-[11px] text-slate-400">{t('common:units.liter')} · {t('profile.tankersTotal', { count: cur.n })}</span>
      </div>
      <div className="flex-1 min-h-0" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 14, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%"
            onMouseMove={(s: { activeTooltipIndex?: number | string | null }) => setHover(typeof s?.activeTooltipIndex === 'number' ? s.activeTooltipIndex : s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
            onMouseLeave={() => setHover(null)}>
            <defs>
              <linearGradient id="sup-bar-soft" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="sup-bar-active" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={1} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis tickLine={false} axisLine={false} width={34} tickCount={5} tickFormatter={compact} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip
              cursor={false}
              // تظهر البطاقة فوق الرسم (لا تحته) حتى لا يقصّها حدّ البطاقة الشخصية
              position={{ y: -150 }}
              allowEscapeViewBox={{ x: false, y: true }}
              wrapperStyle={{ outline: 'none', zIndex: 20 }}
              content={({ active: on, payload }) => {
                if (!on || !payload?.length) return null;
                const p = payload[0].payload as Point;
                const parts = ([
                  { c: 'sahara', q: p.sahara, n: p.saharaN, color: '#d97706' },
                  { c: 'etihad', q: p.etihad, n: p.etihadN, color: '#0284c7' },
                ] as const).filter(x => x.n);
                return (
                  <div dir={i18n.dir()} className="w-[220px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] overflow-hidden text-start">
                    {/* الرأس: الشهر والكمية الكلية وعدد الصهاريج */}
                    <div className="px-3.5 pt-3 pb-2.5 bg-teal-50/70 dark:bg-teal-950/30">
                      <div className="text-[11px] font-medium text-teal-700 dark:text-teal-300">{p.full}</div>
                      <div className="mt-0.5 flex items-baseline gap-1.5 tabular-nums">
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{formatNumber(p.qty)}</span>
                        <span className="text-[11px] text-slate-500">{t('common:units.liter')}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{t('profile.tankersTotal', { count: p.n })}</div>
                    </div>
                    {/* توزيع الشركات المستلمة */}
                    <div className="px-3.5 py-2.5 space-y-2">
                      {parts.map(x => (
                        <div key={x.c} className="text-[12px]">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: x.color }} />
                            <span className="font-medium text-slate-700 dark:text-slate-200">{t(`receiver.${x.c}`)}</span>
                            <span className="ms-auto font-semibold text-slate-900 dark:text-white tabular-nums">{formatNumber(x.q)}</span>
                          </div>
                          <div className="ps-4 text-[10.5px] text-slate-400 tabular-nums">{t('profile.tankersTotal', { count: x.n })}</div>
                        </div>
                      ))}
                    </div>
                    {p.avgPrice > 0 && (
                      <div className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[12px]">
                        <span className="text-slate-500 dark:text-slate-400">{t('profile.avgPrice')}</span>
                        <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{formatNumber(p.avgPrice)} <span className="text-[10.5px] font-normal text-slate-400">{t('units.iqdPerLiter')}</span></span>
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Bar dataKey="qty" radius={[6, 6, 6, 6]} maxBarSize={26} isAnimationActive={false}
              label={({ x, y, width, index }: { x?: number | string; y?: number | string; width?: number | string; index?: number }) =>
                index === active ? (
                  <circle cx={Number(x) + Number(width) / 2} cy={Number(y)} r={4.5} fill="#fff" stroke={ACCENT} strokeWidth={2.5} />
                ) : <g />}>
              {data.map((p, i) => <Cell key={p.key} fill={i === active ? 'url(#sup-bar-active)' : 'url(#sup-bar-soft)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
