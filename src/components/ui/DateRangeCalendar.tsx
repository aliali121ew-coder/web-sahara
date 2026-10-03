import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

/**
 * تقويم لاختيار فترة (من / إلى): الضغطة الأولى بداية الفترة والثانية نهايتها.
 * التواريخ بصيغة YYYY/MM/DD مثل باقي المنظومة.
 */
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const WEEKDAYS = ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة']; // الأسبوع يبدأ السبت

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('/').map(Number);
  return new Date(y, m - 1, d);
};

const PRESETS: { label: string; days: number }[] = [
  { label: 'آخر 7 أيام', days: 6 },
  { label: 'آخر 30 يومًا', days: 29 },
  { label: 'آخر 90 يومًا', days: 89 }
];

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
    <div className="w-[300px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden select-none" dir="rtl">
      {/* فترات سريعة */}
      <div className={`flex gap-1.5 p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 ${single ? 'hidden' : ''}`}>
        {PRESETS.map(p => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.days)}
            className="flex-1 px-1.5 py-1 rounded-lg text-[10.5px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-300 hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* رأس الشهر */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <button type="button" onClick={() => shift(-1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="الشهر السابق">
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="text-sm font-black text-slate-900 dark:text-white">
          {MONTHS[view.getMonth()]} <span className="font-mono text-slate-500">{view.getFullYear()}</span>
        </div>
        <button type="button" onClick={() => shift(1)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="الشهر التالي">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* الأيام */}
      <div className="px-3 pb-2">
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(w => (
            <div key={w} className="text-center text-[10px] font-bold text-slate-400 py-1">{w}</div>
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
                  isStart && rangeEnd ? 'bg-gradient-to-l from-transparent from-50% to-purple-100 to-50% dark:to-purple-900/40' : ''
                } ${isEnd && start && rangeEnd !== start ? 'bg-gradient-to-r from-transparent from-50% to-purple-100 to-50% dark:to-purple-900/40' : ''}`}
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
          {[['من', start], ['إلى', end]].map(([l, v]) => (
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
            تطبيق
          </button>
          <button
            type="button"
            onClick={() => { setStart(today); setEnd(today); setView(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            اليوم
          </button>
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 text-xs font-bold cursor-pointer"
          >
            مسح
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateRangeCalendar;
