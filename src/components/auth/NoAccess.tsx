import React from 'react';
import { ShieldOff } from 'lucide-react';
import { logout } from '../../lib/session';

/** تُعرض عند فتح صفحة لا يملك الحساب صلاحية عليها، أو حساب لم تُحدَّد له أي صلاحية بعد */
export const NoAccess: React.FC<{ hasAny: boolean }> = ({ hasAny }) => (
  <div className="flex-1 flex items-center justify-center p-6">
    <div className="max-w-md w-full text-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
      <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
        <ShieldOff className="w-7 h-7 text-rose-500" />
      </div>
      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2">لا تملك صلاحية لهذه الصفحة</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
        {hasAny
          ? 'هذه الصفحة غير متاحة لحسابك. اختر صفحة أخرى من القائمة، أو راجع مدير النظام لطلب الصلاحية.'
          : 'لم يحدد مدير النظام أي صلاحيات لحسابك بعد. تواصل معه لتفعيل الأقسام المطلوبة.'}
      </p>
      {!hasAny && (
        <button onClick={() => logout()} className="mt-5 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold">
          تسجيل الخروج
        </button>
      )}
    </div>
  </div>
);
