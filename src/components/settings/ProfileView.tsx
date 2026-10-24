import React from 'react';
import { UserCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { ProfileInfoCard, PasswordCard } from './ProfileCards';
import { AppearanceAndNavigationSection, ThemeModeCard } from './SettingsView';

/** الملف الشخصي (لكل حساب): معلوماتي، تغيير كلمة المرور، المظهر والإضاءة */
export const ProfileView: React.FC = () => {
  const { t } = useTranslation('settings');
  const { canCustomize } = useTheme();
  return (
    <div className="space-y-5 mx-auto w-full max-w-4xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <UserCircle className="w-6 h-6 text-blue-600" />
          <span>{t('profile.title')}</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">{t('profile.subtitle')}</p>
      </div>
      <ProfileInfoCard />
      <PasswordCard />
      {/* المظهر الكامل لمن يملك «ضبط المظهر» أو «الإعدادات»، والإضاءة وحدها للباقين */}
      {canCustomize ? <AppearanceAndNavigationSection /> : <ThemeModeCard />}
    </div>
  );
};
