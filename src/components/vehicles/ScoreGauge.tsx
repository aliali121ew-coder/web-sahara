import React from 'react';

/** عدّاد نصف دائري لمؤشر الانضباط (0–100) */
export const ScoreGauge: React.FC<{ score: number; grade: string }> = ({ score, grade }) => {
  const r = 70;
  const len = Math.PI * r;
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#38bdf8' : score >= 50 ? '#f59e0b' : '#f43f5e';
  const a = Math.PI * (1 - score / 100);
  return (
    <div className="relative w-full max-w-[220px] mx-auto">
      <svg viewBox="0 0 180 104" className="w-full" role="img" aria-label={`${score} / 100`}>
        <defs>
          <linearGradient id="vgauge" x1="0" x2="1">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="75%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path d={`M20 92 A${r} ${r} 0 0 1 160 92`} fill="none" stroke="rgb(148 163 184 / 0.2)" strokeWidth="14" strokeLinecap="round" />
        <path
          d={`M20 92 A${r} ${r} 0 0 1 160 92`}
          fill="none"
          stroke="url(#vgauge)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - score / 100)}
          className="vehicle-gauge"
        />
        <circle cx={90 + r * Math.cos(a)} cy={92 - r * Math.sin(a)} r="8" fill="white" stroke={color} strokeWidth="4" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-4xl font-black font-mono leading-none" style={{ color }}>{score}</div>
        <div className="text-xs font-black mt-1" style={{ color }}>{grade}</div>
      </div>
    </div>
  );
};
