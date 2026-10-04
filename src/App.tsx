import React, { useState, useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { FuelDataProvider, useFuelData } from './context/FuelDataContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { QuickActionContext } from './context/QuickActionContext';
import { getAmbientGradientStyle, getAmbientBgColor } from './lib/themeGradients';

import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { QuickActionModal } from './components/layout/QuickActionModal';
import { CommandPalette } from './components/navigation/CommandPalette';
import { MainDashboard } from './components/dashboard/MainDashboard';
import { TanksOverview } from './components/tanks/TanksOverview';
import { PricesView } from './components/prices/PricesView';
import { InboundDeliveries } from './components/deliveries/InboundDeliveries';
import { FinanceBalance } from './components/finance/FinanceBalance';
import { SiteManagers } from './components/managers/SiteManagers';
import { TasksLogistics } from './components/tasks/TasksLogistics';
import { ReportsAnalytics } from './components/reports/ReportsAnalytics';
import { ChatApp } from './components/chat/ChatApp';
import { SettingsView } from './components/settings/SettingsView';
import { NoAccess } from './components/auth/NoAccess';
import { ReadOnlyBanner } from './components/auth/ReadOnlyBanner';
import { useCanOpenTab, TAB_SECTION } from './lib/usePermission';
import type { NavTabId } from './types';

const AppContent: React.FC = () => {
  const { themeMode, bgGradient, gradientIntensity, shadeLevel } = useTheme();
  const { activeTab, setActiveTab } = useFuelData();
  const canOpenTab = useCanOpenTab();
  const firstAllowed = Object.keys(TAB_SECTION).find(canOpenTab) as NavTabId | undefined;

  // صفحة غير مسموحة (رابط قديم أو صفحة البداية الافتراضية): الانتقال لأول صفحة مسموحة
  useEffect(() => {
    if (!canOpenTab(activeTab) && firstAllowed) setActiveTab(firstAllowed);
  }, [activeTab, firstAllowed]); // eslint-disable-line react-hooks/exhaustive-deps
  const { tr, direction } = useLanguage();
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

  const isRtl = direction === 'rtl';

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

  const renderActiveView = () => {
    if (!canOpenTab(activeTab)) return <NoAccess hasAny={!!firstAllowed} />;
    switch (activeTab) {
      case 'dashboard':
        return <MainDashboard />;
      case 'tanks':
        return <TanksOverview />;
      case 'prices':
        return <PricesView />;
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
      <div className="no-print shrink-0 lg:w-[54px]">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapsed}
        />
      </div>

      {/* 🌟 Floating Visible Icon to Open Sidebar on Mobile (< lg) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          title={tr('فتح القائمة الجانبية')}
          aria-label={tr('فتح القائمة الجانبية')}
          className={`no-print lg:hidden fixed top-24 z-40 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white shadow-xl cursor-pointer active:scale-95 group border-y border-white/20 ${
            isRtl
              ? 'right-0 rounded-l-2xl border-l'
              : 'left-0 rounded-r-2xl border-r'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <Menu className="w-[18px] h-[18px] text-white" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-blue-700 animate-pulse" />
          </div>
          <span className="text-xs font-bold tracking-tight">
            {tr('القائمة')}
          </span>
        </button>
      )}

      {/* Main Workspace Container - Expansive Full Width beside sidebar */}
      <div className="flex-1 flex flex-col min-w-0 w-full transition-all duration-300 print:p-0 print:m-0">
        
        {/* Mobile Header Bar & Hamburger */}
        <div className="no-print lg:hidden p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-40">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </button>
          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
            {tr('منظومة وقود صحاري كربلاء 2026')}
          </span>
          <div className="w-6" />
        </div>

        {/* Global Enterprise Header */}
        <div className="no-print">
          <Header
            onOpenQuickAction={handleOpenQuickAction}
            onToggleSidebar={() => {
              if (window.innerWidth >= 1024) {
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
              {canOpenTab(activeTab) && TAB_SECTION[activeTab]?.section && <ReadOnlyBanner section={TAB_SECTION[activeTab].section!} />}
              {renderActiveView()}
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

