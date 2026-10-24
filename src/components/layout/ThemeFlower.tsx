import React from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import type { BgGradientTheme } from '../../types';

/** ألوان بتلات الثيمات (لون البتلة ولون نصها) */
export const THEME_SWATCHES: { id: BgGradientTheme; color: string; ink: string }[] = [
  { id: 'none', color: '#94a3b8', ink: '#0f172a' },
  { id: 'titanium-slate', color: '#64748b', ink: '#ffffff' },
  { id: 'petrol-blue', color: '#2563eb', ink: '#ffffff' },
  { id: 'frost-snow', color: '#bae6fd', ink: '#0c4a6e' },
  { id: 'emerald-flow', color: '#10b981', ink: '#ffffff' },
  { id: 'glacier-blue', color: '#38bdf8', ink: '#0c4a6e' },
  { id: 'ocean-cyan', color: '#06b6d4', ink: '#ffffff' },
  { id: 'royal-violet', color: '#7c3aed', ink: '#ffffff' },
];
export const swatchOf = (id: BgGradientTheme) => THEME_SWATCHES.find(s => s.id === id) || THEME_SWATCHES[1];

const RADIUS = 96;

/**
 * زهرة الثيمات: بتلات ملونة حول دائرة فيها الفاتح/الليلي.
 * اختيار ثيم يضبطه على الطبقة 1 (ناصعة وهادئة) ويجعل الشريط الجانبي يتبعه تلقائيًا.
 * بدون صلاحية «ضبط المظهر» تظهر دائرة الإضاءة فقط.
 */
export const ThemeFlower: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { t } = useTranslation(['nav', 'settings']);
  const { themeMode, setThemeMode, bgGradient, setBgGradient, setShadeLevel, setSidebarStyle, canCustomize } = useTheme();
  const pick = (id: BgGradientTheme) => {
    setBgGradient(id);
    setShadeLevel(1);
    setSidebarStyle('match-bg');
  };
  return (
    <div
      className={`absolute inset-0 z-20 flex items-center justify-center transition-colors duration-300 ${open ? 'bg-white/80 dark:bg-slate-900/85 backdrop-blur-[2px] pointer-events-auto' : 'pointer-events-none'}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      aria-hidden={!open}
    >
      <div className="relative w-[290px] h-[290px] max-w-full" onMouseLeave={onClose}>
        {canCustomize && THEME_SWATCHES.map((s, i) => {
          const a = i * (360 / THEME_SWATCHES.length);
          const on = bgGradient === s.id;
          return (
            <button
              key={s.id}
              type="button"
              tabIndex={open ? 0 : -1}
              onClick={() => pick(s.id)}
              aria-label={t(`settings:gradients.${s.id}.short`)}
              aria-pressed={on}
              className="absolute left-1/2 top-1/2 w-[74px] h-[74px] -ml-[37px] -mt-[37px] cursor-pointer hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              style={{
                background: s.color,
                borderRadius: '50% 50% 50% 12%',
                transform: `rotate(${a}deg) translateY(${open ? -RADIUS : 0}px) rotate(-45deg) scale(${open ? 1 : 0})`,
                opacity: open ? 1 : 0,
                transition: 'transform 450ms cubic-bezier(.3,1.4,.5,1), opacity 300ms',
                transitionDelay: open ? `${i * 35}ms` : '0ms',
              }}
            >
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-black leading-tight text-center"
                style={{ color: s.ink, transform: `rotate(45deg) rotate(${-a}deg)` }}>
                <span className={`w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm ${on ? '' : 'invisible'}`} style={{ color: s.color === '#bae6fd' ? '#0369a1' : s.color }}>
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </span>
                {t(`settings:gradients.${s.id}.short`)}
              </span>
            </button>
          );
        })}
        <div
          className="absolute left-1/2 top-1/2 w-[104px] h-[104px] -ml-[52px] -mt-[52px] rounded-full bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-700 shadow-lg flex flex-col items-center justify-center gap-1"
          style={{ transform: `scale(${open ? 1 : 0})`, transition: 'transform 350ms cubic-bezier(.3,1.4,.5,1)' }}
        >
          <span className="text-[10.5px] text-slate-400">{t('nav:profile.theme')}</span>
          {canCustomize && <span className="text-xs font-black text-slate-900 dark:text-white">{t(`settings:gradients.${bgGradient}.short`)}</span>}
          <div className="flex gap-1 p-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
            {([['light', Sun], ['dark', Moon]] as const).map(([m, Icon]) => (
              <button key={m} type="button" tabIndex={open ? 0 : -1} onClick={() => setThemeMode(m)} aria-label={t(`nav:profile.${m}`)} aria-pressed={themeMode === m}
                className={`w-7 h-6 rounded-full flex items-center justify-center cursor-pointer ${themeMode === m ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
