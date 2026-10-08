import React, { useEffect, useState } from 'react';
import { FlaskConical, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDemoMode, remainingText } from '../../lib/demo';
import { refreshProfile, useSessionProfile } from '../../lib/session';

/**
 * شريط النسخة التجريبية أعلى البرنامج: البيانات وهمية وتُعاد كل ليلة، والوقت المتبقي لحساب التجربة.
 * عند انتهاء المدة يُعاد تحميل البرنامج فيرفض الخادم الجلسة ويعود لشاشة الدخول.
 */
export const DemoBanner: React.FC = () => {
  const { t } = useTranslation('common');
  const demo = useDemoMode();
  const profile = useSessionProfile();
  const expiresAt = profile?.expires_at || 0;
  const [, tick] = useState(0);

  // بيانات الحساب المحفوظة قد تسبق تمديد المدير: تُحدَّث مرة عند الفتح
  useEffect(() => { if (demo) void refreshProfile(); }, [demo]);

  useEffect(() => {
    if (!demo || !expiresAt) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= expiresAt) location.reload();
      else tick(n => n + 1);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [demo, expiresAt]);

  if (!demo) return null;
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-3 py-1.5 bg-gradient-to-l from-violet-600 to-indigo-600 text-white text-[11px] sm:text-xs font-bold">
      <span className="flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5 shrink-0" />{t('demo.banner')}</span>
      {!!expiresAt && (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
          <Timer className="w-3 h-3 shrink-0" />{t('demo.endsIn', { time: remainingText(expiresAt) })}
        </span>
      )}
    </div>
  );
};

/** شارة صغيرة على شاشة الدخول: حتى يعرف الزائر أنه في النسخة التجريبية */
export const DemoLoginBadge: React.FC = () => {
  const { t } = useTranslation('common');
  const demo = useDemoMode();
  if (!demo) return null;
  return (
    <div className="fixed top-2 inset-x-0 z-[60] flex justify-center pointer-events-none">
      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-600 text-white text-[11px] font-bold shadow-lg shadow-violet-600/30">
        <FlaskConical className="w-3.5 h-3.5" />{t('demo.loginBadge')}
      </span>
    </div>
  );
};
