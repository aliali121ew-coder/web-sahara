import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PERMS_CHANGED_EVENT } from '../../lib/cloudSync';
import { refreshProfile } from '../../lib/session';

const SECONDS = 5;
// ثلاث نبضات على عرض الشاشة (المسار يُمدّ أفقيًا)
const ECG = 'M0 8 H110 L120 8 L126 4 L132 8 L140 8 L146 1 L154 15 L160 8 L172 8 L178 6 L186 8 H330 L340 8 L346 4 L352 8 L360 8 L366 1 L374 15 L380 8 L392 8 L398 6 L406 8 H550 L560 8 L566 4 L572 8 L580 8 L586 1 L594 15 L600 8 L612 8 L618 6 L626 8 H700';

/**
 * عند تغيير مدير النظام صلاحيات هذا الحساب: خط نبض صغير أعلى الشاشة 5 ثوانٍ مع عدّ تنازلي،
 * ثم تُجلب الصلاحيات الجديدة وتُحدَّث الصفحة دون تسجيل خروج.
 */
export const PermsPulse: React.FC = () => {
  const { t } = useTranslation('nav');
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const start = () => setLeft(l => (l === null ? SECONDS : l));
    window.addEventListener(PERMS_CHANGED_EVENT, start);
    return () => window.removeEventListener(PERMS_CHANGED_EVENT, start);
  }, []);

  useEffect(() => {
    if (left === null) return;
    if (left <= 0) {
      // الصلاحيات المحفوظة على الجهاز تُحدَّث قبل إعادة التحميل فتظهر الصفحة الجديدة مباشرة
      void refreshProfile().catch(() => null).finally(() => window.location.reload());
      return;
    }
    const id = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  if (left === null) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[90] pointer-events-none print:hidden" role="status" aria-live="polite">
      <svg viewBox="0 0 700 16" preserveAspectRatio="none" className="block w-full h-4" aria-hidden="true">
        <path d="M0 8 H700" className="stroke-emerald-500/20" strokeWidth="1" fill="none" />
        <path d={ECG} fill="none" className="stroke-emerald-500" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"
          style={{ strokeDasharray: '60 1400', animation: 'perms-ecg 1.6s linear infinite' }} />
      </svg>
      <div className="h-0.5 bg-emerald-500 origin-right rtl:origin-right ltr:origin-left" style={{ animation: `perms-fill ${SECONDS}s linear forwards` }} />
      <div className="flex justify-center mt-1">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 dark:bg-slate-900/95 ring-1 ring-emerald-200 dark:ring-emerald-900 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 shadow-sm">
          <ShieldCheck className="w-3 h-3" />
          {left > 0 ? t('profile.permsUpdated', { n: left }) : t('profile.permsReloading')}
        </span>
      </div>
      <style>{'@keyframes perms-ecg{from{stroke-dashoffset:60}to{stroke-dashoffset:-1400}}@keyframes perms-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}'}</style>
    </div>
  );
};
