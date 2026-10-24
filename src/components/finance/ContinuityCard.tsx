import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Link2, ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ContinuityCheck } from '../../lib/reportCheck';
import { fmtNumber } from '../../i18n/format';

const TONE = {
  match: { box: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60', text: 'text-emerald-800 dark:text-emerald-300', icon: ShieldCheck },
  mismatch: { box: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60', text: 'text-rose-700 dark:text-rose-300', icon: ShieldAlert },
  noFileValue: { box: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60', text: 'text-amber-800 dark:text-amber-300', icon: ShieldQuestion },
  noPrevDay: { box: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-300', icon: ShieldQuestion },
} as const;

/**
 * بطاقة التحقق من صحة التقرير: "المدور السابق" في الكشف مقابل "الرصيد الحالي" لليوم السابق في المنظومة.
 * siteName: اسم الموقف (النفط الأسود) لعرض تفصيل كل موقف.
 */
export const ContinuityCard: React.FC<{ check: ContinuityCheck | null; siteName?: (key: string) => string; compact?: boolean }> = ({ check, siteName, compact }) => {
  const { t } = useTranslation('finance');
  if (!check) return null;
  const tone = TONE[check.status];
  const Icon = tone.icon;
  const n = (v: number | null) => (v === null ? '—' : fmtNumber(Math.round(v)));
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-xs ${tone.box}`} role="status">
      <div className={`flex items-center gap-2 font-black ${tone.text}`}>
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1">{t(`check.status.${check.status}`)}</span>
        {check.status === 'mismatch' && (
          <span className="font-mono tabular-nums px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10.5px]" dir="ltr">
            {check.diff > 0 ? '+' : ''}{fmtNumber(check.diff)}
          </span>
        )}
      </div>
      {(check.status === 'match' || check.status === 'mismatch') && !compact && (
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
          <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 border border-white dark:border-slate-800 px-2.5 py-1.5">
            <div className="text-[10.5px] font-bold text-slate-500">{t('check.fileCarried')}</div>
            <div className="font-black font-mono tabular-nums text-slate-900 dark:text-white">{n(check.file)}</div>
          </div>
          <div className={`self-center ${tone.text}`}>{check.status === 'match' ? <Link2 className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}</div>
          <div className="rounded-lg bg-white/80 dark:bg-slate-900/60 border border-white dark:border-slate-800 px-2.5 py-1.5">
            <div className="text-[10.5px] font-bold text-slate-500">{t('check.systemCurrent', { date: check.prevDate })}</div>
            <div className="font-black font-mono tabular-nums text-slate-900 dark:text-white">{n(check.system)}</div>
          </div>
        </div>
      )}
      {check.parts && check.parts.length > 1 && !compact && (
        <ul className="mt-2 space-y-1">
          {check.parts.map(p => (
            <li key={p.key} className="flex items-center gap-2 text-[11px]">
              <span className={`w-1.5 h-1.5 rounded-full ${Math.abs(p.diff) >= 1 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              <span className="font-bold text-slate-700 dark:text-slate-200 flex-1">{siteName?.(p.key) ?? p.key}</span>
              <span className="font-mono tabular-nums text-slate-500">{n(p.file)} / {n(p.system)}</span>
              {Math.abs(p.diff) >= 1 && <span className="font-mono tabular-nums font-black text-rose-600" dir="ltr">{p.diff > 0 ? '+' : ''}{fmtNumber(p.diff)}</span>}
            </li>
          ))}
        </ul>
      )}
      {check.status === 'noFileValue' && check.prevDate && !compact && (
        <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">{t('check.noFileHint', { date: check.prevDate, value: n(check.system) })}</div>
      )}
      {check.status !== 'noPrevDay' && !compact && <div className="mt-1.5 text-[10.5px] text-slate-500">{t('check.logged')}</div>}
    </div>
  );
};
