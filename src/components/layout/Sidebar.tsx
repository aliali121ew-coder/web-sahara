import React, { useState } from 'react';
import { useCanOpenTab } from '../../lib/usePermission';
import {
  LayoutDashboard,
  Database,
  Users,
  CheckSquare,
  BarChart3,
  MessageSquare,
  Settings,
  Flame,
  X,
  ShieldCheck,
  Radio,
  ChevronDown,
  Building2,
  Tags,
  LogOut,
  Loader2
} from 'lucide-react';
import { initials, logout, useSessionProfile } from '../../lib/session';
import { useTheme } from '../../context/ThemeContext';
import { useFuelData } from '../../context/FuelDataContext';
import { useLanguage } from '../../context/LanguageContext';
import { NavTabId } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: {
    id: NavTabId;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose
}) => {
  const { sidebarStyle, themeMode } = useTheme();
  const { activeTab, setActiveTab } = useFuelData();
  const { t, tr, direction } = useLanguage();

  // State for collapsible dropdowns
  const [openDropdowns, setOpenDropdowns] = React.useState<Record<string, boolean>>({});

  // Categorized Navigation for clean corporate architecture with full multi-language support
  const canOpenTab = useCanOpenTab();
  const allGroups: NavGroup[] = [
    {
      groupTitle: t('groupOperations'),
      items: [
        { id: 'dashboard', label: t('navDashboard'), icon: LayoutDashboard },
        { id: 'tanks', label: t('navTanks'), icon: Database },
        { id: 'prices', label: t('navPrices'), icon: Tags },
      ]
    },
    {
      groupTitle: t('groupManagement'),
      items: [
        { id: 'finance-etihad', label: t('navFinanceEtihad'), icon: Building2 },
        { id: 'finance-sahara', label: t('navFinanceSahara'), icon: Building2 },
        { id: 'managers', label: t('navManagers'), icon: Users },
        { id: 'tasks', label: t('navTasks'), icon: CheckSquare },
      ]
    },
    {
      groupTitle: t('groupAnalytics'),
      items: [
        { id: 'reports', label: t('navReports'), icon: BarChart3 },
        { id: 'chat', label: t('navChat'), icon: MessageSquare },
        { id: 'settings', label: t('navSettings'), icon: Settings },
      ]
    }
  ];

  // إخفاء الصفحات غير المسموحة لهذا الحساب (والمجموعات التي تصبح فارغة)
  const navGroups = allGroups
    .map(g => ({ ...g, items: g.items.filter(i => canOpenTab(i.id)) }))
    .filter(g => g.items.length > 0);

  const isUnified = sidebarStyle === 'unified';
  const isLight = sidebarStyle === 'light' || (isUnified && themeMode === 'light');

  // Modern Enterprise background styling
  const getSidebarBgClass = () => {
    switch (sidebarStyle) {
      case 'unified':
        return 'bg-white text-slate-800 border-slate-200/90 dark:bg-[#090E17] dark:text-slate-100 dark:border-slate-800/80 shadow-2xl';
      case 'light':
        return 'bg-white text-slate-800 border-slate-200/90 shadow-2xl';
      case 'gradient':
        return 'bg-gradient-to-b from-[#09152e] via-[#0b1b3d] to-[#081024] text-white border-blue-900/30 shadow-2xl';
      case 'navy':
      default:
        return 'bg-[#0B132B] text-slate-100 border-slate-800/90 shadow-2xl';
    }
  };

  // Keyboard listener for Escape key to close overlay
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const isRtl = direction === 'rtl';
  const profile = useSessionProfile();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [leaving, setLeaving] = useState(false);

  return (
    <>
      {/* 🌟 Floating Backdrop Overlay above the Page */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 transition-opacity duration-300 animate-in fade-in cursor-pointer"
        />
      )}

      {/* 🌟 Floating Corporate Drawer Sidebar - Over Page Content with Dynamic Direction */}
      <aside
        className={`fixed top-0 bottom-0 z-50 w-72 sm:w-80 flex flex-col transition-transform duration-300 ease-out transform ${
          isRtl ? 'right-0 border-l' : 'left-0 border-r'
        } ${
          isOpen
            ? 'translate-x-0 shadow-2xl'
            : isRtl
            ? 'translate-x-full'
            : '-translate-x-full'
        } ${getSidebarBgClass()}`}
      >
        {/* Enterprise Brand Header */}
        <div className={`p-4 sm:px-5 sm:py-4.5 border-b ${
          isLight ? 'border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/50' : 'border-white/10 dark:border-slate-800/80 bg-white/2'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/20 ring-2 ring-blue-500/20 shrink-0">
                <Flame className="w-5 h-5 text-amber-300" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              </div>
              <div className={isRtl ? 'text-right' : 'text-left'}>
                <div className="flex items-center gap-1.5">
                  <h1 className={`font-black text-sm tracking-tight ${isLight ? 'text-slate-900 dark:text-white' : 'text-white'}`}>
                    {t('brandTitle')}
                  </h1>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold font-mono border ${
                    isLight
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                      : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                  }`}>
                    2026
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <Radio className="w-3 h-3 text-emerald-500 animate-pulse shrink-0" />
                  <span>{t('brandSubtitle')}</span>
                </div>
              </div>
            </div>

            {/* Close Drawer Button */}
            <button
              onClick={onClose}
              title={`${t('close')} (Esc)`}
              className={`p-2 rounded-xl transition-all ${
                isLight
                  ? 'text-slate-500 hover:bg-slate-200/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 🧭 Categorized Navigation Menu with Clean Light-Gray Hover */}
        <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto no-scrollbar">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {/* Category Subtitle */}
              <div className={`px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${
                isLight ? 'text-slate-400 dark:text-slate-500' : 'text-slate-400'
              }`}>
                {group.groupTitle}
              </div>

              {/* Category Items */}
              {group.items.map((item) => {
                const Icon = item.icon;
                const hasChildren = Boolean(item.children && item.children.length > 0);
                const isDropdownOpen = openDropdowns[item.id] ?? false;
                const isChildActive = Boolean(item.children?.some(c => c.id === activeTab));
                const isActive = activeTab === item.id;

                if (hasChildren) {
                  return (
                    <div key={item.id} className="space-y-1">
                      {/* Parent Item with Dropdown Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          setOpenDropdowns(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-[13px] transition-all duration-150 group relative ${
                          (isActive || isChildActive)
                            ? isLight
                              ? 'bg-blue-50/90 text-blue-900 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800/60 shadow-xs'
                              : 'bg-white/10 text-white border border-white/15 shadow-xs'
                            : isLight
                            ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        {/* Active Accent Pill */}
                        {(isActive || isChildActive) && (
                          <span className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-5 bg-amber-400 shadow-xs ${
                            isRtl ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'
                          }`} />
                        )}

                        <div className="flex items-center gap-3">
                          <Icon
                            className={`w-4 h-4 transition-transform group-hover:scale-105 ${
                              (isActive || isChildActive)
                                ? 'text-blue-600 dark:text-blue-400'
                                : isLight
                                ? 'text-slate-500 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-400'
                                : 'text-slate-400 group-hover:text-blue-400'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>

                        {/* Dropdown Chevron */}
                        <div className="flex items-center gap-1.5">
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isDropdownOpen
                                ? 'rotate-180 text-blue-600 dark:text-blue-400'
                                : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                            }`}
                          />
                        </div>
                      </button>

                      {/* Dropdown Children Menu */}
                      {isDropdownOpen && (
                        <div className={`space-y-1 pt-1 pb-1 animate-in slide-in-from-top-1 duration-150 ${
                          isRtl
                            ? 'pr-3 mr-3 border-r-2 border-blue-500/20 dark:border-blue-400/20'
                            : 'pl-3 ml-3 border-l-2 border-blue-500/20 dark:border-blue-400/20'
                        }`}>
                          {item.children!.map((child) => {
                            const isCurrentChildActive = activeTab === child.id;

                            return (
                              <button
                                key={child.id}
                                onClick={() => {
                                  setActiveTab(child.id);
                                  if (child.id === 'finance-etihad' || child.id === 'finance') {
                                    window.dispatchEvent(new CustomEvent('sahara:reset-etihad-hub'));
                                  }
                                  onClose();
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-bold text-xs transition-all duration-150 group relative ${
                                  isCurrentChildActive
                                    ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/30'
                                    : isLight
                                    ? 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
                                    : 'text-slate-400 hover:bg-white/8 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className={`w-1.5 h-1.5 rounded-full transition-all ${
                                    isCurrentChildActive
                                      ? 'bg-amber-400 ring-2 ring-amber-400/50 scale-110'
                                      : 'bg-slate-400 dark:bg-slate-600 group-hover:bg-blue-500'
                                  }`} />
                                  <span>{child.label}</span>
                                </div>

                                {isCurrentChildActive && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white font-medium">
                                    {isRtl ? 'محدد' : 'Active'}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-[13px] transition-all duration-150 group relative ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/25'
                        : isLight
                        ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    {/* Active Accent Pill */}
                    {isActive && (
                      <span className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-5 bg-amber-400 shadow-xs ${
                        isRtl ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'
                      }`} />
                    )}

                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-transform group-hover:scale-105 ${
                          isActive
                            ? 'text-white'
                            : isLight
                            ? 'text-slate-500 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-400'
                            : 'text-slate-400 group-hover:text-blue-400'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* 👤 الحساب الحالي + تسجيل الخروج */}
        <div className={`p-3 border-t space-y-2 ${
          isLight
            ? 'border-slate-100 bg-slate-50/70 dark:border-slate-800/80 dark:bg-slate-900/40'
            : 'border-white/10 bg-white/2'
        }`}>
          <div className="flex items-center gap-2.5 px-1">
            <div className="relative w-9 h-9 rounded-xl text-white font-black text-xs flex items-center justify-center shadow-xs overflow-hidden shrink-0" style={{ background: profile?.color || '#4f46e5' }}>
              {profile?.avatar ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" /> : initials(profile?.name)}
            </div>
            <div className={`flex-1 min-w-0 ${isRtl ? 'text-right' : 'text-left'}`}>
              <div className={`text-xs font-bold truncate ${isLight ? 'text-slate-900 dark:text-white' : 'text-white'}`}>
                {profile?.name || t('generalManager')}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                {!!profile?.is_admin && <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />}
                <span dir="ltr" className="truncate">@{profile?.username || '...'}</span>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title={t('online')} />
          </div>

          {confirmLogout ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setLeaving(true); logout(); }}
                disabled={leaving}
                className="h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-60"
              >
                {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                {tr('تأكيد الخروج')}
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
                disabled={leaving}
                className={`h-10 rounded-xl text-xs font-bold transition ${
                  isLight
                    ? 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:ring-slate-700 dark:text-slate-200'
                    : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                {tr('إلغاء')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmLogout(true)}
              className={`w-full h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition ${
                isLight
                  ? 'text-rose-600 ring-1 ring-rose-200 bg-rose-50/60 hover:bg-rose-100 dark:text-rose-300 dark:ring-rose-500/30 dark:bg-rose-500/10 dark:hover:bg-rose-500/20'
                  : 'text-rose-300 ring-1 ring-rose-400/30 bg-rose-500/10 hover:bg-rose-500/20'
              }`}
            >
              <LogOut className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
              {tr('تسجيل الخروج')}
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
