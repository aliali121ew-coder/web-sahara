import React, { useState, useEffect, useRef, Suspense, Activity } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { FuelDataProvider, useFuelData } from './context/FuelDataContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { QuickActionContext } from './context/QuickActionContext';
import { getAmbientGradientStyle, getAmbientBgColor } from './lib/themeGradients';

import { Header } from './components/layout/Header';
import { DemoBanner } from './components/layout/DemoBanner';
import { Sidebar } from './components/layout/Sidebar';
import { QuickActionModal } from './components/layout/QuickActionModal';
import { CommandPalette } from './components/navigation/CommandPalette';
import { lazyPage } from './lib/lazyPage';

/** عدد الصفحات التي تبقى محفوظة للرجوع الفوري إليها */
const MAX_KEPT_PAGES = 4;
import { NoAccess } from './components/auth/NoAccess';
import { useCanOpenTab, TAB_SECTION } from './lib/usePermission';
import type { NavTabId } from './types';

// كل صفحة في ملف مستقل يُحمَّل عند أول زيارة، ويُجلب مسبقاً وقت الخمول بعد ظهور الصفحة الأولى
const MainDashboard = lazyPage(() => import('./components/dashboard/MainDashboard'), 'MainDashboard');
const TanksOverview = lazyPage(() => import('./components/tanks/TanksOverview'), 'TanksOverview');
const PricesView = lazyPage(() => import('./components/prices/PricesView'), 'PricesView');
const SuppliersView = lazyPage(() => import('./components/suppliers/SuppliersView'), 'SuppliersView');
const InboundDeliveries = lazyPage<{ onOpenModal: (data?: any) => void }>(() => import('./components/deliveries/InboundDeliveries'), 'InboundDeliveries');
const FinanceBalance = lazyPage(() => import('./components/finance/FinanceBalance'), 'FinanceBalance');
const SiteManagers = lazyPage(() => import('./components/managers/SiteManagers'), 'SiteManagers');
const TasksLogistics = lazyPage(() => import('./components/tasks/TasksLogistics'), 'TasksLogistics');
const ReportsAnalytics = lazyPage(() => import('./components/reports/ReportsAnalytics'), 'ReportsAnalytics');
const ChatApp = lazyPage(() => import('./components/chat/ChatApp'), 'ChatApp');
const SettingsView = lazyPage(() => import('./components/settings/SettingsView'), 'SettingsView');

const PAGE_PRELOADERS: Record<string, { preload: () => void }> = {
  dashboard: MainDashboard, tanks: TanksOverview, prices: PricesView, suppliers: SuppliersView,
  deliveries: InboundDeliveries, 'deliveries-sahara': InboundDeliveries, 'deliveries-etihad': InboundDeliveries,
  finance: FinanceBalance, 'finance-etihad': FinanceBalance, 'finance-sahara': FinanceBalance,
  managers: SiteManagers, tasks: TasksLogistics, reports: ReportsAnalytics, chat: ChatApp, settings: SettingsView,
};

