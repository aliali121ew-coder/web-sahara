import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Fuel,
  Droplets,
  Activity,
  Edit3,
  Check,
  Plus,
  ChevronDown,
  Layers,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PencilLine,
  X
} from 'lucide-react';
import { formatNumber } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';
import { Tank3DCard } from './Tank3DCard';
import { TankGlobalSvgDefs } from './TankGlobalSvgDefs';
import { AddTankModal } from './AddTankModal';
import { AddSectionModal } from './AddSectionModal';
import { ReorderSectionsModal } from './ReorderSectionsModal';
import { useCentralTanks } from '../../lib/centralTanks';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { usePetrolLedger } from '../../lib/petrolLedger';

// Model for Detailed Tank Unit
export interface TankUnitRow {
  id: string;
  code: string;              // رمز الخزان
  name: string;              // اسم الخزان
  sectionKey: string;        // مفتاح القسم
  sectionName: string;       // اسم القسم
  company: 'صحاري كربلاء' | 'شركة الاتحاد' | 'شركة صحاري كربلاء';
  levelMeters: number;       // مستوى (م) - قابل للتعديل
  maxLevelMeters: number;    // الارتفاع الكلي الثابت (م)
  capacityLiters: number;    // السعة الكلية الثابتة (لتر)
  temperatureC: number;      // درجة الحرارة
  pressureBar: number;       // الضغط
  hidden?: boolean;          // مخفي: لا يظهر في صفحات العرض ولا يُحتسب في الأرصدة
}

// Section Configuration Definition
export interface TankSectionConfig {
  key: string;
  name: string;
  company: 'صحاري كربلاء' | 'شركة الاتحاد' | 'شركة صحاري كربلاء';
  icon?: any;
  iconName?: string;
  description: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  headerGrad: string;
}

export const getSectionIcon = (config?: TankSectionConfig | null): React.ElementType => {
  if (!config) return Droplets;
  if (typeof config.icon === 'function') return config.icon;
  if (typeof config.icon === 'object' && config.icon !== null && (config.icon.$$typeof || config.icon.render)) return config.icon;
  if (config.iconName === 'Fuel') return Fuel;
  if (config.iconName === 'Activity') return Activity;
  if (config.iconName === 'Layers') return Layers;
  return Droplets;
};

const SECTION_CONFIGS: Record<string, TankSectionConfig> = {
  'daily-buffer-diesel': {
    key: 'daily-buffer-diesel',
    name: 'خزانات التشغيل اليومي - بفر وديزل',
    company: 'صحاري كربلاء',
    icon: Activity,
    description: 'خزانات التغذية والضخ المستمر والتشغيل اليومي للديزل ووحدات البفر',
    accentColor: '#d97706',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/50',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800',
    headerGrad: 'from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-950/40 dark:via-orange-950/20 dark:to-transparent',
  },
  'gas-petrol-hajj': {
    key: 'gas-petrol-hajj',
    name: 'وحدة الكاز والبنزين وخزانات بيت الحاج',
    company: 'صحاري كربلاء',
    icon: Fuel,
    description: 'منظومة إمداد الكاز والبنزين وخزانات موقع بيت الحاج أبو نور',
    accentColor: '#059669',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/50',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
    headerGrad: 'from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-transparent',
  },
  'etihad-black-oil': {
    key: 'etihad-black-oil',
    name: 'عمليات الاتحاد - النفط الأسود',
    company: 'شركة الاتحاد',
    icon: Droplets,
    description: 'خزانات النفط الأسود ومحطات الطاقة والربان التابعة لعمليات الاتحاد',
    accentColor: '#0891b2',
    badgeBg: 'bg-cyan-50 dark:bg-cyan-950/50',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    badgeBorder: 'border-cyan-200 dark:border-cyan-800',
    headerGrad: 'from-cyan-500/10 via-sky-500/5 to-transparent dark:from-cyan-950/40 dark:via-sky-950/20 dark:to-transparent',
  },
  'sahara-gas-8': {
    key: 'sahara-gas-8',
    name: 'النفط الأسود - شركة صحاري كربلاء',
    company: 'شركة صحاري كربلاء',
    icon: Droplets,
    description: 'مصفوفة الخزانات الرئيسية - النفط الأسود لشركة صحاري كربلاء',
    accentColor: '#2563eb',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/50',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200 dark:border-blue-800',
    headerGrad: 'from-blue-600/10 via-indigo-600/5 to-transparent dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-transparent',
  }
};

