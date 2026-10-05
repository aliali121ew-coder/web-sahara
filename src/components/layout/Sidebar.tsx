import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Menu,
  X,
  ShieldCheck,
  Radio,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  Tags,
  LogOut,
  Loader2,
  Search,
  Truck,
  UserCheck
} from 'lucide-react';
import { initials, logout, useSessionProfile } from '../../lib/session';
import { useTheme } from '../../context/ThemeContext';
import { useFuelData } from '../../context/FuelDataContext';
import { useLanguage } from '../../context/LanguageContext';
import { NavTabId } from '../../types';
import { getAmbientBgColor, getAmbientGradientStyle } from '../../lib/themeGradients';

/* ==========================================================================
   1. CORE DESIGN SYSTEM & TOKENS
   ========================================================================== */

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavChildItem {
  id: NavTabId;
  label: string;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  id: NavTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: NavChildItem[];
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

interface ThemeVisualTokens {
  bgClass: string;
  headerBorder: string;
  headerBg: string;
  searchBg: string;
  searchBorder: string;
  searchFocusRing: string;
  groupTitleColor: string;
  itemInactiveText: string;
  itemInactiveHoverBg: string;
  itemInactiveIcon: string;
  itemInactiveIconHover: string;
  itemActiveGradient: string;
  itemActiveBorder: string;
  itemActiveText: string;
  itemActiveShadow: string;
  cardBg: string;
  cardBorder: string;
  tooltipBg: string;
  tooltipBorder: string;
  isLightMode: boolean;
}

const getDesignTokens = (
  sidebarStyle: string,
  themeMode: 'light' | 'dark'
): ThemeVisualTokens => {
  const isMatchBg = sidebarStyle === 'match-bg';
  const isUnified = sidebarStyle === 'unified';
  const isLight = sidebarStyle === 'light' || ((isUnified || isMatchBg) && themeMode === 'light');

  if (isLight) {
    return {
      isLightMode: true,
      bgClass: 'bg-gradient-to-b from-white via-white to-slate-100 text-slate-800 border-slate-200/70 shadow-[0_0_24px_-8px_rgba(15,23,42,0.18)]',
      headerBorder: 'border-slate-200/60',
      headerBg: 'bg-white/40',
      searchBg: 'bg-slate-100/80 text-slate-800 placeholder-slate-400',
      searchBorder: 'border-slate-200/80 focus:border-blue-500 focus:bg-white/95',
      searchFocusRing: 'focus:ring-2 focus:ring-blue-500/20',
      groupTitleColor: 'text-slate-400 dark:text-slate-500',
      itemInactiveText: 'text-slate-700 hover:text-slate-950',
      itemInactiveHoverBg: 'hover:bg-white/70 hover:shadow-xs',
      itemInactiveIcon: 'text-slate-400 group-hover:text-blue-600',
      itemInactiveIconHover: 'text-blue-600',
      itemActiveGradient: 'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white',
      itemActiveBorder: 'border border-blue-500/30',
      itemActiveText: 'text-white',
      itemActiveShadow: 'shadow-[0_4px_16px_-2px_rgba(37,99,235,0.35)]',
      cardBg: 'bg-white/60 border-slate-200/70',
      cardBorder: 'border-slate-200/70',
      tooltipBg: 'bg-slate-900/95 text-white',
      tooltipBorder: 'border-slate-800',
    };
  }

  // Dark / Navy / Gradient / Glass default
  switch (sidebarStyle) {
    case 'gradient':
      return {
        isLightMode: false,
        bgClass: 'bg-gradient-to-b from-[#0a162e] via-[#0c1c3f] to-[#071024] text-slate-100 border-blue-900/30 shadow-[0_0_24px_-8px_rgba(0,0,0,0.5)]',
        headerBorder: 'border-blue-900/40',
        headerBg: 'bg-white/[0.02]',
        searchBg: 'bg-white/[0.05] text-white placeholder-slate-400',
        searchBorder: 'border-white/10 focus:border-blue-400 focus:bg-white/[0.08]',
        searchFocusRing: 'focus:ring-2 focus:ring-blue-500/30',
        groupTitleColor: 'text-blue-300/60',
        itemInactiveText: 'text-slate-300 hover:text-white',
        itemInactiveHoverBg: 'hover:bg-white/[0.07]',
        itemInactiveIcon: 'text-slate-400 group-hover:text-blue-300',
        itemInactiveIconHover: 'text-blue-300',
        itemActiveGradient: 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white',
        itemActiveBorder: 'border border-white/20',
        itemActiveText: 'text-white',
        itemActiveShadow: 'shadow-[0_6px_20px_-3px_rgba(37,99,235,0.45)]',
        cardBg: 'bg-white/[0.04] border-white/10',
        cardBorder: 'border-white/10',
        tooltipBg: 'bg-slate-950/95 text-white',
        tooltipBorder: 'border-slate-700/60',
      };
    case 'glass':
      return {
        isLightMode: false,
        bgClass: 'bg-gradient-to-b from-[#0b132b] via-[#0d1736] to-[#070e20] text-slate-100 border-slate-700/40 shadow-[0_0_24px_-8px_rgba(0,0,0,0.45)]',
        headerBorder: 'border-white/10',
        headerBg: 'bg-white/[0.02]',
        searchBg: 'bg-white/[0.05] text-white placeholder-slate-400',
        searchBorder: 'border-white/10 focus:border-blue-400 focus:bg-white/[0.08]',
        searchFocusRing: 'focus:ring-2 focus:ring-blue-500/25',
        groupTitleColor: 'text-slate-400',
        itemInactiveText: 'text-slate-300 hover:text-white',
        itemInactiveHoverBg: 'hover:bg-white/[0.07]',
        itemInactiveIcon: 'text-slate-400 group-hover:text-blue-400',
        itemInactiveIconHover: 'text-blue-400',
        itemActiveGradient: 'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white',
        itemActiveBorder: 'border border-white/15',
        itemActiveText: 'text-white',
        itemActiveShadow: 'shadow-[0_6px_20px_-4px_rgba(37,99,235,0.4)]',
        cardBg: 'bg-white/[0.03] border-white/10',
        cardBorder: 'border-white/10',
        tooltipBg: 'bg-slate-900/95 text-white',
        tooltipBorder: 'border-slate-700/60',
      };
    case 'navy':
    default:
      return {
        isLightMode: false,
        bgClass: 'bg-gradient-to-b from-[#0c1427] via-[#0f1b34] to-[#091021] text-slate-100 border-slate-800/70 shadow-[0_0_24px_-8px_rgba(0,0,0,0.45)]',
        headerBorder: 'border-slate-800/70',
        headerBg: 'bg-white/[0.02]',
        searchBg: 'bg-slate-900/70 text-white placeholder-slate-400',
        searchBorder: 'border-slate-700/60 focus:border-blue-500 focus:bg-slate-900/90',
        searchFocusRing: 'focus:ring-2 focus:ring-blue-500/25',
        groupTitleColor: 'text-slate-400',
        itemInactiveText: 'text-slate-300 hover:text-white',
        itemInactiveHoverBg: 'hover:bg-white/[0.06]',
        itemInactiveIcon: 'text-slate-400 group-hover:text-blue-400',
        itemInactiveIconHover: 'text-blue-400',
        itemActiveGradient: 'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white',
        itemActiveBorder: 'border border-white/15',
        itemActiveText: 'text-white',
        itemActiveShadow: 'shadow-[0_6px_20px_-4px_rgba(37,99,235,0.4)]',
        cardBg: 'bg-slate-900/60 border-slate-800/70',
        cardBorder: 'border-slate-800/70',
        tooltipBg: 'bg-slate-950/95 text-white',
        tooltipBorder: 'border-slate-800',
      };
  }
};

/* ==========================================================================
   2. MAIN SIDEBAR COMPONENT
   ========================================================================== */

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isCollapsed: externalCollapsed,
  onToggleCollapse: externalToggleCollapse
}) => {
  const {
    sidebarStyle,
    themeMode,
    bgGradient,
    gradientIntensity,
    shadeLevel,
  } = useTheme();
  const { activeTab, setActiveTab } = useFuelData();
  const { t, tr, direction } = useLanguage();
  const isRtl = direction === 'rtl';

  // Internal collapsed state if not managed externally (collapsed by default)
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(true);

  // Compact strip only exists on desktop; the mobile drawer always shows labels
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const collapsedPref = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const isCollapsed = collapsedPref && isDesktop;

  const handleToggleCollapse = () => {
    if (externalToggleCollapse) {
      externalToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  // State for collapsible submenus / accordions
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({
    'finance-parent': true,
    'deliveries-parent': false
  });

  // State for search query
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State for user quick profile popover
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // State for logout confirmation
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Hovered item for collapsed floating tooltip
  const [hoveredItem, setHoveredItem] = useState<{ id: string; label: string; rect: DOMRect } | null>(null);

  const canOpenTab = useCanOpenTab();
  const profile = useSessionProfile();
  const tokens = useMemo(() => getDesignTokens(sidebarStyle, themeMode), [sidebarStyle, themeMode]);

  // Master Navigation Groups with Enterprise Submenus
  const allGroups: NavGroup[] = useMemo(() => [
    {
      groupTitle: t('groupOperations') || 'العمليات والمخزون',
      items: [
        { id: 'dashboard', label: t('navDashboard') || 'لوحة التحكم', icon: LayoutDashboard },
        { id: 'tanks', label: t('navTanks') || 'الخزانات والمستودعات', icon: Database },
        { id: 'prices', label: t('navPrices') || 'أسعار الوقود', icon: Tags },
        {
          id: 'deliveries',
          label: t('navDeliveries') || 'الواردات والتفريغ',
          icon: Truck,
          children: [
            { id: 'deliveries-sahara', label: t('navDeliveriesSahara') || 'واردات صحاري كربلاء' },
            { id: 'deliveries-etihad', label: t('navDeliveriesEtihad') || 'واردات شركة الاتحاد' },
          ]
        },
      ]
    },
    {
      groupTitle: t('groupManagement') || 'الإدارة والمالية',
      items: [
        {
          id: 'finance',
          label: t('navFinance') || 'الإدارة المالية',
          icon: Building2,
          children: [
            { id: 'finance-etihad', label: t('navFinanceEtihad') || 'مالية شركة الاتحاد' },
            { id: 'finance-sahara', label: t('navFinanceSahara') || 'مالية شركة صحاري' },
          ]
        },
        { id: 'managers', label: t('navManagers') || 'مسؤولو المحطات', icon: Users },
        { id: 'tasks', label: t('navTasks') || 'المهام واللوجستيات', icon: CheckSquare },
      ]
    },
    {
      groupTitle: t('groupAnalytics') || 'التحليلات والمتابعة',
      items: [
        { id: 'reports', label: t('navReports') || 'التقارير المتقدمة', icon: BarChart3 },
        { id: 'chat', label: t('navChat') || 'المساعد الذكي', icon: MessageSquare },
        { id: 'settings', label: t('navSettings') || 'إعدادات المنظومة', icon: Settings },
      ]
    }
  ], [t]);

  // Filter items based on permissions
  const permittedGroups = useMemo(() => {
    return allGroups
      .map(group => {
        const filteredItems = group.items
          .map(item => {
            if (item.children && item.children.length > 0) {
              const allowedChildren = item.children.filter(child => canOpenTab(child.id));
              const isParentAllowed = canOpenTab(item.id) || allowedChildren.length > 0;
              if (!isParentAllowed) return null;
              return {
                ...item,
                children: allowedChildren
              };
            }
            return canOpenTab(item.id) ? item : null;
          })
          .filter((item): item is NavItem => item !== null);

        return {
          ...group,
          items: filteredItems
        };
      })
      .filter(group => group.items.length > 0);
  }, [allGroups, canOpenTab]);

  // Filter items by search query
  const filteredNavGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return permittedGroups;

    return permittedGroups
      .map(group => {
        const matchingItems = group.items.filter(item => {
          const itemMatch = item.label.toLowerCase().includes(q);
          const childMatch = item.children?.some(c => c.label.toLowerCase().includes(q));
          return itemMatch || childMatch;
        });

        return {
          ...group,
          items: matchingItems
        };
      })
      .filter(group => group.items.length > 0);
  }, [permittedGroups, searchQuery]);

  // Inline custom style for match-bg
  const getSidebarInlineStyle = (): React.CSSProperties => {
    if (sidebarStyle === 'match-bg') {
      return {
        backgroundColor: getAmbientBgColor(bgGradient, themeMode, shadeLevel),
        backgroundImage: getAmbientGradientStyle(bgGradient, gradientIntensity, themeMode, shadeLevel),
      };
    }
    return {};
  };

  // Keyboard navigation listener (Esc to close drawer or clear search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
        } else if (isOpen) {
          onClose();
        } else if (isDesktop && !collapsedPref) {
          handleToggleCollapse();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, searchQuery, isDesktop, collapsedPref]); // eslint-disable-line react-hooks/exhaustive-deps

  // نقل التركيز لأول عنصر عند فتح الدرج، وإرجاعه لزر الفتح عند إغلاقه
  const asideRef = useRef<HTMLElement>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isDesktop) return;
    if (isOpen) {
      lastFocusRef.current = document.activeElement as HTMLElement | null;
      asideRef.current?.querySelector<HTMLElement>('input, nav button')?.focus();
    } else if (lastFocusRef.current) {
      lastFocusRef.current.focus?.();
      lastFocusRef.current = null;
    }
  }, [isOpen, isDesktop]);

  // Auto-expand accordion if child is active
  useEffect(() => {
    permittedGroups.forEach(group => {
      group.items.forEach(item => {
        if (item.children?.some(child => child.id === activeTab)) {
          // بدون تغيير إن كانت مفتوحة أصلًا (تجنّب إعادة رسم بلا داعٍ)
          setOpenDropdowns(prev => (prev[item.id] ? prev : { ...prev, [item.id]: true }));
        }
      });
    });
  }, [activeTab, permittedGroups]);

  // Close profile popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  // Navigate to a page, then dismiss the overlay (desktop: collapse back to the strip, mobile: close drawer)
  const handleItemClick = (id: NavTabId) => {
    setActiveTab(id);
    if (id === 'finance-etihad' || id === 'finance') {
      window.dispatchEvent(new CustomEvent('sahara:reset-etihad-hub'));
    }
    if (isDesktop) {
      if (!collapsedPref) handleToggleCollapse();
    } else {
      onClose();
    }
  };

  const desktopExpanded = isDesktop && !collapsedPref;

  return (
    <>
      {/* Click-away layer: mobile drawer (dimmed) and desktop expanded panel (transparent). No blur = no repaint cost */}
      {(isOpen || desktopExpanded) && (
        <div
          onClick={isDesktop ? handleToggleCollapse : onClose}
          aria-hidden="true"
          className={`fixed inset-0 z-40 cursor-pointer ${
            isDesktop ? 'bg-slate-950/10' : 'bg-slate-950/40 animate-in fade-in duration-200'
          }`}
        />
      )}

      {/* Sidebar: fixed (out of flow) so animating its width never reflows the page */}
      <aside
        ref={asideRef}
        inert={!isDesktop && !isOpen}
        id="main-sidebar"
        dir={direction}
        style={{ ...getSidebarInlineStyle(), contain: 'layout style', willChange: 'width, transform' }}
        aria-label={t('brandTitle')}
        aria-modal={!isDesktop && isOpen ? true : undefined}
        className={`fixed top-0 bottom-0 z-50 flex flex-col shrink-0 select-none whitespace-nowrap transition-[width,transform] duration-200 ease-out motion-reduce:transition-none ${
          isRtl ? 'right-0 border-l' : 'left-0 border-r'
        } ${
          isOpen
            ? 'translate-x-0'
            : isRtl
            ? 'translate-x-full md:translate-x-0'
            : '-translate-x-full md:translate-x-0'
        } ${
          isCollapsed ? 'w-[54px]' : 'w-[260px] max-w-[85vw] md:w-[238px]'
        } ${tokens.bgClass}`}
      >
        {/* 🌟 Desktop Collapse/Expand Pin Button on Outer Border (Storeify-Style) */}
        <button
          type="button"
          onClick={handleToggleCollapse}
          title={isCollapsed ? (isRtl ? 'توسيع القائمة' : 'Expand sidebar') : (isRtl ? 'طي القائمة' : 'Collapse sidebar')}
          aria-label={isCollapsed ? (isRtl ? 'توسيع القائمة' : 'Expand sidebar') : (isRtl ? 'طي القائمة' : 'Collapse sidebar')}
          aria-expanded={!isCollapsed}
          aria-controls="main-sidebar"
          className={`no-print hidden md:flex absolute top-[18px] z-40 w-[22px] h-[22px] rounded-full items-center justify-center transition-all duration-200 shadow-md border cursor-pointer active:scale-90 ${
            isRtl ? '-left-2.5' : '-right-2.5'
          } ${
            tokens.isLightMode
              ? 'bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 border-slate-200 shadow-slate-200/90'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700 shadow-black/50'
          }`}
        >
          {isCollapsed ? (
            isRtl ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
          ) : (
            isRtl ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />
          )}
        </button>

        {/* ==========================================================================
            HEADER / BRAND AREA
           ========================================================================== */}
        <div
          className={`border-b flex items-center transition-all duration-200 ${
            tokens.headerBorder
          } ${tokens.headerBg} ${
            isCollapsed ? 'justify-center py-3.5 px-1' : 'justify-between px-3 py-3.5'
          }`}
        >
          {/* In Collapsed Mode: ONLY show the 3 lines (Menu) button! Logo is hidden! */}
          {isCollapsed ? (
            <button
              type="button"
              onClick={handleToggleCollapse}
              title={isRtl ? 'فتح القائمة الجانبية' : 'Open sidebar'}
              aria-label={isRtl ? 'فتح القائمة الجانبية' : 'Open sidebar'}
              aria-expanded={false}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-90 ${
                tokens.isLightMode
                  ? 'text-slate-700 hover:text-blue-600 hover:bg-slate-100'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Menu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </button>
          ) : (
            /* In Expanded Mode: Logo + Title + 2026 Badge + 3-Lines Collapse Button */
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Logo Badge Container */}
                <div
                  onClick={() => handleItemClick('dashboard')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleItemClick('dashboard'); } }}
                  title={t('brandTitle')}
                  className="relative w-[34px] h-[34px] rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-600/30 ring-2 ring-blue-500/20 shrink-0 cursor-pointer transform transition-transform hover:scale-105 active:scale-95"
                >
                  <Flame className="w-4 h-4 text-amber-300" />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-[1.5px] ring-white dark:ring-slate-900"
                    title={t('online')}
                  />
                </div>

                {/* Brand Title & Year */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1
                      className={`font-black text-xs tracking-tight truncate leading-tight ${
                        tokens.isLightMode ? 'text-slate-900' : 'text-white'
                      }`}
                    >
                      {t('brandTitle') || 'صحاري كربلاء'}
                    </h1>
                    <span
                      className={`text-[8.5px] px-1 py-px rounded font-mono font-extrabold border ${
                        tokens.isLightMode
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                      }`}
                    >
                      2026
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 font-medium truncate">
                    <Radio className="w-2.5 h-2.5 text-emerald-500 animate-pulse shrink-0" />
                    <span className="truncate">{t('brandSubtitle') || 'محطة كربلاء المركزية'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleToggleCollapse}
                  title={isRtl ? 'طي القائمة' : 'Collapse sidebar'}
                  aria-label={isRtl ? 'طي القائمة' : 'Collapse sidebar'}
                  aria-expanded={true}
                  className={`p-1.5 rounded-lg transition-colors ${
                    tokens.isLightMode
                      ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-200/60'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Menu className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>

                {/* Close Drawer Button for Mobile */}
                <button
                  onClick={onClose}
                  title={`${t('close')} (Esc)`}
                  aria-label={t('close')}
                  className={`p-1.5 rounded-lg transition-colors md:hidden ${
                    tokens.isLightMode
                      ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-200/60'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ==========================================================================
            COMPACT REAL-TIME SEARCH (Shown in expanded mode)
           ========================================================================== */}
        {!isCollapsed && (
          <div className="px-3 pt-3 pb-1">
            <div className="relative flex items-center">
              <Search className={`w-3.5 h-3.5 absolute ${isRtl ? 'right-3' : 'left-3'} text-slate-400 pointer-events-none`} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr('بحث في القائمة...')}
                aria-label={tr('بحث في القائمة...')}
                className={`w-full h-[34px] text-xs rounded-xl font-medium transition-all duration-150 border outline-none ${
                  isRtl ? 'pr-8 pl-7' : 'pl-8 pr-7'
                } ${tokens.searchBg} ${tokens.searchBorder} ${tokens.searchFocusRing}`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  title={tr('مسح البحث')}
                  aria-label={tr('مسح البحث')}
                  type="button"
                  className={`absolute ${isRtl ? 'left-2.5' : 'right-2.5'} p-0.5 rounded text-slate-400 hover:text-slate-200`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Collapsed Search Trigger Button (Storeify-Style) */}
        {isCollapsed && (
          <div className="px-2 pt-2.5 pb-1 flex justify-center">
            <button
              onClick={() => {
                handleToggleCollapse();
                setTimeout(() => searchInputRef.current?.focus(), 150);
              }}
              title={tr('بحث في القائمة...')}
              aria-label={tr('بحث في القائمة...')}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                tokens.isLightMode ? 'text-slate-500 hover:bg-slate-100 hover:text-blue-600' : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ==========================================================================
            NAVIGATION GROUPS & ITEMS
           ========================================================================== */}
        <nav
          aria-label={isRtl ? 'التنقل الرئيسي' : 'Main navigation'}
          className="flex-1 px-2.5 py-2.5 space-y-4 overflow-y-auto overflow-x-hidden select-none"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: tokens.isLightMode ? 'rgba(148, 163, 184, 0.4) transparent' : 'rgba(255, 255, 255, 0.1) transparent'
          }}
        >
          {filteredNavGroups.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <p className="text-xs text-slate-400 font-medium">{tr('لا توجد نتائج مطابقة')}</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-[11px] text-blue-500 hover:underline font-bold"
              >
                {tr('إلغاء التصفية')}
              </button>
            </div>
          ) : (
            filteredNavGroups.map((group, gIdx) => (
              <div key={gIdx} className={isCollapsed ? 'space-y-1.5' : 'space-y-1'}>
                {/* Group Title or Separator */}
                {!isCollapsed ? (
                  <div className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${tokens.groupTitleColor}`}>
                    <span className="w-1 h-1 rounded-full bg-blue-500/60" />
                    <span>{group.groupTitle}</span>
                  </div>
                ) : (
                  <div className="h-px bg-white/10 dark:bg-white/5 mx-2 my-2" />
                )}

                {/* Items in Group */}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const hasChildren = Boolean(item.children && item.children.length > 0);
                  const isDropdownOpen = openDropdowns[item.id] ?? false;
                  const isChildActive = Boolean(item.children?.some(c => c.id === activeTab));
                  const isActive = activeTab === item.id;
                  const isCurrentActive = isActive || isChildActive;

                  /* ----------------------------------------------------
                     Accordion Parent Item
                     ---------------------------------------------------- */
                  if (hasChildren && !isCollapsed) {
                    return (
                      <div key={item.id} className="space-y-1">
                        <button
                          type="button"
                          aria-expanded={isDropdownOpen}
                          aria-controls={`submenu-${item.id}`}
                          onClick={() => {
                            setOpenDropdowns(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition-all duration-180 group relative ${
                            isCurrentActive
                              ? `${tokens.cardBg} border ${tokens.cardBorder} text-blue-600 dark:text-blue-300 font-extrabold shadow-xs`
                              : `${tokens.itemInactiveText} ${tokens.itemInactiveHoverBg}`
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={`w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-105 ${
                                isCurrentActive
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : tokens.itemInactiveIcon
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>

                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 text-slate-400 ${
                              isDropdownOpen ? 'rotate-180 text-blue-500' : ''
                            }`}
                          />
                        </button>

                        {/* Child Submenu */}
                        {isDropdownOpen && (
                          <div
                            id={`submenu-${item.id}`}
                            className={`space-y-1 pt-0.5 pb-1 animate-in fade-in duration-150 ${
                              isRtl
                                ? 'pr-3 mr-3 border-r-2 border-blue-500/25'
                                : 'pl-3 ml-3 border-l-2 border-blue-500/25'
                            }`}
                          >
                            {item.children!.map((child) => {
                              const isSubActive = activeTab === child.id;
                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  aria-current={isSubActive ? 'page' : undefined}
                                  onClick={() => handleItemClick(child.id)}
                                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-bold text-xs transition-all duration-180 group relative ${
                                    isSubActive
                                      ? `${tokens.itemActiveGradient} ${tokens.itemActiveShadow} ${tokens.itemActiveBorder}`
                                      : `${tokens.itemInactiveText} ${tokens.itemInactiveHoverBg}`
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full transition-transform duration-200 ${
                                        isSubActive
                                          ? 'bg-amber-400 ring-4 ring-amber-400/30 scale-125'
                                          : 'bg-slate-400/70 group-hover:bg-blue-400'
                                      }`}
                                    />
                                    <span className="truncate">{child.label}</span>
                                  </div>

                                  {isSubActive && (
                                    <span className="text-[10px] px-1.5 py-px rounded bg-white/20 text-white font-extrabold">
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

                  /* ----------------------------------------------------
                     Regular or Collapsed Item
                     ---------------------------------------------------- */
                  return (
                    <div
                      key={item.id}
                      className="relative"
                      onMouseEnter={(e) => {
                        if (isCollapsed) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredItem({ id: item.id, label: item.label, rect });
                        }
                      }}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <button
                        type="button"
                        aria-label={item.label}
                        aria-current={isActive ? 'page' : undefined}
                        onFocus={(e) => {
                          if (isCollapsed) setHoveredItem({ id: item.id, label: item.label, rect: e.currentTarget.getBoundingClientRect() });
                        }}
                        onBlur={() => setHoveredItem(null)}
                        onClick={() => {
                          if (isCollapsed) {
                            handleToggleCollapse();
                            return;
                          }
                          if (hasChildren) {
                            // Select first permitted child
                            const firstChild = item.children?.[0];
                            if (firstChild) handleItemClick(firstChild.id);
                          } else {
                            handleItemClick(item.id);
                          }
                        }}
                        className={`w-full flex items-center rounded-xl font-bold text-xs sm:text-[13px] transition-all duration-180 group relative ${
                          isCollapsed
                            ? 'justify-center h-[34px] w-[34px] mx-auto'
                            : 'justify-between px-2.5 py-2 h-10'
                        } ${
                          isCurrentActive
                            ? `${tokens.itemActiveGradient} ${tokens.itemActiveShadow} ${tokens.itemActiveBorder}`
                            : `${tokens.itemInactiveText} ${tokens.itemInactiveHoverBg}`
                        }`}
                      >
                        {/* Active Accent Pill on the leading edge */}
                        {isCurrentActive && (
                          <span
                            className={`absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)] ${
                              isRtl ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'
                            }`}
                          />
                        )}

                        <div className={`flex items-center gap-2.5 relative z-10 ${isCollapsed ? 'justify-center' : ''}`}>
                          <Icon
                            className={`w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-105 shrink-0 ${
                              isCurrentActive
                                ? 'text-white drop-shadow-xs'
                                : tokens.itemInactiveIcon
                            }`}
                          />
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </div>

                        {/* Optional item badge if expanded */}
                        {!isCollapsed && item.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-blue-500/20 text-blue-300">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </nav>

        {/* ==========================================================================
            FLOATING ENTERPRISE USER PROFILE & LOGOUT
           ========================================================================== */}
        <div className={`transition-all duration-200 ${isCollapsed ? 'p-1 m-1' : 'p-2 m-2'} rounded-2xl border ${tokens.cardBg} ${tokens.cardBorder}`}>
          {/* User Profile Card */}
          <div
            ref={profileMenuRef}
            onClick={() => setShowProfileMenu(prev => !prev)}
            role="button"
            tabIndex={0}
            aria-haspopup="menu"
            aria-expanded={showProfileMenu}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowProfileMenu(prev => !prev); } }}
            title={profile?.name || t('profile')}
            className={`flex items-center gap-2 p-1 rounded-xl cursor-pointer transition-colors group ${
              isCollapsed ? 'justify-center' : 'justify-between hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="relative rounded-xl text-white font-black text-xs flex items-center justify-center shadow-xs overflow-hidden shrink-0 ring-1 ring-white/20"
                style={{
                  background: profile?.color || '#2563eb',
                  width: isCollapsed ? '30px' : '36px',
                  height: isCollapsed ? '30px' : '36px',
                  minWidth: isCollapsed ? '30px' : '36px',
                  minHeight: isCollapsed ? '30px' : '36px',
                  maxWidth: isCollapsed ? '30px' : '36px',
                  maxHeight: isCollapsed ? '30px' : '36px',
                }}
              >
                {profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt=""
                    className="w-full h-full object-cover rounded-xl"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  initials(profile?.name)
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
              </div>

              {!isCollapsed && (
                <div className={`flex-1 min-w-0 ${isRtl ? 'text-right' : 'text-left'}`}>
                  <div className={`text-xs font-bold truncate leading-tight ${tokens.isLightMode ? 'text-slate-900' : 'text-white'}`}>
                    {profile?.name || t('generalManager')}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 truncate font-mono">
                    {!!profile?.is_admin && <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />}
                    <span dir="ltr" className="truncate">@{profile?.username || 'user'}</span>
                  </div>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
            )}
          </div>

          {/* User Profile Popover / Dropdown Menu */}
          {showProfileMenu && !isCollapsed && (
            <div
              role="menu"
              className={`mt-2 p-1.5 rounded-xl border space-y-1 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-150 ${
                tokens.isLightMode ? 'bg-white border-slate-200 shadow-lg' : 'bg-slate-900/95 border-slate-700/80 shadow-xl'
              }`}
            >
              <button
                onClick={() => {
                  handleItemClick('settings');
                  setShowProfileMenu(false);
                }}
                role="menuitem"
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                  tokens.isLightMode ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>{tr('الملف الشخصي والحساب')}</span>
              </button>
              <button
                onClick={() => {
                  handleItemClick('settings');
                  setShowProfileMenu(false);
                }}
                role="menuitem"
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${
                  tokens.isLightMode ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-200'
                }`}
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>{tr('إعدادات المنظومة')}</span>
              </button>
            </div>
          )}

          {/* Logout Section */}
          {!isCollapsed && (
            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-white/10">
              {confirmLogout ? (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      setLeaving(true);
                      logout();
                    }}
                    disabled={leaving}
                    className="h-8 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors disabled:opacity-60"
                  >
                    {leaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                    <span>{tr('تأكيد')}</span>
                  </button>
                  <button
                    onClick={() => setConfirmLogout(false)}
                    disabled={leaving}
                    className={`h-8 rounded-lg text-[11px] font-bold transition-colors ${
                      tokens.isLightMode
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-white/10 hover:bg-white/15 text-slate-200'
                    }`}
                  >
                    {tr('إلغاء')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmLogout(true)}
                  className={`w-full h-8 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-bold transition-colors ${
                    tokens.isLightMode
                      ? 'text-rose-600 hover:bg-rose-50'
                      : 'text-rose-300 hover:bg-rose-500/10'
                  }`}
                >
                  <LogOut className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                  <span>{tr('تسجيل الخروج')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ==========================================================================
          FLOATING TOOLTIP FOR COLLAPSED MODE
         ========================================================================== */}
      {isCollapsed && hoveredItem && (
        <div
          style={{
            position: 'fixed',
            top: hoveredItem.rect.top + hoveredItem.rect.height / 2,
            [isRtl ? 'right' : 'left']: 62,
            transform: 'translateY(-50%)',
            zIndex: 60,
          }}
          className={`pointer-events-none px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-xl border animate-in fade-in duration-100 whitespace-nowrap ${tokens.tooltipBg} ${tokens.tooltipBorder}`}
        >
          {hoveredItem.label}
        </div>
      )}
    </>
  );
};
