import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DateRangeCalendar } from './DateRangeCalendar';

/** أي صيغة تاريخ (YYYY/MM/DD أو YYYY-MM-DD) إلى صيغة التقويم YYYY/MM/DD */
const toSlash = (v?: string) => (v || '').trim().split(' ')[0].split('T')[0].replace(/-/g, '/');

/**
 * خانة تاريخ موحّدة للبرنامج: زر يعرض التاريخ ويفتح تقويم البرنامج (نفس تقويم الأرشيف) لاختيار يوم واحد.
 * بديل خانة المتصفح type="date" التي يختلف شكلها بين الأجهزة.
 * format: صيغة القيمة التي يرسلها onChange كما تتوقعها الصفحة (slash = YYYY/MM/DD، dash = YYYY-MM-DD).
 */
export const DateField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  format?: 'slash' | 'dash';
  min?: string;
  max?: string;
  /** أيام عليها علامة (الأيام المسجّلة مثلًا) */
  marked?: Set<string>;
  /** يمنع اختيار غير الأيام المعلّمة */
  onlyMarked?: boolean;
  className?: string;
  iconClassName?: string;
  placeholder?: string;
  ariaLabel?: string;
  /** محتوى الزر بدل التاريخ والأيقونة (لتصاميم خاصة) */
  children?: React.ReactNode;
  disabled?: boolean;
}> = ({ value, onChange, format = 'slash', min, max, marked, onlyMarked = false, className = '', iconClassName = 'text-slate-400', placeholder, ariaLabel, children, disabled }) => {
  const { i18n } = useTranslation('common');
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // مخفي وثابت قبل القياس: بدون position:fixed يمتد الغلاف بعرض الصفحة فيُحسب الموضع خطأ (يلتصق بطرف الشاشة)
  const HIDDEN: React.CSSProperties = { position: 'fixed', top: 0, left: 0, visibility: 'hidden' };
  const [style, setStyle] = useState<React.CSSProperties>(HIDDEN);
  const current = toSlash(value);

  // الموضع: تحت الزر، ويفتح للأعلى إن لم تكفِ المساحة، ومحصور داخل الشاشة
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      const pop = popRef.current;
      if (!b || !pop) return;
      const h = pop.offsetHeight, w = pop.offsetWidth, gap = 8, vw = window.innerWidth, vh = window.innerHeight;
      const below = vh - b.bottom - gap, above = b.top - gap;
      const top = h <= below || below >= above ? b.bottom + gap : Math.max(gap, b.top - gap - h);
      const start = i18n.dir() === 'rtl' ? b.right - w : b.left;
      setStyle({ position: 'fixed', top, left: Math.min(Math.max(gap, start), vw - w - gap) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, i18n]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  const apply = (d: string) => {
    onChange(format === 'dash' ? d.replace(/\//g, '-') : d);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setStyle(HIDDEN); setOpen(o => !o); }}
        className={`inline-flex items-center gap-2 cursor-pointer disabled:cursor-default disabled:opacity-60 ${className}`}
      >
        {children ?? (
          <>
            <CalendarDays className={`w-4 h-4 shrink-0 ${iconClassName}`} />
            <span className={`font-mono font-bold ${current ? '' : 'text-slate-400'}`} dir="ltr">{current || placeholder || 'YYYY/MM/DD'}</span>
          </>
        )}
      </button>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[300]" onClick={() => setOpen(false)} />
          <div ref={popRef} style={style} className="z-[301] w-max animate-in zoom-in-95 duration-150" dir={i18n.dir()} role="dialog">
            <DateRangeCalendar
              single
              from={current}
              to={current}
              marked={onlyMarked ? marked : undefined}
              min={min ? toSlash(min) : undefined}
              max={max ? toSlash(max) : undefined}
              onApply={apply}
              onClear={() => setOpen(false)}
            />
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default DateField;
