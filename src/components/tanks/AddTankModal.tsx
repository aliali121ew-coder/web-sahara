import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Edit3,
  Trash2,
  Layers,
  CheckCircle2,
  Gauge
} from 'lucide-react';
import { formatNumber } from '../../lib/utils';
import { useTranslation, Trans } from 'react-i18next';
import { TankUnitRow, TankSectionConfig } from './TanksOverview';

interface AddTankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTank?: (newTank: TankUnitRow) => void;
  onUpdateTank?: (updatedTank: TankUnitRow) => void;
  onDeleteTank?: (tankId: string) => void;
  sections: Record<string, TankSectionConfig>;
  initialSectionKey?: string;
  allTanks?: TankUnitRow[];
  editingTank?: TankUnitRow | null;
}

// Utility to format numbers with commas while typing
const formatWithCommas = (val: string | number): string => {
  if (val === '' || val === null || val === undefined) return '';
  const numStr = val.toString().replace(/,/g, '');
  if (isNaN(Number(numStr))) return val.toString();
  const parts = numStr.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

// Utility to extract numeric value from formatted string
const parseRawNumber = (val: string): number => {
  if (!val) return 0;
  const cleaned = val.toString().replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const AddTankModal: React.FC<AddTankModalProps> = ({
  isOpen,
  onClose,
  onAddTank,
  onUpdateTank,
  onDeleteTank,
  sections,
  initialSectionKey,
  allTanks = [],
  editingTank = null
}) => {
  const { t } = useTranslation(['tanks', 'common']);
  const BASE_SECTION_KEYS = ['sahara-gas-8', 'etihad-black-oil', 'gas-petrol-hajj', 'daily-buffer-diesel'];
  const sectionKeys = [
    ...BASE_SECTION_KEYS.filter(k => sections[k]),
    ...Object.keys(sections).filter(k => !BASE_SECTION_KEYS.includes(k))
  ];
  const defaultSecKey = initialSectionKey && sections[initialSectionKey] ? initialSectionKey : sectionKeys[0] || '';

  const [sectionKey, setSectionKey] = useState<string>(defaultSecKey);
  const [tankName, setTankName] = useState<string>('');
  const [tankCode, setTankCode] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  
  // String state for inputs to allow complete freedom of backspace, deletion, and comma formatting
  const [capacityStr, setCapacityStr] = useState<string>('150,000');
  const [storedStr, setStoredStr] = useState<string>('75,000');
  const [levelStr, setLevelStr] = useState<string>('3.00');
  const [maxLevelStr, setMaxLevelStr] = useState<string>('6.00');

  const isEditing = Boolean(editingTank);

  // Sync state when editingTank changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setShowDeleteConfirm(false);
      if (editingTank) {
        setSectionKey(editingTank.sectionKey);
        setTankName(editingTank.name);
        setTankCode(editingTank.code);
        setCapacityStr(formatWithCommas(editingTank.capacityLiters));
        setMaxLevelStr(editingTank.maxLevelMeters.toString());
        setLevelStr(editingTank.levelMeters.toString());

        const fillPercent = (editingTank.levelMeters / (editingTank.maxLevelMeters || 1));
        const stored = Math.round(fillPercent * editingTank.capacityLiters);
        setStoredStr(formatWithCommas(stored));
      } else {
        // New Tank Mode
        const currentSecKey = initialSectionKey && sections[initialSectionKey] ? initialSectionKey : sectionKeys[0] || '';
        setSectionKey(currentSecKey);
        setTankName('');
        setCapacityStr('150,000');
        setStoredStr('75,000');
        setLevelStr('3.00');
        setMaxLevelStr('6.00');

        const sectionTanks = allTanks.filter(t => t.sectionKey === currentSecKey);
        const nextNum = sectionTanks.length + 1;
        const countPadded = String(nextNum).padStart(2, '0');

        let prefix = 'TK-SH-';
        if (currentSecKey === 'daily-buffer-diesel') {
          prefix = 'TK-DZ-';
        } else if (currentSecKey === 'gas-petrol-hajj') {
          prefix = 'TK-GS-';
        } else if (currentSecKey === 'etihad-black-oil') {
          prefix = 'TK-ET-';
        } else if (currentSecKey === 'sahara-gas-8') {
          prefix = 'TK-SH-';
        } else {
          prefix = `TK-${currentSecKey.slice(-2).toUpperCase()}-`;
        }

        setTankCode(`${prefix}${countPadded}`);
      }
    }
  }, [isOpen, editingTank, initialSectionKey]);

  // Auto-increment code according to existing tanks in this section (only in Add Mode)
  useEffect(() => {
    if (isOpen && !editingTank) {
      const sectionTanks = allTanks.filter(t => t.sectionKey === sectionKey);
      const nextNum = sectionTanks.length + 1;
      const countPadded = String(nextNum).padStart(2, '0');

      let prefix = 'TK-SH-';
      if (sectionKey === 'daily-buffer-diesel') {
        prefix = 'TK-DZ-';
      } else if (sectionKey === 'gas-petrol-hajj') {
        prefix = 'TK-GS-';
      } else if (sectionKey === 'etihad-black-oil') {
        prefix = 'TK-ET-';
      } else if (sectionKey === 'sahara-gas-8') {
        prefix = 'TK-SH-';
      } else {
        prefix = `TK-${sectionKey.slice(-2).toUpperCase()}-`;
      }

      setTankCode(`${prefix}${countPadded}`);
    }
  }, [sectionKey, isOpen, editingTank, allTanks]);

  if (!isOpen) return null;

  const currentSection = sections[sectionKey] || sections[sectionKeys[0]];

  const capacityNum = parseRawNumber(capacityStr);
  const storedNum = parseRawNumber(storedStr);
  const maxLevelNum = parseRawNumber(maxLevelStr) || 6.0;

  // Handler for Capacity Input
  const handleCapacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const formatted = formatWithCommas(raw);
    setCapacityStr(formatted);

    const newCap = parseRawNumber(raw);
    const currLevel = parseRawNumber(levelStr);
    const currMax = parseRawNumber(maxLevelStr) || 1;
    if (newCap > 0 && currMax > 0) {
      const calculatedStored = Math.round((currLevel / currMax) * newCap);
      setStoredStr(formatWithCommas(calculatedStored));
    }
  };

  // Handler for Actual Stored Liters Input (From Right to Left, formatted with commas)
  const handleStoredChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    const formatted = formatWithCommas(raw);
    setStoredStr(formatted);

    const newStored = parseRawNumber(raw);
    const cap = parseRawNumber(capacityStr) || 1;
    const currMax = parseRawNumber(maxLevelStr) || 6.0;
    if (cap > 0) {
      const calculatedLevel = Number(((newStored / cap) * currMax).toFixed(2));
      setLevelStr(calculatedLevel.toString());
    }
  };

  // Handler for Level Meters Input
  const handleLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    setLevelStr(raw);

    const newLevel = parseFloat(raw) || 0;
    const cap = parseRawNumber(capacityStr);
    const currMax = parseRawNumber(maxLevelStr) || 6.0;
    if (cap > 0 && currMax > 0) {
      const calculatedStored = Math.round((newLevel / currMax) * cap);
      setStoredStr(formatWithCommas(calculatedStored));
    }
  };

  // Handler for Max Level Meters Input
  const handleMaxLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    setMaxLevelStr(raw);
  };

  const fillPercent = capacityNum > 0
    ? Number(((storedNum / capacityNum) * 100).toFixed(1))
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!tankName.trim()) {
      alert(t('tanks:tank.nameRequired'));
      return;
    }

    const finalCapacity = capacityNum || 150000;
    const finalMaxLevel = maxLevelNum || 6.0;
    const finalLevel = Math.min(finalMaxLevel, parseRawNumber(levelStr));

    if (isEditing && editingTank && onUpdateTank) {
      const updatedTank: TankUnitRow = {
        ...editingTank,
        code: tankCode.trim() || editingTank.code,
        name: tankName.trim(),
        sectionKey: currentSection.key,
        sectionName: currentSection.name,
        company: currentSection.company,
        levelMeters: Number(finalLevel.toFixed(2)),
        maxLevelMeters: Number(finalMaxLevel.toFixed(2)),
        capacityLiters: Number(finalCapacity)
      };
      onUpdateTank(updatedTank);
    } else if (onAddTank) {
      const finalTank: TankUnitRow = {
        id: `tk-custom-${Date.now()}`,
        code: tankCode.trim() || `TK-${Date.now().toString().slice(-4)}`,
        name: tankName.trim(),
        sectionKey: currentSection.key,
        sectionName: currentSection.name,
        company: currentSection.company,
        levelMeters: Number(finalLevel.toFixed(2)),
        maxLevelMeters: Number(finalMaxLevel.toFixed(2)),
        capacityLiters: Number(finalCapacity),
        temperatureC: 27.0,
        pressureBar: 1.05
      };
      onAddTank(finalTank);
    }

    onClose();
  };

  const handleDelete = () => {
    if (editingTank && onDeleteTank) {
      setShowDeleteConfirm(true);
    }
  };

  const handleConfirmDelete = () => {
    if (editingTank && onDeleteTank) {
      onDeleteTank(editingTank.id);
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Background Click to Dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Content */}
      <div 
        className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden z-10 my-8 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Banner */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_70%)] pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
              {isEditing ? (
                <Edit3 className="w-6 h-6 text-white stroke-[2.5]" />
              ) : (
                <Plus className="w-6 h-6 text-white stroke-[2.5]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black tracking-tight">
                  {isEditing ? t('tanks:tank.editTitle') : t('tanks:tank.addTitle')}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold backdrop-blur-sm">
                  {isEditing ? currentSection?.name : t('tanks:tank.scada')}
                </span>
              </div>
              <p className="text-xs text-blue-100/90 font-medium mt-0.5">
                {isEditing ? t('tanks:tank.editText') : t('tanks:tank.addText')}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-5">

          {/* 1. اختيار القسم (Section Selector) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
              {t('tanks:tank.section')} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={sectionKey}
                onChange={(e) => setSectionKey(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
              >
                {sectionKeys.map((key) => (
                  <option key={key} value={key} className="dark:bg-slate-900 py-1">
                    {sections[key]?.name} ({sections[key]?.company})
                  </option>
                ))}
              </select>
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Layers className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* 2. عنوان / اسم الخزان */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
              {t('tanks:tank.name')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: خزان الديزل الإضافي 2"
              value={tankName}
              onChange={(e) => setTankName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>

          {/* 3. السعة الكلية والارتفاع الأقصى مع الفوارز وحرية التعديل */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
                {t('tanks:tank.capacity')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  dir="rtl"
                  placeholder="150,000"
                  value={capacityStr}
                  onChange={handleCapacityChange}
                  className="w-full px-3.5 py-2.5 pl-12 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-black text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-right"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none pointer-events-none">
                  {t('common:units.liter')}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
                {t('tanks:tank.height')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  dir="rtl"
                  placeholder="6.00"
                  value={maxLevelStr}
                  onChange={handleMaxLevelChange}
                  className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-black text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-right"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none pointer-events-none">
                  {t('common:units.meter')}
                </span>
              </div>
            </div>

          </div>

          {/* 4. المخزون الفعلي والمنسوب الحالي (بالفوارز ومن اليمين إلى اليسار) */}
          <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 space-y-3">
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                {t('tanks:tank.readings')}
              </span>
              <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                {t('tanks:tank.fillPercent', { value: fillPercent })}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {t('tanks:tank.stored')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    dir="rtl"
                    placeholder="75,000"
                    value={storedStr}
                    onChange={handleStoredChange}
                    className="w-full px-3 py-2 pl-12 rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-slate-900 dark:text-white font-mono font-black text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 select-none pointer-events-none">
                    {t('common:units.liter')}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {t('tanks:tank.level')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    dir="rtl"
                    placeholder="3.00"
                    value={levelStr}
                    onChange={handleLevelChange}
                    className="w-full px-3 py-2 pl-10 rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-slate-900 dark:text-white font-mono font-black text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 select-none pointer-events-none">
                    {t('common:units.meter')}
                  </span>
                </div>
              </div>

            </div>

            {/* Live Visual Fill Bar */}
            <div className="space-y-1 pt-1">
              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 shadow-sm"
                  style={{ width: `${Math.min(100, Math.max(0, fillPercent))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>0 {t('common:units.liter')}</span>
                <span>{formatNumber(capacityNum)} {t('common:units.liter')}</span>
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {isEditing && onDeleteTank ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{t('tanks:deleteTank')}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer hover:shadow-lg active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>{isEditing ? t('common:actions.saveChanges') : t('tanks:tank.addSave')}</span>
              </button>
            </div>
          </div>

        </form>

      </div>

    </div>,
    document.body
  ) : null}

  {/* ⚠️ نافذة تأكيد الحذف في المنتصف (Custom Centered Confirmation Modal via Independent Top Portal) */}
  {showDeleteConfirm && typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={() => setShowDeleteConfirm(false)} />
      <div 
        className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-2xl space-y-5 text-center animate-in zoom-in-95 duration-200 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon */}
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 mx-auto flex items-center justify-center shadow-inner">
          <Trash2 className="w-8 h-8 stroke-[2.2]" />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {t('tanks:confirmDeleteTankTitle')}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            <Trans t={t} i18nKey="tanks:confirmDeleteTankRecords" values={{ name: editingTank?.name }} components={{ 1: <strong className="text-rose-600 dark:text-rose-400 font-bold" /> }} />
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(false)}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            {t('common:actions.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-500/25 transition-all cursor-pointer hover:shadow-lg active:scale-98 flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t('common:actions.delete')}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null}
</>
);
};
