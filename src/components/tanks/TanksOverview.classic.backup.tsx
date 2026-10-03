// نسخه احتياطية كاملة ومحفوظة للتصميم القياسي السابق (Classic SCADA API-650 Design)
import React, { useState, useMemo, useEffect } from 'react';
import {
  Fuel,
  Droplets,
  RotateCcw,
  Activity
} from 'lucide-react';
import { formatNumber } from '../../lib/utils';

export interface TankUnitRow {
  id: string;
  code: string;
  name: string;
  sectionKey: string;
  sectionName: string;
  company: 'صحاري كربلاء' | 'شركة الاتحاد' | 'شركة صحاري كربلاء';
  levelMeters: number;
  maxLevelMeters: number;
  capacityLiters: number;
  temperatureC: number;
  pressureBar: number;
}

export interface TankSectionConfig {
  key: string;
  name: string;
  company: 'صحاري كربلاء' | 'شركة الاتحاد' | 'شركة صحاري كربلاء';
  icon: React.ElementType;
  description: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  headerGrad: string;
}

const SECTION_CONFIGS: Record<string, TankSectionConfig> = {
  'daily-buffer-diesel': {
    key: 'daily-buffer-diesel',
    name: 'خزانات التشغيل اليومي (بفر / ديزل)',
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
    name: 'عمليات الاتحاد (النفط الأسود)',
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

const OFFICIAL_TABLE_TANK_UNITS: TankUnitRow[] = [
  {
    id: 'tk-tbl-dy-01',
    code: 'TK-DY-01',
    name: 'خزان الوقود اليومي',
    sectionKey: 'daily-buffer-diesel',
    sectionName: 'خزانات التشغيل اليومي (بفر / ديزل)',
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
    sectionName: 'خزانات التشغيل اليومي (بفر / ديزل)',
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
    sectionName: 'خزانات التشغيل اليومي (بفر / ديزل)',
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
    sectionName: 'خزانات التشغيل اليومي (بفر / ديزل)',
    company: 'صحاري كربلاء',
    levelMeters: 3.50,
    maxLevelMeters: 6.00,
    capacityLiters: 154740,
    temperatureC: 26.9,
    pressureBar: 1.10
  },
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
  {
    id: 'tk-tbl-et-01',
    code: 'TK-ET-01',
    name: 'خزان الطاقة القديمة',
    sectionKey: 'etihad-black-oil',
    sectionName: 'عمليات الاتحاد (النفط الأسود)',
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
    sectionName: 'عمليات الاتحاد (النفط الأسود)',
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
    sectionName: 'عمليات الاتحاد (النفط الأسود)',
    company: 'شركة الاتحاد',
    levelMeters: 18.46,
    maxLevelMeters: 20.00,
    capacityLiters: 39000000,
    temperatureC: 46.5,
    pressureBar: 1.45
  },
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

export const getFillLevelTheme = (percent: number) => {
  if (percent >= 80) {
    return {
      status: 'safe',
      statusLabel: 'ممتاز',
      gradientFrom: '#064e3b',
      gradientVia: '#059669',
      gradientTo: '#10b981',
      waveColor: '#34d399',
      textColor: '#10b981',
      laserGlow: '#10b981',
      laserTrack: 'from-emerald-500/20 via-emerald-500 to-teal-400',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    };
  } else if (percent >= 60) {
    return {
      status: 'safe',
      statusLabel: 'جيد',
      gradientFrom: '#1e3a8a',
      gradientVia: '#2563eb',
      gradientTo: '#3b82f6',
      waveColor: '#60a5fa',
      textColor: '#3b82f6',
      laserGlow: '#3b82f6',
      laserTrack: 'from-blue-600/20 via-blue-500 to-cyan-400',
      badgeClass: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800',
    };
  } else if (percent >= 31) {
    return {
      status: 'warning',
      statusLabel: 'منخفض',
      gradientFrom: '#78350f',
      gradientVia: '#d97706',
      gradientTo: '#f59e0b',
      waveColor: '#fbbf24',
      textColor: '#f59e0b',
      laserGlow: '#f59e0b',
      laserTrack: 'from-amber-600/20 via-amber-500 to-yellow-400',
      badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    };
  } else {
    return {
      status: 'critical',
      statusLabel: 'حرج',
      gradientFrom: '#7f1d1d',
      gradientVia: '#dc2626',
      gradientTo: '#ef4444',
      waveColor: '#f87171',
      textColor: '#ef4444',
      laserGlow: '#ef4444',
      laserTrack: 'from-rose-600/20 via-rose-500 to-red-400',
      badgeClass: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse',
    };
  }
};

export const TanksOverviewClassicBackup: React.FC = () => {
  const [tankUnits, setTankUnits] = useState<TankUnitRow[]>(() => {
    const saved = localStorage.getItem('sahara_tank_units_scifi_ruler_v11');
    return saved ? JSON.parse(saved) : OFFICIAL_TABLE_TANK_UNITS;
  });

  useEffect(() => {
    localStorage.setItem('sahara_tank_units_scifi_ruler_v11', JSON.stringify(tankUnits));
  }, [tankUnits]);

  const handleLevelChange = (id: string, newLevel: number) => {
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
  };

  const handleResetDefaults = () => {
    if (window.confirm('هل تريد إعادة تعيين كافة مستويات الخزانات إلى القراءات الرسمية للجداول؟')) {
      setTankUnits(OFFICIAL_TABLE_TANK_UNITS);
      localStorage.removeItem('sahara_tank_units_scifi_ruler_v11');
    }
  };

  const computeTankValues = (tank: TankUnitRow) => {
    const fillPercent = Number(((tank.levelMeters / tank.maxLevelMeters) * 100).toFixed(1));
    const currentStoredLiters = Math.round((fillPercent / 100) * tank.capacityLiters);
    const theme = getFillLevelTheme(fillPercent);

    return {
      fillPercent,
      currentStoredLiters,
      theme
    };
  };

  const sectionKeys = ['sahara-gas-8', 'etihad-black-oil', 'gas-petrol-hajj', 'daily-buffer-diesel'];

  const overallMetrics = useMemo(() => {
    let totalCap = 0;
    let totalStored = 0;

    tankUnits.forEach(t => {
      const { currentStoredLiters } = computeTankValues(t);
      totalCap += t.capacityLiters;
      totalStored += currentStoredLiters;
    });

    const percent = totalCap > 0 ? Number(((totalStored / totalCap) * 100).toFixed(1)) : 0;
    return { totalCap, totalStored, percent };
  }, [tankUnits]);

  const sectionsData = useMemo(() => {
    return sectionKeys
      .map(key => {
        const config = SECTION_CONFIGS[key];
        const tanks = tankUnits.filter(t => t.sectionKey === key);

        let secTotalCapacity = 0;
        let secTotalStored = 0;

        const calculatedTanks = tanks.map(t => {
          const comp = computeTankValues(t);
          secTotalCapacity += t.capacityLiters;
          secTotalStored += comp.currentStoredLiters;
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
      .filter(s => s.tanks.length > 0);
  }, [tankUnits]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-20 font-sans text-slate-800 dark:text-slate-100">
      
      {/* 🌟 1. CLEAN MINIMALIST ENTERPRISE HEADER */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 transition-colors">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0 shadow-sm">
              <Fuel className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  خزانات شركة الاتحاد وصحاري كربلاء (التصميم السابق)
                </h1>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold border border-slate-200 dark:border-slate-700">
                  SCADA API-650
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  مباشر
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                متابعة حية للمخزونات الهيدروليكية، المعايرة المترية، والطاقة الاستيعابية
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">المخزون الفعلي</span>
                <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white">
                  {formatNumber(overallMetrics.totalStored)} <span className="text-[10px] text-slate-400 font-normal">لتر</span>
                </span>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">السعة والامتلاء</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {overallMetrics.percent}%
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ({formatNumber(overallMetrics.totalCap)} لتر)
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleResetDefaults}
              title="إعادة ضبط القراءات الافتراضية للجداول"
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* 🚀 Sections */}
      <div className="space-y-8 sm:space-y-10">
        {sectionsData.map(({ config, tanks, secTotalCapacity, secTotalStored, secAveragePercent }) => {
          const Icon = config.icon;

          return (
            <div
              key={config.key}
              className="rounded-[32px] bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/90 shadow-soft-card dark:shadow-[0_15px_40px_rgba(0,0,0,0.6)] p-5 sm:p-7 space-y-6 relative overflow-hidden transition-colors duration-300"
            >
              
              <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${config.headerGrad} border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10`}>
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center shadow-xs shrink-0">
                    <Icon className="w-6 h-6" style={{ color: config.accentColor }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                        {config.name}
                      </h2>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}>
                        {config.company}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                      {config.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs self-end md:self-center shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block">إجمالي مخزون الجدول</span>
                    <span className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white">
                      {formatNumber(secTotalStored)} <span className="text-[9px] text-slate-400 font-normal">/ {formatNumber(secTotalCapacity)} لتر</span>
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center font-mono font-black text-xs text-blue-600 dark:text-blue-400">
                    {secAveragePercent.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {tanks.map((tank) => {
                  const fillHeightPercent = `${Math.min(100, Math.max(0, tank.fillPercent))}%`;
                  const theme = tank.theme;
                  const sliderPercent = Math.min(100, Math.max(0, (tank.levelMeters / tank.maxLevelMeters) * 100));

                  return (
                    <div
                      key={tank.id}
                      className="rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-soft-card hover:shadow-xl hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 flex flex-col justify-between space-y-4 group relative overflow-hidden backdrop-blur-xs"
                    >
                      <div
                        className="absolute top-0 inset-x-0 h-[2.5px] transition-colors duration-500 z-10"
                        style={{ backgroundColor: theme.textColor }}
                      />

                      <div className="flex items-start justify-between gap-2 pt-0.5">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span
                                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                style={{ backgroundColor: theme.textColor }}
                              />
                              <span
                                className="relative inline-flex rounded-full h-2 w-2"
                                style={{ backgroundColor: theme.textColor }}
                              />
                            </span>

                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                              {tank.code}
                            </span>

                            <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                              {tank.name}
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-xs font-black font-mono px-2.5 py-0.5 rounded-full border shadow-2xs ${theme.badgeClass}`}>
                            {tank.fillPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* 3D Tank Render */}
                      <div className="flex flex-col items-center justify-center pt-3 pb-1 relative">
                        
                        {/* 1. Dome Roof */}
                        <div className="relative w-28 sm:w-32 flex flex-col items-center z-20">
                          <div className="absolute -top-3.5 inset-x-0.5 flex items-end justify-between px-1 z-30 pointer-events-none">
                            <div className="flex flex-col items-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-300 dark:bg-amber-400 shadow-[0_0_8px_#f59e0b] border border-amber-500 animate-pulse" />
                              <div className="w-0.5 h-2 bg-slate-500 dark:bg-slate-400" />
                            </div>
                            <div className="flex flex-col items-center -mb-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-300 dark:bg-amber-400 shadow-[0_0_8px_#f59e0b] border border-amber-500" />
                              <div className="w-0.5 h-2.5 bg-slate-500 dark:bg-slate-400" />
                            </div>
                            <div className="absolute inset-x-2 bottom-1 h-px bg-slate-400 dark:bg-slate-500" />
                            <div className="absolute inset-x-2 bottom-2 h-px bg-slate-400/80 dark:bg-slate-500/80" />
                            <div className="flex flex-col items-center -mb-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-300 dark:bg-amber-400 shadow-[0_0_8px_#f59e0b] border border-amber-500" />
                              <div className="w-0.5 h-2.5 bg-slate-500 dark:bg-slate-400" />
                            </div>
                            <div className="flex flex-col items-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-300 dark:bg-amber-400 shadow-[0_0_8px_#f59e0b] border border-amber-500 animate-pulse" />
                              <div className="w-0.5 h-2 bg-slate-500 dark:bg-slate-400" />
                            </div>
                          </div>

                          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-30">
                            <div className="w-2.5 h-1.5 bg-gradient-to-t from-slate-600 via-slate-400 to-slate-300 dark:from-slate-700 dark:via-slate-500 dark:to-slate-400 rounded-t-xs border border-slate-600 dark:border-slate-500 shadow-xs flex items-center justify-center">
                              <div className="w-0.5 h-0.5 bg-slate-700 dark:bg-slate-300" />
                            </div>
                            <div className="w-1.5 h-2 bg-slate-500 dark:bg-slate-600 rounded-t-full border border-slate-600 dark:border-slate-400 shadow-xs" />
                          </div>

                          <div className="w-full h-5.5 rounded-t-[100%] bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500 dark:from-slate-600 dark:via-slate-700 dark:to-slate-800 border-t-2 border-x-2 border-slate-500 dark:border-slate-600 shadow-md relative overflow-hidden flex items-end">
                            <div className="absolute inset-y-0 left-4 w-5 bg-white/40 dark:bg-white/15 blur-[1px] transform -skew-x-12" />
                            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/35 to-transparent" />
                            <div className="w-full h-1 bg-slate-500/90 dark:bg-slate-600/90 border-t border-slate-400/50" />
                          </div>

                          <div className="w-[104%] h-1 bg-gradient-to-r from-slate-400 via-slate-300 to-slate-500 dark:from-slate-700 dark:via-slate-600 dark:to-slate-800 border-y border-slate-500 dark:border-slate-600 shadow-xs z-20" />
                        </div>

                        {/* 2. Cylindrical Shell */}
                        <div className="relative flex items-center justify-center">
                          <div dir="ltr" className="absolute -left-13 top-0 bottom-0 flex items-stretch gap-1.5 z-20 select-none group/tankgauge">
                            <div className="flex flex-col justify-between text-[7.5px] font-mono font-extrabold text-slate-700 dark:text-slate-200 py-1 text-right z-30">
                              <div className="flex items-center gap-0.5 justify-end">
                                <span>{tank.maxLevelMeters.toFixed(0)}م</span>
                                <span className="w-1.5 h-px bg-slate-500 dark:bg-slate-400" />
                              </div>
                              <div className="flex items-center gap-0.5 justify-end">
                                <span>{(tank.maxLevelMeters * 0.75).toFixed(0)}م</span>
                                <span className="w-1 h-px bg-slate-400 dark:bg-slate-500" />
                              </div>
                              <div className="flex items-center gap-0.5 justify-end">
                                <span>{(tank.maxLevelMeters * 0.5).toFixed(0)}م</span>
                                <span className="w-1.5 h-px bg-slate-500 dark:bg-slate-400" />
                              </div>
                              <div className="flex items-center gap-0.5 justify-end">
                                <span>{(tank.maxLevelMeters * 0.25).toFixed(0)}م</span>
                                <span className="w-1 h-px bg-slate-400 dark:bg-slate-500" />
                              </div>
                              <div className="flex items-center gap-0.5 justify-end">
                                <span>0م</span>
                                <span className="w-1.5 h-px bg-slate-500 dark:bg-slate-400" />
                              </div>
                            </div>

                            <div className="relative flex flex-col items-center h-full">
                              <div className="w-3.5 h-1 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 dark:from-slate-700 dark:via-slate-500 dark:to-slate-700 border border-slate-500 dark:border-slate-600 rounded-none shadow-xs z-10" />

                              <div className="relative w-2.5 flex-1 bg-slate-200/90 dark:bg-slate-900 border-x border-slate-400 dark:border-slate-700 rounded-none overflow-hidden flex flex-col justify-end shadow-inner">
                                <div className="absolute inset-y-0 left-0.5 w-0.5 bg-white/40 dark:bg-white/10 pointer-events-none z-10" />
                                <div
                                  className="w-full rounded-none transition-all duration-300 relative"
                                  style={{
                                    height: `${sliderPercent}%`,
                                    backgroundColor: theme.textColor
                                  }}
                                >
                                  <div className="absolute top-0 inset-x-0 h-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] z-20" />
                                </div>
                              </div>

                              <div className="w-3.5 h-1 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 dark:from-slate-700 dark:via-slate-500 dark:to-slate-700 border border-slate-500 dark:border-slate-600 rounded-none shadow-xs z-10" />

                              <input
                                type="range"
                                min="0"
                                max={tank.maxLevelMeters}
                                step="0.05"
                                value={tank.levelMeters}
                                onChange={(e) => handleLevelChange(tank.id, parseFloat(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30 [writing-mode:vertical-lr] [direction:rtl]"
                                title="اسحب على مسطرة الخزان لضبط المنسوب"
                              />
                            </div>
                          </div>

                          <div className="w-28 sm:w-32 h-36 sm:h-40 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-300 dark:from-slate-900 dark:via-slate-800 dark:to-slate-950 border-x-2 border-b-2 border-slate-500 dark:border-slate-700 relative overflow-hidden flex flex-col justify-end shadow-2xl z-10">
                            <div className="absolute inset-x-0 top-[25%] h-[1.5px] bg-slate-400/90 dark:bg-slate-700 z-20 pointer-events-none shadow-xs" />
                            <div className="absolute inset-x-0 top-[50%] h-[1.5px] bg-slate-400/90 dark:bg-slate-700 z-20 pointer-events-none shadow-xs" />
                            <div className="absolute inset-x-0 top-[75%] h-[1.5px] bg-slate-400/90 dark:bg-slate-700 z-20 pointer-events-none shadow-xs" />
                            <div className="absolute inset-x-0 top-[50%] h-1 bg-gradient-to-r from-slate-400 via-slate-300 to-slate-500 dark:from-slate-800 dark:via-slate-700 dark:to-slate-900 border-y border-slate-500/70 z-20 pointer-events-none opacity-90" />

                            <div className="absolute inset-y-0 left-0 w-full z-20 pointer-events-none opacity-30 dark:opacity-25">
                              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                                <path
                                  d="M 5,95 Q 50,70 95,50 T 5,5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeDasharray="2,3"
                                  className="text-slate-700 dark:text-slate-300"
                                />
                              </svg>
                            </div>

                            <div className="absolute right-1.5 inset-y-0 flex flex-col justify-between py-1 text-[7.5px] font-mono font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] select-none z-30 pointer-events-none text-right">
                              <span>100%</span>
                              <span>75%</span>
                              <span>50%</span>
                              <span>25%</span>
                              <span>0%</span>
                            </div>

                            <div className="absolute inset-y-0 left-0 w-3.5 bg-gradient-to-r from-black/35 via-black/15 to-transparent pointer-events-none z-20" />
                            <div className="absolute inset-y-0 right-0 w-3.5 bg-gradient-to-l from-black/35 via-black/15 to-transparent pointer-events-none z-20" />
                            <div className="absolute inset-y-0 left-6 w-3 bg-white/35 dark:bg-white/10 blur-[1px] pointer-events-none z-20" />

                            <div
                              className="w-full relative overflow-hidden transition-all duration-700 ease-out z-10"
                              style={{
                                height: fillHeightPercent,
                                background: `linear-gradient(to top, ${theme.gradientFrom}, ${theme.gradientVia}, ${theme.gradientTo})`,
                              }}
                            >
                              <div className="absolute -top-2 inset-x-0 h-3 opacity-85">
                                <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full animate-pulse">
                                  <path
                                    d="M0.00,49.98 C150.00,140.00 349.20,-40.00 500.00,49.98 L500.00,150.00 L0.00,150.00 Z"
                                    fill={theme.waveColor}
                                  />
                                </svg>
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-black/35 pointer-events-none" />
                            </div>
                          </div>

                          {/* Pipeline */}
                          <div className="absolute -right-3 top-0.5 bottom-0 flex flex-col items-center justify-between z-20 pointer-events-none">
                            <div className="flex items-center -mr-0.5">
                              <div className="w-1 h-2 bg-slate-400 dark:bg-slate-500 border border-slate-600 shadow-2xs" />
                              <div className="w-2 h-1.5 bg-gradient-to-br from-slate-300 via-slate-100 to-slate-500 dark:from-slate-700 dark:via-slate-400 dark:to-slate-900 border-t border-l border-slate-500 shadow-2xs" />
                            </div>

                            <div className="relative w-2 flex-1 bg-gradient-to-r from-slate-400 via-slate-100 to-slate-500 dark:from-slate-800 dark:via-slate-400 dark:to-slate-900 border-x border-slate-500 dark:border-slate-700 shadow-md flex flex-col justify-around items-center">
                              <div className="w-2.5 h-1 bg-slate-500 dark:bg-slate-700 border-y border-slate-600 shadow-2xs" />

                              <div className="relative flex flex-col items-center z-30 my-0.5">
                                <div className="w-2.5 h-0.5 bg-slate-400 dark:bg-slate-600 border border-slate-600 shadow-2xs" />
                                <div className="relative flex items-center justify-center my-0.5">
                                  <div className="w-2.5 h-3 rounded-xs bg-gradient-to-b from-slate-400 via-slate-200 to-slate-500 dark:from-slate-700 dark:via-slate-500 dark:to-slate-800 border border-slate-600 shadow-xs" />
                                  <div className="absolute w-5 h-5 flex items-center justify-center filter drop-shadow-md">
                                    <svg viewBox="0 0 100 100" className="w-full h-full text-slate-800 dark:text-slate-200">
                                      <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="10" />
                                      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                                      <line x1="50" y1="50" x2="50" y2="8" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                                      <line x1="50" y1="50" x2="92" y2="50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                                      <line x1="50" y1="50" x2="50" y2="92" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                                      <line x1="50" y1="50" x2="8" y2="50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                                      <circle cx="50" cy="50" r="14" fill="#64748b" stroke="#334155" strokeWidth="2" />
                                      <circle cx="50" cy="50" r="5" fill="#f59e0b" />
                                    </svg>
                                  </div>
                                </div>
                                <div className="w-2.5 h-0.5 bg-slate-400 dark:bg-slate-600 border border-slate-600 shadow-2xs" />
                              </div>

                              <div className="w-2.5 h-1 bg-slate-500 dark:bg-slate-700 border-y border-slate-600 shadow-2xs" />
                              <div className="absolute inset-y-0 left-0.2 w-0.5 bg-white/40 dark:bg-white/20 pointer-events-none" />
                            </div>

                            <div className="flex items-center -mr-0.5">
                              <div className="w-2 h-1.5 bg-gradient-to-tr from-slate-400 via-slate-200 to-slate-500 dark:from-slate-800 dark:via-slate-500 dark:to-slate-900 border-b border-l border-slate-500 shadow-2xs" />
                              <div className="w-1 h-2 bg-slate-400 dark:bg-slate-500 border border-slate-600 shadow-2xs" />
                            </div>
                          </div>
                        </div>

                        {/* 3. Base */}
                        <div className="relative flex flex-col items-center z-10">
                          <div className="w-[104%] h-1.5 bg-gradient-to-r from-slate-400 via-slate-300 to-slate-500 dark:from-slate-700 dark:via-slate-600 dark:to-slate-800 border-x border-t border-slate-500 dark:border-slate-600 shadow-xs" />
                          <div className="w-34 sm:w-38 h-2 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-400 dark:from-slate-800 dark:via-slate-700 dark:to-slate-900 rounded-b-md border-t border-slate-400 dark:border-slate-600 shadow-lg" />
                        </div>
                      </div>

                      {/* Unified Console */}
                      <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block uppercase">المخزون الفعلي</span>
                            <div className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white leading-tight">
                              {formatNumber(tank.currentStoredLiters)} <span className="text-[10px] font-normal text-slate-400">لتر</span>
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
                            {theme.statusLabel}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-2">
                          <div className="text-[10px] text-slate-400 font-mono">
                            <span>السعة: </span>
                            <strong className="text-slate-700 dark:text-slate-300">{formatNumber(tank.capacityLiters)} لتر</strong>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">المنسوب:</span>
                            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus-within:border-blue-500 rounded-lg px-2 py-0.5 shadow-2xs">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={tank.maxLevelMeters}
                                value={tank.levelMeters}
                                onChange={(e) => handleLevelChange(tank.id, parseFloat(e.target.value))}
                                className="w-12 bg-transparent text-slate-900 dark:text-white font-mono font-black text-center text-xs focus:outline-none"
                              />
                              <span className="text-[10px] text-slate-400 font-bold mr-1">م</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
