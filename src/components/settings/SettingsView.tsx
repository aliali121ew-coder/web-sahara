import React, { useState } from 'react';
import {
  Settings,
  Palette,
  Layout,
  Sun,
  Moon,
  Database,
  Save,
  RotateCcw,
  CheckCircle2,
  Users,
  ChevronLeft,
  ArrowRight,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useFuelData } from '../../context/FuelDataContext';
import { SidebarStyle } from '../../types';
import { UsersAdmin } from '../admin/UsersAdmin';
import { usePermissions } from '../../lib/usePermission';

type SectionId = 'users' | 'appearance' | 'navigation' | 'cloud' | 'data';

interface SectionDef {
  id: SectionId;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  adminOnly?: boolean;
}

const SECTIONS: SectionDef[] = [
  { id: 'users', title: 'إدارة المستخدمين', desc: 'الحسابات والصلاحيات، طلبات الموظفين، وسجل العمليات', icon: Users, gradient: 'from-violet-600 to-indigo-600', adminOnly: true },
  { id: 'appearance', title: 'المظهر والإضاءة', desc: 'الوضع الفاتح أو الليلي حسب راحتك', icon: Palette, gradient: 'from-amber-500 to-orange-600' },
  { id: 'navigation', title: 'شريط التنقل', desc: 'ألوان وتصميم القائمة الجانبية', icon: Layout, gradient: 'from-sky-500 to-blue-600' },
  { id: 'cloud', title: 'التكامل السحابي', desc: 'ربط المنظومة بمشروع Supabase', icon: Database, gradient: 'from-emerald-500 to-teal-600' },
  { id: 'data', title: 'إدارة البيانات', desc: 'إعادة ضبط البيانات والذاكرة المؤقتة', icon: HardDrive, gradient: 'from-rose-500 to-red-600', adminOnly: true },
];

const SECTION_KEY = 'sahara_settings_section';
const readSection = (): SectionId | null => {
  try { return (sessionStorage.getItem(SECTION_KEY) as SectionId) || null; } catch { return null; }
};

const cardCls = 'rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-soft-card';

