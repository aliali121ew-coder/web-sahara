import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, CornerDownLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFuelNav } from '../../context/FuelDataContext';

/**
 * بحث أقسام الصفحة الرئيسية: يُكتب جزء من اسم القسم فيظهر، والضغط عليه يفتح الرئيسية وينزل إلى القسم.
 * (بدل نافذة الأوامر الكبيرة). معرّفات الأقسام في MainDashboard.tsx.
 */
export const DASHBOARD_SECTIONS = [
  { id: 'dash-sahara-gas', key: 'saharaGas' },
  { id: 'dash-etihad-gas', key: 'etihadGas' },
  { id: 'dash-black-oil', key: 'blackOil' },
  { id: 'dash-petrol', key: 'petrol' },
  { id: 'dash-tanks', key: 'tanks' },
  { id: 'dash-purchases', key: 'purchases' },
  { id: 'dash-prices', key: 'prices' },
] as const;

const norm = (s: string) =>
  s.toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();

/** فتح الرئيسية ثم النزول إلى القسم بعد ظهوره (والتنقل يعيد موضع التمرير للصفحة، فيُنتظر قليلًا) */
const goToSection = (id: string, openDashboard: () => void) => {
  openDashboard();
  const started = performance.now();
  const tryScroll = () => {
    const el = document.getElementById(id);
    if (el && el.offsetParent) {
      window.setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('section-flash');
        window.setTimeout(() => el.classList.remove('section-flash'), 1400);
      }, 150);
      return;
    }
    if (performance.now() - started < 3000) window.setTimeout(tryScroll, 50);
  };
  tryScroll();
};

export const SectionSearch: React.FC<{ open: boolean; onOpen: () => void; onClose: () => void }> = ({ open, onOpen, onClose }) => {
  const { t, i18n } = useTranslation('nav');
  const { setActiveTab } = useFuelNav();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const query = norm(q);
    return DASHBOARD_SECTIONS
      .map(s => ({ ...s, title: t(`sectionSearch.sections.${s.key}.title`), words: t(`sectionSearch.sections.${s.key}.words`) }))
      .filter(s => !query || norm(`${s.title} ${s.words}`).split(' ').some(w => w.startsWith(query)) || norm(s.title).includes(query));
  }, [q, t]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);
  useEffect(() => { setActive(0); }, [q]);

  const pick = (id: string) => {
    onClose();
    goToSection(id, () => setActiveTab('dashboard'));
  };

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="relative w-full ps-9 pe-2.5 h-9 text-sm bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl border border-transparent hover:border-blue-500/40 transition-colors flex items-center text-start cursor-pointer"
      >
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <span className="truncate text-xs">{t('sectionSearch.placeholder')}</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[110]" dir={i18n.dir()} onClick={onClose}>
          <div
            onClick={e => e.stopPropagation()}
            className="absolute top-14 inset-x-3 sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2 rtl:sm:translate-x-1/2 sm:w-[420px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden font-cairo animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="relative border-b border-slate-100 dark:border-slate-800">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') onClose();
                  else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
                  else if (e.key === 'Enter' && items[active]) pick(items[active].id);
                }}
                placeholder={t('sectionSearch.placeholder')}
                className="w-full h-12 ps-10 pe-10 bg-transparent text-sm font-bold text-slate-900 dark:text-white outline-none"
              />
              <button type="button" onClick={onClose} aria-label={t('common:actions.close')} className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto p-1.5">
              {items.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-slate-400">{t('sectionSearch.empty')}</li>
              ) : items.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => pick(s.id)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-start text-sm font-bold cursor-pointer ${i === active ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}
                  >
                    <span className="flex-1 truncate">{s.title}</span>
                    {i === active && <CornerDownLeft className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
