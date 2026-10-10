import React, { useState } from 'react';
import {
  Settings,
  Palette,
  Layout,
  Sun,
  Moon,
  RotateCcw,
  CheckCircle2,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  HardDrive,
  Server,
  Sparkles,
  Layers,
  Activity,
  SlidersHorizontal,
  Maximize2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useFuelStore } from '../../context/FuelDataContext';
import {
  SidebarStyle,
  BgGradientTheme,
} from '../../types';
import { getShadePalette } from '../../lib/themeGradients';
import { UsersAdmin } from '../admin/UsersAdmin';
import { SystemConsole } from '../system/SystemConsole';
import { usePermissions } from '../../lib/usePermission';

type SectionId = 'users' | 'system' | 'appearance' | 'data';

// العنوان والوصف في settings:sections.<id>.title / desc
interface SectionDef {
  id: SectionId;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  adminOnly?: boolean;
}

const SECTIONS: SectionDef[] = [
  { id: 'users', icon: Users, gradient: 'from-violet-600 to-indigo-600', adminOnly: true },
  { id: 'system', icon: Server, gradient: 'from-slate-700 to-slate-900', adminOnly: true },
  { id: 'appearance', icon: Palette, gradient: 'from-amber-500 via-rose-500 to-indigo-600' },
  { id: 'data', icon: HardDrive, gradient: 'from-rose-500 to-red-600', adminOnly: true },
];

const SECTION_KEY = 'sahara_settings_section';
const readSection = (): SectionId | null => {
  try {
    const s = sessionStorage.getItem(SECTION_KEY);
    if (s === 'navigation') return 'appearance';
    return (s as SectionId) || null;
  } catch { return null; }
};

const cardCls = 'rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-soft-card';

