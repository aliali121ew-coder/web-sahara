import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, Infinity as InfinityIcon, Info, RotateCcw, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { InboundDelivery } from '../../types';
import { computeInboundPriceStats, deliveryDay } from '../../lib/inboundPrice';
import { inAvgPeriod, periodBreakdown, type AvgPricePeriod } from '../../lib/avgPricePeriod';
import { formatNumber } from '../../lib/utils';
import { DateField } from '../ui/DateField';

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;

type PresetKey = 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'all';

/** فترات سريعة (شاملة اليوم) */
const presetRange = (key: PresetKey): AvgPricePeriod | null => {
  const now = new Date();
  const daysAgo = (n: number) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
  switch (key) {
    case 'last7': return { from: fmt(daysAgo(6)), to: fmt(now) };
    case 'last30': return { from: fmt(daysAgo(29)), to: fmt(now) };
    case 'thisMonth': return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
    case 'lastMonth': return { from: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: fmt(new Date(now.getFullYear(), now.getMonth(), 0)) };
    default: return null;
  }
};
const PRESETS: PresetKey[] = ['last7', 'last30', 'thisMonth', 'lastMonth', 'all'];
const samePeriod = (a: AvgPricePeriod | null, b: AvgPricePeriod | null) =>
  (a?.from ?? '') === (b?.from ?? '') && (a?.to ?? '') === (b?.to ?? '');

/**
 * نافذة «متوسط السعر» في صفحة الوارد: تُختار فيها فترة الوارد التي يُحسب منها متوسط السعر،
 * مع معاينة فورية (المتوسط الجديد وفرقه عن الحالي، الكمية والتكلفة والشحنات، وأثر كل مجهز) قبل الاعتماد.
 */
