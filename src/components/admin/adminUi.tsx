import React, { useState } from 'react';
import { Loader2, Check, Copy, CheckCircle2 } from 'lucide-react';
import { initials } from '../../lib/session';

/** أدوات وأنماط مشتركة لصفحات إدارة المستخدمين */

export const inputCls = 'w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition';
export const btnCls = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';
export const cardCls = 'rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card';
export const chipCls = 'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full';

/** كلمة مرور عشوائية سهلة الإملاء (بدون أحرف ملتبسة مثل 0/O و 1/l) */
export const genPassword = (len = 12) => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(b, x => chars[x % chars.length]).join('');
};

/** قوة كلمة المرور: 0 ضعيفة جدًا .. 4 قوية جدًا */
export const passwordScore = (p: string) => {
  if (p.length < 8) return 0;
  let s = 1;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^a-zA-Z0-9]/.test(p) || (/\d/.test(p) && p.length >= 14)) s++;
  return Math.min(4, s);
};
export const SCORE_LABEL = ['قصيرة جدًا', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية'];
export const SCORE_TONE = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500'];

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('ar', { numeric: 'auto' }) : null;
/** وقت نسبي بالعربية: «قبل 5 دقائق» */
export const timeAgo = (ts: number) => {
  const diff = (ts - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (!rtf) return new Date(ts).toLocaleString('ar-IQ');
  if (abs < 45) return 'الآن';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(ts).toLocaleDateString('ar-IQ');
};
export const fullDate = (ts: number) => new Date(ts).toLocaleString('ar-IQ', { dateStyle: 'full', timeStyle: 'medium' });
export const clock = (ts: number) => new Date(ts).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

export const UserAvatar: React.FC<{ name: string; color?: string; size?: number; className?: string }> = ({ name, color, size = 42, className = '' }) => (
  <div className={`rounded-2xl flex items-center justify-center text-white font-black shrink-0 shadow-sm ${className}`}
    style={{ width: size, height: size, fontSize: size * 0.36, background: color || 'linear-gradient(135deg,#6366f1,#3b82f6)' }}>
    {initials(name)}
  </div>
);

export const Empty: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; hint?: string }> = ({ icon: Icon, title, hint }) => (
  <div className="py-14 text-center">
    <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
      <Icon className="w-7 h-7 text-slate-400" />
    </div>
    <p className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{title}</p>
    {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
  </div>
);

export const Spinner = () => <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

/** هياكل تحميل بدل الدوّار في القوائم */
export const Skeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-2" aria-busy="true">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 animate-pulse">
        <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-2.5 w-2/3 rounded bg-slate-100 dark:bg-slate-800/70" />
        </div>
      </div>
    ))}
  </div>
);

/** بطاقة رقم مختصرة */
export const KpiCard: React.FC<{ label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; tone: string; sub?: string; onClick?: () => void; active?: boolean }> = ({ label, value, icon: Icon, tone, sub, onClick, active }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick}
      className={`text-right rounded-2xl border px-3.5 py-3 flex items-center gap-3 transition ${active ? 'border-blue-400 ring-4 ring-blue-500/10 bg-blue-50/50 dark:bg-blue-950/30' : 'border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900'} ${onClick ? 'hover:border-blue-300 dark:hover:border-blue-800' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-5 h-5" /></div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-slate-500 truncate">{label}</div>
        <div className="text-xl font-black tabular-nums text-slate-900 dark:text-white leading-tight">{value}</div>
        {sub && <div className="text-[10px] text-slate-400 truncate">{sub}</div>}
      </div>
    </Tag>
  );
};

/** زر نسخ صغير مع تأكيد بصري */
export const CopyButton: React.FC<{ text: string; label?: string; className?: string }> = ({ text, label, className = '' }) => {
  const [done, setDone] = useState(false);
  return (
    <button type="button" title={label || 'نسخ'} aria-label={label || 'نسخ'}
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* تجاهل */ } }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl transition ${className}`}>
      {done ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
      {label && <span>{done ? 'تم النسخ' : label}</span>}
    </button>
  );
};

/** بيانات الدخول بعد الإصدار (تظهر مرة واحدة) */
export const Issued: React.FC<{ name: string; username: string; password: string; onBack: () => void; backLabel?: string; extra?: React.ReactNode }> = ({ name, username, password, onBack, backLabel = 'تم', extra }) => (
  <div className="space-y-5 max-w-md mx-auto text-center py-2">
    <div className="relative mx-auto w-16 h-16">
      <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
      <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
        <CheckCircle2 className="w-8 h-8" />
      </div>
    </div>
    <div>
      <h4 className="font-black text-lg text-slate-900 dark:text-white">تم إصدار بيانات الدخول</h4>
      <p className="text-sm text-slate-500 mt-1">سلّمها للموظف الآن. لن تظهر كلمة المرور مرة أخرى، ويستطيع تغييرها من «حسابي».</p>
    </div>
    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 divide-y divide-slate-200 dark:divide-slate-700 text-sm text-right">
      {[['الاسم', name, false], ['اسم المستخدم', username, true], ['كلمة المرور', password, true]].map(([k, v, mono]) => (
        <div key={k as string} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-slate-500">{k}</span>
          <span className="flex items-center gap-2">
            <b dir={mono ? 'ltr' : undefined} className={mono ? 'font-mono tracking-wide' : ''}>{v}</b>
            {mono && <CopyButton text={v as string} className="w-7 h-7 text-slate-400 hover:text-slate-700 dark:hover:text-white" />}
          </span>
        </div>
      ))}
    </div>
    <CopyButton text={`الاسم: ${name}\nاسم المستخدم: ${username}\nكلمة المرور: ${password}`} label="نسخ كل البيانات"
      className={`${btnCls} w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`} />
    <div className="flex gap-2">
      {extra}
      <button className={`${btnCls} flex-1 bg-blue-600 hover:bg-blue-700 text-white`} onClick={onBack}>{backLabel}</button>
    </div>
  </div>
);
