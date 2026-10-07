import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface NavPoint {
  key: string;
  label: string;
  inbound: number;
}

interface Props {
  /** كل النقاط بترتيب العرض (الفهرس 0 = أقصى اليسار) */
  data: NavPoint[];
  start: number;
  end: number;
  /** null = الفترة كاملة */
  onChange: (win: { start: number; end: number } | null) => void;
  /** إزاحة يسار/يمين لمحاذاة مساحة الرسم فوقه (هوامش الرسم + عرض المحور) */
  insetLeft?: number;
  insetRight?: number;
}

type DragMode = 'left' | 'right' | 'window';

/**
 * شريط تنقل احترافي (Navigator): أعمدة مصغرة لكل الفترة، ونافذة مختارة بمقبضين.
 * السحب: المقابض تغيّر الطول، النافذة تتحرك كاملة، النقر خارجها ينقلها، والنقر المزدوج يعيد الفترة كاملة.
 */
export const RangeNavigator: React.FC<Props> = ({ data, start, end, onChange, insetLeft = 0, insetRight = 0 }) => {
  const { t } = useTranslation('prices');
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: DragMode; grab: number; s: number; e: number } | null>(null);
  const [dragging, setDragging] = useState<DragMode | null>(null);
  const n = data.length;
  const max = useMemo(() => Math.max(1, ...data.map(d => d.inbound)), [data]);
  const full = start === 0 && end === n - 1;

  const idxAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.floor(((clientX - r.left) / r.width) * n)));
  };
  const emit = (s: number, e: number) => onChange(s === 0 && e === n - 1 ? null : { start: s, end: e });

  const onPointerDown = (e: React.PointerEvent, mode?: DragMode) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const i = idxAt(e.clientX);
    let m = mode;
    if (!m) {
      if (i >= start && i <= end) m = 'window';
      else {
        // النقر خارج النافذة: نقلها لتتمركز عند النقطة
        const len = end - start;
        const s = Math.max(0, Math.min(n - 1 - len, i - Math.floor(len / 2)));
        emit(s, s + len);
        m = 'window';
        drag.current = { mode: m, grab: i, s, e: s + len };
        setDragging(m);
        trackRef.current?.setPointerCapture(e.pointerId);
        return;
      }
    }
    drag.current = { mode: m, grab: i, s: start, e: end };
    setDragging(m);
    trackRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const i = idxAt(e.clientX);
    if (d.mode === 'left') emit(Math.min(i, d.e), d.e);
    else if (d.mode === 'right') emit(d.s, Math.max(i, d.s));
    else {
      const len = d.e - d.s;
      const s = Math.max(0, Math.min(n - 1 - len, d.s + (i - d.grab)));
      emit(s, s + len);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    drag.current = null;
    setDragging(null);
    trackRef.current?.releasePointerCapture(e.pointerId);
  };

  // لوحة المفاتيح: الأسهم تحرك النافذة، Home/End للأطراف
  const onKeyDown = (e: React.KeyboardEvent) => {
    const len = end - start;
    if (e.key === 'ArrowLeft' && start > 0) emit(start - 1, end - 1);
    else if (e.key === 'ArrowRight' && end < n - 1) emit(start + 1, end + 1);
    else if (e.key === 'Home') emit(0, len);
    else if (e.key === 'End') emit(n - 1 - len, n - 1);
    else return;
    e.preventDefault();
  };

  if (n < 3) return null;
  const leftPct = (start / n) * 100;
  const widthPct = ((end - start + 1) / n) * 100;
  const rightPct = 100 - leftPct - widthPct;

  const handle = (side: 'left' | 'right') => (
    <div
      onPointerDown={e => { e.stopPropagation(); onPointerDown(e, side); }}
      className={`absolute top-1/2 -translate-y-1/2 ${side === 'left' ? '-left-[7px]' : '-right-[7px]'} z-20 w-3.5 h-8 rounded-full bg-white dark:bg-slate-200 shadow-md ring-1 ${
        dragging === side ? 'ring-teal-500 scale-110' : 'ring-slate-300 dark:ring-slate-500 hover:ring-teal-500'
      } flex items-center justify-center gap-[2px] cursor-ew-resize transition-transform`}
      role="slider"
      aria-label={t(side === 'left' ? 'navigator.start' : 'navigator.end')}
    >
      <span className="w-px h-3.5 bg-slate-400 rounded" />
      <span className="w-px h-3.5 bg-slate-400 rounded" />
    </div>
  );

  return (
    <div className="select-none" style={{ marginLeft: insetLeft, marginRight: insetRight }}>
      <div
        ref={trackRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={e => onPointerDown(e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => onChange(null)}
        title={t('navigator.hint')}
        className="relative h-11 rounded-xl bg-slate-50 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-slate-700/80 outline-none focus-visible:ring-2 focus-visible:ring-teal-500 touch-none"
      >
        {/* الأعمدة المصغرة */}
        <div className="absolute inset-x-0 bottom-1 top-1.5 flex items-end gap-px px-px">
          {data.map((d, i) => {
            const inWin = i >= start && i <= end;
            return (
              <div
                key={d.key}
                className={`flex-1 rounded-t-[2px] transition-colors ${inWin ? 'bg-teal-500/80 dark:bg-teal-400/80' : 'bg-slate-300/80 dark:bg-slate-600/70'}`}
                style={{ height: d.inbound > 0 ? `${Math.max(6, (d.inbound / max) * 100)}%` : '2px' }}
              />
            );
          })}
        </div>
        {/* تعتيم ما خارج النافذة */}
        <div className="absolute inset-y-0 left-0 rounded-s-xl bg-white/55 dark:bg-slate-900/55 pointer-events-none" style={{ width: `${leftPct}%` }} />
        <div className="absolute inset-y-0 right-0 rounded-e-xl bg-white/55 dark:bg-slate-900/55 pointer-events-none" style={{ width: `${rightPct}%` }} />
        {/* النافذة المختارة */}
        <div
          className={`absolute inset-y-0 z-10 rounded-lg border-2 ${full ? 'border-teal-500/40' : 'border-teal-500'} bg-teal-500/[0.06] ${dragging === 'window' ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        >
          {handle('left')}
          {handle('right')}
        </div>
      </div>
      {/* شارات التواريخ تحت المقبضين (شارة واحدة مدمجة إذا كانت النافذة ضيقة) */}
      <div className="relative h-6 mt-1 text-[10px] font-mono font-bold">
        {(widthPct < 14 ? [{ pos: leftPct + widthPct / 2, text: start === end ? data[start]?.label : `${data[start]?.label} — ${data[end]?.label}` }] : [
          { pos: leftPct, text: data[start]?.label },
          { pos: leftPct + widthPct, text: data[end]?.label }
        ]).map((l, i) => (
          <span
            key={i}
            className={`absolute top-0 -translate-x-1/2 px-1.5 py-0.5 rounded-md whitespace-nowrap ${full ? 'text-slate-400' : 'bg-teal-600 text-white shadow-sm'}`}
            style={{ left: `clamp(40px, ${l.pos}%, calc(100% - 40px))` }}
          >
            {l.text}
          </span>
        ))}
      </div>
    </div>
  );
};

export default RangeNavigator;