// Exact Official Tank Data
export const OFFICIAL_TABLE_TANK_UNITS: TankUnitRow[] = [
  // 📋 جدول 1: خزانات التشغيل اليومي (بفر / ديزل)
  {
    id: 'tk-tbl-dy-01',
    code: 'TK-DY-01',
    name: 'خزان الوقود اليومي',
    sectionKey: 'daily-buffer-diesel',
    sectionName: 'خزانات التشغيل اليومي - بفر وديزل',
    company: 'صحاري كربلاء',
    levelMeters: 4.06,
    maxLevelMeters: 6.00,
    capacityLiters: 154722,
    temperatureC: 27.5,
    pressureBar: 1.08
  },
  {
    id: 'tk-tbl-bf-01',
    code: 'TK-BF-01',
    name: 'خزان البفر 1',
    sectionKey: 'daily-buffer-diesel',
    sectionName: 'خزانات التشغيل اليومي - بفر وديزل',
    company: 'صحاري كربلاء',
    levelMeters: 2.98,
    maxLevelMeters: 6.00,
    capacityLiters: 107220,
    temperatureC: 27.1,
    pressureBar: 1.05
  },
  {
    id: 'tk-tbl-bf-02',
    code: 'TK-BF-02',
    name: 'خزان البفر 2',
    sectionKey: 'daily-buffer-diesel',
    sectionName: 'خزانات التشغيل اليومي - بفر وديزل',
    company: 'صحاري كربلاء',
    levelMeters: 3.50,
    maxLevelMeters: 6.00,
    capacityLiters: 107220,
    temperatureC: 27.3,
    pressureBar: 1.06
  },
  {
    id: 'tk-tbl-dz-01',
    code: 'TK-DZ-01',
    name: 'خزان الديزل',
    sectionKey: 'daily-buffer-diesel',
    sectionName: 'خزانات التشغيل اليومي - بفر وديزل',
    company: 'صحاري كربلاء',
    levelMeters: 3.50,
    maxLevelMeters: 6.00,
    capacityLiters: 154740,
    temperatureC: 26.9,
    pressureBar: 1.10
  },

  // 📋 جدول 2: وحدة الكاز والبنزين وخزانات بيت الحاج
  {
    id: 'tk-tbl-kz-01',
    code: 'TK-KZ-01',
    name: 'خزان الكاز 1',
    sectionKey: 'gas-petrol-hajj',
    sectionName: 'وحدة الكاز والبنزين وخزانات بيت الحاج',
    company: 'صحاري كربلاء',
    levelMeters: 18.80,
    maxLevelMeters: 20.00,
    capacityLiters: 4499480,
    temperatureC: 28.2,
    pressureBar: 1.18
  },
  {
    id: 'tk-tbl-kz-02',
    code: 'TK-KZ-02',
    name: 'خزان الكاز 2',
    sectionKey: 'gas-petrol-hajj',
    sectionName: 'وحدة الكاز والبنزين وخزانات بيت الحاج',
    company: 'صحاري كربلاء',
    levelMeters: 18.50,
    maxLevelMeters: 20.00,
    capacityLiters: 4499480,
    temperatureC: 28.0,
    pressureBar: 1.16
  },
  {
    id: 'tk-tbl-hj-01',
    code: 'TK-HJ-01',
    name: 'خزان بيت الحاج أبو نور',
    sectionKey: 'gas-petrol-hajj',
    sectionName: 'وحدة الكاز والبنزين وخزانات بيت الحاج',
    company: 'صحاري كربلاء',
    levelMeters: 4.00,
    maxLevelMeters: 5.00,
    capacityLiters: 10000,
    temperatureC: 26.5,
    pressureBar: 1.02
  },
  {
    id: 'tk-tbl-bn-01',
    code: 'TK-BN-01',
    name: 'خزان البنزين',
    sectionKey: 'gas-petrol-hajj',
    sectionName: 'وحدة الكاز والبنزين وخزانات بيت الحاج',
    company: 'صحاري كربلاء',
    levelMeters: 2.28,
    maxLevelMeters: 5.00,
    capacityLiters: 44000,
    temperatureC: 25.8,
    pressureBar: 1.04
  },

  // 📋 جدول 3: عمليات الاتحاد (النفط الأسود)
  {
    id: 'tk-tbl-et-01',
    code: 'TK-ET-01',
    name: 'خزان الطاقة القديمة',
    sectionKey: 'etihad-black-oil',
    sectionName: 'عمليات الاتحاد - النفط الأسود',
    company: 'شركة الاتحاد',
    levelMeters: 14.68,
    maxLevelMeters: 20.00,
    capacityLiters: 6000000,
    temperatureC: 44.0,
    pressureBar: 1.35
  },
  {
    id: 'tk-tbl-et-02',
    code: 'TK-ET-02',
    name: 'خزان الطاقة الجديدة',
    sectionKey: 'etihad-black-oil',
    sectionName: 'عمليات الاتحاد - النفط الأسود',
    company: 'شركة الاتحاد',
    levelMeters: 9.36,
    maxLevelMeters: 20.00,
    capacityLiters: 10800000,
    temperatureC: 45.2,
    pressureBar: 1.38
  },
  {
    id: 'tk-tbl-et-03',
    code: 'TK-ET-03',
    name: 'خزان الربان',
    sectionKey: 'etihad-black-oil',
    sectionName: 'عمليات الاتحاد - النفط الأسود',
    company: 'شركة الاتحاد',
    levelMeters: 18.46,
    maxLevelMeters: 20.00,
    capacityLiters: 39000000,
    temperatureC: 46.5,
    pressureBar: 1.45
  },

  // 🛢️ مصفوفة النفط الأسود - شركة صحاري كربلاء (8 خزانات)
  {
    id: 'tk-sh-kz-01',
    code: 'TK-SH-01',
    name: 'خزان صحاري 1',
    sectionKey: 'sahara-gas-8',
    sectionName: 'النفط الأسود - شركة صحاري كربلاء',
    company: 'شركة صحاري كربلاء',
    levelMeters: 7.40,
    maxLevelMeters: 20.00,
    capacityLiters: 4645536,
    temperatureC: 28.4,
    pressureBar: 1.15
  },
  {
    id: 'tk-sh-kz-02',
    code: 'TK-SH-02',
    name: 'خزان صحاري 2',
    sectionKey: 'sahara-gas-8',
    sectionName: 'النفط الأسود - شركة صحاري كربلاء',
    company: 'شركة صحاري كربلاء',
    levelMeters: 18.91,
    maxLevelMeters: 20.00,
    capacityLiters: 4618419,
    temperatureC: 27.9,
    pressureBar: 1.12
  },
  {
    id: 'tk-sh-kz-03',
    code: 'TK-SH-03',
    name: 'خزان صحاري 3',
    sectionKey: 'sahara-gas-8',
    sectionName: 'النفط الأسود - شركة صحاري كربلاء',
    company: 'شركة صحاري كربلاء',
    levelMeters: 7.80,
    maxLevelMeters: 20.00,
    capacityLiters: 4640400,
    temperatureC: 29.1,
    pressureBar: 1.08
  },
  {
    id: 'tk-sh-kz-04',
    code: 'TK-SH-04',
    name: 'خزان صحاري 4',
    sectionKey: 'sahara-gas-8',
    sectionName: 'النفط الأسود - شركة صحاري كربلاء',
    company: 'شركة صحاري كربلاء',
    levelMeters: 8.18,
    maxLevelMeters: 20.00,
    capacityLiters: 4628960,
    temperatureC: 28.6,
    pressureBar: 1.10
  },
  {
    id: 'tk-sh-kz-05',
    code: 'TK-SH-05',
    name: 'خزان صحاري 5',
    sectionKey: 'sahara-gas-8',
    sectionName: 'النفط الأسود - شركة صحاري كربلاء',
    company: 'شركة صحاري كربلاء',
    levelMeters: 18.56,
    maxLevelMeters: 20.00,
    capacityLiters: 4630420,
    temperatureC: 26.5,
    pressureBar: 1.18
  },
  {
    id: 'tk-sh-kz-06',
    code: 'TK-SH-06',
    name: 'خزان صحاري 6',
    sectionKey: 'sahara-gas-8',
    sectionName: 'النفط الأسود - شركة صحاري كربلاء',
    company: 'شركة صحاري كربلاء',
    levelMeters: 18.91,
    maxLevelMeters: 20.00,
    capacityLiters: 4618419,
    temperatureC: 26.8,
    pressureBar: 1.20
  },
  {
    id: 'tk-sh-kz-07',
    code: 'TK-SH-07',
    name: 'خزان صحاري 7',
    sectionKey: 'sahara-gas-8',
    sectionName: 'النفط الأسود - شركة صحاري كربلاء',
    company: 'شركة صحاري كربلاء',
    levelMeters: 10.00,
    maxLevelMeters: 20.00,
    capacityLiters: 4641000,
    temperatureC: 29.5,
    pressureBar: 1.05
  },
  {
    id: 'tk-sh-kz-08',
    code: 'TK-SH-08',
    name: 'خزان صحاري 8',
    sectionKey: 'sahara-gas-8',
    sectionName: 'النفط الأسود - شركة صحاري كربلاء',
    company: 'شركة صحاري كربلاء',
    levelMeters: 4.00,
    maxLevelMeters: 20.00,
    capacityLiters: 4641000,
    temperatureC: 30.2,
    pressureBar: 1.01
  }
];

