import React, { useRef, useState } from 'react';
import { Loader2, Check, Copy, CheckCircle2, Camera, Trash2, ImagePlus } from 'lucide-react';
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

export const UserAvatar: React.FC<{ name: string; color?: string; src?: string; size?: number; className?: string }> = ({ name, color, src, size = 42, className = '' }) => (
  src ? (
    <img src={src} alt={name} width={size} height={size} className={`rounded-2xl object-cover shrink-0 shadow-sm bg-slate-100 dark:bg-slate-800 ${className}`} style={{ width: size, height: size }} />
  ) : (
    <div className={`rounded-2xl flex items-center justify-center text-white font-black shrink-0 shadow-sm ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36, background: color || 'linear-gradient(135deg,#6366f1,#3b82f6)' }}>
      {initials(name)}
    </div>
  )
);

const AVATAR_PX = 256;
/** قص الصورة مربعًا من المنتصف وتصغيرها إلى 256×256 (WebP أو JPEG) حتى تبقى خفيفة (~20–40KB) */
export const resizeAvatar = (file: File): Promise<string> => new Promise((resolve, reject) => {
  if (!/^image\/(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(file.type)) return reject(new Error('اختر صورة (PNG أو JPEG أو WebP)'));
  if (file.size > 15 * 1024 * 1024) return reject(new Error('حجم الصورة أكبر من 15MB'));
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = AVATAR_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('تعذّر معالجة الصورة'));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
    const webp = canvas.toDataURL('image/webp', 0.85);
    resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذّر قراءة الصورة')); };
  img.src = url;
});

/** اختيار صورة شخصية: ضغط أو سحب وإفلات، مع معاينة وإزالة */
export const AvatarPicker: React.FC<{ value: string; name: string; onChange: (v: string) => void; size?: number }> = ({ value, name, onChange, size = 88 }) => {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pick = async (file?: File) => {
    if (!file) return;
    setError('');
    setBusy(true);
    try { onChange(await resizeAvatar(file)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} aria-label="اختيار صورة شخصية"
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
        className={`group relative rounded-3xl shrink-0 transition ${drag ? 'ring-4 ring-blue-500/40 scale-105' : ''}`} style={{ width: size, height: size }}>
        {value ? <UserAvatar name={name || '؟'} src={value} size={size} className="!rounded-3xl" /> : (
          <span className="w-full h-full rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 flex flex-col items-center justify-center gap-1 text-slate-400 group-hover:border-blue-400 group-hover:text-blue-500 transition">
            <ImagePlus className="w-6 h-6" />
            <span className="text-[10px] font-bold">صورة</span>
          </span>
        )}
        <span className="absolute -bottom-1 -left-1 w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-slate-900">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
        </span>
      </button>
      <div className="min-w-0 space-y-1.5">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">الصورة الشخصية <span className="font-normal text-slate-400">(اختياري)</span></div>
        <p className="text-[11px] text-slate-400 leading-relaxed">اضغط أو اسحب صورة هنا. تُقص مربعًا وتُصغَّر تلقائيًا.</p>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => input.current?.click()} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200">
            {value ? 'تغيير' : 'رفع صورة'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange('')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
              <Trash2 className="w-3.5 h-3.5" /> إزالة
            </button>
          )}
        </div>
        {error && <p className="text-[11px] font-bold text-rose-500">{error}</p>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
};

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
