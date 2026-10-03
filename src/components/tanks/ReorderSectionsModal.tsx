import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  Layers,
  Fuel,
  Flame
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { TankSectionConfig } from './TanksOverview';

interface ReorderSectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Record<string, TankSectionConfig>;
  orderedKeys: string[];
  onReorder: (newOrderedKeys: string[]) => void;
  onResetOrder: () => void;
}

// Icon selector for sections
const getSectionIcon = (config: TankSectionConfig) => {
  switch (config.iconName) {
    case 'flame': return Flame;
    case 'droplets': return Fuel;
    case 'layers': return Layers;
    case 'fuel':
    default: return Fuel;
  }
};

export const ReorderSectionsModal: React.FC<ReorderSectionsModalProps> = ({
  isOpen,
  onClose,
  sections,
  orderedKeys,
  onReorder,
  onResetOrder
}) => {
  const { tr } = useLanguage();

  if (!isOpen) return null;

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newKeys = [...orderedKeys];
    const temp = newKeys[index];
    newKeys[index] = newKeys[index - 1];
    newKeys[index - 1] = temp;
    onReorder(newKeys);
  };

  const handleMoveDown = (index: number) => {
    if (index >= orderedKeys.length - 1) return;
    const newKeys = [...orderedKeys];
    const temp = newKeys[index];
    newKeys[index] = newKeys[index + 1];
    newKeys[index + 1] = temp;
    onReorder(newKeys);
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Background Click to Dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Content */}
      <div 
        className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden z-10 my-8 transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Banner */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_70%)] pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner">
              <ArrowUpDown className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {tr('تعديل ترتيب الأقسام')}
              </h2>
              <p className="text-[11px] sm:text-xs text-blue-100 font-medium mt-0.5">
                {tr('تحكم في ترتيب ظهور أقسام الخزانات في الواجهة الرئيسية')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition-colors cursor-pointer relative z-10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body: Sections List */}
        <div className="p-5 sm:p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {tr('استخدم أزرار الأسهم لتقديم أو تأخير ظهور القسم:')}
          </p>

          <div className="space-y-2.5">
            {orderedKeys.map((key, index) => {
              const sec = sections[key];
              if (!sec) return null;
              const Icon = getSectionIcon(sec);
              const isFirst = index === 0;
              const isLast = index === orderedKeys.length - 1;

              return (
                <div
                  key={key}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 transition-all hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs group"
                >
                  {/* Left (Right in RTL): Order Number & Icon & Title */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Position Badge */}
                    <div className="w-7 h-7 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center text-xs font-black shrink-0 font-mono">
                      {index + 1}
                    </div>

                    {/* Section Icon */}
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    >
                      <Icon className="w-4 h-4" style={{ color: sec.accentColor }} />
                    </div>

                    {/* Name & Company */}
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                        {sec.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {sec.company}
                      </p>
                    </div>
                  </div>

                  {/* Right (Left in RTL): Reorder Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveUp(index)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isFirst
                          ? 'opacity-30 cursor-not-allowed bg-slate-200 dark:bg-slate-700 text-slate-400'
                          : 'bg-white dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-600 cursor-pointer shadow-2xs hover:scale-105 active:scale-95'
                      }`}
                      title={tr('تحريك للأعلى')}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveDown(index)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isLast
                          ? 'opacity-30 cursor-not-allowed bg-slate-200 dark:bg-slate-700 text-slate-400'
                          : 'bg-white dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-600 cursor-pointer shadow-2xs hover:scale-105 active:scale-95'
                      }`}
                      title={tr('تحريك للأسفل')}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onResetOrder}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title={tr('استعادة الترتيب الافتراضي للأقسام')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{tr('الترتيب الافتراضي')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black shadow-md shadow-blue-500/25 flex items-center gap-1.5 transition-all cursor-pointer active:scale-98"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{tr('تم وحفظ الترتيب')}</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  ) : null;
};
