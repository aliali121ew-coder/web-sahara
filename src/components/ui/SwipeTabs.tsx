import React, { useRef, useState } from 'react';

export interface SwipeTab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number;
  content: React.ReactNode;
}

/**
 * تبويبات يُتنقّل بينها بالضغط أو بالسحب أفقيًا (لمس) أو بأسهم لوحة المفاتيح.
 * يُعرض التبويب النشط فقط (ارتفاع الصفحة يتبع محتواه)، مع حركة انزلاق باتجاه التنقل.
 * الاتجاه عربي: التبويب التالي على اليسار، فالسحب من اليسار إلى اليمين ينقل للتالي.
 */
export const SwipeTabs: React.FC<{ tabs: SwipeTab[]; active: string; onChange: (id: string) => void }> = ({ tabs, active, onChange }) => {
  const index = Math.max(0, tabs.findIndex(t => t.id === active));
  const [dir, setDir] = useState<1 | -1>(1);
  const start = useRef<{ x: number; y: number } | null>(null);

  const go = (i: number) => {
    if (i < 0 || i >= tabs.length || i === index) return;
    setDir(i > index ? 1 : -1);
    onChange(tabs[i].id);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    // سحب أفقي واضح فقط، حتى لا يتعارض مع التمرير العمودي
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(index + (dx > 0 ? 1 : -1));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(index + 1);
    else if (e.key === 'ArrowRight') go(index - 1);
  };

  return (
    <div>
      {/* شريط التبويبات مع مؤشر منزلق */}
      <div role="tablist" onKeyDown={onKeyDown}
        className="relative grid gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        <span aria-hidden
          className="absolute top-1 bottom-1 rounded-xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-700 transition-all duration-300 ease-out"
          style={{ width: `calc((100% - 0.5rem) / ${tabs.length})`, right: `calc(0.25rem + (100% - 0.5rem) / ${tabs.length} * ${index})` }} />
        {tabs.map((t, i) => {
          const Icon = t.icon;
          const on = i === index;
          return (
            <button key={t.id} role="tab" aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => go(i)}
              className={`relative z-10 h-11 rounded-xl px-2 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold transition-colors ${on ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              {/* على الشاشات الضيقة: التبويب النشط يعرض اسمه، والبقية أيقونة فقط */}
              <span className={`truncate ${on || !Icon ? '' : 'sr-only sm:not-sr-only'}`}>{t.label}</span>
              {!!t.badge && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* نقاط الموضع (تلميح للسحب على الجوال) */}
      <div className="flex justify-center gap-1.5 mt-2 sm:hidden" aria-hidden>
        {tabs.map((t, i) => (
          <span key={t.id} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-blue-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`} />
        ))}
      </div>

      <div role="tabpanel" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="mt-4 overflow-hidden" style={{ touchAction: 'pan-y' }}>
        <div key={tabs[index].id} className={dir === 1 ? 'swipe-in-next' : 'swipe-in-prev'}>
          {tabs[index].content}
        </div>
      </div>
    </div>
  );
};
