import React, { useMemo, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '../../i18n/format';
import { formatNumber } from '../../lib/utils';
import type { InboundDelivery } from '../../types';
import type { Company } from './supplierUi';

interface Row { d: InboundDelivery; co: Company }
interface Point { key: string; label: string; full: string; qty: number; n: number; sahara: number; etihad: number; saharaN: number; etihadN: number; avgPrice: number }

const MONTHS = 12;
const ACCENT = '#0d9488';
const compact = (v: number) => (v >= 1e6 ? `${Math.round(v / 1e5) / 10}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));
const priceOf = (d: InboundDelivery) => d.productPrice || d.pricePerLiter || 0;

/** أعمدة الوارد الشهري (آخر 12 شهرًا فيها وارد): أعمدة ناعمة متدرجة، وأعلى شهر (أو الذي تمر عليه الفأرة) بلون غامق مع نقطة وقيمته */
export const SupplierMonthlyChart: React.FC<{ rows: Row[] }> = ({ rows }) => {
  const { t } = useTranslation(['suppliers', 'common']);
  const [hover, setHover] = useState<number | null>(null);

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
    const list = [...by.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-MONTHS);
    const multiYear = new Set(list.map(p => p.key.slice(0, 4))).size > 1;
    return list.map(({ cost, pq, ...p }) => {
      const [y, m] = p.key.split('/').map(Number);
      const date = new Date(y, m - 1, 1);
      return { ...p, avgPrice: pq ? Math.round((cost / pq) * 10) / 10 : 0, label: fmtDate(date, multiYear ? { month: 'short', year: '2-digit' } : { month: 'short' }), full: fmtDate(date, { month: 'long', year: 'numeric' }) };
    });
  }, [rows]);

  if (!data.length) return null;
  // الشهر المحدد: الذي تمر عليه الفأرة، وإلا الشهر صاحب أعلى وارد
  const peak = data.reduce((best, p, i) => (p.qty > data[best].qty ? i : best), 0);
  const active = hover ?? peak;
  const cur = data[active];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{t('profile.chartTitle')}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ACCENT }} />{t('profile.chartLegend')}
        </span>
      </div>
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
              content={({ active: on, payload }) => {
                if (!on || !payload?.length) return null;
                const p = payload[0].payload as Point;
                const rowsOf: [string, string][] = [
                  [t('profile.col.qty'), `${formatNumber(p.qty)} ${t('common:units.liter')}`],
                  [t('profile.statTankers'), formatNumber(p.n)],
                  ...(p.saharaN ? [[t('receiver.sahara'), `${formatNumber(p.sahara)} · ${formatNumber(p.saharaN)}`] as [string, string]] : []),
                  ...(p.etihadN ? [[t('receiver.etihad'), `${formatNumber(p.etihad)} · ${formatNumber(p.etihadN)}`] as [string, string]] : []),
                  ...(p.avgPrice ? [[t('profile.avgPrice'), `${formatNumber(p.avgPrice)} ${t('units.iqdPerLiter')}`] as [string, string]] : []),
                ];
                return (
                  <div dir="auto" className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg px-3 py-2 text-xs min-w-[170px]">
                    <div className="font-semibold text-slate-900 dark:text-white mb-1">{p.full}</div>
                    <dl className="space-y-0.5">
                      {rowsOf.map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between gap-4">
                          <dt className="text-slate-400">{k}</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-100 tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
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
