import React, { useId } from 'react';

/** رسوم كروت صفحة المواقع: ملوّنة ومظلّلة لتبدو أقرب للواقع */

type P = { size?: number };

/** بيضة واقعية بتظليل وانعكاس ضوء */
const EggShape: React.FC<{ id: string; x?: number; y?: number; s?: number }> = ({ id, x = 0, y = 0, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <defs>
      <radialGradient id={`${id}e`} cx="38%" cy="32%" r="75%">
        <stop offset="0" stopColor="#fffaf1" />
        <stop offset=".55" stopColor="#f1dfc2" />
        <stop offset="1" stopColor="#c9a47a" />
      </radialGradient>
    </defs>
    <ellipse cx="32" cy="59" rx="16" ry="3" fill="#0f172a" opacity=".12" />
    <path d="M32 5C20 5 12 25 12 38c0 12 9 20 20 20s20-8 20-20C52 25 44 5 32 5Z" fill={`url(#${id}e)`} />
    <ellipse cx="25" cy="22" rx="4.5" ry="8" fill="#fff" opacity=".7" transform="rotate(18 25 22)" />
  </g>
);

export const EggIcon: React.FC<P> = ({ size = 64 }) => {
  const id = useId();
  return <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true"><EggShape id={id} /></svg>;
};

/** دجاجة جانبية؛ الألوان تميّز البيضاء عن البنية */
const Hen: React.FC<{ id: string; tone: 'white' | 'brown' | 'gold' }> = ({ id, tone }) => {
  const body = { white: ['#ffffff', '#e8e1d4'], brown: ['#c2703a', '#7c3a14'], gold: ['#f2b84b', '#a5611c'] }[tone];
  const wing = { white: '#d9cfbd', brown: '#6b2f10', gold: '#9a5418' }[tone];
  return (
    <g>
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={body[0]} />
          <stop offset="1" stopColor={body[1]} />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="60" rx="20" ry="2.6" fill="#0f172a" opacity=".12" />
      {/* الأرجل */}
      <path d="M28 50v8m-3 0h6M37 50v8m-3 0h6" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* الذيل */}
      <path d="M43 30c3-12 13-15 15-8 2 8-3 17-11 19Z" fill={wing} />
      <path d="M45 31c4-8 10-10 11-5" stroke={body[0]} strokeWidth="1.6" fill="none" opacity=".6" strokeLinecap="round" />
      {/* الجسم */}
      <path d="M13 33c0-10 8-14 16-12 9 2 20 4 22 15 2 10-8 16-19 16-12 0-19-8-19-19Z" fill={`url(#${id}b)`} />
      {/* الجناح */}
      <path d="M25 36c4-7 16-7 19 1-4 7-15 8-19-1Z" fill={wing} opacity=".85" />
      <path d="M29 38c3-2 8-2 11 0" stroke={body[0]} strokeWidth="1.2" fill="none" opacity=".5" strokeLinecap="round" />
      {/* الرأس */}
      <circle cx="18" cy="20" r="8.5" fill={`url(#${id}b)`} />
      {/* العُرف والدلاية */}
      <path d="M11 14c0-4 3-5 4.5-2 .5-4 4.5-4.5 5-.5 1.5-3 5-2 3.5 1.5-3 2-8 3-13 1Z" fill="#dc2626" />
      <ellipse cx="11.5" cy="27" rx="2.3" ry="3.2" fill="#dc2626" />
      {/* المنقار والعين */}
      <path d="M10.5 18.5 4 21l6.5 2.5Z" fill="#f59e0b" />
      <circle cx="15.5" cy="18.5" r="1.6" fill="#1f2937" />
      <circle cx="15.1" cy="18" r=".5" fill="#fff" />
    </g>
  );
};

/** دجاجة كاملة؛ الحجم يكبر من البوادي إلى الأجداد */
export const HenIcon: React.FC<P & { tone?: 'white' | 'brown' | 'gold' }> = ({ size = 64, tone = 'white' }) => {
  const id = useId();
  return <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true"><Hen id={id} tone={tone} /></svg>;
};

/** أمهات البياض: دجاجة وبجانبها بيضة */
export const HenEggIcon: React.FC<P> = ({ size = 64 }) => {
  const id = useId();
  return (
    <svg width={size * 1.3} height={size} viewBox="0 0 84 64" aria-hidden="true">
      <Hen id={id} tone="brown" />
      <EggShape id={`${id}g`} x={60} y={36} s={0.38} />
    </svg>
  );
};

/** التسمين: صوص صغير */
export const ChickIcon: React.FC<P> = ({ size = 64 }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}c`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#fff7c2" />
          <stop offset=".6" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#e0a516" />
        </radialGradient>
      </defs>
      <ellipse cx="34" cy="60" rx="16" ry="2.6" fill="#0f172a" opacity=".12" />
      <path d="M30 52v6m-3 0h6M38 52v6m-3 0h6" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="35" cy="40" r="14" fill={`url(#${id}c)`} />
      <path d="M33 41c3-6 12-6 13 1-3 5-10 5-13-1Z" fill="#eab308" opacity=".8" />
      <circle cx="24" cy="25" r="10" fill={`url(#${id}c)`} />
      <path d="M22 15c0-4 3-5 3-2 1-3 4-2 2 1" stroke="#e0a516" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M15 24 9 26.5l6 2Z" fill="#f97316" />
      <circle cx="21" cy="23" r="1.7" fill="#1f2937" />
      <circle cx="20.6" cy="22.5" r=".55" fill="#fff" />
      <circle cx="22" cy="29" r="2" fill="#fb923c" opacity=".35" />
    </svg>
  );
};

/** الطاقة: رمز صاعقة */
export const EnergyIcon: React.FC<P> = ({ size = 64 }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}z`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde047" />
          <stop offset=".5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="60" rx="14" ry="2.6" fill="#0f172a" opacity=".12" />
      <path d="M37 3 13 35h16l-5 22 27-34H35l2-20Z" fill={`url(#${id}z)`} stroke="#c2410c" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M33 10 20 30" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
};

/** المصروف السنوي: أعمدة */
export const AnnualIcon: React.FC<P> = ({ size = 64 }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#818cf8" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="60" rx="20" ry="2.6" fill="#0f172a" opacity=".12" />
      <rect x="10" y="34" width="10" height="22" rx="3" fill={`url(#${id}a)`} opacity=".7" />
      <rect x="27" y="20" width="10" height="36" rx="3" fill={`url(#${id}a)`} />
      <rect x="44" y="8" width="10" height="48" rx="3" fill={`url(#${id}a)`} opacity=".85" />
    </svg>
  );
};
