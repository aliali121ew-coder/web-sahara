import React, { useEffect, useSyncExternalStore } from 'react';
import { PERMS_CHANGED_EVENT } from '../../lib/cloudSync';
import { refreshProfile } from '../../lib/session';

export const PERMS_SECONDS = 5;

// العدّ التنازلي مشترك: PermsPulse يديره، والخط حول صورة الحساب في الشريط العلوي يقرؤه
let left: number | null = null;
const listeners = new Set<() => void>();
const setLeft = (v: number | null) => { left = v; listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** الثواني المتبقية قبل تحديث الصفحة بعد تغيير الصلاحيات (null = لا تغيير) */
export const usePermsCountdown = () => useSyncExternalStore(subscribe, () => left, () => null);

/**
 * عند تغيير مدير النظام صلاحيات هذا الحساب: خط يلتف حول صورة الحساب خلال 5 ثوانٍ (Header)،
 * ثم تُجلب الصلاحيات الجديدة وتُحدَّث الصفحة دون تسجيل خروج.
 */
export const PermsPulse: React.FC = () => {
  const n = usePermsCountdown();

  useEffect(() => {
    const start = () => { if (left === null) setLeft(PERMS_SECONDS); };
    window.addEventListener(PERMS_CHANGED_EVENT, start);
    return () => window.removeEventListener(PERMS_CHANGED_EVENT, start);
  }, []);

  useEffect(() => {
    if (n === null) return;
    if (n <= 0) {
      // الصلاحيات المحفوظة على الجهاز تُحدَّث قبل إعادة التحميل فتظهر الصفحة الجديدة مباشرة
      void refreshProfile().catch(() => null).finally(() => window.location.reload());
      return;
    }
    const id = setTimeout(() => setLeft(n - 1), 1000);
    return () => clearTimeout(id);
  }, [n]);

  return null;
};

/** خط احترافي يلتف حول صورة الحساب ويكتمل خلال مدة العدّ (يُرسم فوق الزر) */
export const PermsRing: React.FC<{ label: string }> = ({ label }) => (
  <span className="pointer-events-none absolute -inset-[3px]" role="status" aria-live="polite" aria-label={label} title={label}>
    <svg viewBox="0 0 52 52" className="w-full h-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="perms-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="49" height="49" rx="14" fill="none" stroke="#10b981" strokeOpacity="0.18" strokeWidth="2.5" />
      <rect x="1.5" y="1.5" width="49" height="49" rx="14" fill="none" stroke="url(#perms-ring)" strokeWidth="2.5" strokeLinecap="round"
        pathLength={100} strokeDasharray="100" style={{ animation: `perms-ring ${PERMS_SECONDS}s linear forwards`, filter: 'drop-shadow(0 0 3px rgba(16,185,129,.55))' }} />
    </svg>
    <style>{'@keyframes perms-ring{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}'}</style>
  </span>
);