export const SettingsView: React.FC = () => {
  const { t, i18n } = useTranslation('settings');
  const rtl = i18n.dir() === 'rtl';
  const Back = rtl ? ArrowRight : ArrowLeft;
  const Crumb = rtl ? ChevronLeft : ChevronRight;
  const { isAdmin } = usePermissions();
  const [section, setSectionState] = useState<SectionId | null>(readSection);
  const setSection = (s: SectionId | null) => {
    setSectionState(s);
    try { if (s) sessionStorage.setItem(SECTION_KEY, s); else sessionStorage.removeItem(SECTION_KEY); } catch { /* تجاهل */ }
    window.scrollTo({ top: 0 });
  };

  const { canCustomize } = useTheme();
  const visible = SECTIONS.filter(s => (!s.adminOnly || isAdmin) && (s.id !== 'appearance' || canCustomize));
  const current = visible.find(s => s.id === section) || null;

  return (
    <div className={`space-y-5 mx-auto w-full ${current?.id === 'users' || current?.id === 'system' ? 'xl:w-[95%]' : 'max-w-4xl'}`}>
      {/* صفحة المستخدمين: 95% من عرض الشاشة على الكمبيوتر، وكامل العرض على الشاشات الأصغر */}
      {/* الترويسة: عنوان الإعدادات أو مسار القسم المفتوح */}
      {current ? (
        <div className="flex items-center gap-3">
          <button onClick={() => setSection(null)} aria-label={t('back')}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm">
            <Back className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <button onClick={() => setSection(null)} className="hover:text-blue-600">{t('title')}</button>
              <Crumb className="w-3 h-3" />
              <span className="text-slate-500">{t(`sections.${current.id}.title`)}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">{t(`sections.${current.id}.title`)}</h2>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            <span>{t('title')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
      )}

      {!current && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {visible.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
                className="group relative overflow-hidden text-start rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-soft-card hover:shadow-xl hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-900 transition-all duration-200">
                <div aria-hidden className={`absolute -end-10 -top-10 w-32 h-32 rounded-full bg-gradient-to-br ${s.gradient} opacity-[0.08] group-hover:opacity-[0.16] transition-opacity`} />
                <div className="relative flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.gradient} text-white flex items-center justify-center shadow-lg shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">{t(`sections.${s.id}.title`)}</span>
                      {s.adminOnly && <ShieldCheck className="w-3.5 h-3.5 text-amber-500" aria-label={t('adminOnly')} />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t(`sections.${s.id}.desc`)}</p>
                  </div>
                  <Crumb className="w-5 h-5 text-slate-300 group-hover:text-blue-500 rtl:group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5 transition-all self-center" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {current?.id === 'users' && <UsersAdmin />}
      {current?.id === 'system' && <SystemConsole />}
      {current?.id === 'appearance' && <AppearanceAndNavigationSection />}
      {current?.id === 'data' && <DataSection />}
    </div>
  );
};

// ───── المظهر والإضاءة وشريط التنقل (مدمج في صفحة واحدة احترافية) ─────
const AppearanceAndNavigationSection: React.FC = () => {
  const { t } = useTranslation('settings');
  const {
    themeMode,
    setThemeMode,
    sidebarStyle,
    setSidebarStyle,
    bgGradient,
    setBgGradient,
    gradientIntensity,
    setGradientIntensity,
    shadeLevel,
    setShadeLevel,
    glassmorphism,
    setGlassmorphism,
    uiDensity,
    setUiDensity,
    resetAllAppearance,
  } = useTheme();

  // مصفوفة الطبقات التدريجية العشر للثيم والوضع الحالي
  const shadePalette = getShadePalette(bgGradient, themeMode);
  const currentShade = shadePalette.find((s) => s.level === shadeLevel) || shadePalette[3];

  // خيارات الإضاءة (Light / Dark)
  const themeOptions = [
    {
      id: 'light' as const,
      title: t('theme.light.title'),
      desc: t('theme.light.desc'),
      icon: Sun,
      iconCls: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/50 dark:bg-amber-950/30',
      tag: t('theme.light.tag'),
    },
    {
      id: 'dark' as const,
      title: t('theme.dark.title'),
      desc: t('theme.dark.desc'),
      icon: Moon,
      iconCls: 'bg-slate-800 text-blue-400 dark:bg-blue-950 dark:text-blue-300',
      activeBorder: 'border-blue-600 ring-2 ring-blue-500/25 bg-blue-50/50 dark:bg-blue-950/35',
      tag: t('theme.dark.tag'),
    },
  ];

  // خيارات تدرجات ألوان الخلفية المتعددة التدريجية (موسعة بألوان هادئة ومريحة للعين)
  const gradientOptions: {
    id: BgGradientTheme;
    title: string;
    desc: string;
    previewGradient: string;
    colors: string[];
    tag: string;
  }[] = [
    {
      id: 'none',
      title: t('gradients.none.title'),
      desc: t('gradients.none.desc'),
      previewGradient: 'bg-gradient-to-r from-slate-100 to-slate-300 dark:from-slate-800 dark:to-slate-950',
      colors: ['#f8fafc', '#94a3b8', '#090e17'],
      tag: t('gradients.none.tag'),
    },
    {
      id: 'titanium-slate',
      title: t('gradients.titanium-slate.title'),
      desc: t('gradients.titanium-slate.desc'),
      previewGradient: 'bg-gradient-to-r from-slate-400 via-slate-500 to-slate-300',
      colors: ['#94a3b8', '#64748b', '#cbd5e1'],
      tag: t('gradients.titanium-slate.tag'),
    },
    {
      id: 'petrol-blue',
      title: t('gradients.petrol-blue.title'),
      desc: t('gradients.petrol-blue.desc'),
      previewGradient: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500',
      colors: ['#2563eb', '#4f46e5', '#0ea5e9'],
      tag: t('gradients.petrol-blue.tag'),
    },
    {
      id: 'frost-snow',
      title: t('gradients.frost-snow.title'),
      desc: t('gradients.frost-snow.desc'),
      previewGradient: 'bg-gradient-to-r from-slate-100 via-sky-50 to-blue-100 dark:from-slate-800 dark:via-slate-850 dark:to-sky-950',
      colors: ['#ffffff', '#e0f2fe', '#bae6fd'],
      tag: t('gradients.frost-snow.tag'),
    },
    {
      id: 'emerald-flow',
      title: t('gradients.emerald-flow.title'),
      desc: t('gradients.emerald-flow.desc'),
      previewGradient: 'bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-500',
      colors: ['#10b981', '#0d9488', '#06b6d4'],
      tag: t('gradients.emerald-flow.tag'),
    },
    {
      id: 'glacier-blue',
      title: t('gradients.glacier-blue.title'),
      desc: t('gradients.glacier-blue.desc'),
      previewGradient: 'bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-300',
      colors: ['#38bdf8', '#0ea5e9', '#7dd3fc'],
      tag: t('gradients.glacier-blue.tag'),
    },
    {
      id: 'ocean-cyan',
      title: t('gradients.ocean-cyan.title'),
      desc: t('gradients.ocean-cyan.desc'),
      previewGradient: 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500',
      colors: ['#06b6d4', '#0284c7', '#3b82f6'],
      tag: t('gradients.ocean-cyan.tag'),
    },
    {
      id: 'royal-violet',
      title: t('gradients.royal-violet.title'),
      desc: t('gradients.royal-violet.desc'),
      previewGradient: 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700',
      colors: ['#7c3aed', '#9333ea', '#4338ca'],
      tag: t('gradients.royal-violet.tag'),
    },
  ];

  // إزالة التلقائية لأي سمة برتقالية أو شريط شفاف تم تحديدها سابقاً
  React.useEffect(() => {
    if (bgGradient === 'sahara-amber' || bgGradient === 'desert-bronze') {
      setBgGradient('titanium-slate');
    }
    if (sidebarStyle === 'glass') {
      setSidebarStyle('navy');
    }
  }, [bgGradient, sidebarStyle, setBgGradient, setSidebarStyle]);

  const currentGradient = gradientOptions.find((g) => g.id === bgGradient) || gradientOptions[0];

  // خيارات شريط التنقل والقائمة الجانبية (بما فيها خيار التطابق التلقائي مع لون وتدرج الخلفية المحددة)
  const sidebarOptions: {
    id: SidebarStyle;
    title: string;
    desc: string;
    bg: string;
    previewBadge: string;
  }[] = [
    {
      id: 'match-bg',
      title: t('sidebar.styles.match-bg.title'),
      desc: t('sidebar.styles.match-bg.desc'),
      bg: currentGradient.previewGradient,
      previewBadge: t('sidebar.liveMatch', { name: t(`gradients.${currentGradient.id}.short`) }),
    },
    {
      id: 'unified',
      title: t('sidebar.styles.unified.title'),
      desc: t('sidebar.styles.unified.desc'),
      bg: 'bg-gradient-to-r from-slate-100 via-slate-500 to-slate-900 text-white',
      previewBadge: t('sidebar.styles.unified.badge'),
    },
    {
      id: 'navy',
      title: t('sidebar.styles.navy.title'),
      desc: t('sidebar.styles.navy.desc'),
      bg: 'bg-[#0B132B] text-white',
      previewBadge: t('sidebar.styles.navy.badge'),
    },
    {
      id: 'light',
      title: t('sidebar.styles.light.title'),
      desc: t('sidebar.styles.light.desc'),
      bg: 'bg-white text-slate-800 border border-slate-200 dark:border-slate-700',
      previewBadge: t('sidebar.styles.light.badge'),
    },
    {
      id: 'gradient',
      title: t('sidebar.styles.gradient.title'),
      desc: t('sidebar.styles.gradient.desc'),
      bg: 'bg-gradient-to-br from-[#09152e] via-[#0b1b3d] to-[#081024] text-white',
      previewBadge: t('sidebar.styles.gradient.badge'),
    },
  ];

  // محاكاة الخلفية النشطة في نافذة المعاينة
  const getPreviewMockupBg = () => {
    switch (bgGradient) {
      case 'frost-snow':
        return themeMode === 'dark'
          ? 'from-slate-900 via-slate-850 to-sky-950/40'
          : 'from-white via-sky-50/60 to-slate-100/70';
      case 'titanium-slate':
        return themeMode === 'dark'
          ? 'from-slate-900 via-slate-800 to-slate-900'
          : 'from-slate-200/90 via-slate-100 to-slate-200/60';
      case 'glacier-blue':
        return themeMode === 'dark'
          ? 'from-sky-950/70 via-slate-900 to-blue-950/50'
          : 'from-sky-100/90 via-slate-50 to-blue-100/60';
      case 'petrol-blue':
        return themeMode === 'dark'
          ? 'from-blue-950/70 via-slate-900 to-indigo-950/50'
          : 'from-blue-100/70 via-white to-sky-50';
      case 'emerald-flow':
        return themeMode === 'dark'
          ? 'from-emerald-950/60 via-slate-900 to-teal-950/40'
          : 'from-emerald-100/70 via-white to-teal-50';
      case 'royal-violet':
        return themeMode === 'dark'
          ? 'from-purple-950/60 via-slate-900 to-indigo-950/50'
          : 'from-violet-100/70 via-white to-indigo-50';
      case 'ocean-cyan':
        return themeMode === 'dark'
          ? 'from-cyan-950/60 via-slate-900 to-blue-950/40'
          : 'from-cyan-100/70 via-white to-sky-50';
      default:
        return themeMode === 'dark' ? 'from-slate-900 to-slate-950' : 'from-slate-50 to-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* 🌟 1. استوديو المعاينة الحية التفاعلية الفورية (Live Preview Simulator) */}
      <div className="rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl border border-slate-700/80 relative overflow-hidden">
        {/* هالة إضاءة تفاعلية خلفية */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Sparkles className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">{t('preview.title')}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {t('preview.live')}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {t('preview.text')}
              </p>
            </div>
          </div>

          {/* أزرار الإجراءات السريعة في المعاينة */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all border border-white/15"
              title={t('preview.toggleTheme')}
            >
              {themeMode === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5 text-blue-300" />}
              <span>{themeMode === 'dark' ? t('preview.toLight') : t('preview.toDark')}</span>
            </button>
            <button
              onClick={resetAllAppearance}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold transition-all border border-rose-500/30"
              title={t('preview.resetHint')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('preview.reset')}</span>
            </button>
          </div>
        </div>

        {/* مجسم مصغر للواجهة يعكس التخصيصات فوراً */}
        <div className="mt-5 rounded-2xl p-3 sm:p-4 bg-slate-950/70 border border-white/10 shadow-inner">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
              <span className="font-semibold text-slate-300 ms-2">{t('preview.appName')}</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span>{t('preview.mode')} <b className="text-white">{themeMode === 'dark' ? t('preview.modeDark') : t('preview.modeLight')}</b></span>
              <span>{t('preview.background')} <b className="text-white">{t(`gradients.${currentGradient.id}.short`)}</b></span>
              <span>{t('preview.layer')} <b className="text-amber-400">{shadeLevel}/5 ({t(`shades.${currentShade?.level ?? 3}`)})</b></span>
            </div>
          </div>

          {/* محتوى الشاشة المصغرة */}
          <div className={`rounded-xl border border-white/10 overflow-hidden flex h-36 bg-gradient-to-br ${getPreviewMockupBg()} transition-all duration-500 relative`}>
            {/* شريط التنقل المصغر */}
            <div
              className={`w-28 sm:w-36 p-2.5 border-e border-white/10 flex flex-col justify-between shrink-0 transition-all ${
                sidebarStyle === 'match-bg'
                  ? themeMode === 'light'
                    ? 'bg-white/80 text-slate-900 border-e border-slate-300'
                    : 'bg-slate-900/80 text-white border-e border-slate-800'
                  : sidebarStyle === 'light'
                  ? 'bg-white text-slate-900'
                  : sidebarStyle === 'unified'
                  ? themeMode === 'light' ? 'bg-white text-slate-900' : 'bg-[#090E17] text-white'
                  : sidebarStyle === 'gradient'
                  ? 'bg-gradient-to-b from-[#09152e] to-[#0b1b3d] text-white'
                  : 'bg-[#0B132B] text-white'
              }`}
            >
              <div className="space-y-1.5">
                <div className="h-4 w-3/4 rounded bg-current opacity-30 mb-2" />
                <div className="h-3 w-full rounded bg-blue-500 text-white text-[8px] font-bold flex items-center px-1">
                  {t('preview.home')}
                </div>
                <div className="h-3 w-5/6 rounded bg-current opacity-20" />
                <div className="h-3 w-4/6 rounded bg-current opacity-20" />
              </div>
              <div className="text-[8px] opacity-40 font-mono">SCADA v3.2</div>
            </div>

            {/* مساحة العمل المصغرة */}
            <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  <span>{t('preview.dashboard')}</span>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold">
                  {t('preview.stock', { value: '94.2%' })}
                </span>
              </div>

              {/* بطاقات مصغرة */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-xs">
                  <div className="text-[9px] text-slate-500">{t('preview.tank')}</div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">4,380,000 L</div>
                  <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-amber-500 w-[94%]" />
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-xs">
                  <div className="text-[9px] text-slate-500">{t('preview.flow')}</div>
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">1,420 L/min</div>
                  <div className="text-[8px] text-slate-400">{t('preview.pumps')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🌓 2. بطاقة نظام الإضاءة (Light & Dark Theme) */}
      <div className={cardCls}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{t('theme.title')}</h3>
            <p className="text-xs text-slate-500">{t('theme.text')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {themeOptions.map((o) => {
            const Icon = o.icon;
            const on = themeMode === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setThemeMode(o.id)}
                className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-start group ${
                  on ? o.activeBorder : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 ${o.iconCls}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{o.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                      {o.tag}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">{o.desc}</div>
                </div>
                {on ? (
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 🌈 3. بطاقة خلفيات النظام والتدرجات اللونية المتعددة (Gradual Multi-Color Background Gradients) */}
      <div className={cardCls}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {t('backgrounds.title')}
                </h3>
                <span className="whitespace-nowrap text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-indigo-600 text-white">
                  {t('backgrounds.pro')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('backgrounds.text')}
              </p>
            </div>
          </div>

          {/* عناصر التحكم في الرأس: زر الانزلاق ومحدد قوة التدرج */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* زر الانزلاق السريع لدرجات الألوان من 1 إلى 10 بجانب زر التبديل */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 whitespace-nowrap">
                <span>{t('backgrounds.layer')}</span>
                <span className="px-1.5 py-0.2 rounded bg-indigo-600 text-white font-mono text-[10px]">{shadeLevel}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={shadeLevel}
                onChange={(e) => setShadeLevel(Number(e.target.value))}
                className="w-20 sm:w-28 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                title={t('backgrounds.sliderHint')}
              />
            </div>

            {/* محدد قوة التدرج (Intensity Selector) */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => setGradientIntensity('subtle')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  gradientIntensity === 'subtle'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('backgrounds.subtle')}
              </button>
              <button
                onClick={() => setGradientIntensity('vibrant')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  gradientIntensity === 'vibrant'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('backgrounds.vibrant')}
              </button>
            </div>
          </div>
        </div>

        {/* 🎨 القسم الثالث المضاف: مصفوفة الطبقات التدريجية الست (من الفاتح إلى الأغمق قليلاً) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/70 dark:from-slate-800/60 dark:to-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                6
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                  <span>{t('backgrounds.layersTitle')}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold">
                    {t(`gradients.${currentGradient.id}.short`)}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  {t('backgrounds.layersCurrent')}{' '}
                  <b className="text-indigo-600 dark:text-indigo-400">
                    {t('backgrounds.layerOf', { n: shadeLevel, name: t(`shades.${currentShade?.level ?? 3}`) })}
                  </b>
                </p>
              </div>
            </div>

            {/* أزرار الانتقال السريع بين المستويات */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setShadeLevel(1)}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  shadeLevel <= 1
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                {t('backgrounds.quickLight')}
              </button>
              <button
                type="button"
                onClick={() => setShadeLevel(3)}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  shadeLevel >= 2 && shadeLevel <= 3
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                {t('backgrounds.quickBalanced')}
              </button>
              <button
                type="button"
                onClick={() => setShadeLevel(5)}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  shadeLevel >= 4
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                {t('backgrounds.quickDeep')}
              </button>
            </div>
          </div>

          {/* شريط السلايدر الانزلاقي الممتد مع علامات الطبقات */}
          <div className="space-y-1.5 px-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                {t('backgrounds.min')}
              </span>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                {t('backgrounds.selected', { n: shadeLevel, name: t(`shades.${currentShade?.level ?? 3}`) })}
              </span>
              <span className="flex items-center gap-1">
                {t('backgrounds.max')}
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
              </span>
            </div>
            <div className="relative py-1">
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={shadeLevel}
                onChange={(e) => setShadeLevel(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <div className="flex justify-between px-1 mt-1 text-[9px] font-mono text-slate-400">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    onClick={() => setShadeLevel(n)}
                    className={`cursor-pointer hover:text-indigo-500 ${
                      shadeLevel === n ? 'text-indigo-600 dark:text-indigo-400 font-black' : ''
                    }`}
                  >
                    #{n}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* مربعات المعاينة اللونية الحية للطبقات الست (Interactive Swatches 0..5) */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
            {shadePalette.map((item) => {
              const active = shadeLevel === item.level;
              return (
                <button
                  key={item.level}
                  type="button"
                  onClick={() => setShadeLevel(item.level)}
                  title={`${t('shades.label', { n: item.level })}: ${t(`shades.${item.level}`)} (${item.bgHex})`}
                  style={{ backgroundColor: item.bgHex }}
                  className={`h-16 sm:h-20 rounded-xl p-1.5 flex flex-col justify-between items-center transition-all duration-200 relative group shadow-sm border-2 ${
                    active
                      ? 'border-indigo-600 ring-2 ring-indigo-500/40 scale-105 z-10 shadow-md'
                      : 'border-black/10 dark:border-white/10 hover:scale-102 hover:border-indigo-400'
                  }`}
                >
                  <span
                    className={`text-[9px] font-mono font-bold px-1 rounded ${
                      item.textLight ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    #{item.level}
                  </span>

                  {active && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <span
                    className={`text-[9px] font-bold text-center leading-tight truncate w-full ${
                      item.textLight ? 'text-white/90' : 'text-slate-700'
                    }`}
                  >
                    {t(`shades.${item.level}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* شبكة خيارات التدرجات اللونية */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 animate-fade-in">
          {gradientOptions.map((grad) => {
            const on = bgGradient === grad.id;
            return (
              <button
                key={`grad-${grad.id}`}
                onClick={() => setBgGradient(grad.id)}
                className={`p-4 rounded-2xl border-2 flex flex-col justify-between text-start transition-all group ${
                  on
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-full h-14 rounded-xl mb-3 ${grad.previewGradient} shadow-inner flex items-center justify-between px-3 text-white relative overflow-hidden`}
                >
                  <div className="flex items-center gap-1.5 z-10">
                    {grad.colors.map((c, i) => (
                      <span key={i} className="w-3.5 h-3.5 rounded-full border border-white/60 shadow-xs" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{grad.title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{grad.tag}</span>
                      {on && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-600 text-white shrink-0">{t('backgrounds.active')}</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">{grad.desc}</div>
                  </div>
                  {on ? <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" /> : <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0 mt-0.5" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 🧭 4. بطاقة شريط التنقل والقائمة الجانبية */}
      <div className={cardCls}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Layout className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{t('sidebar.title')}</h3>
            <p className="text-xs text-slate-500">{t('sidebar.text')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {sidebarOptions.map((style) => {
            const on = sidebarStyle === style.id;
            return (
              <button
                key={style.id}
                onClick={() => setSidebarStyle(style.id)}
                className={`p-4 rounded-2xl border-2 flex flex-col justify-between text-start transition-all group ${
                  on
                    ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* شريط المعاينة التفاعلي */}
                <div
                  className={`w-full h-14 rounded-xl mb-3 ${style.bg} flex items-center justify-between px-3.5 font-bold text-xs shadow-inner relative overflow-hidden`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{t('sidebar.bar')}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-black/20 backdrop-blur-xs font-normal">
                    {style.previewBadge}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {style.title}
                      </span>
                      {on && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-600 text-white shrink-0">
                          {t('backgrounds.active')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">{style.desc}</div>
                  </div>
                  {on ? (
                    <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ⚙️ 5. بطاقة المميزات والتخصيصات الاحترافية المتقدمة */}
      <div className={cardCls}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {t('extras.title')}
            </h3>
            <p className="text-xs text-slate-500">{t('extras.text')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* خيار تأثير الزجاج البلوري (Glassmorphism) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {t('extras.glass')}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {t('extras.glassText')}
                </div>
              </div>
            </div>
            <button
              onClick={() => setGlassmorphism(!glassmorphism)}
              role="switch"
              aria-checked={glassmorphism}
              aria-label={t('extras.glass')}
              className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${
                glassmorphism ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                  glassmorphism ? 'ltr:translate-x-5.5 rtl:-translate-x-5.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* خيار كثافة العرض (UI Density) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Maximize2 className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {t('extras.density')}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {t('extras.densityText')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-white dark:bg-slate-700 p-0.5 rounded-lg border border-slate-200 dark:border-slate-600">
              <button
                onClick={() => setUiDensity('standard')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  uiDensity === 'standard'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('extras.standard')}
              </button>
              <button
                onClick={() => setUiDensity('compact')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  uiDensity === 'compact'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('extras.compact')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ───── إدارة البيانات (لمدير النظام فقط) ─────
const DataSection: React.FC = () => {
  const { t } = useTranslation('settings');
  const { setThemeMode, setSidebarStyle } = useTheme();
  const { refreshAllData } = useFuelStore();
  const handleResetDefaults = () => {
    if (window.confirm(t('data.confirm'))) {
      localStorage.clear();
      setThemeMode('light');
      setSidebarStyle('navy');
      refreshAllData();
      window.location.reload();
    }
  };
  return (
    <div className={`${cardCls} flex flex-col sm:flex-row sm:items-center gap-4 justify-between`}>
      <div>
        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{t('data.title')}</h4>
        <p className="text-xs text-slate-500 mt-0.5">{t('data.text')}</p>
      </div>
      <button onClick={handleResetDefaults}
        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 text-xs font-bold transition-colors">
        <RotateCcw className="w-3.5 h-3.5" />
        <span>{t('data.reset')}</span>
      </button>
    </div>
  );
};
