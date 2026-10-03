import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowRight, Fuel, Loader2, User, Phone, MessageSquareText, Send, CheckCircle2, UserPlus, KeyRound, HelpCircle, AlertCircle, Sun, Moon } from 'lucide-react';
import { sendSupportRequest } from '../../lib/session';
import { Onboarding } from './Onboarding';

export type PhoneStep = 'intro' | 'welcome' | 'login' | 'support';
export type SupportKind = 'account' | 'password' | 'other';

/**
 * شكل الهاتف: ثلاث شاشات متتالية بجزء علوي ملوّن ولوحة بيضاء ترتفع من الأسفل.
 * الشرائح التعريفية ← الترحيب ← تسجيل الدخول ← التواصل مع الدعم.
 */
export const PhoneFlow: React.FC<{
  step: PhoneStep;
  setStep: (s: PhoneStep) => void;
  setup: boolean;
  loading: boolean;
  dark: boolean;
  onToggleDark: () => void;
  supportKind: SupportKind;
  setSupportKind: (k: SupportKind) => void;
  username: string;
  form: React.ReactNode;
}> = ({ step, setStep: rawSetStep, setup, loading, dark, onToggleDark, supportKind, setSupportKind, username, form }) => {
  // انتقال سلس بين الشاشات: الرأس الملوّن يتقلص واللوحة البيضاء ترتفع (View Transitions عند توفرها)
  const setStep = (s: PhoneStep) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return rawSetStep(s);
    doc.startViewTransition(() => flushSync(() => rawSetStep(s)));
  };
  return (
  <div dir="rtl" className="auth-phone min-h-[100dvh] flex flex-col">
    {step === 'intro' && <Onboarding onDone={() => setStep('welcome')} />}
    {step === 'welcome' && <Welcome dark={dark} onToggleDark={onToggleDark} onStart={() => setStep('login')} />}

    {step === 'login' && (
      <Shell
        key="login"
        onBack={setup ? undefined : () => setStep('welcome')}
        dark={dark}
        onToggleDark={onToggleDark}
        headline={setup ? <>جهّز النظام<br />وأضف <b>فريقك</b> بأمان.</> : <>سجّل دخولك لمتابعة<br /><b>الأرصدة والخزانات</b><br />والتوريدات.</>}
      >
        <div className="text-center mb-6">
          <h1 className="text-[26px] font-black text-slate-900 dark:text-white">{setup ? 'إنشاء حساب المدير' : 'تسجيل الدخول'}</h1>
          {setup ? (
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">أدخل رمز تفعيل النظام ثم أنشئ حساب المدير.</p>
          ) : (
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              لا تملك حسابًا؟{' '}
              <button type="button" onClick={() => { setSupportKind('account'); setStep('support'); }} className="auth-focus font-bold text-teal-700 dark:text-teal-300 rounded">
                تواصل مع الدعم
              </button>
            </p>
          )}
        </div>
        {loading ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div> : form}
      </Shell>
    )}

    {step === 'support' && (
      <Shell
        key="support"
        onBack={() => setStep('login')}
        dark={dark}
        onToggleDark={onToggleDark}
        headline={<>نحن هنا <b>لمساعدتك</b><br />في الوصول إلى حسابك.</>}
      >
        <SupportForm kind={supportKind} setKind={setSupportKind} username={username} onDone={() => setStep('login')} />
      </Shell>
    )}
  </div>
  );
};

