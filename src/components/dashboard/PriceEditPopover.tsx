import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap, PenLine, RotateCcw, Check, Truck, Info } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { formatNumber } from '../../lib/utils';

export interface PriceDay {
  date: string;
  price: number;
  qty: number;
}

interface Props {
  /** مكان الكارت على الشاشة: النافذة تنفتح منه وفوقه */
  anchor: DOMRect;
  title: string;
  company: string;
  icon: React.ElementType;
  iconClass: string;
  /** السعر المعروض الآن (يدوي أو تلقائي) */
  price: number;
  /** السعر التلقائي من الوارد (null = لا يوجد وارد مسعّر لهذا المنتج) */
  autoPrice: number | null;
  autoDate: string | null;
  /** أيام الوارد المسعّرة (الأحدث أولًا) */
  days: PriceDay[];
  /** السعر اليدوي الساري (null = تلقائي) */
  manual: { price: number; setAt: string } | null;
  onSave: (price: number) => void;
  onReset: () => void;
  onClose: () => void;
}

const WIDTH = 360;
const EST_HEIGHT = 470;

/** نافذة سعر المنتج: تنفتح في مكان الكارت بحركة تكبير، وفيها تعديل السعر يدويًا أو إرجاعه للتلقائي */
export const PriceEditPopover: React.FC<Props> = ({ anchor, title, company, icon: Icon, iconClass, price, autoPrice, autoDate, days, manual, onSave, onReset, onClose }) => {
  const { tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(price));
  const inputRef = useRef<HTMLInputElement>(null);

  // الموضع: متمركز على الكارت أفقيًا، ويبدأ من أعلاه، ومحصور داخل الشاشة
  const vw = window.innerWidth, vh = window.innerHeight;
  const width = Math.min(Math.max(WIDTH, anchor.width * 1.35), vw - 24);
  const left = Math.min(Math.max(12, anchor.left + anchor.width / 2 - width / 2), vw - width - 12);
  const top = Math.min(Math.max(12, anchor.top - 16), Math.max(12, vh - EST_HEIGHT - 12));
  // نقطة الانطلاق = مركز الكارت، ومقياس البداية = حجم الكارت
  const origin = `${anchor.left + anchor.width / 2 - left}px ${anchor.top + anchor.height / 2 - top}px`;
  const startScale = Math.min(1, anchor.width / width);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = () => {
    setOpen(false);
    setTimeout(onClose, 180);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const num = Number(value.replace(/[^\d.]/g, ''));
  const valid = num > 0;
  const save = () => {
    if (!valid) return;
    onSave(Math.round(num * 100) / 100);
    setEditing(false);
  };
  const diffVsAuto = autoPrice && price ? ((price - autoPrice) / autoPrice) * 100 : null;
  const maxQty = Math.max(1, ...days.map(d => d.qty));

  return createPortal(
    <>
      <div className={`fixed inset-0 z-[180] bg-slate-900/10 backdrop-blur-[2px] transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={close} />
      <div
        dir="rtl"
        role="dialog"
        aria-label={tr(title)}
        className="fixed z-[181] rounded-[22px] bg-[#fcfdff] dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.35)] overflow-hidden"
        style={{
          top, left, width,
          transformOrigin: origin,
          transform: open ? 'scale(1)' : `scale(${startScale})`,
          opacity: open ? 1 : 0,
          transition: 'transform 320ms cubic-bezier(0.2, 0.9, 0.25, 1.15), opacity 200ms ease-out'
        }}
      >
        {/* الرأس */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${iconClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-black text-slate-900 dark:text-white truncate">{tr(title)}</div>
              <div className="text-[11px] font-bold text-slate-400">{tr(company)}</div>
            </div>
          </div>
          <button type="button" onClick={close} aria-label={tr('إغلاق')} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* السعر الحالي ومصدره */}
        <div className="mx-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{tr('سعر اللتر المعتمد')}</span>
            {manual ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[10.5px] font-black ring-1 ring-amber-200 dark:ring-amber-900">
                <PenLine className="w-3 h-3" />{tr('يدوي')}
              </span>
            ) : autoPrice ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10.5px] font-black ring-1 ring-emerald-200 dark:ring-emerald-900">
                <Zap className="w-3 h-3" />{tr('تلقائي من الوارد')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10.5px] font-black">
                {tr('من جدول الموردين')}
              </span>
            )}
          </div>

          {editing ? (
            <div className="mt-2 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
              <input
                ref={inputRef}
                inputMode="decimal"
                dir="ltr"
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); } }}
                className="flex-1 min-w-0 h-11 px-3 rounded-xl border-2 border-teal-500 bg-white dark:bg-slate-900 text-2xl font-black font-mono text-slate-900 dark:text-white outline-none"
              />
              <span className="text-xs font-bold text-slate-400">{tr('د.ع')}</span>
              <button type="button" onClick={save} disabled={!valid} className="h-11 w-11 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all" title={tr('حفظ')}>
                <Check className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-end justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white">{formatNumber(price)}</span>
                <span className="text-xs font-bold text-slate-400">{tr('د.ع')}</span>
              </div>
              <button
                type="button"
                onClick={() => { setValue(String(price)); setEditing(true); }}
                className="mb-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-teal-400 hover:text-teal-700 cursor-pointer active:scale-95 transition-all"
              >
                <PenLine className="w-3.5 h-3.5" />{tr('تعديل السعر')}
              </button>
            </div>
          )}

          {/* المقارنة بالتلقائي عند السعر اليدوي */}
          {manual && autoPrice !== null && (
            <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">{tr('السعر من الوارد')}: <b className="font-mono text-slate-800 dark:text-slate-200">{formatNumber(autoPrice)}</b></span>
              {diffVsAuto !== null && Math.abs(diffVsAuto) >= 0.05 && (
                <span dir="ltr" className={`font-mono font-bold ${diffVsAuto > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{diffVsAuto > 0 ? '+' : ''}{diffVsAuto.toFixed(1)}%</span>
              )}
            </div>
          )}
        </div>

        {/* ملاحظة سلوك التحديث */}
        <div className="mx-4 mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          {manual
            ? <span>{tr('السعر اليدوي يبقى حتى أول عملية وارد جديدة، ثم يعود تلقائيًا من الوارد.')}</span>
            : <span>{tr('يُحدَّث تلقائيًا مع كل عملية وارد جديدة (متوسط موزون لآخر يوم وارد).')}{autoDate ? <> {tr('آخر وارد')}: <b className="font-mono">{autoDate}</b></> : null}</span>}
        </div>

        {/* آخر أيام الوارد */}
        <div className="mx-4 mt-3">
          <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 dark:text-slate-200 mb-1.5">
            <Truck className="w-3.5 h-3.5 text-slate-400" />{tr('آخر أيام الوارد')}
          </div>
          {days.length === 0 ? (
            <div className="text-[11px] text-slate-400 py-3 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40">{tr('لا يوجد وارد مسعّر لهذا المنتج بعد')}</div>
          ) : (
            <div className="space-y-1">
              {days.slice(0, 5).map((d, i) => {
                const prev = days[i + 1];
                const ch = prev ? ((d.price - prev.price) / prev.price) * 100 : null;
                return (
                  <div
                    key={d.date}
                    className="grid grid-cols-[76px_1fr_auto_52px] items-center gap-2 text-[11px] animate-in fade-in slide-in-from-bottom-1 fill-mode-both"
                    style={{ animationDelay: `${120 + i * 45}ms`, animationDuration: '260ms' }}
                  >
                    <span className="font-mono text-slate-500">{d.date.slice(2)}</span>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" title={`${formatNumber(d.qty)} ${tr('لتر')}`}>
                      <div className="h-full rounded-full bg-slate-300 dark:bg-slate-600" style={{ width: `${Math.max(6, (d.qty / maxQty) * 100)}%` }} />
                    </div>
                    <span className="font-mono font-black text-slate-900 dark:text-white">{formatNumber(d.price)}</span>
                    <span dir="ltr" className={`text-left font-mono text-[10px] font-bold ${ch === null || Math.abs(ch) < 0.05 ? 'text-slate-400' : ch > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {ch === null ? '—' : `${ch > 0 ? '▲' : ch < 0 ? '▼' : '•'}${Math.abs(ch).toFixed(1)}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* الأزرار */}
        <div className="mt-3.5 px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          {manual ? (
            <button type="button" onClick={onReset} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" />{tr('رجوع للسعر التلقائي')}
            </button>
          ) : <span />}
          <button type="button" onClick={close} className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer active:scale-95 transition-all">
            {tr('تم')}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
};

export default PriceEditPopover;
