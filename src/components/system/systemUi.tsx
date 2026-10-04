import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

/** أسماء عربية للجداول في لوحة النظام */
export const TABLE_LABELS: Record<string, string> = {
  app_state: 'بيانات الأقسام والإعدادات',
  collection_items: 'سجلات الواردات والإشعارات',
  chat_users: 'الحسابات',
  chat_sessions: 'جلسات الدخول',
  chat_messages: 'رسائل المحادثة',
  chat_rooms: 'غرف المحادثة',
  chat_members: 'أعضاء الغرف',
  chat_seen: 'إيصالات القراءة',
  chat_files: 'مرفقات المحادثة',
  sahara_files: 'مرفقات رصيد الصحاري',
  audit_log: 'سجل العمليات',
  backups: 'سجل النسخ الاحتياطية',
  system_jobs: 'سجل المهام',
  system_meta: 'إعدادات النظام',
  support_requests: 'طلبات الدعم',
  webauthn_credentials: 'بصمات الدخول',
  webauthn_challenges: 'تحديات البصمة المؤقتة',
  sahara_file_chunks: 'أجزاء ملفات قديمة',
  chat_file_chunks: 'أجزاء مرفقات قديمة',
  v_sahara_inbound_deliveries: 'عرض: واردات الصحاري',
  v_etihad_inbound_deliveries: 'عرض: واردات الاتحاد',
  v_notifications: 'عرض: الإشعارات',
};
export const PREFIX_LABELS: Record<string, string> = {
  sahara: 'مرفقات الصحاري',
  chat: 'مرفقات المحادثة',
  daily: 'نسخ يومية',
  manual: 'نسخ يدوية',
  'pre-restore': 'قبل الاسترجاع',
  monthly: 'أرشيف شهري',
  migrations: 'نسخ الترحيل',
};
export const KIND_META: Record<string, { label: string; tone: string }> = {
  daily: { label: 'يومية', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  manual: { label: 'يدوية', tone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  'pre-restore': { label: 'قبل الاسترجاع', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  monthly: { label: 'أرشيف شهري', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
};
export const JOB_LABELS: Record<string, string> = {
  'daily-backup': 'النسخة اليومية',
  'monthly-maintenance': 'الصيانة الشهرية',
};

/** حالة بنص وأيقونة (لا تعتمد على اللون وحده) */
export const StatusPill: React.FC<{ status: 'ok' | 'warn' | 'error' | 'running'; label: string }> = ({ status, label }) => {
  const map = {
    ok: { icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    warn: { icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    error: { icon: XCircle, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
    running: { icon: Loader2, cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  }[status];
  const Icon = map.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${map.cls}`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'running' ? 'animate-spin' : ''}`} />{label}
    </span>
  );
};

/**
 * قائمة أشرطة أفقية لسلسلة واحدة (لون واحد، القيمة نصًا بجانب كل شريط، وتلميح عند المرور).
 * الشريط الرفيع بطرف دائري، والمسار خلفه باهت حتى لا ينافس البيانات.
 */
export const BarList: React.FC<{ items: { label: string; sub?: string; value: number; display: string }[]; empty?: string }> = ({ items, empty = '—' }) => {
  const max = Math.max(1, ...items.map(i => i.value));
  if (!items.length) return <p className="text-sm text-slate-400 py-4 text-center">{empty}</p>;
  return (
    <ul className="space-y-2.5" role="list">
      {items.map(i => (
        <li key={i.label} title={`${i.label}: ${i.display}`} className="group">
          <div className="flex items-baseline justify-between gap-3 text-xs mb-1">
            <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{i.label}{i.sub && <span className="font-normal text-slate-400 mr-1.5" dir="ltr">{i.sub}</span>}</span>
            <span className="tabular-nums font-bold text-slate-900 dark:text-white shrink-0">{i.display}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400 group-hover:bg-blue-700 dark:group-hover:bg-blue-300 transition-all duration-500"
              style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
};

/** نافذة تأكيد بسيطة فوق الصفحة */
export const Dialog: React.FC<{ title: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; tone?: 'danger' | 'default' }> = ({ title, icon, onClose, children, footer, tone = 'default' }) => (
  <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
    <button aria-label="إغلاق" className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col">
      <div className={`flex items-center gap-3 px-5 py-4 border-b ${tone === 'danger' ? 'border-rose-100 dark:border-rose-900/40' : 'border-slate-100 dark:border-slate-800'}`}>
        {icon}
        <h3 className="font-black text-base text-slate-900 dark:text-white flex-1">{title}</h3>
      </div>
      <div className="p-5 overflow-y-auto">{children}</div>
      {footer && <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">{footer}</div>}
    </div>
  </div>
);