export const AvgPricePeriodModal: React.FC<{
  deliveries: InboundDelivery[];
  period: AvgPricePeriod | null;
  companyLabel: string;
  onApply: (period: AvgPricePeriod | null) => void;
  onClose: () => void;
}> = ({ deliveries, period, companyLabel, onApply, onClose }) => {
  const { t, i18n } = useTranslation(['deliveries', 'common']);
  const [draft, setDraft] = useState<AvgPricePeriod | null>(period);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const current = useMemo(() => computeInboundPriceStats(inAvgPeriod(deliveries, period)), [deliveries, period]);
  const inDraft = useMemo(() => inAvgPeriod(deliveries, draft), [deliveries, draft]);
  const next = useMemo(() => computeInboundPriceStats(inDraft), [inDraft]);
  const { shipments, suppliers } = useMemo(() => periodBreakdown(inDraft), [inDraft]);
  const lastDay = useMemo(() => deliveries.reduce((m, d) => (deliveryDay(d) > m ? deliveryDay(d) : m), ''), [deliveries]);

  const diff = next.avgPrice - current.avgPrice;
  const diffPct = current.avgPrice > 0 ? (diff / current.avgPrice) * 100 : 0;
  const activePreset = PRESETS.find(p => samePeriod(presetRange(p), draft));
  const changed = !samePeriod(draft, period);
  const setEdge = (edge: 'from' | 'to', v: string) => {
    const nextP = { from: draft?.from ?? '', to: draft?.to ?? '', [edge]: v };
    setDraft(nextP.from || nextP.to ? nextP : null);
  };
  const invalid = !!draft?.from && !!draft?.to && draft.from > draft.to;
  // مستمر: من تاريخ معيّن بلا نهاية، فيدخل كل وارد جديد في المتوسط تلقائيًا
  const ongoing = !!draft?.from && !draft.to;
  const toggleOngoing = () => {
    if (ongoing) setDraft({ from: draft!.from, to: lastDay || fmt(new Date()) });
    else setDraft({ from: draft?.from || fmt(new Date()), to: '' });
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6" dir={i18n.dir()}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-150" onClick={onClose} />
      <div role="dialog" aria-label={t('deliveries:avgPeriod.title')} className="relative w-full max-w-[520px] max-h-[92vh] flex flex-col rounded-[22px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* الرأس */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200/70 dark:border-teal-800/50 text-teal-600 dark:text-teal-300 flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-black text-slate-900 dark:text-white">{t('deliveries:avgPeriod.title')}</div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('deliveries:avgPeriod.subtitle', { company: companyLabel })}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common:actions.close')} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
          {/* فترات سريعة */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(p => {
              const on = p === 'all' ? !draft : activePreset === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDraft(presetRange(p))}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${on
                    ? 'bg-teal-600 border-teal-600 text-white shadow-sm shadow-teal-600/25'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-400'}`}
                >
                  {t(`deliveries:avgPeriod.preset.${p}`)}
                </button>
              );
            })}
          </div>

          {/* من / إلى بتقويم البرنامج، و«مستمر» = من تاريخ معيّن حتى آخر وارد دائمًا */}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2.5">
            {(['from', 'to'] as const).map(edge => edge === 'to' && ongoing ? (
              <div key={edge} className="rounded-xl border border-dashed border-teal-300 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20 px-3 py-2">
                <div className="text-[11px] font-bold text-slate-400 mb-0.5">{t('deliveries:avgPeriod.to')}</div>
                <div className="flex items-center gap-1.5 text-sm font-black text-teal-700 dark:text-teal-300">
                  <InfinityIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t('deliveries:avgPeriod.toLatest')}</span>
                </div>
              </div>
            ) : (
              <div key={edge} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 px-3 py-2">
                <div className="text-[11px] font-bold text-slate-400 mb-0.5">{t(`deliveries:avgPeriod.${edge}`)}</div>
                <DateField
                  value={draft?.[edge] ?? ''}
                  onChange={v => setEdge(edge, v)}
                  max={edge === 'from' ? draft?.to || undefined : undefined}
                  min={edge === 'to' ? draft?.from || undefined : undefined}
                  placeholder={edge === 'from' ? t('deliveries:avgPeriod.fromStart') : t('deliveries:avgPeriod.toLatest')}
                  className="w-full text-sm text-slate-800 dark:text-slate-100"
                  iconClassName="text-teal-600 dark:text-teal-400"
                />
              </div>
            ))}
            <button
              type="button"
              role="switch"
              aria-checked={ongoing}
              onClick={toggleOngoing}
              title={t('deliveries:avgPeriod.ongoingHint')}
              className={`rounded-xl border px-3 py-2 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${ongoing
                ? 'border-teal-500 bg-teal-600 text-white shadow-sm shadow-teal-600/25'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-300 hover:border-teal-400'}`}
            >
              <span className={`relative w-8 h-[18px] rounded-full transition-colors ${ongoing ? 'bg-white/35' : 'bg-slate-300 dark:bg-slate-600'}`}>
                <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-all ${ongoing ? 'start-[16px]' : 'start-[2px]'}`} />
              </span>
              <span className="text-[11px] font-black whitespace-nowrap">{t('deliveries:avgPeriod.ongoing')}</span>
            </button>
          </div>
          {ongoing && (
            <div className="-mt-2 text-[11px] font-bold text-teal-700 dark:text-teal-300">{t('deliveries:avgPeriod.ongoingHint')}</div>
          )}

          {/* المعاينة */}
          <div className="rounded-2xl border border-teal-200/70 dark:border-teal-800/50 bg-gradient-to-br from-teal-50/80 to-white dark:from-teal-950/30 dark:to-slate-900 p-3.5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{t('deliveries:avgPeriod.newAvg')}</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[30px] leading-tight font-black font-mono tabular-nums text-teal-700 dark:text-teal-300">{next.avgPrice > 0 ? next.avgPrice.toFixed(1) : '—'}</span>
                <span className="text-[11px] font-bold text-slate-400">{t('deliveries:avgPeriod.perLiter')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <span>{t('deliveries:avgPeriod.currentAvg')} <span className="font-mono text-slate-700 dark:text-slate-200">{current.avgPrice > 0 ? current.avgPrice.toFixed(1) : '—'}</span></span>
                {changed && next.avgPrice > 0 && current.avgPrice > 0 && Math.abs(diff) >= 0.05 && (
                  <span dir="ltr" className={`inline-flex items-center gap-0.5 font-mono ${diff > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {diff > 0 ? '+' : '−'}{Math.abs(diff).toFixed(1)} ({diff > 0 ? '+' : '−'}{Math.abs(diffPct).toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 space-y-0.5 text-end">
              <div>{t('deliveries:avgPeriod.qty')} <span className="font-mono font-black text-slate-800 dark:text-slate-100">{formatNumber(Math.round(next.totalQty))}</span> {t('common:units.liter')}</div>
              <div>{t('deliveries:avgPeriod.cost')} <span className="font-mono font-black text-slate-800 dark:text-slate-100">{formatNumber(Math.round(next.totalCost))}</span> {t('common:units.iqd')}</div>
              <div>{t('deliveries:avgPeriod.shipments')} <span className="font-mono font-black text-slate-800 dark:text-slate-100">{shipments}</span> · {t('deliveries:avgPeriod.suppliers')} <span className="font-mono font-black text-slate-800 dark:text-slate-100">{suppliers.length}</span></div>
            </div>
          </div>

          {/* أثر كل مجهز */}
          {suppliers.length > 0 ? (
            <div>
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t('deliveries:avgPeriod.bySupplier')}</div>
              <div className="space-y-1.5">
                {suppliers.slice(0, 6).map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="w-[38%] min-w-0 truncate font-bold text-slate-700 dark:text-slate-200" title={s.name}>{s.name}</span>
                    <span className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <span className="block h-full rounded-full bg-teal-500" style={{ width: `${Math.max(3, s.share)}%` }} />
                    </span>
                    <span className="w-10 text-end font-mono font-bold text-slate-500 dark:text-slate-400">{Math.round(s.share)}%</span>
                    <span className="w-12 text-end font-mono font-black text-slate-800 dark:text-slate-100">{s.price.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 py-4 text-center text-xs font-bold text-slate-400">
              {t('deliveries:avgPeriod.empty')}
            </div>
          )}

          <div className="flex items-start gap-1.5 text-[11px] font-semibold text-slate-400">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{t('deliveries:avgPeriod.note', { day: lastDay || '—' })}</span>
          </div>
        </div>

        {/* الأزرار */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900">
          <button
            type="button"
            disabled={invalid || !changed}
            onClick={() => { onApply(draft); onClose(); }}
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black shadow-md shadow-teal-600/20 active:scale-95 transition-all cursor-pointer"
          >
            {t('deliveries:avgPeriod.apply')}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer">
            {t('common:actions.cancel')}
          </button>
          {period && (
            <button
              type="button"
              onClick={() => { onApply(null); onClose(); }}
              className="ms-auto inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('deliveries:avgPeriod.reset')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
