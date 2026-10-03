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
  CheckCircle2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useFuelData } from '../../context/FuelDataContext';
import { SidebarStyle } from '../../types';
import { UsersAdmin } from '../admin/UsersAdmin';
import { usePermissions } from '../../lib/usePermission';

export const SettingsView: React.FC = () => {
  const { isAdmin } = usePermissions();
  const { themeMode, setThemeMode, sidebarStyle, setSidebarStyle } = useTheme();
  const { refreshAllData } = useFuelData();

  const [supabaseUrl, setSupabaseUrl] = useState(
    () => localStorage.getItem('sahara_supabase_url') || ''
  );
  const [supabaseKey, setSupabaseKey] = useState(
    () => localStorage.getItem('sahara_supabase_anon_key') || ''
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('sahara_supabase_url', supabaseUrl);
    localStorage.setItem('sahara_supabase_anon_key', supabaseKey);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-600" />
          <span>إعدادات وتخصيص المنظومة</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          تخصيص المظهر والهوية البصرية، إعدادات الشريط الجانبي والربط السحابي
        </p>
      </div>

      {/* إدارة المستخدمين والصلاحيات: لمدير النظام فقط */}
      {isAdmin && <UsersAdmin />}

      {/* Theme Customizer Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-soft-card space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Palette className="w-5 h-5 text-blue-600" />
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            1. نمط العرض والإضاءة (Theme Mode)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setThemeMode('light')}
            className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-right ${
              themeMode === 'light'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">الوضع الفاتح (Soft Light)</div>
              <div className="text-xs text-slate-500 mt-0.5">خلفيات ناصعة وألوان مريحة للعين نهاراً</div>
            </div>
          </button>

          <button
            onClick={() => setThemeMode('dark')}
            className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all text-right ${
              themeMode === 'dark'
                ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-blue-400 flex items-center justify-center shrink-0">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">الوضع الليلي (Dark Navy)</div>
              <div className="text-xs text-slate-500 mt-0.5">خلفيات كحلية داكنة موفرة للطاقة ومريحة ليلاً</div>
            </div>
          </button>
        </div>

        {/* Sidebar Style Customizer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <Layout className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              3. ألوان وتصميم شريط التنقل (Theme Style)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                id: 'unified' as SidebarStyle,
                title: 'المتطابق التلقائي (Unified Auto)',
                desc: 'يتطابق تلقائياً مع لون الصفحة (نهاري/ليلي)',
                bg: 'bg-gradient-to-r from-slate-100 via-slate-500 to-slate-900 text-white shadow-xs',
              },
              {
                id: 'navy' as SidebarStyle,
                title: 'الكحلي الفاخر (Dark Navy)',
                desc: 'النمط الافتراضي لقطاع الطاقة',
                bg: 'bg-[#0B132B] text-white',
              },
              {
                id: 'light' as SidebarStyle,
                title: 'الأبيض الهادئ (Clean Light)',
                desc: 'خلفية بيضاء نقية مستقلة',
                bg: 'bg-white text-slate-900 border border-slate-200',
              },
              {
                id: 'gradient' as SidebarStyle,
                title: 'التدرج الملكي (Royal Gradient)',
                desc: 'تدرج ملكي من الأزرق إلى النيلي',
                bg: 'bg-gradient-to-br from-blue-900 to-indigo-950 text-white',
              },
            ].map((style) => (
              <button
                key={style.id}
                onClick={() => setSidebarStyle(style.id)}
                className={`p-4 rounded-2xl border-2 flex flex-col justify-between text-right transition-all ${
                  sidebarStyle === style.id
                    ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className={`w-full h-12 rounded-xl mb-3 ${style.bg} flex items-center justify-center font-bold text-xs shadow-inner`}>
                  معاينة المظهر
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{style.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{style.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>


      {/* Cloud & Supabase Integration */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-soft-card space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Database className="w-5 h-5 text-emerald-600" />
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
            3. إعدادات التكامل السحابي وقاعدة البيانات (Supabase Integration)
          </h3>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          تعمل المنظومة فورياً دون أي تأخير مع نظام التخزين المحلي التلقائي. يمكنك ربطها مع مشروع Supabase حقيقي عبر إدخال المفاتيح التالية:
        </p>

        <form onSubmit={handleSaveCredentials} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              رابط مشروع Supabase URL
            </label>
            <input
              type="text"
              placeholder="https://your-project.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              مفتاح الوصول العام Supabase Anon Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>حفظ الإعدادات</span>
            </button>

            {savedSuccess && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم الحفظ والتطبيق بنجاح</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* System Reset & Data Management (لمدير النظام فقط) */}
      {isAdmin && <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-soft-card flex items-center justify-between">
        <div>
          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">إعادة ضبط المصنع للبيانات</h4>
          <p className="text-xs text-slate-500 mt-0.5">استعادة البيانات الافتراضية الأولية ومسح الذاكرة المؤقتة</p>
        </div>

        <button
          onClick={handleResetDefaults}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 text-xs font-bold transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>إعادة ضبط البيانات</span>
        </button>
      </div>}
    </div>
  );
};
