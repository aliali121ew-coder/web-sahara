import React, { useEffect, useState } from 'react';
import { usePermissions } from '../../lib/usePermission';
import {
  Wallet,
  Truck,
  Database,
  Droplets,
  ShieldCheck, Sprout,
  BarChart3,
  Sparkles,
  ArrowLeft,
  Lock,
  Hammer,
  Fuel,
  DatabaseBackup
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFuelNav } from '../../context/FuelDataContext';
import { EtihadSubtabKey } from './EtihadBalanceHubTabs';
import { BulkUploadButton } from './BulkUpload';

interface EtihadPortalHubProps {
  onSelectModule: (subtab: EtihadSubtabKey | 'petrol') => void;
  balanceLiters?: number;
  tanksCapacity?: number;
  blackOilLiters?: number;
  reservesSitesCount?: number;
  /** الشركة: الاتحاد (فعّالة) أو الصحاري (نفس البطاقات، كلها قيد البرمجة حاليًا) */
  company?: 'etihad' | 'sahara';
}

export const EtihadPortalHub: React.FC<EtihadPortalHubProps> = ({
  onSelectModule,
  company = 'etihad',
}) => {
  const isSahara = company === 'sahara';
  const { t, i18n } = useTranslation(['finance', 'common']);
  const { setActiveTab } = useFuelNav();

  const baseModules = [
    {
      id: 'balance' as const,
      title: isSahara ? t('finance:hub.gasoilBalance') : t('finance:hub.companyBalance'),
      description: t('finance:hub.balanceDesc'),
      hintText: t('finance:hub.balanceHint'),
      icon: Wallet,
      iconBoxBg: 'bg-gradient-to-br from-teal-600 to-emerald-600',
      iconShadow: 'shadow-emerald-600/25',
      cardHoverGlow: 'hover:shadow-emerald-500/10'
    },
    {
      id: 'inbound' as const,
      title: t('finance:hub.inbound'),
      description: t('finance:hub.inboundDesc'),
      hintText: t('finance:hub.inboundHint'),
      icon: Truck,
      iconBoxBg: 'bg-gradient-to-br from-sky-500 via-cyan-600 to-blue-600',
      iconShadow: 'shadow-sky-500/25',
      cardHoverGlow: 'hover:shadow-sky-500/10'
    },
    {
      id: 'tanks' as const,
      title: isSahara ? t('finance:hub.saharaTanks') : t('finance:hub.etihadTanks'),
      description: t('finance:hub.tanksDesc'),
      hintText: t('finance:hub.tanksHint'),
      icon: Database,
      iconBoxBg: 'bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900',
      iconShadow: 'shadow-indigo-700/25',
      cardHoverGlow: 'hover:shadow-indigo-500/10'
    },
    {
      id: 'black-oil' as const,
      title: t('finance:hub.blackOil'),
      description: t('finance:hub.blackOilDesc'),
      hintText: t('finance:hub.blackOilHint'),
      icon: Droplets,
      iconBoxBg: 'bg-gradient-to-br from-zinc-700 via-slate-800 to-neutral-900',
      iconShadow: 'shadow-neutral-900/30',
      cardHoverGlow: 'hover:shadow-neutral-900/10'
    },
    {
      id: 'reserves' as const,
      // عند الصحاري تصبح هذه البطاقة "مزارع الموقع"
      title: isSahara ? t('finance:siteFarms.title') : t('finance:hub.reserves'),
      description: isSahara ? t('finance:hub.farmsDesc') : t('finance:hub.reservesDesc'),
      hintText: isSahara ? t('finance:siteFarms.title') : t('finance:hub.reservesHint'),
      icon: isSahara ? Sprout : ShieldCheck,
      iconBoxBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
      iconShadow: 'shadow-amber-500/25',
      cardHoverGlow: 'hover:shadow-amber-500/10',
      locked: true // قيد البرمجة
    },
    {
      id: 'reports' as const,
      title: isSahara ? t('finance:hub.saharaReports') : t('finance:hub.etihadReports'),
      description: t('finance:hub.reportsHubDesc'),
      hintText: t('finance:hub.reportsHint'),
      icon: BarChart3,
      iconBoxBg: 'bg-gradient-to-br from-red-600 via-rose-600 to-red-700',
      iconShadow: 'shadow-red-600/25',
      cardHoverGlow: 'hover:shadow-red-500/10'
    }
  ];
  // الصحاري فقط: كارتا البنزين والنسخ الاحتياطي (قيد البرمجة)
  const saharaExtraModules = [
    {
      id: 'petrol' as const,
      title: t('finance:hub.gasoline'),
      description: t('finance:hub.gasolineDesc'),
      hintText: t('finance:hub.gasolineHint'),
      icon: Fuel,
      iconBoxBg: 'bg-gradient-to-br from-orange-400 via-orange-500 to-rose-500',
      iconShadow: 'shadow-orange-500/25',
      cardHoverGlow: 'hover:shadow-orange-500/10'
    },
    {
      id: 'backup' as const,
      title: t('finance:hub.backup'),
      description: t('finance:hub.backupDesc'),
      hintText: t('finance:hub.backupHint'),
      icon: DatabaseBackup,
      iconBoxBg: 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700',
      iconShadow: 'shadow-violet-600/25',
      cardHoverGlow: 'hover:shadow-violet-500/10'
    }
  ];
  // الصحاري: رصيد الشركة والوارد والخزانات والنفط الأسود والتقارير مفعّلة (بيانات منفصلة عن الاتحاد)، وباقي البطاقات مقفلة حتى تُبرمج صفحاتها
  const SAHARA_ACTIVE: string[] = ['inbound', 'balance', 'tanks', 'black-oil', 'reports', 'petrol'];
  // ترتيب الصحاري: البنزين تحت رصيد الكاز مباشرة (أول الصف الثاني)، والنسخ الاحتياطي في الآخر
  const orderedModules = isSahara
    ? [...baseModules.slice(0, 4), saharaExtraModules[0], ...baseModules.slice(4), saharaExtraModules[1]]
    : baseModules;
  // بطاقات الأقسام حسب صلاحيات الحساب: الوارد يتبع صفحة واردات الشركة، والنسخ الاحتياطي للمدير فقط
  const perms = usePermissions();
  const moduleAllowed = (id: string) =>
    id === 'inbound' ? perms.canView(isSahara ? 'deliveries-sahara' : 'deliveries-etihad')
      : id === 'backup' ? perms.isAdmin
        : perms.canView(`${company}.${id}`);
  const portalModules = orderedModules.filter(m => moduleAllowed(m.id)).map(m => ({
    ...m,
    locked: (isSahara && !SAHARA_ACTIVE.includes(m.id)) || ('locked' in m && !!m.locked)
  }));

  // تنبيه الأقسام المقفلة (قيد البرمجة)
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!lockedNotice) return;
    const t = setTimeout(() => setLockedNotice(null), 3500);
    return () => clearTimeout(t);
  }, [lockedNotice]);

  const handleCardClick = (id: (typeof portalModules)[number]['id']) => {
    const mod = portalModules.find(m => m.id === id);
    if (mod?.locked || id === 'backup') {
      setLockedNotice(mod?.title ?? '');
      return;
    }
    if (id === 'inbound') {
      setActiveTab(isSahara ? 'deliveries-sahara' : 'deliveries-etihad');
    } else {
      onSelectModule(id);
    }
  };

  return (
    <div className="relative w-full flex-1 flex flex-col justify-between py-1 sm:py-1.5 min-h-0">
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* 🌟 كارت الأم بتدريج ثلجي أبيض ناصع مع تمدد مرن لملء المساحة بتناسق كامل 🌟 */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <div className="relative w-full mx-auto rounded-[28px] bg-gradient-to-b from-white/95 via-slate-50/90 to-slate-100/80 dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-950/90 backdrop-blur-3xl border border-white dark:border-slate-800 shadow-[0_20px_50px_-10px_rgba(15,23,42,0.07)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] p-5 sm:p-5.5 lg:p-6 flex-1 flex flex-col justify-between overflow-hidden">
        
        {/* ── 1. لمسة زجاجية علوية ناصعة (Top Glass Sheen) ── */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none" />

        {/* ── 2. ترويسة العنوان متضمنة داخل كارت الأم ── */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 mb-3 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-teal-600 via-teal-700 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-600/30 shrink-0">
              <Wallet className="w-6 h-6 sm:w-6.5 sm:h-6.5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl sm:text-[26px] font-black text-slate-900 dark:text-white tracking-tight">
                  {isSahara ? t('finance:hub.saharaBalance') : t('finance:hub.etihadBalance')}
                </h2>
              </div>
              <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isSahara
                  ? t('finance:hub.saharaOverview')
                  : t('finance:hub.etihadOverview')}
              </p>
            </div>
          </div>
          {/* الرفع المتعدد: يظهر لمن لديه صلاحية "الرفع المتعدد" (الزر يتحقق بنفسه) */}
          {isSahara && <BulkUploadButton />}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* 🌟 شبكة الكروت الستة مع هامش مريح وأنيق ومكبر بين الوصف والتلميح 🌟 */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* الصحاري 8 كروت: 4 أعمدة بصفّين حتى تبقى الصفحة بنفس الارتفاع */}
        <div className={`relative z-10 grid grid-cols-1 sm:grid-cols-2 ${portalModules.length > 6 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 sm:gap-4.5 lg:gap-5 w-full flex-1 items-stretch my-auto`}>
          {portalModules.map((module) => {
            const Icon = module.icon;
            const locked = module.locked;

            return (
              <div
                key={module.id}
                onClick={() => handleCardClick(module.id)}
                className={`group relative w-full h-full min-h-[230px] rounded-[24px] bg-white dark:bg-slate-900/95 backdrop-blur-xl border border-slate-100 dark:border-slate-800/80 p-5 sm:p-5.5 flex flex-col justify-between transition-[transform,box-shadow] duration-200 ease-out cursor-pointer shadow-[0_6px_22px_-3px_rgba(0,0,0,0.05)] dark:shadow-[0_15px_35px_-5px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_40px_-6px_rgba(0,0,0,0.09)] dark:hover:shadow-[0_25px_50px_-10px_rgba(0,0,0,0.75)] hover:-translate-y-1 hover:scale-[1.01] ${module.cardHoverGlow} overflow-hidden`}
              >
                {/* 1. الصف العلوي: الأيقونة الحديثة + شارة الحالة الهادئة */}
                <div className="flex items-center justify-between gap-3 shrink-0">
                  <div
                    className={`w-[50px] h-[50px] rounded-2xl ${module.iconBoxBg} ${module.iconShadow} text-white shadow-md flex items-center justify-center group-hover:scale-105 group-hover:rotate-1 transition-transform duration-200 shrink-0`}
                  >
                    <Icon className="w-6.5 h-6.5" strokeWidth={2.2} />
                  </div>

                  {/* شارة حالة عصرية ناعمة */}
                  {locked ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60 shrink-0 select-none">
                      <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">{t('finance:hub.inDevelopment')}</span>
                    </div>
                  ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800/60 shrink-0 transition-all select-none group-hover:bg-slate-100/90 dark:group-hover:bg-slate-800">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {t('finance:hub.activeNow')}
                    </span>
                  </div>
                  )}
                </div>

                {/* 2. المنتصف: العنوان والوصف مزاح للأسفل قليلاً لمنح مسافة مريحة عن الأيقونة */}
                <div className="space-y-2.5 mt-5 sm:mt-6 mb-3 flex-1 flex flex-col justify-start">
                  <h4 className="text-lg sm:text-[20px] font-black text-slate-900 dark:text-white group-hover:text-slate-800 dark:group-hover:text-slate-100 transition-colors tracking-tight">
                    {module.title}
                  </h4>

                  <p className="text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-3">
                    {module.description}
                  </p>
                </div>

                {/* 3. الفوتر: التلميح + زر سهم مع هامش علوي مريح ومكبر */}
                <div className="mt-auto pt-5 sm:pt-6 border-t border-slate-100 dark:border-slate-800/70 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Sparkles className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                    <span className="text-[12px] font-bold text-slate-400 dark:text-slate-500 truncate group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                      {module.hintText}
                    </span>
                  </div>

                  {/* 🌟 زر السهم بنمط هادئ وأنيق بدون هوفر حبري داكن 🌟 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick(module.id);
                    }}
                    aria-label={t('finance:hub.enter')}
                    className="w-10.5 h-10.5 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700/60 group-hover:bg-slate-100 dark:group-hover:bg-slate-700/80 group-hover:text-slate-900 dark:group-hover:text-white shadow-xs active:scale-95 transition-all duration-200 cursor-pointer shrink-0 flex items-center justify-center"
                  >
                    {locked ? (
                      <Lock className="w-4 h-4" strokeWidth={2.2} />
                    ) : (
                      <ArrowLeft className="w-4.5 h-4.5 transition-transform duration-200 group-hover:-translate-x-1" strokeWidth={2.2} />
                    )}
                  </button>
                </div>

              </div>
            );
          })}
        </div>

      </div>

      {/* تنبيه: القسم قيد البرمجة */}
      {lockedNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] animate-in fade-in slide-in-from-bottom-2 duration-200" dir={i18n.dir()}>
          <div className="flex items-center gap-3 pl-3 pr-4 py-3 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white shadow-2xl border border-slate-700">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <Hammer className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-sm font-black">{lockedNotice}</div>
              <div className="text-xs text-slate-300">{t('finance:hub.comingSoon')}</div>
            </div>
            <button type="button" onClick={() => setLockedNotice(null)} className="mr-2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer">
              {t('finance:hub.ok')}
            </button>
          </div>
        </div>
      )}

      {/* 🌟 سطر الاعتماد والتوثيق خارج كارت الأم بحجم صغير ومتناسق 🌟 */}
      <div className="relative z-10 flex items-center justify-center pt-2.5 pb-0.5 text-center select-none shrink-0">
        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wide flex flex-wrap items-center justify-center gap-2">
          <span>{isSahara ? t('finance:hub.saharaSystem') : t('finance:hub.etihadSystem')}</span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span className="font-mono">{t('finance:hub.version')}</span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span>{t('finance:hub.autoAudit')}</span>
        </p>
      </div>

    </div>
  );
};
