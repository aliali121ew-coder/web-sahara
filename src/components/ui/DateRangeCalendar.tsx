import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '../../i18n/format';

/**
 * تقويم لاختيار فترة (من / إلى): الضغطة الأولى بداية الفترة والثانية نهايتها.
 * التواريخ بصيغة YYYY/MM/DD مثل باقي المنظومة.
 */
const WEEKDAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']; // الأسبوع يبدأ السبت

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('/').map(Number);
  return new Date(y, m - 1, d);
};

/** فترات سريعة: آخر 7 / 30 / 90 يومًا (شاملة اليوم) */
const PRESETS = [7, 30, 90];

export const DateRangeCalendar: React.FC<{
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
  /** اختيار يوم واحد: الضغطة تختار اليوم وتطبّقه مباشرة (بدون فترات سريعة ولا "إلى") */
  single?: boolean;
  /** أيام عليها علامة (مثل الأيام المسجّلة)؛ مع single لا يُختار إلا منها */
  marked?: Set<string>;
}> = ({ from, to, onApply, onClear, single = false, marked }) => {
  const { t, i18n } = useTranslation('common');
  const rtl = i18n.dir() === 'rtl';
  const today = fmt(new Date());
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [hover, setHover] = useState('');
  const [view, setView] = useState(() => {
    const base = from ? parse(from) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 1) % 7; // السبت = 0
    const startDate = new Date(first);
    startDate.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      return { key: fmt(d), day: d.getDate(), inMonth: d.getMonth() === view.getMonth() };
    });
  }, [view]);

  const pick = (key: string) => {
    if (single) {
      onApply(key, key);
      return;
    }
    if (!start || end) {
      setStart(key);
      setEnd('');
    } else if (key < start) {
      setEnd(start);
      setStart(key);
    } else {
      setEnd(key);
    }
  };

  const rangeEnd = end || (start && hover > start ? hover : '');
  const inRange = (k: string) => !!start && !!rangeEnd && k > start && k < rangeEnd;

  const applyPreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    onApply(fmt(d), today);
  };

  const shift = (m: number) => setView(v => new Date(v.getFullYear(), v.getMonth() + m, 1));

  return (
    <div className="w-[300px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden select-none" dir={i18n.dir()}>
      {/* فترات سريعة */}
      <div className={`flex gap-1.5 p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 ${single ? 'hidden' : ''}`}>
        {PRESETS.map(days => (
          <button
            key={days}
            type="button"
            onClick={() => applyPreset(days - 1)}
            className="flex-1 px-1.5 py-1 rounded-lg text-[10.5px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-300 hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer transition-colors"
          >
            {t('calendar.lastDays', { count: days })}
          </button>
        ))}
      </div>

      {/* رأس الشهر */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <button type="button" onClick={() => shift(-1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title={t('calendar.prevMonth')}>
          {rtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <div className="text-sm font-black text-slate-900 dark:text-white">
          {fmtDate(view, { month: 'long' })} <span className="font-mono text-slate-500">{view.getFullYear()}</span>
        </div>
        <button type="button" onClick={() => shift(1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title={t('calendar.nextMonth')}>
          {rtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* الأيام */}
      <div className="px-3 pb-2">
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(w => (
            <div key={w} className="text-center text-[10px] font-bold text-slate-400 py-1">{t(`calendar.weekdays.${w}`)}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => setHover('')}>
          {cells.map(c => {
            const isStart = c.key === start;
            const isEnd = c.key === rangeEnd;
            const band = inRange(c.key);
            const edge = isStart || isEnd;
            const isMarked = !!marked?.has(c.key);
            const blocked = single && !!marked && !isMarked;
            return (
              <div
                key={c.key}
                className={`relative h-9 flex items-center justify-center ${band ? 'bg-purple-100 dark:bg-purple-900/40' : ''} ${
                  isStart && rangeEnd ? 'rtl:bg-gradient-to-l ltr:bg-gradient-to-r from-transparent from-50% to-purple-100 to-50% dark:to-purple-900/40' : ''
                } ${isEnd && start && rangeEnd !== start ? 'rtl:bg-gradient-to-r ltr:bg-gradient-to-l from-transparent from-50% to-purple-100 to-50% dark:to-purple-900/40' : ''}`}
              >
                <button
                  type="button"
                  disabled={blocked}
                  onClick={() => pick(c.key)}
                  onMouseEnter={() => setHover(c.key)}
                  className={`relative w-8 h-8 rounded-full text-xs font-bold font-mono cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                    edge
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30'
                      : band
                        ? 'text-purple-800 dark:text-purple-200'
                        : c.inMonth
                          ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                  } ${c.key === today && !edge ? 'ring-1 ring-purple-400' : ''}`}
                >
                  {c.day}
                  {isMarked && <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${edge ? 'bg-white' : 'bg-teal-500'}`} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* الفترة المختارة + الأزرار */}
      <div className={`px-3 py-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2 ${single ? 'hidden' : ''}`}>
        <div className="grid grid-cols-2 gap-2 text-[10.5px]">
          {[[t('calendar.from'), start], [t('calendar.to'), end]].map(([l, v]) => (
            <div key={l} className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1">
              <span className="text-slate-400 font-bold">{l} </span>
              <span className="font-mono font-black text-slate-800 dark:text-slate-100">{v || '—'}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!start}
            onClick={() => onApply(start, end || start)}
            className="flex-1 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
          >
            {t('calendar.apply')}
          </button>
          <button
            type="button"
            onClick={() => { setStart(today); setEnd(today); setView(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {t('calendar.today')}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 text-xs font-bold cursor-pointer"
          >
            {t('calendar.clear')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateRangeCalendar;
