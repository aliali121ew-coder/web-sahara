import React from 'react';
import { Lock, Edit3, Trash2, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../lib/utils';
import { TankUnitRow } from './TanksOverview';

export interface CalculatedTankUnit extends TankUnitRow {
  fillPercent: number;
  currentStoredLiters: number;
  theme: {
    status: string;
    /** مفتاح ترجمة: tanks:level.<statusLabel> */
    statusLabel: string;
    gradientFrom: string;
    gradientVia: string;
    gradientTo: string;
    fluidColor: string;
    fluidGlow: string;
    waveColor: string;
    textColor: string;
    badgeClass: string;
  };
}

interface Tank3DCardProps {
  tank: CalculatedTankUnit;
  onLevelChange: (id: string, newLevel: number) => void;
  isEditable?: boolean;
  onEdit?: (tank: CalculatedTankUnit) => void;
  onDelete?: (tank: CalculatedTankUnit) => void;
  onToggleHidden?: (id: string) => void;
  /** خزان مجمّع (قسم كامل) للعرض فقط: تُعرض نسبة الامتلاء بدل حقل المنسوب */
  summary?: boolean;
}

// جسم معدني فضي فاتح لكل الخزانات (في الوضعين الفاتح والداكن)، والسائل يبقى بلون حالته
const steelBody: React.CSSProperties = {
  background: 'linear-gradient(to right, #9aa3ad, #f4f6f8 18%, #dde2e7 45%, #a7b0ba 85%, #7d8791)',
  borderColor: '#5b646d'
};

export const Tank3DCard: React.FC<Tank3DCardProps> = React.memo(({ tank, onLevelChange, isEditable = false, onEdit, onDelete, onToggleHidden, summary = false }) => {
  const { t } = useTranslation(['tanks', 'common']);
  const fillHeightPercent = `${Math.min(100, Math.max(0, tank.fillPercent))}%`;
  const theme = tank.theme;
  const sliderPercent = Math.min(100, Math.max(0, (tank.levelMeters / tank.maxLevelMeters) * 100));

  return (
    <div 
      className={`rounded-3xl bg-white/75 dark:bg-slate-900/80 backdrop-blur-xl border border-white/80 dark:border-slate-800/80 p-4 sm:p-5 shadow-[inset_0_1px_2px_rgba(255,255,255,0.95),0_12px_32px_rgba(15,23,42,0.06)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_15px_35px_rgba(0,0,0,0.5)] ring-1 ring-slate-900/[0.04] dark:ring-white/[0.05] ring-inset hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between space-y-4 group relative overflow-hidden contain-paint will-change-transform ${
        isEditable ? 'border-blue-300/80 dark:border-blue-700/80 ring-2 ring-blue-500/20' : ''
      } ${tank.hidden ? 'opacity-55 grayscale' : ''}`}
    >
      {/* 📐 Engineering SCADA Dot Grid Pattern (خلفية نقطية هندسية ناعمة وخافتة جداً في العمق) */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.16] dark:opacity-[0.10] z-0"
        style={{
          backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.2))',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.2))'
        }}
      />

      {/* 💎 Frosted Glass Inner Ambient Light Diffusion (تأثير الزجاج المصقول المعتم في الخلفية) */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-slate-50/20 to-slate-100/40 dark:from-white/5 dark:via-transparent dark:to-black/30 pointer-events-none z-0" />

      {/* Header Row (في الطبقة العلوية فوق النقاط) */}
      <div className="flex items-start justify-between gap-2 pt-0.5 relative z-10">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            {tank.fillPercent <= 59 && (
              <span className="relative flex h-2 w-2 shrink-0 animate-in fade-in duration-200" title={t('tanks:card.lowLevelWarning', { value: tank.fillPercent })}>
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: theme.textColor }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: theme.textColor }}
                />
              </span>
            )}

            <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
              {tank.name}
            </h3>
          </div>
        </div>

        {/* Edit & Delete Buttons & Fill Percent Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isEditable && (
            <div className="flex items-center gap-1">
              {onToggleHidden && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleHidden(tank.id);
                  }}
                  className={`p-1 rounded-full border shadow-xs transition-all cursor-pointer animate-in fade-in hover:scale-105 active:scale-95 ${
                    tank.hidden
                      ? 'bg-slate-700 hover:bg-slate-800 text-white border-slate-700'
                      : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                  title={tank.hidden ? t('tanks:card.show') : t('tanks:card.hide')}
                >
                  {tank.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(tank);
                  }}
                  className="px-2 py-0.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[10.5px] font-black flex items-center gap-1 shadow-xs transition-all cursor-pointer animate-in fade-in active:scale-95"
                  title={t('tanks:card.editAll')}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{t('common:actions.edit')}</span>
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(tank);
                  }}
                  className="p-1 rounded-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 shadow-xs transition-all cursor-pointer animate-in fade-in hover:scale-105 active:scale-95"
                  title={t('tanks:card.delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <span className={`text-xs font-black font-mono px-2.5 py-0.5 rounded-full border shadow-2xs ${theme.badgeClass}`}>
            {tank.fillPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 🛢️ CINEMATIC 3D STEEL TANK VESSEL (المجسم السينمائي ثلاثي الأبعاد للخزان الفولاذي) */}
      <div className="flex flex-col items-center justify-center pt-4 pb-2 relative z-10 select-none">
        {/* شارة الخزان المخفي فوق الرسم */}
        {tank.hidden && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/85 text-white text-xs font-black shadow-lg">
              <EyeOff className="w-3.5 h-3.5" />
              {t('tanks:card.hiddenBadge')}
            </span>
          </div>
        )}
        
        {/* 1. 🌟 Ellipsoidal Satin Crown (القبة الإهليلجية الانسيابية المصقولة - مصمتة بالكامل وناعمة) */}
        <div className="relative w-32 sm:w-36 z-20">
          {/* 3D Smooth Ellipsoidal Dome */}
          <div className="w-full h-5 rounded-t-[100%] bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 border-t border-x border-slate-300/80 dark:border-slate-700 relative overflow-hidden flex items-end shadow-xs" style={steelBody}>
            {/* Smooth Satin Crown Arched Highlight */}
            <div className="absolute top-1 inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-white/70 to-transparent pointer-events-none" />
            
            {/* Soft Ambient Cylindrical Shading */}
            <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-slate-400/25 to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-slate-400/25 to-transparent pointer-events-none" />
          </div>
          
          {/* 🛡️ Integrated Polished Compression Chime (حافة التثبيت المصقولة) */}
          <div className="w-full h-1 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 dark:from-slate-700 dark:via-slate-500 dark:to-slate-700 border-y border-slate-300/80 dark:border-slate-650 shadow-xs relative z-20" style={steelBody} />
        </div>

        {/* 2. Main 3D API-650 Cylindrical Shell & Scale */}
        <div className="relative flex items-center justify-center">
          
          {/* 📏 Precision Left Calibration Scale & Reticle */}
          <div dir="ltr" className="absolute -left-12 top-0 bottom-0 flex items-stretch gap-1 z-20 select-none">
            {/* Meters Labels */}
            <div className="flex flex-col justify-between text-[8px] font-mono font-black text-slate-600 dark:text-slate-300 py-1 text-right">
              <div className="flex items-center gap-0.5 justify-end">
                <span>{tank.maxLevelMeters.toFixed(0)}{t('common:units.meter')}</span>
                <span className="w-1.5 h-0.5 bg-slate-500 dark:bg-slate-400" />
              </div>
              <div className="flex items-center gap-0.5 justify-end">
                <span>{(tank.maxLevelMeters * 0.75).toFixed(0)}{t('common:units.meter')}</span>
                <span className="w-1 h-px bg-slate-400 dark:bg-slate-500" />
              </div>
              <div className="flex items-center gap-0.5 justify-end">
                <span>{(tank.maxLevelMeters * 0.5).toFixed(0)}{t('common:units.meter')}</span>
                <span className="w-1.5 h-0.5 bg-slate-500 dark:bg-slate-400" />
              </div>
              <div className="flex items-center gap-0.5 justify-end">
                <span>{(tank.maxLevelMeters * 0.25).toFixed(0)}{t('common:units.meter')}</span>
                <span className="w-1 h-px bg-slate-400 dark:bg-slate-500" />
              </div>
              <div className="flex items-center gap-0.5 justify-end">
                <span>0{t('common:units.meter')}</span>
                <span className="w-1.5 h-0.5 bg-slate-500 dark:bg-slate-400" />
              </div>
            </div>

            {/* Transparent Glass Level Conduit with Smooth Vertical Slider */}
            <div className="relative flex flex-col items-center h-full">
              <div className="w-2.5 h-1 bg-slate-400 dark:bg-slate-600 border border-slate-500 shadow-xs z-10" />
              <div className="relative w-2 flex-1 bg-slate-200/90 dark:bg-slate-900 border-x border-slate-400 dark:border-slate-700 overflow-hidden flex flex-col justify-end shadow-inner">
                <div
                  className="w-full transition-[height] duration-300 ease-out relative"
                  style={{
                    height: `${sliderPercent}%`,
                    backgroundColor: theme.textColor
                  }}
                >
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-white shadow-[0_0_6px_#fff]" />
                </div>
              </div>
              <div className="w-2.5 h-1 bg-slate-400 dark:bg-slate-600 border border-slate-500 shadow-xs z-10" />
              <input
                type="range"
                min="0"
                max={tank.maxLevelMeters}
                step="0.05"
                value={tank.levelMeters}
                disabled={!isEditable}
                onChange={(e) => isEditable && onLevelChange(tank.id, parseFloat(e.target.value))}
                className={`absolute inset-0 w-full h-full opacity-0 z-30 touch-pan-y [writing-mode:vertical-lr] [direction:rtl] ${
                  isEditable ? 'cursor-pointer' : 'cursor-default pointer-events-none'
                }`}
                title={isEditable ? t('tanks:card.dragLevel') : t('tanks:card.levelLocked')}
                aria-label={t('tanks:card.levelSliderAria', { name: tank.name })}
              />
            </div>
          </div>

          {/* 🛢️ 3D Solid Light-Steel Tank Shell (هيكل خزان فولاذي مصمت 100% وفاتح وناعم) */}
          <div className="w-32 sm:w-36 h-40 sm:h-44 rounded-b-xs bg-gradient-to-r from-slate-300 via-slate-100 to-slate-300 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 border-x border-b border-slate-300/80 dark:border-slate-700 relative overflow-hidden flex flex-col justify-end shadow-lg z-10" style={steelBody}>
            
            {/* Horizontal Welded Steel Plate Courses (خطوط اللحام الهندسية الناعمة) */}
            <div className="absolute inset-x-0 top-[25%] h-px bg-slate-400/40 dark:bg-slate-600/50 border-t border-white/60 dark:border-white/10 pointer-events-none z-20" />
            <div className="absolute inset-x-0 top-[50%] h-px bg-slate-400/40 dark:bg-slate-600/50 border-t border-white/60 dark:border-white/10 pointer-events-none z-20" />
            <div className="absolute inset-x-0 top-[75%] h-px bg-slate-400/40 dark:bg-slate-600/50 border-t border-white/60 dark:border-white/10 pointer-events-none z-20" />

            {/* Soft Cylindrical Light Shading (تظليل أسطواني ناعم وخفيف) */}
            <div className="absolute inset-y-0 left-0 w-3.5 bg-gradient-to-r from-slate-400/25 to-transparent pointer-events-none z-25" />
            <div className="absolute inset-y-0 right-0 w-3.5 bg-gradient-to-l from-slate-400/25 to-transparent pointer-events-none z-25" />

            {/* 🌊 Living Fuel Volume Simulation (السائل الهيدروليكي الحي مع الأمواج واللمعان) */}
            <div
              className="w-full relative overflow-hidden transition-[height,background] duration-700 ease-out z-15 will-change-transform"
              style={{
                height: fillHeightPercent,
                background: `linear-gradient(to top, ${theme.gradientFrom}, ${theme.gradientVia}, ${theme.gradientTo})`,
              }}
            >
              {/* Glowing Meniscus & Surface Wave */}
              <div className="absolute -top-2 inset-x-0 h-3.5 opacity-90 pointer-events-none">
                <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full animate-pulse">
                  <path
                    d="M0.00,49.98 C150.00,140.00 349.20,-40.00 500.00,49.98 L500.00,150.00 L0.00,150.00 Z"
                    fill={theme.waveColor}
                  />
                </svg>
              </div>

              {/* Fluid Surface Laser Line */}
              <div className="absolute top-0 inset-x-0 h-0.5 bg-white/80 shadow-[0_0_8px_#fff]" />

              {/* Internal Depth Reflections */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-black/35 pointer-events-none" />
            </div>

          </div>

          {/* 📏 مسطرة قياس جانبية ملاصقة لجسم الخزان مع جهاز قياس إلكتروني */}
          <div dir="ltr" className="absolute left-full top-0 bottom-0 w-7 z-20 flex select-none pointer-events-none" aria-hidden="true">
            <div className="relative w-2.5 h-full bg-slate-100 dark:bg-slate-800 border-y border-r border-slate-400 dark:border-slate-600">
              {/* 🎛️ جهاز قياس إلكتروني منزلق على المسطرة يعرض نسبة الامتلاء */}
              <div
                className="absolute -left-1 h-0 z-10 transition-[bottom] duration-700 ease-out"
                style={{ bottom: `${sliderPercent}%` }}
              >
                <div className="absolute left-0 -translate-y-1/2 flex items-center">
                  <div className="w-1 h-3 rounded-l-sm bg-slate-600 dark:bg-slate-400" />
                  <div className="px-1 py-0.5 rounded-[3px] bg-slate-800 dark:bg-slate-950 border border-slate-600 shadow-md flex items-center gap-0.5">
                    <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: theme.textColor }} />
                    <span className="text-[7px] font-mono font-black leading-none tabular-nums" style={{ color: theme.textColor }}>
                      {tank.fillPercent.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
              {Array.from({ length: 21 }).map((_, i) => {
                const major = i % 5 === 0;
                return (
                  <div
                    key={i}
                    className={`absolute left-0 ${major ? 'w-full h-[1.5px] bg-slate-600 dark:bg-slate-300' : 'w-1.5 h-px bg-slate-400 dark:bg-slate-500'}`}
                    style={{ bottom: `${i * 5}%` }}
                  />
                );
              })}
            </div>
            <div className="relative flex-1 h-full">
              {[0, 25, 50, 75, 100].map(p => (
                <span
                  key={p}
                  className="absolute left-0.5 translate-y-1/2 text-[7px] font-mono font-bold text-slate-500 dark:text-slate-400 leading-none"
                  style={{ bottom: `${p}%` }}
                >
                  {p}%
                </span>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* 🎛️ UNIFIED TELEMETRY & INPUT CONSOLE (بطاقة البيانات السفلية في الطبقة الأمامية فوق النقاط) */}
      <div className="p-3.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-sm relative z-10 space-y-2.5">
        
        {/* Stored Volume & Status Badge */}
        <div className="flex items-start justify-between gap-1">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">{t('tanks:card.stored')}</span>
            <div className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white leading-tight">
              {formatNumber(tank.currentStoredLiters)} <span className="text-[10px] font-normal text-slate-400">{t('common:units.liter')}</span>
            </div>
          </div>
          <span
            className="text-[10.5px] font-black px-2.5 py-0.5 rounded-lg border shadow-2xs shrink-0"
            style={{
              color: theme.textColor,
              borderColor: `${theme.textColor}40`,
              backgroundColor: `${theme.textColor}12`,
            }}
          >
            {t(`tanks:level.${theme.statusLabel}`)}
          </span>
        </div>

        {/* Capacity & Direct Numeric Level Input */}
        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <div className="text-[10px] text-slate-400 font-mono">
            <span>{t('tanks:card.capacity')} </span>
            <strong className="text-slate-700 dark:text-slate-300">{formatNumber(tank.capacityLiters)} {t('common:units.liter')}</strong>
          </div>

          {summary ? (
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              {t('tanks:card.fill')} <strong className="font-mono font-black text-slate-800 dark:text-slate-200">{tank.fillPercent}%</strong>
            </div>
          ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              {!isEditable && <Lock className="w-2.5 h-2.5 text-slate-400 opacity-70" />}
              <span>{t('tanks:card.level')}</span>
            </span>
            <div className={`flex items-center rounded-lg px-2 py-0.5 shadow-2xs transition-all ${
              isEditable 
                ? 'bg-blue-50 dark:bg-blue-950/60 border-2 border-blue-500 ring-2 ring-blue-400/20' 
                : 'bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800'
            }`}>
              <input
                type="number"
                step="0.01"
                min="0"
                max={tank.maxLevelMeters}
                value={tank.levelMeters}
                disabled={!isEditable}
                readOnly={!isEditable}
                onChange={(e) => isEditable && onLevelChange(tank.id, parseFloat(e.target.value))}
                className={`w-12 bg-transparent font-mono font-black text-center text-xs focus:outline-none ${
                  isEditable 
                    ? 'text-blue-700 dark:text-blue-300 font-extrabold cursor-text' 
                    : 'text-slate-700 dark:text-slate-300 cursor-default select-none'
                }`}
                aria-label={t('tanks:card.levelInputAria', { name: tank.name })}
              />
              <span className={`text-[10px] font-bold ms-1 ${isEditable ? 'text-blue-600 dark:text-blue-400 font-extrabold' : 'text-slate-400'}`}>{t('common:units.meter')}</span>
            </div>
          </div>
          )}
        </div>

      </div>

    </div>
  );
}, (prevProps, nextProps) => {
  // Ultra-Fast strict comparator for 120 FPS
  return (
    prevProps.isEditable === nextProps.isEditable &&
    prevProps.tank.id === nextProps.tank.id &&
    // بيانات الخزان القابلة للتعديل: يُعاد رسم الكارت فور تعديلها دون انتظار "حفظ التعديلات"
    prevProps.tank.name === nextProps.tank.name &&
    prevProps.tank.code === nextProps.tank.code &&
    prevProps.tank.capacityLiters === nextProps.tank.capacityLiters &&
    prevProps.tank.maxLevelMeters === nextProps.tank.maxLevelMeters &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onToggleHidden === nextProps.onToggleHidden &&
    prevProps.tank.hidden === nextProps.tank.hidden &&
    prevProps.tank.levelMeters === nextProps.tank.levelMeters &&
    prevProps.tank.currentStoredLiters === nextProps.tank.currentStoredLiters &&
    prevProps.tank.fillPercent === nextProps.tank.fillPercent &&
    prevProps.tank.theme.status === nextProps.tank.theme.status
  );
});

Tank3DCard.displayName = 'Tank3DCard';
