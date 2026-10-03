import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Layers,
  Fuel,
  Droplets,
  Activity,
  CheckCircle2,
  Building2,
  FileText
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { TankSectionConfig } from './TanksOverview';

interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSection: (newSection: TankSectionConfig) => void;
}

const COLOR_PRESETS = [
  {
    key: 'blue',
    label: 'أزرق نفطي (صحاري)',
    accentColor: '#2563eb',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/50',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200 dark:border-blue-800',
    headerGrad: 'from-blue-600/10 via-indigo-600/5 to-transparent dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-transparent',
    icon: Droplets,
    iconName: 'Droplets'
  },
  {
    key: 'emerald',
    label: 'أخضر زمردي (كاز وبنزين)',
    accentColor: '#059669',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
    headerGrad: 'from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-transparent',
    icon: Fuel,
    iconName: 'Fuel'
  },
  {
    key: 'amber',
    label: 'برتقالي كهرماني (ديزل وبفر)',
    accentColor: '#d97706',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/50',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800',
    headerGrad: 'from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-950/40 dark:via-orange-950/20 dark:to-transparent',
    icon: Activity,
    iconName: 'Activity'
  },
  {
    key: 'cyan',
    label: 'سماوي (الاتحاد)',
    accentColor: '#0891b2',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/50',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    badgeBorder: 'border-cyan-200 dark:border-cyan-800',
    headerGrad: 'from-cyan-500/10 via-sky-500/5 to-transparent dark:from-cyan-950/40 dark:via-sky-950/20 dark:to-transparent',
    icon: Droplets,
    iconName: 'Droplets'
  },
  {
    key: 'purple',
    label: 'أرجواني ملكي',
    accentColor: '#7c3aed',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/50',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-200 dark:border-purple-800',
    headerGrad: 'from-purple-600/10 via-violet-600/5 to-transparent dark:from-purple-950/40 dark:via-violet-950/20 dark:to-transparent',
    icon: Layers,
    iconName: 'Layers'
  }
];

export const AddSectionModal: React.FC<AddSectionModalProps> = ({
  isOpen,
  onClose,
  onAddSection
}) => {
  const { tr } = useLanguage();

  const [sectionName, setSectionName] = useState('');
  const [company, setCompany] = useState<'صحاري كربلاء' | 'شركة الاتحاد' | 'شركة صحاري كربلاء'>('صحاري كربلاء');
  const [description, setDescription] = useState('');
  const [selectedColorKey, setSelectedColorKey] = useState('blue');

  if (!isOpen) return null;

  const activePreset = COLOR_PRESETS.find(p => p.key === selectedColorKey) || COLOR_PRESETS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!sectionName.trim()) {
      alert(tr('يرجى إدخال اسم القسم'));
      return;
    }

    const key = `custom-sec-${Date.now()}`;
    const newSection: TankSectionConfig = {
      key,
      name: sectionName.trim(),
      company,
      description: description.trim() || tr('قسم تشغيلي إضافي مخصص لمنظومة الخزانات'),
      icon: activePreset.icon,
      iconName: activePreset.iconName,
      accentColor: activePreset.accentColor,
      badgeBg: activePreset.badgeBg,
      badgeText: activePreset.badgeText,
      badgeBorder: activePreset.badgeBorder,
      headerGrad: activePreset.headerGrad
    };

    onAddSection(newSection);
    onClose();

    // Reset form
    setSectionName('');
    setDescription('');
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden z-10 my-8 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Banner */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
              <Layers className="w-6 h-6 text-white stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black tracking-tight">{tr('إضافة قسم جديد للخزانات')}</h3>
              <p className="text-xs text-blue-100/90 font-medium mt-0.5">
                {tr('إنشاء مصفوفة جدول أو وحدة تخزين جديدة')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors relative z-10 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4">
          
          {/* Section Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
              {tr('اسم القسم / الوحدة الجديدة')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: خزانات البنزين المحسن - الموقع 3"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>

          {/* Company */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-500" />
              <span>{tr('الشركة التابعة')}</span>
            </label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
            >
              <option value="صحاري كربلاء">صحاري كربلاء</option>
              <option value="شركة الاتحاد">شركة الاتحاد</option>
              <option value="شركة صحاري كربلاء">شركة صحاري كربلاء</option>
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-500" />
              <span>{tr('وصف القسم والتشغيل')}</span>
            </label>
            <input
              type="text"
              placeholder="مثال: منظومة تخزين ومضخات التغذية لمحطة التوليد"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>

          {/* Color Preset Selector */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
              {tr('السمة اللونية للقسم')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {COLOR_PRESETS.map((preset) => {
                const isSelected = preset.key === selectedColorKey;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setSelectedColorKey(preset.key)}
                    className={`p-2.5 rounded-xl border text-right text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-400/30 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: preset.accentColor }}
                    />
                    <span className="truncate text-[11px]">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              {tr('إلغاء')}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer hover:shadow-lg active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>{tr('إضافة القسم')}</span>
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  ) : null;
};