// Adaptive Fluid Theme based strictly on percentage
export const getFillLevelTheme = (percent: number) => {
  if (percent >= 80) {
    return {
      status: 'safe',
      statusLabel: 'ممتاز',
      gradientFrom: '#064e3b',
      gradientVia: '#059669',
      gradientTo: '#10b981',
      fluidColor: '#10b981',
      fluidGlow: '#34d399',
      waveColor: '#34d399',
      textColor: '#10b981',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    };
  } else if (percent >= 60) {
    return {
      status: 'safe',
      statusLabel: 'جيد',
      gradientFrom: '#1e3a8a',
      gradientVia: '#2563eb',
      gradientTo: '#3b82f6',
      fluidColor: '#3b82f6',
      fluidGlow: '#60a5fa',
      waveColor: '#60a5fa',
      textColor: '#3b82f6',
      badgeClass: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800',
    };
  } else if (percent >= 31) {
    return {
      status: 'warning',
      statusLabel: 'منخفض',
      gradientFrom: '#78350f',
      gradientVia: '#d97706',
      gradientTo: '#f59e0b',
      fluidColor: '#f59e0b',
      fluidGlow: '#fbbf24',
      waveColor: '#fbbf24',
      textColor: '#f59e0b',
      badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    };
  } else {
    return {
      status: 'critical',
      statusLabel: 'حرج',
      gradientFrom: '#7f1d1d',
      gradientVia: '#dc2626',
      gradientTo: '#ef4444',
      fluidColor: '#ef4444',
      fluidGlow: '#f87171',
      waveColor: '#f87171',
      textColor: '#ef4444',
      badgeClass: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse',
    };
  }
};

