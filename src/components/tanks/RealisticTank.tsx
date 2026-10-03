import React from 'react';

/**
 * خزان أسطواني واقعي (SVG): جسم معدني مظلّل، سقف مخروطي، حلقات تدعيم، سلّم جانبي،
 * خط الحد الأدنى، ومسطرة منسوب بالنسب المئوية مع مؤشر المنسوب الحالي.
 * يُستخدم في كشف الخزانات المطبوع وفي كروت الخزانات.
 */
export const RealisticTank: React.FC<{
  percent: number;
  alarmPercent?: number;
  className?: string;
  /** تمديد الرسم ليملأ الأبعاد المحددة (لمطابقة حجم خزان آخر) */
  stretch?: boolean;
}> = ({ percent, alarmPercent = 20, className = 'w-[118px] h-auto', stretch = false }) => {
  const p = Math.min(100, Math.max(0, percent));
  const top = 18, h = 100, cx = 55, rx = 34, ry = 7;
  const surfaceY = top + h - (p / 100) * h;
  const low = p < alarmPercent;
  const fill = low ? '#f59e0b' : '#378ADD';
  const surface = low ? '#fcd34d' : '#85B7EB';
  const bottom = low ? '#b45309' : '#185FA5';
  const id = React.useId().replace(/:/g, '');
  const left = cx - rx, right = cx + rx, base = top + h;
  const alarmY = base - (alarmPercent / 100) * h;
  const shell = `M${left} ${top} V${base} A${rx} ${ry} 0 0 0 ${right} ${base} V${top} Z`;

  return (
    <svg viewBox="0 0 120 142" className={className} preserveAspectRatio={stretch ? 'none' : undefined} aria-hidden="true">
      <defs>
        {/* تظليل أسطواني: إضاءة من اليسار وظل على اليمين */}
        <linearGradient id={`steel-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#9aa3ad" />
          <stop offset="0.18" stopColor="#f4f6f8" />
          <stop offset="0.45" stopColor="#dde2e7" />
          <stop offset="0.85" stopColor="#a7b0ba" />
          <stop offset="1" stopColor="#7d8791" />
        </linearGradient>
        <linearGradient id={`liquid-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor={bottom} />
          <stop offset="0.2" stopColor={surface} />
          <stop offset="0.5" stopColor={fill} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <linearGradient id={`roof-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#8e98a3" />
          <stop offset="0.3" stopColor="#eef1f4" />
          <stop offset="1" stopColor="#7d8791" />
        </linearGradient>
        <clipPath id={`body-${id}`}>
          <path d={shell} />
        </clipPath>
      </defs>

      {/* جسم الخزان المعدني */}
      <path d={shell} fill={`url(#steel-${id})`} stroke="#5b646d" strokeWidth="0.9" />

      {/* السائل */}
      {p > 0 && (
        <g clipPath={`url(#body-${id})`}>
          <rect x={left} y={surfaceY} width={rx * 2} height={base - surfaceY + ry} fill={`url(#liquid-${id})`} opacity="0.95" />
        </g>
      )}
      {p > 0 && <ellipse cx={cx} cy={surfaceY} rx={rx - 0.6} ry={ry - 1} fill={surface} stroke={fill} strokeWidth="0.6" />}

      {/* حلقات التدعيم */}
      {[0.25, 0.5, 0.75].map(f => (
        <path key={f} d={`M${left} ${top + h * f} A${rx} ${ry} 0 0 0 ${right} ${top + h * f}`} fill="none" stroke="#6b747d" strokeWidth="0.5" opacity="0.55" />
      ))}

      {/* خط الحد الأدنى */}
      <path d={`M${left} ${alarmY} A${rx} ${ry} 0 0 0 ${right} ${alarmY}`} fill="none" stroke="#dc2626" strokeWidth="0.9" strokeDasharray="3 2" />

      {/* السقف المخروطي */}
      <path d={`M${left} ${top} Q${cx} ${top - 16} ${right} ${top}`} fill={`url(#roof-${id})`} stroke="#5b646d" strokeWidth="0.9" />
      <ellipse cx={cx} cy={top} rx={rx} ry={ry * 0.45} fill="none" stroke="#5b646d" strokeWidth="0.6" />
      <rect x={cx - 3} y={top - 10} width="6" height="3" rx="1" fill="#6b747d" />

      {/* سلّم جانبي */}
      <g stroke="#4b545c" strokeWidth="0.7">
        <line x1={left + 5} x2={left + 5} y1={top - 1} y2={base + 3} />
        <line x1={left + 10} x2={left + 10} y1={top - 1} y2={base + 3} />
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} x1={left + 5} x2={left + 10} y1={top + 3 + i * 10} y2={top + 3 + i * 10} />
        ))}
      </g>

      {/* مسطرة المنسوب */}
      <line x1={right + 4} x2={right + 4} y1={top} y2={base} stroke="#6b747d" strokeWidth="0.8" />
      {[0, 25, 50, 75, 100].map(f => {
        const y = base - (f / 100) * h;
        return (
          <g key={f}>
            <line x1={right + 4} x2={right + 8} y1={y} y2={y} stroke="#6b747d" strokeWidth="0.8" />
            <text x={right + 10} y={y + 2} fontSize="5.5" fill="#64748b" fontFamily="monospace">{f}</text>
          </g>
        );
      })}
      {/* مؤشر المنسوب الحالي */}
      <path d={`M${right + 1} ${surfaceY} l4 -3 v6 z`} fill={low ? '#dc2626' : '#0f172a'} />
    </svg>
  );
};

export default RealisticTank;
