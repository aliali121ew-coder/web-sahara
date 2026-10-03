import React from 'react';

/**
 * 🌟 TankGlobalSvgDefs - تعريفات الـ SVG المركزية الموحدة
 * توفر التدرجات وظلال الإسقاط لمرة واحدة فقط في الـ DOM لمنع تكرار الـ Shaders
 * وتحقيق سرعة رسم فائقة (Zero Redundant GPU Shaders) وثبات 120 FPS.
 */
export const TankGlobalSvgDefs: React.FC = () => {
  return (
    <svg className="absolute w-0 h-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <defs>
        {/* 3D Precision Cylindrical Stainless Steel Gradient */}
        <linearGradient id="tank-pipe-stainless-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="12%" stopColor="#475569" />
          <stop offset="28%" stopColor="#cbd5e1" />
          <stop offset="42%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#cbd5e1" />
          <stop offset="82%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        {/* Forged Flange Metallic Gradient */}
        <linearGradient id="tank-flange-metallic-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="25%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#f8fafc" />
          <stop offset="75%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        {/* Ambient Pipe Drop Shadow onto Tank Hull */}
        <filter id="tank-pipe-drop-shadow" x="-40%" y="-10%" width="180%" height="120%">
          <feDropShadow dx="-2" dy="2.5" stdDeviation="2.2" floodColor="#000000" floodOpacity="0.65" />
        </filter>
      </defs>
    </svg>
  );
};
