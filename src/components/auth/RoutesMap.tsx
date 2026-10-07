import React from 'react';
import { useTranslation } from 'react-i18next';
import './auth.css';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// أسماء المناطق في auth:showcase.stations.<key>
const STATIONS = [
  { x: 92, y: 74, key: 'husseiniya' },
  { x: 470, y: 62, key: 'hurr' },
  { x: 498, y: 252, key: 'tuwairij' },
  { x: 104, y: 262, key: 'ainTamr' },
  { x: 300, y: 36, key: 'jadwal' },
];
const DEPOT_1 = { x: 200, y: 160 };
const DEPOT_2 = { x: 380, y: 160 };
const route = (s: { x: number; y: number }, k: number) => {
  const target = k % 2 === 0 ? DEPOT_1 : DEPOT_2;
  const cx = (target.x + s.x) / 2 + (k % 2 ? 40 : -40);
  const cy = (target.y + s.y) / 2 + (k % 2 ? -30 : 30);
  return `M${target.x},${target.y} Q${cx},${cy} ${s.x},${s.y}`;
};

/** خريطة مسارات نقل الوقود (شاشة الدخول في الحاسوب وشاشة الترحيب في الهاتف) */
export const RoutesMap: React.FC<{ className?: string; /** خط أكبر للأسماء (عرض الهاتف الضيق) */ large?: boolean }> = ({ className = '', large }) => {
  const { t } = useTranslation('auth');
  const motion = !reducedMotion();
  const depotFont = large ? 15 : 12;
  const stationFont = large ? 17 : 11;
  return (
    <div className={`auth-glass rounded-2xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-sm font-bold">{t('showcase.routes')}</span>
        <span className="flex items-center gap-3 text-[11px] text-white/65">
          <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-amber-300" /> {t('showcase.tanker')}</span>
          <span className="flex items-center gap-1.5"><i className="w-2 h-2 rounded-full ring-2 ring-teal-300" /> {t('showcase.station')}</span>
        </span>
      </div>
      <svg viewBox="0 0 580 300" className="w-full h-auto" role="img" aria-label={t('showcase.mapLabel')}>
        <defs>
          <radialGradient id="auth-depot" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5eead4" stopOpacity=".55" />
            <stop offset="100%" stopColor="#5eead4" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* طرق خلفية */}
        <path d="M0,210 C120,190 200,240 330,215 S520,150 580,170" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="10" strokeLinecap="round" />
        <path d="M40,0 C90,90 150,140 190,300" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="8" strokeLinecap="round" />
        {STATIONS.map((s, k) => (
          <path key={k} id={`auth-r${k}`} d={route(s, k)} fill="none" stroke="rgba(94,234,212,.45)" strokeWidth="1.6" className="auth-route" />
        ))}
        {/* الشركة الأولى */}
        <circle cx={DEPOT_1.x} cy={DEPOT_1.y} r="34" fill="url(#auth-depot)" />
        <circle cx={DEPOT_1.x} cy={DEPOT_1.y} r="9" fill="#14b8a6" stroke="#ccfbf1" strokeWidth="2.5" />
        <text x={DEPOT_1.x} y={DEPOT_1.y + 28} textAnchor="middle" fill="#fff" fontSize={depotFont} fontWeight="700">{t('showcase.depot')}</text>
        {/* الشركة الثانية */}
        <circle cx={DEPOT_2.x} cy={DEPOT_2.y} r="34" fill="url(#auth-depot)" />
        <circle cx={DEPOT_2.x} cy={DEPOT_2.y} r="9" fill="#14b8a6" stroke="#ccfbf1" strokeWidth="2.5" />
        <text x={DEPOT_2.x} y={DEPOT_2.y + 28} textAnchor="middle" fill="#fff" fontSize={depotFont} fontWeight="700">{t('showcase.depot2')}</text>
        {/* المحطات */}
        {STATIONS.map((s, k) => (
          <g key={s.key}>
            <circle cx={s.x} cy={s.y} r="6" fill="none" stroke="#5eead4" strokeWidth="1.5" className="auth-station-ring" style={{ animationDelay: `${k * 0.45}s` }} />
            <circle cx={s.x} cy={s.y} r="5" fill="#0b3f4a" stroke="#5eead4" strokeWidth="2" />
            <text x={s.x} y={s.y - 12} textAnchor="middle" fill="rgba(255,255,255,.8)" fontSize={stationFont} fontWeight="600">{t(`showcase.stations.${s.key}`)}</text>
          </g>
        ))}
        {/* الصهاريج المتحركة */}
        {STATIONS.map((_, k) => (
          <g key={`t${k}`}>
            <circle r="9" fill="rgba(252,211,77,.22)">
              {motion && <animateMotion dur={`${7 + k * 1.3}s`} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" begin={`${-k * 1.1}s`}><mpath href={`#auth-r${k}`} /></animateMotion>}
            </circle>
            <circle r="4" fill="#fcd34d" stroke="#fff7d6" strokeWidth="1.2">
              {motion && <animateMotion dur={`${7 + k * 1.3}s`} repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" begin={`${-k * 1.1}s`}><mpath href={`#auth-r${k}`} /></animateMotion>}
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
};
