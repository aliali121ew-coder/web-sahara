import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  CheckCircle2,
  AlertTriangle,
  Info,
  User,
  ShieldCheck,
  LogOut,
  Globe,
  Check
} from 'lucide-react';
import { initials, logout, useSessionProfile } from '../../lib/session';
import { useTheme } from '../../context/ThemeContext';
import { useFuelData } from '../../context/FuelDataContext';
import { useLanguage, LANGUAGES } from '../../context/LanguageContext';

interface HeaderProps {
  onOpenQuickAction?: () => void;
  onToggleSidebar?: () => void;
  onOpenCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onToggleSidebar,
  onOpenCommandPalette 
}) => {
  const { themeMode, toggleThemeMode } = useTheme();
  const { currentLanguage, currentLangInfo, setLanguage, t, tr } = useLanguage();
  const profile = useSessionProfile();
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead
  } = useFuelData();

  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [showLangMenu, setShowLangMenu] = useState<boolean>(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  // Close popups on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-200 px-4 lg:px-8 py-2">
      <div className="flex items-center justify-between gap-3">
        
        {/* Toggle Sidebar Button & Search Bar */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              title={tr('فتح / طي القائمة الجانبية')}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 transition-colors shrink-0 md:hidden"
            >
              <Menu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </button>
          )}

          {/* Search Trigger (Command Palette) */}
          <div className="flex-1 relative">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="w-full pl-3 pr-10 py-2 text-sm bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl border border-transparent hover:border-blue-500/40 outline-none transition-all flex items-center justify-between group text-right cursor-pointer"
            >
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors" />
              <span className="truncate text-xs sm:text-sm">{t('searchPlaceholder')}</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[10.5px] font-mono font-bold shadow-2xs">
                {t('ctrlK')}
              </kbd>
            </button>
          </div>
        </div>

        {/* Center/Left Info & Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          
          {/* 🌐 Multi-Language Switcher (EN/AR & Other Languages) */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              title={`${t('selectLanguage')} / Change Language`}
              aria-label={`${t('selectLanguage')}: ${currentLanguage.toUpperCase()}`}
              aria-haspopup="menu"
              aria-expanded={showLangMenu}
              dir="ltr"
              className="inline-flex items-center justify-center gap-1.5 h-9 min-w-[3.25rem] px-2.5 rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 transition-all active:scale-95 whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
              <span className="font-black font-mono uppercase tracking-wide text-[12px] leading-none">
                {currentLanguage}
              </span>
            </button>

            {/* Language Selection Dropdown Menu */}
            {showLangMenu && (
              <div className="absolute left-0 sm:right-auto mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>{t('selectLanguage')}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">{t('languagesCount')}</span>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/50 py-1 no-scrollbar">
                  {LANGUAGES.map((lang) => {
                    const isSelected = currentLanguage === lang.code;

                    return (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLangMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 hover:text-slate-950 dark:hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{lang.flag}</span>
                          <div className={currentLangInfo.dir === 'rtl' ? 'text-right' : 'text-left'}>
                            <div className="leading-tight">{lang.nativeName}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{lang.name}</div>
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Theme Switcher */}
          <button
            onClick={toggleThemeMode}
            title={themeMode === 'light' ? t('darkMode') : t('lightMode')}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 active:scale-95 transition-all"
          >
            {themeMode === 'light' ? (
              <Moon className="w-4 h-4 text-slate-700" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 relative transition-all"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{t('notifications')}</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-md">
                        {unreadCount} {t('newNotifications')}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllNotificationsRead}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      {t('markAllRead')}
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto mt-2">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      {t('noNotifications')}
                    </div>
                  ) : (

                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => markNotificationRead(notif.id)}
                        className={`p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer flex gap-3 ${
                          !notif.read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {notif.type === 'alert' ? (
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                          ) : notif.type === 'warning' ? (
                            <Info className="w-4 h-4 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {tr(notif.title)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{notif.timestamp}</span>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {tr(notif.message)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar / Menu */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 transition-all"
            >
              <div className="w-7 h-7 rounded-lg text-white font-black text-[11px] flex items-center justify-center shadow-xs overflow-hidden" style={{ background: profile?.color || '#4f46e5' }}>
                {profile?.avatar ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" /> : initials(profile?.name)}
              </div>
              <div className="hidden lg:block text-right">
                <div className="text-xs font-bold text-slate-900 dark:text-white leading-none">
                  {profile?.name || '...'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-1">
                  {profile?.role || (profile?.is_admin ? tr('مدير النظام') : '')}
                </div>
              </div>
            </button>

            {showProfileMenu && (
              <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="font-bold text-xs text-slate-900 dark:text-white">{profile?.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5" dir="ltr">@{profile?.username}</div>
                  {!!profile?.is_admin && (
                    <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 text-[10px] font-bold">
                      <ShieldCheck className="w-3 h-3" />
                      <span>{tr('صلاحيات إدارية كاملة')}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setShowProfileMenu(false)}
                    className="w-full text-right px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('profile')}</span>
                  </button>
                  <button
                    onClick={() => logout()}
                    className="w-full text-right px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{tr('تسجيل الخروج')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