export const SettingsView: React.FC = () => {
  const { isAdmin } = usePermissions();
  const [section, setSectionState] = useState<SectionId | null>(readSection);
  const setSection = (s: SectionId | null) => {
    setSectionState(s);
    try { if (s) sessionStorage.setItem(SECTION_KEY, s); else sessionStorage.removeItem(SECTION_KEY); } catch { /* تجاهل */ }
    window.scrollTo({ top: 0 });
  };

  const visible = SECTIONS.filter(s => !s.adminOnly || isAdmin);
  const current = visible.find(s => s.id === section) || null;

  return (
    <div className={`space-y-5 mx-auto w-full ${current?.id === 'users' ? 'max-w-6xl' : 'max-w-4xl'}`}>
      {/* الترويسة: عنوان الإعدادات أو مسار القسم المفتوح */}
      {current ? (
        <div className="flex items-center gap-3">
          <button onClick={() => setSection(null)} aria-label="رجوع للإعدادات"
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm">
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <button onClick={() => setSection(null)} className="hover:text-blue-600">الإعدادات</button>
              <ChevronLeft className="w-3 h-3" />
              <span className="text-slate-500">{current.title}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">{current.title}</h2>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            <span>الإعدادات</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">اختر القسم الذي تريد إدارته</p>
        </div>
      )}

      {!current && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {visible.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
                className="group relative overflow-hidden text-right rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-soft-card hover:shadow-xl hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-900 transition-all duration-200">
                <div aria-hidden className={`absolute -left-10 -top-10 w-32 h-32 rounded-full bg-gradient-to-br ${s.gradient} opacity-[0.08] group-hover:opacity-[0.16] transition-opacity`} />
                <div className="relative flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.gradient} text-white flex items-center justify-center shadow-lg shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">{s.title}</span>
                      {s.adminOnly && <ShieldCheck className="w-3.5 h-3.5 text-amber-500" aria-label="لمدير النظام فقط" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:-translate-x-0.5 transition-all self-center" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {current?.id === 'users' && <UsersAdmin />}
      {current?.id === 'appearance' && <AppearanceSection />}
      {current?.id === 'navigation' && <NavigationSection />}
      {current?.id === 'cloud' && <CloudSection />}
      {current?.id === 'data' && <DataSection />}
    </div>
  );
};

// ───── المظهر والإضاءة ─────
const AppearanceSection: React.FC = () => {
  const { themeMode, setThemeMode } = useTheme();
  const options = [
    { id: 'light' as const, title: 'الوضع الفاتح (Soft Light)', desc: 'خلفيات ناصعة وألوان مريحة للعين نهاراً', icon: Sun, iconCls: 'bg-amber-100 text-amber-600' },
    { id: 'dark' as const, title: 'الوضع الليلي (Dark Navy)', desc: 'خلفيات كحلية داكنة موفرة للطاقة ومريحة ليلاً', icon: Moon, iconCls: 'bg-slate-800 text-blue-400' },
  ];
  return (
    <div className={cardCls}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map(o => {
          const Icon = o.icon;
          const on = themeMode === o.id;
          return (
            <button key={o.id} onClick={() => setThemeMode(o.id)}
              className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-right ${on ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${o.iconCls}`}><Icon className="w-5 h-5" /></div>
              <div className="flex-1">
                <div className="font-bold text-sm text-slate-900 dark:text-white">{o.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{o.desc}</div>
              </div>
              {on && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ───── شريط التنقل ─────
const SIDEBAR_STYLES: { id: SidebarStyle; title: string; desc: string; bg: string }[] = [
  { id: 'unified', title: 'المتطابق التلقائي (Unified Auto)', desc: 'يتطابق تلقائياً مع لون الصفحة (نهاري/ليلي)', bg: 'bg-gradient-to-r from-slate-100 via-slate-500 to-slate-900 text-white shadow-xs' },
  { id: 'navy', title: 'الكحلي الفاخر (Dark Navy)', desc: 'النمط الافتراضي لقطاع الطاقة', bg: 'bg-[#0B132B] text-white' },
  { id: 'light', title: 'الأبيض الهادئ (Clean Light)', desc: 'خلفية بيضاء نقية مستقلة', bg: 'bg-white text-slate-900 border border-slate-200' },
  { id: 'gradient', title: 'التدرج الملكي (Royal Gradient)', desc: 'تدرج ملكي من الأزرق إلى النيلي', bg: 'bg-gradient-to-br from-blue-900 to-indigo-950 text-white' },
];

const NavigationSection: React.FC = () => {
  const { sidebarStyle, setSidebarStyle } = useTheme();
  return (
    <div className={cardCls}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SIDEBAR_STYLES.map(style => (
          <button key={style.id} onClick={() => setSidebarStyle(style.id)}
            className={`p-4 rounded-2xl border-2 flex flex-col justify-between text-right transition-all ${sidebarStyle === style.id
              ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
            <div className={`w-full h-14 rounded-xl mb-3 ${style.bg} flex items-center justify-center font-bold text-xs shadow-inner`}>معاينة المظهر</div>
            <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{style.title}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{style.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ───── التكامل السحابي ─────
const CloudSection: React.FC = () => {
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('sahara_supabase_url') || '');
  const [supabaseKey, setSupabaseKey] = useState(() => localStorage.getItem('sahara_supabase_anon_key') || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('sahara_supabase_url', supabaseUrl);
    localStorage.setItem('sahara_supabase_anon_key', supabaseKey);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const inputCls = 'w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono';
  return (
    <div className={`${cardCls} space-y-4`}>
      <p className="text-xs text-slate-500 leading-relaxed">
        تعمل المنظومة فورياً دون أي تأخير مع نظام التخزين المحلي التلقائي. يمكنك ربطها مع مشروع Supabase حقيقي عبر إدخال المفاتيح التالية:
      </p>
      <form onSubmit={handleSaveCredentials} className="space-y-3">
        <label className="block">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رابط مشروع Supabase URL</span>
          <input type="text" placeholder="https://your-project.supabase.co" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">مفتاح الوصول العام Supabase Anon Key</span>
          <input type="password" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." value={supabaseKey} onChange={e => setSupabaseKey(e.target.value)} className={inputCls} />
        </label>
        <div className="flex items-center justify-between pt-2">
          <button type="submit" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all">
            <Save className="w-4 h-4" />
            <span>حفظ الإعدادات</span>
          </button>
          {savedSuccess && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>تم الحفظ والتطبيق بنجاح</span>
            </span>
          )}
        </div>
      </form>
    </div>
  );
};

// ───── إدارة البيانات (لمدير النظام فقط) ─────
const DataSection: React.FC = () => {
  const { setThemeMode, setSidebarStyle } = useTheme();
  const { refreshAllData } = useFuelData();
  const handleResetDefaults = () => {
    if (window.confirm('هل تريد إعادة تعيين كافة البيانات النموذجية والسمات إلى الحالة الأصلية؟')) {
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
        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">إعادة ضبط المصنع للبيانات</h4>
        <p className="text-xs text-slate-500 mt-0.5">استعادة البيانات الافتراضية الأولية ومسح الذاكرة المؤقتة</p>
      </div>
      <button onClick={handleResetDefaults}
        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 text-xs font-bold transition-colors">
        <RotateCcw className="w-3.5 h-3.5" />
        <span>إعادة ضبط البيانات</span>
      </button>
    </div>
  );
};