const AppContent: React.FC = () => {
  const { themeMode, bgGradient, gradientIntensity, shadeLevel } = useTheme();
  const { activeTab, setActiveTab } = useFuelData();
  const canOpenTab = useCanOpenTab();
  const firstAllowed = Object.keys(TAB_SECTION).find(canOpenTab) as NavTabId | undefined;

  // صفحة غير مسموحة (رابط قديم أو صفحة البداية الافتراضية): الانتقال لأول صفحة مسموحة
  useEffect(() => {
    if (!canOpenTab(activeTab) && firstAllowed) setActiveTab(firstAllowed);
  }, [activeTab, firstAllowed]); // eslint-disable-line react-hooks/exhaustive-deps
  const { direction } = useLanguage();

  // جلب باقي الصفحات في الخلفية وقت الخمول (صفحة المستخدم الحالية أولاً) فيصبح التنقل فورياً
  useEffect(() => {
    const ric: (cb: () => void) => any = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 400));
    const queue = [activeTab, ...Object.keys(PAGE_PRELOADERS)];
    const seen = new Set<unknown>();
    let cancelled = false;
    const next = () => {
      if (cancelled) return;
      const k = queue.shift();
      if (!k) return;
      const p = PAGE_PRELOADERS[k];
      if (p && !seen.has(p)) { seen.add(p); p.preload(); }
      ric(next);
    };
    ric(next);
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);
  const toggleSidebarCollapsed = () => setSidebarCollapsed(prev => !prev);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [quickActionData, setQuickActionData] = useState<any>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Tab scroll position memory
  const scrollPositions = useRef<Record<string, number>>({});
  const isNavigatingRef = useRef(false);

  // 1. On page mount/refresh: reset scroll restoration so fresh reload starts at top (0,0)
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  // 2. Track scroll position for currently active tab
  useEffect(() => {
    const handleScroll = () => {
      if (!isNavigatingRef.current) {
        scrollPositions.current[activeTab] = window.scrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  // 3. When switching tabs: restore saved position or start from top (0)
  useEffect(() => {
    isNavigatingRef.current = true;
    const targetY = scrollPositions.current[activeTab] ?? 0;

    // Apply scroll immediately
    window.scrollTo({ top: targetY, left: 0, behavior: 'instant' as ScrollBehavior });

    // Allow render to complete before accepting new scroll positions
    const timer = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 100);

    return () => clearTimeout(timer);
  }, [activeTab]);

  const handleOpenQuickAction = (data?: any) => {
    const locked = activeTab === 'deliveries-sahara'
      ? 'صحاري كربلاء'
      : activeTab === 'deliveries-etihad'
      ? 'شركة الاتحاد'
      : data?.lockedCompany;

    setQuickActionData(data ? { ...data, lockedCompany: data.lockedCompany || locked } : (locked ? { lockedCompany: locked } : null));
    setQuickActionOpen(true);
  };


  // Global Ctrl + K / Cmd + K Shortcut Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // الصفحات التي زارها المستخدم تبقى محفوظة (Activity): العودة إليها فورية بحالتها كما تركها،
  // وتتوقف مؤثراتها وتتأجل تحديثاتها وهي مخفية فلا تستهلك المعالج
  // أحدث 4 صفحات فقط: كل صفحة محفوظة تستهلك ذاكرة وتُحدَّث في الخلفية، وهذا يثقل الهواتف الضعيفة
  const [visited, setVisited] = useState<NavTabId[]>(() => [activeTab]);
  useEffect(() => {
    setVisited(prev => (prev.includes(activeTab) ? prev : [...prev, activeTab].slice(-MAX_KEPT_PAGES)));
  }, [activeTab]);
  const mountedTabs = visited.includes(activeTab) ? visited : [...visited, activeTab];

  const renderTab = (tab: NavTabId) => {
    if (!canOpenTab(tab)) return <NoAccess hasAny={!!firstAllowed} />;
    switch (tab) {
      case 'dashboard':
        return <MainDashboard />;
      case 'tanks':
        return <TanksOverview />;
      case 'prices':
        return <PricesView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'deliveries':
      case 'deliveries-sahara':
      case 'deliveries-etihad':
        return <InboundDeliveries onOpenModal={handleOpenQuickAction} />;
      case 'finance':
      case 'finance-etihad':
      case 'finance-sahara':
        return <FinanceBalance />;
      case 'managers':
        return <SiteManagers />;
      case 'tasks':
        return <TasksLogistics />;
      case 'reports':
        return <ReportsAnalytics />;
      case 'chat':
        return <ChatApp />;
      case 'settings':
        return <SettingsView />;
      default:
        return <MainDashboard />;
    }
  };

  return (
    <div
      className="min-h-screen text-slate-800 dark:text-slate-100 flex flex-row print:bg-white print:min-h-0 transition-colors duration-300 relative w-full overflow-x-clip"
      dir={direction}
      style={{
        backgroundColor: getAmbientBgColor(bgGradient, themeMode, shadeLevel),
        backgroundImage: getAmbientGradientStyle(bgGradient, gradientIntensity, themeMode, shadeLevel),
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
      }}
    >
      
      {/* 🌟 Embedded In-Page Sidebar Navigation (Desktop embedded & sticky, Mobile drawer) */}
      <div className="no-print shrink-0 md:w-[54px]">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapsed}
        />
      </div>

      {/* Main Workspace Container - Expansive Full Width beside sidebar */}
      <div className="flex-1 flex flex-col min-w-0 w-full transition-all duration-300 print:p-0 print:m-0">
        
        {/* Global Enterprise Header */}
        <div className="no-print">
          <DemoBanner />
          <Header
            onOpenQuickAction={handleOpenQuickAction}
            onToggleSidebar={() => {
              if (window.innerWidth >= 768) {
                toggleSidebarCollapsed();
              } else {
                setSidebarOpen(prev => !prev);
              }
            }}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />
        </div>

        {/* Page Content View - 99% Ultra-Wide Fluid Responsive Layout */}
        <main className="flex-1 flex flex-col pt-1.5 pb-4 px-1 sm:px-1.5 md:px-2 w-[99%] max-w-[99%] mx-auto print:w-full print:p-0 print:m-0 transition-all duration-300">

          {/* Active View Container */}
          <div className="flex-1 flex flex-col print:animate-none">
            <QuickActionContext.Provider value={handleOpenQuickAction}>
              <Suspense fallback={null}>
                {mountedTabs.map(tab => (
                  <Activity key={tab} mode={tab === activeTab ? 'visible' : 'hidden'}>
                    {renderTab(tab)}
                  </Activity>
                ))}
              </Suspense>
            </QuickActionContext.Provider>
          </div>
        </main>

      </div>


      {/* ⚡ Command Palette (Ctrl + K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenQuickAction={handleOpenQuickAction}
      />

      {/* Quick Action Modal */}
      <QuickActionModal
        isOpen={quickActionOpen}
        onClose={() => setQuickActionOpen(false)}
        editData={quickActionData}
      />

    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <FuelDataProvider>
          <AppContent />
        </FuelDataProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

