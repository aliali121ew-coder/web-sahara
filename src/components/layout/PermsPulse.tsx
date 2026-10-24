import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PERMS_CHANGED_EVENT } from '../../lib/cloudSync';
import { refreshProfile } from '../../lib/session';

const SECONDS = 5;
// نبضة واحدة كل 40 وحدة؛ المسار نبضتان ويتحرك بمقدار نبضة فيبدو كشاشة مراقبة متصلة
const BEAT = 'h12 l3 -3 l3 3 h2 l2 -8 l3 14 l2 -6 h3 l2 -2 l2 2 h6';
const ECG = `M0 10 ${BEAT} ${BEAT} ${BEAT}`;

/**
 * عند تغيير مدير النظام صلاحيات هذا الحساب: شارة صغيرة بحجم زر «تحديث» أعلى الشاشة فيها نبض قلب هادئ
 * وعدّ تنازلي 5 ثوانٍ، ثم تُجلب الصلاحيات الجديدة وتُحدَّث الصفحة دون تسجيل خروج.
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
  const label = left > 0 ? t('profile.permsUpdated', { n: left }) : t('profile.permsReloading');
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[90] pointer-events-none print:hidden" role="status" aria-live="polite" aria-label={label} title={label}>
      <div className="relative inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl text-white bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-md shadow-emerald-500/25">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <svg viewBox="0 0 40 20" className="w-14 h-5 overflow-hidden" aria-hidden="true">
          <g style={{ animation: 'perms-ecg 1.6s linear infinite' }}>
            <path d={ECG} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        </svg>
        <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-white/25 text-[11.5px] font-black font-mono tabular-nums leading-[22px] text-center">{Math.max(left, 0)}</span>
      </div>
      <style>{'@keyframes perms-ecg{from{transform:translateX(0)}to{transform:translateX(-40px)}}'}</style>
    </div>
  );
};