// ───── الإطار المشترك: رأس ملوّن + لوحة بيضاء ─────
const Shell: React.FC<{
  onBack?: () => void;
  dark: boolean;
  onToggleDark: () => void;
  headline: React.ReactNode;
  children: React.ReactNode;
}> = ({ onBack, dark, onToggleDark, headline, children }) => (
  <>
    <div className="auth-phone-top relative overflow-hidden px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-16 text-white" style={{ viewTransitionName: 'auth-top' }}>
      <Swirls />
      <div className="relative flex items-center justify-between">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="رجوع"
            className="auth-focus w-11 h-11 rounded-xl flex items-center justify-center bg-white/10 ring-1 ring-white/20 hover:bg-white/20 transition">
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : <span className="w-11" />}
        <ToggleDark dark={dark} onToggle={onToggleDark} />
      </div>
      <p className="auth-headline relative mt-6 text-[26px] font-black leading-[1.45]">{headline}</p>
    </div>
    <div className="auth-sheet relative -mt-9 flex-1 rounded-t-[32px] bg-white dark:bg-slate-950 px-6 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]" style={{ viewTransitionName: 'auth-sheet' }}>
      <div className="max-w-[420px] mx-auto auth-fade">{children}</div>
    </div>
  </>
);

const ToggleDark: React.FC<{ dark: boolean; onToggle: () => void }> = ({ dark, onToggle }) => (
  <button type="button" onClick={onToggle} aria-label={dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
    className="auth-focus w-11 h-11 rounded-xl flex items-center justify-center bg-white/10 ring-1 ring-white/20 hover:bg-white/20 transition">
    {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
  </button>
);

/** خطوط زخرفية دائرية في الخلفية الملوّنة */
const Swirls = () => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
    <g fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.5">
      <circle cx="340" cy="40" r="70" />
      <circle cx="340" cy="40" r="110" />
      <path d="M-20 230 C 60 170, 140 290, 220 220 S 360 170, 430 240" />
      <circle cx="40" cy="70" r="26" />
    </g>
  </svg>
);

// ═════ 1) الترحيب ═════
const Welcome: React.FC<{ dark: boolean; onToggleDark: () => void; onStart: () => void }> = ({ dark, onToggleDark, onStart }) => (
  <>
    <div className="auth-welcome-top relative overflow-hidden flex-1 min-h-[56dvh] flex flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-14 text-white" style={{ viewTransitionName: 'auth-top' }}>
      <Swirls />
      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur text-[12px] font-bold">
          <span className="auth-live-dot w-2 h-2 rounded-full bg-emerald-300 text-emerald-300" /> منظومة 2026
        </span>
        <ToggleDark dark={dark} onToggle={onToggleDark} />
      </div>
      <div className="relative flex-1 flex items-center justify-center pt-2">
        <WelcomeScene />
      </div>
    </div>

    <div className="auth-sheet relative -mt-10 rounded-t-[36px] bg-white dark:bg-slate-950 px-7 pt-7 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center" style={{ viewTransitionName: 'auth-sheet' }}>
      {/* الشعار */}
      <div className="auth-rise flex flex-col items-center">
        <span className="auth-logo-ring relative w-[72px] h-[72px] rounded-[22px] p-[2px]">
          <span className="w-full h-full rounded-[20px] bg-white flex items-center justify-center overflow-hidden">
            <img src="/logos/sahara.png" alt="شعار صحاري كربلاء" className="w-14 h-14 object-contain" />
          </span>
        </span>
      </div>

      <h1 className="auth-rise d1 mt-5 font-black leading-[1.45] text-slate-900 dark:text-white">
        <span className="block text-[clamp(16px,calc((100vw-56px)/17),22px)]">نظام إدارة الوقود المركزية</span>
        <span className="mt-1.5 text-[26px] flex items-center justify-center gap-2 text-teal-700 dark:text-teal-300">
          <span className="w-9 h-9 rounded-xl bg-teal-50 ring-1 ring-teal-100 dark:bg-teal-500/10 dark:ring-teal-500/20 flex items-center justify-center" aria-hidden>
            <Fuel className="w-5 h-5" />
          </span>
          صحاري كربلاء
        </span>
      </h1>
      <p className="auth-rise d2 mt-2.5 text-[15px] leading-7 text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
        تابع الخزانات والصهاريج والتوريدات لحظة بلحظة، وتواصل مع فريقك بسهولة.
      </p>
      <button type="button" onClick={onStart} autoFocus
        className="auth-rise d3 auth-btn auth-focus mt-6 w-full h-14 rounded-2xl text-white font-bold text-base">
        ابدأ الآن
      </button>
    </div>
  </>
);

/** مشهد الترحيب: محطة وقود ذكية + خزانات + صهريج حديث + بطاقات بيانات عائمة */
const WelcomeScene = () => (
  <div className="relative w-full max-w-[360px]">
    {/* توهج خلف المشهد */}
    <div className="auth-scene-glow absolute inset-x-6 top-10 bottom-6 rounded-full" aria-hidden />

    <svg viewBox="0 0 360 250" className="relative w-full h-auto" role="img" aria-label="محطة وقود ذكية وخزانات وصهريج وقود">
      <defs>
        <linearGradient id="w-tank" x1="0" x2="1">
          <stop offset="0" stopColor="#99f6e4" /><stop offset=".55" stopColor="#ecfeff" /><stop offset="1" stopColor="#5eead4" />
        </linearGradient>
        <linearGradient id="w-fuel" x1="0" x2="1">
          <stop offset="0" stopColor="#0d9488" /><stop offset=".55" stopColor="#2dd4bf" /><stop offset="1" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id="w-trailer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="w-cab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcd34d" /><stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* الأرض والطريق */}
      <ellipse cx="180" cy="226" rx="170" ry="14" fill="rgba(255,255,255,.08)" />
      <path d="M8 214 H352" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
      <path className="auth-road" d="M8 222 H352" stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeDasharray="14 12" />

      {/* الخزانات */}
      <g>
        <rect x="262" y="70" width="38" height="140" rx="12" fill="url(#w-tank)" />
        <rect x="262" y="118" width="38" height="92" rx="12" fill="url(#w-fuel)" opacity=".9" />
        <rect x="262" y="70" width="38" height="140" rx="12" fill="none" stroke="#134e4a" strokeWidth="2.5" />
        <rect x="306" y="96" width="34" height="114" rx="11" fill="url(#w-tank)" />
        <rect x="306" y="150" width="34" height="60" rx="11" fill="url(#w-fuel)" opacity=".9" />
        <rect x="306" y="96" width="34" height="114" rx="11" fill="none" stroke="#134e4a" strokeWidth="2.5" />
        <path d="M262 86 h38 M306 110 h34" stroke="#134e4a" strokeWidth="2" opacity=".4" />
        <rect x="273" y="62" width="16" height="10" rx="3" fill="#134e4a" />
        <rect x="315" y="88" width="16" height="10" rx="3" fill="#134e4a" />
        {/* أنبوب بين الخزانين */}
        <path d="M300 196 h6" stroke="#134e4a" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* المحطة الذكية */}
      <g>
        {/* المظلة */}
        <rect x="24" y="52" width="150" height="16" rx="6" fill="#ecfeff" />
        <rect className="auth-canopy-light" x="30" y="66" width="138" height="3" rx="1.5" fill="#5eead4" />
        <rect x="24" y="52" width="150" height="16" rx="6" fill="none" stroke="#134e4a" strokeWidth="2.5" />
        <rect x="40" y="68" width="8" height="146" fill="#ccfbf1" stroke="#134e4a" strokeWidth="2" />
        <rect x="150" y="68" width="8" height="146" fill="#ccfbf1" stroke="#134e4a" strokeWidth="2" />
        {/* المضخة */}
        <rect x="78" y="118" width="46" height="96" rx="9" fill="#ffffff" stroke="#134e4a" strokeWidth="2.5" />
        <rect x="85" y="126" width="32" height="24" rx="4" fill="#134e4a" />
        <rect className="auth-pump-screen" x="89" y="131" width="24" height="5" rx="2" fill="#5eead4" />
        <rect x="89" y="140" width="15" height="4" rx="2" fill="#2dd4bf" opacity=".6" />
        <rect x="88" y="160" width="26" height="8" rx="3" fill="#ccfbf1" />
        <circle cx="101" cy="186" r="7" fill="#fbbf24" stroke="#134e4a" strokeWidth="2" />
        <path d="M124 150 c 14 0 14 26 2 34" fill="none" stroke="#134e4a" strokeWidth="3" strokeLinecap="round" />
        <rect x="120" y="182" width="8" height="12" rx="2" fill="#134e4a" />
      </g>

      {/* الصهريج الحديث */}
      <g className="auth-truck">
        {/* المقطورة */}
        <rect x="118" y="160" width="132" height="40" rx="20" fill="url(#w-trailer)" stroke="#134e4a" strokeWidth="2.5" />
        <path d="M136 172 h96" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" />
        <path d="M136 184 h60" stroke="#99f6e4" strokeWidth="3" strokeLinecap="round" />
        <rect x="170" y="152" width="22" height="9" rx="3" fill="#134e4a" />
        {/* الكابينة */}
        <path d="M250 168 h22 q8 0 12 7 l12 18 v13 h-46 z" fill="url(#w-cab)" stroke="#134e4a" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M262 174 h11 q4 0 6 4 l7 11 h-24 z" fill="#ecfeff" stroke="#134e4a" strokeWidth="2" strokeLinejoin="round" />
        <rect x="290" y="198" width="8" height="4" rx="2" fill="#fef3c7" />
        {/* العجلات */}
        {[146, 222, 282].map(cx => (
          <g key={cx}>
            <circle cx={cx} cy="208" r="11" fill="#0f172a" />
            <circle cx={cx} cy="208" r="4.5" fill="#cbd5e1" />
          </g>
        ))}
      </g>

      {/* قطرة الوقود */}
      <path className="auth-drop" d="M214 22 c 9 13 14 20 14 27 a14 14 0 0 1 -28 0 c0 -7 5 -14 14 -27z" fill="#fbbf24" stroke="#fff7d6" strokeWidth="2" />
    </svg>

    {/* بطاقات بيانات عائمة (عرض توضيحي) */}
    <div className="auth-chip c1 absolute top-[2%] right-[2%]">
      <span className="text-[10px] text-white/70">مستوى الخزان</span>
      <span className="flex items-center gap-1.5 mt-0.5">
        <b className="text-[13px]">82%</b>
        <span className="w-12 h-1.5 rounded-full bg-white/20 overflow-hidden"><span className="block h-full w-[82%] bg-emerald-300 rounded-full" /></span>
      </span>
    </div>
    <div className="auth-chip c2 absolute top-[0%] left-[0%]">
      <span className="flex items-center gap-1.5 text-[11px] font-bold">
        <span className="auth-live-dot w-1.5 h-1.5 rounded-full bg-amber-300 text-amber-300" /> صهريج 14
      </span>
      <span className="text-[10px] text-white/70">في الطريق · 12 دقيقة</span>
    </div>
    <div className="auth-chip c3 absolute top-[33%] left-[38%]">
      <span className="text-[10px] text-white/70">الرصيد الكلي</span>
      <b className="text-[13px]" dir="ltr">705,021 L</b>
    </div>
  </div>
);

