/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronLeft } from 'lucide-react';
import { normalizeArabic } from '../../lib/saharaReportFile';

export interface SearchOption {
  vehicle: string;
  /** الاسم المعروض (اسم العربة إن وُجد وإلا رمزها) */
  label: string;
  /** اسم الفئة يظهر بجانبه في البحث العام */
  category?: string;
  total: number;
}

/** ارتفاع سطر النتيجة: تظهر 5 نتائج والباقي بالتمرير */
const ROW = 46;
const VISIBLE = 5;

/**
 * بحث العربات داخل كارت الفئات: القائمة لا تنسدل إلا بعد الكتابة،
 * وتُطابق الرمز أو الاسم، مع التنقل بالأسهم وEnter والإبراز عند المرور.
 */
export const VehicleSearch: React.FC<{ options: SearchOption[]; onOpen: (v: string) => void; placeholder?: string }> = ({ options, onOpen, placeholder = 'ابحث برقم العربة' }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const t = q.trim();
    if (!t) return [];
    const up = t.toUpperCase();
    const ar = normalizeArabic(t);
    return options
      .filter(o => o.vehicle.toUpperCase().includes(up) || o.label.toUpperCase().includes(up) || normalizeArabic(o.label).includes(ar))
      // ما يبدأ بالنص أولًا، ثم الأعلى استهلاكًا
      .sort((a, b) => Number(b.vehicle.toUpperCase().startsWith(up)) - Number(a.vehicle.toUpperCase().startsWith(up)) || b.total - a.total);
  }, [q, options]);

  useEffect(() => setHi(0), [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  // السطر المبرز يبقى ظاهرًا عند التنقل بالأسهم
  useEffect(() => { list.current?.children[hi]?.scrollIntoView({ block: 'nearest' }); }, [hi]);

  const pick = (v: string) => { onOpen(v); setQ(''); setOpen(false); };
  const show = open && q.trim().length > 0;

  return (
    <div ref={box} className="relative w-56 max-w-full" onClick={e => e.stopPropagation()}>
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!show) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(results.length - 1, h + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)); }
          else if (e.key === 'Enter' && results[hi]) { e.preventDefault(); pick(results[hi].vehicle); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
        aria-label="البحث عن عربة"
        className="w-full pr-9 pl-8 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-100 placeholder:font-normal placeholder:text-slate-400 focus:outline-hidden focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all"
      />
      {q && (
        <button type="button" onClick={() => { setQ(''); setOpen(false); }} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" aria-label="مسح">
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {show && (
        <div className="vehicle-page absolute left-0 right-0 top-full mt-2 z-30 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-900/10 overflow-hidden">
          {results.length ? (
            <>
              <ul ref={list} className="overflow-y-auto p-1" style={{ maxHeight: ROW * VISIBLE + 8 }}>
                {results.map((o, i) => (
                  <li key={o.vehicle}>
                    <button
                      type="button"
                      onMouseEnter={() => setHi(i)}
                      onClick={() => pick(o.vehicle)}
                      className={`w-full flex items-center gap-2.5 px-3 rounded-xl text-right transition-colors cursor-pointer ${i === hi ? 'bg-sky-50 dark:bg-sky-950/40' : ''}`}
                      style={{ height: ROW }}
                    >
                      <span className={`w-1.5 h-6 rounded-full shrink-0 transition-colors ${i === hi ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-black truncate ${i === hi ? 'text-sky-700 dark:text-sky-300' : 'text-slate-800 dark:text-slate-100'}`}>{o.label}</span>
                        {o.category && <span className="block text-[10px] font-bold text-slate-400 truncate">{o.category}</span>}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">{o.total.toLocaleString()} L</span>
                      <ChevronLeft className={`w-3.5 h-3.5 shrink-0 transition-opacity ${i === hi ? 'opacity-100 text-sky-500' : 'opacity-0'}`} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400">{results.length} نتيجة · ↑↓ للتنقل · Enter للفتح</div>
            </>
          ) : (
            <div className="px-3 py-4 text-center text-xs font-bold text-slate-400">لا توجد عربة بهذا الرقم</div>
          )}
        </div>
      )}
    </div>
  );
};
