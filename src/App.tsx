import React, { useState, useEffect, useRef } from 'react';
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { FuelDataProvider, useFuelData } from './context/FuelDataContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { QuickActionContext } from './context/QuickActionContext';

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

const AppContent: React.FC = () => {
  const { activeTab } = useFuelData();
  const { tr, direction } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

    // Apply scroll immediately and after frame render
    window.scrollTo({ top: targetY, left: 0, behavior: 'instant' as ScrollBehavior });

    const raf1 = requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, left: 0, behavior: 'instant' as ScrollBehavior });
      const raf2 = requestAnimationFrame(() => {
        window.scrollTo({ top: targetY, left: 0, behavior: 'instant' as ScrollBehavior });
        isNavigatingRef.current = false;
      });
      return () => cancelAnimationFrame(raf2);
    });

    return () => cancelAnimationFrame(raf1);
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
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090E17] text-slate-800 dark:text-slate-100 flex flex-col print:bg-white print:min-h-0">
      
      {/* 🌟 Floating Sidebar Navigation Overlay */}
      <div className="no-print">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Sleek Floating Edge Tab to Open Sidebar if Closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          title={tr('فتح القائمة الجانبية (شريط العمليات)')}
          className={`no-print fixed top-1/2 -translate-y-1/2 z-40 w-6 hover:w-8 h-14 bg-gradient-to-b from-blue-700 to-indigo-600 text-white shadow-xl flex items-center justify-center transition-all duration-200 cursor-pointer group border-y border-white/20 hover:shadow-blue-500/30 ${
            isRtl ? 'right-0 rounded-l-xl border-l' : 'left-0 rounded-r-xl border-r'
          }`}
        >
          {isRtl ? (
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          ) : (
            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          )}
        </button>
      )}

      {/* Main Workspace Container - 100% Expansive Full Width */}
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
            onToggleSidebar={() => setSidebarOpen(prev => !prev)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />
        </div>

        {/* Page Content View - 99% Ultra-Wide Fluid Responsive Layout */}
        <main className="flex-1 flex flex-col pt-1.5 pb-4 px-1 sm:px-1.5 md:px-2 w-[99%] max-w-[99%] mx-auto print:w-full print:p-0 print:m-0 transition-all duration-300">

          {/* Active View Container */}
          <div className="flex-1 flex flex-col print:animate-none">
            <QuickActionContext.Provider value={handleOpenQuickAction}>
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