// ═════ 3) التواصل مع الدعم ═════
const KINDS: { id: SupportKind; label: string; icon: React.ElementType }[] = [
  { id: 'account', label: 'حساب جديد', icon: UserPlus },
  { id: 'password', label: 'نسيت كلمة المرور', icon: KeyRound },
  { id: 'other', label: 'مشكلة أخرى', icon: HelpCircle },
];

const inputCls = 'auth-input-plain w-full h-14 rounded-xl border border-slate-200 bg-white pr-11 pl-4 text-[15px] text-slate-900 placeholder:text-slate-400 dark:bg-slate-950 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500';

const SupportForm: React.FC<{ kind: SupportKind; setKind: (k: SupportKind) => void; username: string; onDone: () => void }> = ({ kind, setKind, username, onDone }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [user, setUser] = useState(kind === 'password' ? username : '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!name.trim()) return setError('اكتب اسمك الكامل');
    if (phone.replace(/[^\d]/g, '').length < 7) return setError('اكتب رقم هاتف صحيح للتواصل معك');
    setBusy(true);
    try {
      await sendSupportRequest({ name: name.trim(), phone, username: user.trim(), kind, message: message.trim() });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-6 auth-fade" role="status">
        <span className="mx-auto w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50 dark:bg-emerald-500/10 dark:ring-emerald-500/5 flex items-center justify-center auth-pop">
          <CheckCircle2 className="w-9 h-9" />
        </span>
        <h2 className="mt-5 text-xl font-black text-slate-900 dark:text-white">تم إرسال طلبك</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">سيتواصل معك مدير النظام على رقم هاتفك قريبًا.</p>
        <button type="button" onClick={onDone} className="auth-btn auth-focus mt-7 w-full h-14 rounded-2xl text-white font-bold">العودة لتسجيل الدخول</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="text-center mb-6">
        <h1 className="text-[26px] font-black text-slate-900 dark:text-white">تواصل مع الدعم</h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          لديك حساب؟{' '}
          <button type="button" onClick={onDone} className="auth-focus font-bold text-teal-700 dark:text-teal-300 rounded">تسجيل الدخول</button>
        </p>
      </div>

      <fieldset className="mb-4">
        <legend className="text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">نوع الطلب</legend>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setKind(id)} aria-pressed={kind === id}
              className={`auth-focus min-h-[64px] rounded-xl px-1.5 py-2 flex flex-col items-center justify-center gap-1 text-[12px] font-bold transition ring-1 ${
                kind === id
                  ? 'bg-teal-50 text-teal-800 ring-teal-600 dark:bg-teal-500/10 dark:text-teal-200 dark:ring-teal-400'
                  : 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800'
              }`}>
              <Icon className="w-[18px] h-[18px]" /> {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">الاسم الكامل</span>
          <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" aria-hidden />
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="الاسم الكامل" autoComplete="name" className={inputCls} />
        </label>
        <label className="relative block">
          <span className="sr-only">رقم الهاتف</span>
          <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" aria-hidden />
          <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} placeholder="رقم الهاتف" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" className={`${inputCls} text-right`} />
        </label>
        {kind === 'password' && (
          <label className="relative block">
            <span className="sr-only">اسم المستخدم</span>
            <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" aria-hidden />
            <input value={user} onChange={e => setUser(e.target.value.replace(/\s/g, ''))} maxLength={32} placeholder="اسم المستخدم" dir="ltr" autoCapitalize="none" className={`${inputCls} text-right`} />
          </label>
        )}
        <label className="relative block">
          <span className="sr-only">ملاحظات</span>
          <MessageSquareText className="absolute right-3.5 top-4 w-[18px] h-[18px] text-slate-400" aria-hidden />
          <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500} rows={3} placeholder="ملاحظات (اختياري): المحطة، الوظيفة..."
            className="auth-input-plain w-full rounded-xl border border-slate-200 bg-white pr-11 pl-4 py-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 resize-none dark:bg-slate-950 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500" />
        </label>
      </div>

      <div aria-live="assertive">
        {error && (
          <p role="alert" className="mt-3 flex items-center gap-2 rounded-xl px-3.5 py-3 text-[13px] font-bold bg-rose-50 text-rose-800 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30">
            <AlertCircle className="w-[18px] h-[18px] shrink-0" /> {error}
          </p>
        )}
      </div>

      <button type="submit" disabled={busy} aria-busy={busy}
        className="auth-btn auth-focus mt-5 w-full h-14 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-70">
        {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> جارٍ الإرسال...</> : <><Send className="w-[18px] h-[18px]" /> إرسال الطلب</>}
      </button>
      <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">يصل طلبك مباشرة إلى مدير النظام.</p>
    </form>
  );
};
