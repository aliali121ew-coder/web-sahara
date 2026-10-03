import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useCanOpenTab } from '../../lib/usePermission';
import {
  Search,
  LayoutDashboard,
  Database,
  Truck,
  Wallet,
  Users,
  CheckSquare,
  BarChart3,
  MessageSquare,
  Settings,
  PlusCircle,
  Sun,
  Moon,
  RefreshCw,
  X,
  ArrowRight,
  Sparkles,
  Command
} from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQuickAction: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'صفحات' | 'خزانات' | 'إجراءات';
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  onSelect: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenQuickAction
}) => {
  const { setActiveTab, refreshAllData } = useFuelData();
  const { themeMode, toggleThemeMode } = useTheme();
  const { tr, isRTL } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);


  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global Ctrl + K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open via external state or callback
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Comprehensive Search Items
  const canOpenTab = useCanOpenTab();
  const everyItem: CommandItem[] = useMemo(() => [
    // 📄 Navigation Pages
    {
      id: 'page-dashboard',
      title: 'لوحة التحكم الرئيسية',
      subtitle: 'نظرة شاملة ومؤشرات حية لاستهلاك ومخزون الوقود',
      category: 'صفحات',
      icon: LayoutDashboard,
      onSelect: () => { setActiveTab('dashboard'); onClose(); }
    },
    {
      id: 'page-tanks',
      title: 'منظومة الخزانات ثلاثية الأبعاد (3D SCADA)',
      subtitle: 'مراقبة الـ 16 خزان ومناسيب النفط الأسود والكاز والبنزين',
      category: 'صفحات',
      icon: Database,
      badge: '16 خزان',
      onSelect: () => { setActiveTab('tanks'); onClose(); }
    },
    {
      id: 'page-deliveries',
      title: 'الوارد والشحنات',
      subtitle: 'سجل الحوضيات وتفريغ الشحنات وأرقام السيارات',
      category: 'صفحات',
      icon: Truck,
      onSelect: () => { setActiveTab('deliveries'); onClose(); }
    },
    {
      id: 'page-deliveries-sahara',
      title: 'وارد الصحاري',
      subtitle: 'سجل شحنات وواردات صهاريج صحاري كربلاء',
      category: 'صفحات',
      icon: Truck,
      onSelect: () => { setActiveTab('deliveries-sahara'); onClose(); }
    },
    {
      id: 'page-deliveries-etihad',
      title: 'وارد الاتحاد',
      subtitle: 'سجل شحنات وواردات صهاريج شركة الاتحاد',
      category: 'صفحات',
      icon: Truck,
      onSelect: () => { setActiveTab('deliveries-etihad'); onClose(); }
    },
    {
      id: 'page-finance-etihad',
      title: 'رصيد شركة الاتحاد',
      subtitle: 'الحسابات والمخزون الاستراتيجي واعتمادات شركة الاتحاد',
      category: 'صفحات',
      icon: Wallet,
      onSelect: () => { setActiveTab('finance-etihad'); onClose(); }
    },
    {
      id: 'page-finance-sahara',
      title: 'رصيد شركة الصحاري',
      subtitle: 'التدفقات النقدية ومخزون ومبيعات صحاري كربلاء',
      category: 'صفحات',
      icon: Wallet,
      onSelect: () => { setActiveTab('finance-sahara'); onClose(); }
    },
    {
      id: 'page-managers',
      title: 'مدراء الموقع وفرق العمل',
      subtitle: 'الصلاحيات، الورديات، وسجلات المشرفين الميدانيين',
      category: 'صفحات',
      icon: Users,
      onSelect: () => { setActiveTab('managers'); onClose(); }
    },
    {
      id: 'page-tasks',
      title: 'إدارة المهام والعمليات اللوجستية',
      subtitle: 'متابعة الصيانة الوقائية والمهام الميدانية',
      category: 'صفحات',
      icon: CheckSquare,
      onSelect: () => { setActiveTab('tasks'); onClose(); }
    },
    {
      id: 'page-reports',
      title: 'التقارير التحليلية والإحصائيات',
      subtitle: 'رسوم بيانية، تقارير استهلاك دورية، وتصدير البيانات',
      category: 'صفحات',
      icon: BarChart3,
      onSelect: () => { setActiveTab('reports'); onClose(); }
    },
    {
      id: 'page-chat',
      title: 'غرفة المحادثات والتنسيق المباشر',
      subtitle: 'تواصل فوري بين غرف السيطرة والمشرفين الميدانيين',
      category: 'صفحات',
      icon: MessageSquare,
      onSelect: () => { setActiveTab('chat'); onClose(); }
    },
    {
      id: 'page-settings',
      title: 'إعدادات النظام والمظهر',
      subtitle: 'تخصيص الثيمات، أنماط القائمة، والخيارات الهندسية',
      category: 'صفحات',
      icon: Settings,
      onSelect: () => { setActiveTab('settings'); onClose(); }
    },

    // 🛢️ Tanks Quick Jump
    {
      id: 'tank-sh-01',
      title: 'خزان صحاري 1 (TK-SH-01)',
      subtitle: 'النفط الأسود - شركة صحاري كربلاء | السعة: 4,645,536 لتر',
      category: 'خزانات',
      icon: Database,
      onSelect: () => { setActiveTab('tanks'); onClose(); }
    },
    {
      id: 'tank-sh-02',
      title: 'خزان صحاري 2 (TK-SH-02)',
      subtitle: 'النفط الأسود - شركة صحاري كربلاء | السعة: 4,618,419 لتر',
      category: 'خزانات',
      icon: Database,
      onSelect: () => { setActiveTab('tanks'); onClose(); }
    },
    {
      id: 'tank-sh-03',
      title: 'خزان صحاري 3 (TK-SH-03)',
      subtitle: 'النفط الأسود - شركة صحاري كربلاء | السعة: 4,640,400 لتر',
      category: 'خزانات',
      icon: Database,
      onSelect: () => { setActiveTab('tanks'); onClose(); }
    },
    {
      id: 'tank-et-01',
      title: 'خزان الطاقة القديمة (TK-ET-01)',
      subtitle: 'عمليات الاتحاد - النفط الأسود | السعة: 6,000,000 لتر',
      category: 'خزانات',
      icon: Database,
      onSelect: () => { setActiveTab('tanks'); onClose(); }
    },
    {
      id: 'tank-et-02',
      title: 'خزان الطاقة الجديدة (TK-ET-02)',
      subtitle: 'عمليات الاتحاد - النفط الأسود | السعة: 10,800,000 لتر',
      category: 'خزانات',
      icon: Database,
      onSelect: () => { setActiveTab('tanks'); onClose(); }
    },
    {
      id: 'tank-kz-01',
      title: 'خزان الكاز الرئيسي 1 (TK-KZ-01)',
      subtitle: 'وحدة الكاز والبنزين | السعة: 4,499,480 لتر',
      category: 'خزانات',
      icon: Database,
      onSelect: () => { setActiveTab('tanks'); onClose(); }
    },

    // ⚡ Quick Actions
    {
      id: 'action-new-delivery',
      title: 'تسجيل تفريغ شحنة واردة جديدة',
      subtitle: 'إدخال بيانات حوضية وتفريغ الوقود في الخزانات',
      category: 'إجراءات',
      icon: PlusCircle,
      badge: 'إجراء سريع',
      onSelect: () => { onClose(); onOpenQuickAction(); }
    },
    {
      id: 'action-toggle-theme',
      title: `تبديل المظهر إلى ${themeMode === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}`,
      subtitle: 'تغيير سمة الألوان والتصميم للمنظومة',
      category: 'إجراءات',
      icon: themeMode === 'dark' ? Sun : Moon,
      onSelect: () => { toggleThemeMode(); onClose(); }
    },
    {
      id: 'action-refresh',
      title: 'تحديث كافة البيانات اللحظية (SCADA Sync)',
      subtitle: 'مزامنة قياسات الخزانات والتدفقات والميزانية',
      category: 'إجراءات',
      icon: RefreshCw,
      onSelect: () => { refreshAllData(); onClose(); }
    }
  ], [setActiveTab, onClose, onOpenQuickAction, themeMode, toggleThemeMode, refreshAllData]);
  // الصفحات والخزانات غير المسموحة لهذا الحساب لا تظهر في البحث
  const allItems = everyItem.filter(item =>
    item.id.startsWith('page-') ? canOpenTab(item.id.slice(5))
      : item.id.startsWith('tank-') ? canOpenTab('tanks')
        : true);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const cleanQuery = query.toLowerCase().trim();
    return allItems.filter(item => 
      item.title.toLowerCase().includes(cleanQuery) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(cleanQuery)) ||
      item.category.toLowerCase().includes(cleanQuery)
    );
  }, [allItems, query]);

  // Arrow Key Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].onSelect();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0E1524] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        
        {/* Search Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <Search className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder={tr('ابحث عن صفحة، خزان، إجراء، أو أمر سريع...')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm sm:text-base font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
            <Command className="w-3 h-3" />
            <span>{tr('ESC للإغلاق')}</span>
          </div>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2.5 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/40"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold">{tr('لا توجد نتائج تطابق بحثك')}</p>
              <p className="text-xs mt-1">{tr('جرّب البحث باسم صفحة مثل «الخزانات» أو رمز خزان مثل «TK-SH-01»')}</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.008]'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs sm:text-sm font-black truncate ${
                          isSelected ? 'text-white' : 'text-slate-900 dark:text-white'
                        }`}>
                          {tr(item.title)}
                        </span>
                        {item.badge && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-white/20 text-white border border-white/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}>
                            {tr(item.badge)}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className={`text-[11px] truncate mt-0.5 ${
                          isSelected ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {tr(item.subtitle)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pr-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      isSelected
                        ? 'bg-white/10 text-white'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500'
                    }`}>
                      {tr(item.category)}
                    </span>
                    {isSelected && (
                      <ArrowRight className={`w-4 h-4 text-white animate-pulse ${!isRTL ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px] font-mono shadow-2xs">↑↓</kbd> {tr('للتنقل')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px] font-mono shadow-2xs">Enter</kbd> {tr('للاختيار')}
            </span>
          </div>
          <div className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SCADA 2026</span>
          </div>
        </div>


      </div>
    </div>
  );
};