const EMPTY_SECTIONS: Record<string, TankSectionConfig> = {};
const EMPTY_KEYS: string[] = [];
const EMPTY_OVERRIDES: Record<string, { name: string; description: string }> = {};

export const TanksOverview: React.FC = () => {
  const { tr } = useLanguage();
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingTank, setEditingTank] = useState<TankUnitRow | null>(null);
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState<boolean>(false);
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('');
  const [isSectionDropdownOpen, setIsSectionDropdownOpen] = useState<boolean>(false);
  const [sectionToDelete, setSectionToDelete] = useState<TankSectionConfig | null>(null);
  const [tankToDelete, setTankToDelete] = useState<TankUnitRow | null>(null);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState<boolean>(false);

  // Custom added sections
  // الأقسام تبقى محدّثة حيًّا بين النوافذ والأجهزة، وكل تعديل يُطبَّق على أحدث نسخة محفوظة
  const [customSections, setCustomSections] = useSyncedStorage<Record<string, TankSectionConfig>>('sahara_tank_custom_sections_v1', EMPTY_SECTIONS);

  // الأقسام الأصلية المحذوفة (مكتوبة في الكود) تُحفظ هنا حتى لا تعود بعد الحذف
  const [deletedSectionKeys, setDeletedSectionKeys] = useSyncedStorage<string[]>('sahara_tank_deleted_sections_v1', EMPTY_KEYS);

  // تعديلات أسماء وأوصاف الأقسام (أصلية أو مضافة) محفوظة هنا
  const [sectionOverrides, setSectionOverrides] = useSyncedStorage<Record<string, { name: string; description: string }>>('sahara_tank_section_overrides_v1', EMPTY_OVERRIDES);

  const allSections = useMemo(() => {
    const merged: Record<string, TankSectionConfig> = { ...SECTION_CONFIGS, ...customSections };
    deletedSectionKeys.forEach(k => delete merged[k]);
    Object.entries(sectionOverrides).forEach(([k, o]) => {
      if (merged[k]) merged[k] = { ...merged[k], ...o };
    });
    return merged;
  }, [customSections, deletedSectionKeys, sectionOverrides]);

  // تعديل اسم القسم مباشرة داخل ترويسته
  const [renamingSectionKey, setRenamingSectionKey] = useState<string | null>(null);
  const [draftSectionName, setDraftSectionName] = useState('');
  const [draftSectionDesc, setDraftSectionDesc] = useState('');

  const startRenameSection = (config: TankSectionConfig) => {
    setRenamingSectionKey(config.key);
    setDraftSectionName(config.name);
    setDraftSectionDesc(config.description);
  };

  const saveRenameSection = () => {
    if (!renamingSectionKey) return;
    const name = draftSectionName.trim();
    if (name) {
      setSectionOverrides(prev => ({ ...prev, [renamingSectionKey]: { name, description: draftSectionDesc.trim() } }));
    }
    setRenamingSectionKey(null);
  };

  // المخزن المركزي للخزانات: أي تعديل هنا ينعكس فورًا في صفحة خزانات الاتحاد والعكس
  // منظومة الخزانات تقرأ كل الخزانات بما فيها المخفية (لإظهارها في وضع التعديل)
  const [tankUnits, setTankUnits] = useCentralTanks(OFFICIAL_TABLE_TANK_UNITS, { includeHidden: true });
  // ربط خزان البنزين برصيد صفحة بنزين الصحاري (يحدّث نفسه عند فتح الصفحة وعند كل تأكيد)
  usePetrolLedger();

  // إخفاء / إظهار خزان (المخفي لا يُعرض خارج وضع التعديل ولا يُحتسب في أي رصيد)
  const handleToggleHidden = useCallback((id: string) => {
    setTankUnits(prev => prev.map(t => (t.id === id ? { ...t, hidden: !t.hidden } : t)));
  }, []);

  // Handler for adding a new custom tank
  const handleAddNewTank = useCallback((newTank: TankUnitRow) => {
    setTankUnits(prev => [...prev, newTank]);
    setEditingTank(null);
  }, []);

  // Handler for opening edit modal for a tank
  const handleEditTank = useCallback((tank: TankUnitRow) => {
    setEditingTank(tank);
    setIsAddModalOpen(true);
  }, []);

  // Handler for updating an existing tank
  const handleUpdateTank = useCallback((updatedTank: TankUnitRow) => {
    setTankUnits(prev => prev.map(t => t.id === updatedTank.id ? updatedTank : t));
    setEditingTank(null);
  }, []);

  // Handler for deleting a tank
  const handleDeleteTank = useCallback((tankId: string) => {
    setTankUnits(prev => prev.filter(t => t.id !== tankId));
    setEditingTank(null);
  }, []);

  // Handler for confirming section deletion
  const handleConfirmDeleteSection = useCallback(() => {
    if (!sectionToDelete) return;
    const secKey = sectionToDelete.key;

    // Remove from custom sections
    setCustomSections(prev => {
      const updated = { ...prev };
      delete updated[secKey];
      return updated;
    });

    // إخفاء القسم نهائيًا إن كان من الأقسام الأصلية
    if (secKey in SECTION_CONFIGS) {
      setDeletedSectionKeys(prev => (prev.includes(secKey) ? prev : [...prev, secKey]));
    }

    // Remove all tanks belonging to this section
    setTankUnits(prev => prev.filter(t => t.sectionKey !== secKey));
    setSectionToDelete(null);
  }, [sectionToDelete]);

  // Handler for adding a new custom section
  const handleAddNewSection = useCallback((newSection: TankSectionConfig) => {
    setCustomSections(prev => ({
      ...prev,
      [newSection.key]: newSection
    }));
    // Open add tank modal directly for this new section
    setSelectedSectionKey(newSection.key);
    setEditingTank(null);
    setIsAddModalOpen(true);
  }, []);

  // Handler for Level modification (Memoized for 120 FPS performance)
  const handleLevelChange = useCallback((id: string, newLevel: number) => {
    setTankUnits(prev => prev.map(t => {
      if (t.id === id) {
        const clampedLevel = Math.max(0, Math.min(Number(newLevel) || 0, t.maxLevelMeters));
        return {
          ...t,
          levelMeters: Number(clampedLevel.toFixed(2))
        };
      }
      return t;
    }));
  }, []);

  // Computed Tank Item with dynamic calculated values
  const computeTankValues = (tank: TankUnitRow) => {
    const fillPercent = Number(((tank.levelMeters / tank.maxLevelMeters) * 100).toFixed(1));
    // الكمية من المنسوب الدقيق (وليس من النسبة المقرّبة لرقم عشري واحد) حتى تطابق أرصدة المحطات بعد "تأكيد البيانات"
    const currentStoredLiters = Math.round((tank.levelMeters / (tank.maxLevelMeters || 1)) * tank.capacityLiters);
    const theme = getFillLevelTheme(fillPercent);

    return {
      fillPercent,
      currentStoredLiters,
      theme
    };
  };

  // Base sections default keys
  const BASE_SECTION_KEYS = useMemo(() => ['sahara-gas-8', 'etihad-black-oil', 'gas-petrol-hajj', 'daily-buffer-diesel'], []);

  // Sections custom ordering state (persisted to localStorage)
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('sahara_tank_sections_order_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallback
      }
    }
    return ['sahara-gas-8', 'etihad-black-oil', 'gas-petrol-hajj', 'daily-buffer-diesel'];
  });

  // Save sectionOrder to localStorage
  useEffect(() => {
    localStorage.setItem('sahara_tank_sections_order_v1', JSON.stringify(sectionOrder));
  }, [sectionOrder]);

  // All ordered section keys (includes custom added sections)
  const allOrderedSectionKeys = useMemo(() => {
    const validSectionKeys = Object.keys(allSections);
    // Keep saved order for existing sections
    const ordered = sectionOrder.filter(k => validSectionKeys.includes(k));
    // Append any newly added sections not yet in the saved order
    validSectionKeys.forEach(k => {
      if (!ordered.includes(k)) {
        ordered.push(k);
      }
    });
    return ordered;
  }, [allSections, sectionOrder]);

  // Handlers for reordering sections
  const handleMoveSectionUp = useCallback((secKey: string) => {
    const currentList = [...allOrderedSectionKeys];
    const idx = currentList.indexOf(secKey);
    if (idx <= 0) return;
    const temp = currentList[idx];
    currentList[idx] = currentList[idx - 1];
    currentList[idx - 1] = temp;
    setSectionOrder(currentList);
  }, [allOrderedSectionKeys]);

  const handleMoveSectionDown = useCallback((secKey: string) => {
    const currentList = [...allOrderedSectionKeys];
    const idx = currentList.indexOf(secKey);
    if (idx === -1 || idx >= currentList.length - 1) return;
    const temp = currentList[idx];
    currentList[idx] = currentList[idx + 1];
    currentList[idx + 1] = temp;
    setSectionOrder(currentList);
  }, [allOrderedSectionKeys]);

  const handleResetSectionOrder = useCallback(() => {
    const customKeys = Object.keys(customSections);
    const defaultOrder = [...BASE_SECTION_KEYS.filter(k => allSections[k]), ...customKeys];
    setSectionOrder(defaultOrder);
  }, [allSections, customSections, BASE_SECTION_KEYS]);

  // Sections Data
  const sectionsData = useMemo(() => {
    return allOrderedSectionKeys
      .map(key => {
        const config = allSections[key];
        if (!config) return null;
        // خارج وضع التعديل تُعرض الخزانات الظاهرة فقط، والمجاميع دائمًا بدون المخفية
        const tanks = tankUnits.filter(t => t.sectionKey === key && (isEditMode || !t.hidden));

        let secTotalCapacity = 0;
        let secTotalStored = 0;

        const calculatedTanks = tanks.map(t => {
          const comp = computeTankValues(t);
          if (!t.hidden) {
            secTotalCapacity += t.capacityLiters;
            secTotalStored += comp.currentStoredLiters;
          }
          return { ...t, ...comp };
        });

        const secAveragePercent = secTotalCapacity > 0
          ? Number(((secTotalStored / secTotalCapacity) * 100).toFixed(1))
          : 0;

        return {
          config,
          tanks: calculatedTanks,
          secTotalCapacity,
          secTotalStored,
          secAveragePercent
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [tankUnits, allSections, allOrderedSectionKeys, isEditMode]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-20 font-sans text-slate-800 dark:text-slate-100">
      {/* 🌟 Centralized GPU SVG Shaders & Gradients for 120 FPS */}
      <TankGlobalSvgDefs />
      
      {/* 🌟 1. ENTERPRISE HEADER */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 transition-colors">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          
          {/* Main Title & Brand Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-900 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
              <Fuel className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {tr('خزانات شركة الاتحاد وصحاري كربلاء')}
              </h1>
            </div>
          </div>

          {/* Controls & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">

            {/* Edit Mode Toggle Button */}
            <button
              onClick={() => setIsEditMode(prev => !prev)}
              className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 text-xs font-black transition-all duration-200 cursor-pointer shadow-xs ${
                isEditMode
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500 shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40 animate-pulse'
                  : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-600'
              }`}
              title={isEditMode ? tr('حفظ وإنهاء وضع التعديل') : tr('تفعيل وضع تعديل الخزانات')}
            >
              {isEditMode ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300 stroke-[2.5]" />
                  <span>{tr('حفظ التعديلات')}</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{tr('تعديل الخزانات')}</span>
                </>
              )}
            </button>

            {/* Reorder Sections Button */}
            <button
              onClick={() => setIsReorderModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 hover:border-blue-300 dark:hover:border-blue-600"
              title={tr('تعديل ترتيب ظهور الأقسام')}
            >
              <ArrowUpDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{tr('ترتيب الأقسام')}</span>
            </button>

            {/* Add Button with Section Selection Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSectionDropdownOpen(prev => !prev)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-500 font-black text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer hover:shadow-md active:scale-98"
                title={tr('إضافة خزان أو قسم جديد')}
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>{tr('إضافة')}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isSectionDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Floating Dropdown for Sections */}
              {isSectionDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsSectionDropdownOpen(false)}
                  />
                  <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-32px)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                    <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-400">
                      {tr('اختر القسم لإضافة خزان إليه:')}
                    </div>

                    {allOrderedSectionKeys.map((key) => {
                      const sec = allSections[key];
                      if (!sec) return null;
                      const Icon = getSectionIcon(sec);
                      return (
                        <button
                          key={sec.key}
                          onClick={() => {
                            setSelectedSectionKey(sec.key);
                            setEditingTank(null);
                            setIsSectionDropdownOpen(false);
                            setIsAddModalOpen(true);
                          }}
                          className="w-full text-right p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center gap-3 transition-colors cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Icon className="w-4 h-4" style={{ color: sec.accentColor }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                              {sec.name}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {sec.company}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })}

                    {/* خيار إضافة قسم آخر في نهاية القائمة */}
                    <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setIsSectionDropdownOpen(false);
                          setIsAddSectionModalOpen(true);
                        }}
                        className="w-full text-right p-2.5 rounded-xl bg-blue-50/70 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-between transition-colors cursor-pointer font-bold text-xs group"
                      >
                        <span className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400 stroke-[2.5]" />
                          <span>{tr('إضافة قسم آخر')}</span>
                        </span>
                        <Layers className="w-4 h-4 text-blue-500 opacity-70 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>

                  </div>
                </>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* 🚀 2. SECTIONS GRID */}
      <div className="space-y-8 sm:space-y-10">
        {sectionsData.map(({ config, tanks, secTotalCapacity, secTotalStored, secAveragePercent }, sectionIndex) => {
          const Icon = getSectionIcon(config);

          return (
            <div
              key={config.key}
              className="rounded-[32px] bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/90 shadow-soft-card dark:shadow-[0_15px_40px_rgba(0,0,0,0.6)] p-5 sm:p-7 space-y-6 relative overflow-hidden transition-colors duration-300"
            >
              
              {/* Header Banner */}
              <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${config.headerGrad} border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10`}>
                
                {/* Title & Badge */}
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center shadow-xs shrink-0">
                    <Icon className="w-6 h-6" style={{ color: config.accentColor }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-white/80 dark:bg-slate-900/80 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 shadow-2xs">
                        #{sectionIndex + 1}
                      </span>
                      {renamingSectionKey === config.key ? (
                        <input
                          autoFocus
                          value={draftSectionName}
                          onChange={e => setDraftSectionName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveRenameSection(); if (e.key === 'Escape') setRenamingSectionKey(null); }}
                          className="text-base sm:text-lg font-black text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-blue-400 rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-500/30 min-w-[220px]"
                        />
                      ) : (
                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                          {config.name}
                        </h2>
                      )}
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}>
                        {tanks.length} {tr('خزانات')}
                      </span>
                    </div>
                    {renamingSectionKey === config.key ? (
                      <input
                        value={draftSectionDesc}
                        onChange={e => setDraftSectionDesc(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveRenameSection(); if (e.key === 'Escape') setRenamingSectionKey(null); }}
                        placeholder={tr('وصف القسم')}
                        className="mt-1 w-full max-w-md text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        {config.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Section Controls (Move Up / Move Down / Delete) & Metrics */}
                <div className="flex items-center gap-2.5 self-end md:self-center shrink-0">
                  {isEditMode && (
                    <div className="flex items-center gap-1.5 animate-in fade-in">
                      {/* Rename Section */}
                      {renamingSectionKey === config.key ? (
                        <>
                          <button type="button" onClick={saveRenameSection} title={tr('حفظ اسم القسم')}
                            className="w-9 h-9 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center cursor-pointer shadow-xs hover:scale-105 active:scale-95 transition-all">
                            <Check className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => setRenamingSectionKey(null)} title={tr('إلغاء')}
                            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer shadow-2xs hover:scale-105 active:scale-95 transition-all">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => startRenameSection(config)} title={tr('تعديل اسم القسم')}
                          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-200 hover:text-blue-600 flex items-center justify-center cursor-pointer shadow-2xs hover:scale-105 active:scale-95 transition-all">
                          <PencilLine className="w-4 h-4" />
                        </button>
                      )}

                      {/* Move Section Up */}
                      <button
                        type="button"
                        disabled={sectionIndex === 0}
                        onClick={() => handleMoveSectionUp(config.key)}
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                          sectionIndex === 0
                            ? 'opacity-30 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                            : 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-200 hover:text-blue-600 border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs hover:scale-105 active:scale-95'
                        }`}
                        title={tr('تحريك هذا القسم للأعلى')}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      {/* Move Section Down */}
                      <button
                        type="button"
                        disabled={sectionIndex === sectionsData.length - 1}
                        onClick={() => handleMoveSectionDown(config.key)}
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                          sectionIndex === sectionsData.length - 1
                            ? 'opacity-30 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                            : 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-200 hover:text-blue-600 border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs hover:scale-105 active:scale-95'
                        }`}
                        title={tr('تحريك هذا القسم للأسفل')}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      {/* Delete Section */}
                      <button
                        onClick={() => setSectionToDelete(config)}
                        className="w-9 h-9 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/90 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-all cursor-pointer shadow-xs flex items-center justify-center hover:scale-105 active:scale-95"
                        title={tr('حذف هذا القسم بالكامل')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 block">{tr('إجمالي مخزون الجدول')}</span>
                      <span className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white">
                        {formatNumber(secTotalStored)} <span className="text-[9px] text-slate-400 font-normal">/ {formatNumber(secTotalCapacity)} {tr('لتر')}</span>
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center font-mono font-black text-xs text-blue-600 dark:text-blue-400">
                      {secAveragePercent.toFixed(0)}%
                    </div>
                  </div>
                </div>

              </div>

              {/* 🎨 Hyper-Realistic 3D SCADA Tanks Grid (120 FPS Memoized Cards) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
                {tanks.map((tank) => (
                  <Tank3DCard
                    key={tank.id}
                    tank={tank}
                    onLevelChange={handleLevelChange}
                    isEditable={isEditMode}
                    onEdit={handleEditTank}
                    onDelete={setTankToDelete}
                    onToggleHidden={handleToggleHidden}
                  />
                ))}
              </div>

            </div>
          );
        })}
      </div>

      {/* 🌟 3. MODAL: ADD / EDIT TANK */}
      <AddTankModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTank(null);
        }}
        onAddTank={handleAddNewTank}
        onUpdateTank={handleUpdateTank}
        onDeleteTank={handleDeleteTank}
        sections={allSections}
        initialSectionKey={selectedSectionKey}
        allTanks={tankUnits}
        editingTank={editingTank}
      />

      {/* 🌟 4. MODAL: ADD NEW SECTION */}
      <AddSectionModal
        isOpen={isAddSectionModalOpen}
        onClose={() => setIsAddSectionModalOpen(false)}
        onAddSection={handleAddNewSection}
      />

      {/* ⚠️ 5. MODAL: CONFIRM DELETE SECTION (نافذة تأكيد حذف القسم في المنتصف عبر Portal لملء كامل الشاشة) */}
      {sectionToDelete && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setSectionToDelete(null)} />
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
                {tr('تأكيد حذف القسم')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                {tr('هل أنت متأكد من رغبتك في حذف')} <strong className="text-rose-600 dark:text-rose-400 font-bold">"{sectionToDelete.name}"</strong>؟ {tr('سيتم إزالة هذا القسم مع كافة الخزانات التابعة له فورياً.')}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSectionToDelete(null)}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                {tr('إلغاء')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSection}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-500/25 transition-all cursor-pointer hover:shadow-lg active:scale-98 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{tr('حذف')}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ⚠️ 6. MODAL: CONFIRM DELETE TANK (نافذة تأكيد حذف الخزان في المنتصف عبر Portal لملء كامل الشاشة) */}
      {tankToDelete && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setTankToDelete(null)} />
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
                {tr('تأكيد حذف الخزان')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                {tr('هل أنت متأكد من رغبتك في حذف الخزان')} <strong className="text-rose-600 dark:text-rose-400 font-bold">"{tankToDelete.name}"</strong> ({tankToDelete.code})؟
                <br />
                <span className="text-slate-500 dark:text-slate-400 text-xs mt-1 block">{tr('لا يمكن التراجع عن هذا الإجراء وسيتم إزالة الخزان من المنظومة فورياً.')}</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTankToDelete(null)}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                {tr('إلغاء')}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteTank(tankToDelete.id);
                  setTankToDelete(null);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-500/25 transition-all cursor-pointer hover:shadow-lg active:scale-98 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{tr('حذف الخزان')}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 🌟 7. MODAL: REORDER SECTIONS */}
      <ReorderSectionsModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        sections={allSections}
        orderedKeys={allOrderedSectionKeys}
        onReorder={(newKeys) => setSectionOrder(newKeys)}
        onResetOrder={handleResetSectionOrder}
      />

    </div>
  );
};
