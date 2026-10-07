import React, { useId } from 'react';
import { COMPANY_COLOR, type Company } from './supplierUi';

/**
 * رسوم مصغّرة لبطاقات صفحة المورد (SVG خفيف بلا recharts).
 * PriceSpark: مسار آخر الأسعار زمنيًا مع شريط المدى (أدنى↔أعلى) وخط المتوسط ونقطة آخر سعر.
 */
export const PriceSpark: React.FC<{ prices: number[]; avg: number; label?: string }> = ({ prices, avg, label }) => {
  const gid = useId().replace(/:/g, '');
  const W = 240, H = 56, PAD = 6;
  if (prices.length < 2) return null;
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (prices.length - 1)) * W;
  // سعر ثابت ⇒ خط في المنتصف
  const y = (v: number) => (hi === lo ? H / 2 : PAD + (1 - (v - lo) / span) * (H - PAD * 2));
  const line = prices.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = `${line}L${W},${H}L0,${H}Z`;
  const last = prices[prices.length - 1], prev = prices[prices.length - 2];
  const up = last > prev, down = last < prev;
  const dot = up ? '#f43f5e' : down ? '#10b981' : '#0d9488';
  const ay = avg ? y(Math.min(hi, Math.max(lo, avg))) : null;
  return (
    // الزمن يسير من اليسار لليمين دائمًا مثل باقي الرسوم
    <div dir="ltr" className="relative" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-14 overflow-visible">
        <defs>
          <linearGradient id={`ps-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* حدود المدى: أعلى (وردي) وأدنى (أخضر) */}
        <line x1="0" x2={W} y1={y(hi)} y2={y(hi)} stroke="#f43f5e" strokeOpacity="0.35" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
        <line x1="0" x2={W} y1={y(lo)} y2={y(lo)} stroke="#10b981" strokeOpacity="0.4" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
        {ay !== null && <line x1="0" x2={W} y1={ay} y2={ay} className="stroke-slate-400 dark:stroke-slate-500" strokeOpacity="0.6" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
        <path d={area} fill={`url(#ps-${gid})`} />
        <path d={line} fill="none" stroke="#0d9488" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* نقطة آخر سعر بـHTML حتى لا تتشوه مع تمدد الـSVG */}
      <span className="absolute w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 -translate-x-1/2 -translate-y-1/2"
        style={{ left: '100%', top: `${(y(last) / H) * 100}%`, background: dot, boxShadow: `0 0 0 4px ${dot}26` }} />
    </div>
  );
};

/** حلقة حصص الشركتين مع الإجمالي في المركز؛ الشركة المختارة تبرز والأخرى تخفت */
export const ShareRing: React.FC<{ counts: Record<Company, number>; active: Company | null; center: React.ReactNode; size?: number }> = ({ counts, active, center, size = 84 }) => {
  const R = 34, C = 2 * Math.PI * R, GAP = 3;
  const total = counts.sahara + counts.etihad;
  const segs = (['sahara', 'etihad'] as Company[]).filter(c => counts[c] > 0);
  let off = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
        <circle cx="42" cy="42" r={R} fill="none" strokeWidth="9" className="stroke-slate-100 dark:stroke-slate-800" />
        {total > 0 && segs.map(c => {
          const len = (counts[c] / total) * C;
          const dash = Math.max(0, len - (segs.length > 1 ? GAP : 0));
          const el = (
            <circle key={c} cx="42" cy="42" r={R} fill="none" stroke={COMPANY_COLOR[c]} strokeWidth="9"
              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off}
              style={{ opacity: !active || active === c ? 1 : 0.25, transition: 'opacity .2s, stroke-dasharray .5s ease' }} />
          );
          off += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">{center}</div>
    </div>
  );
};
