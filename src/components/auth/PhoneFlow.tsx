import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation, Trans } from 'react-i18next';
import { errorText } from '../../i18n/errors';
import { ArrowRight, ArrowLeft, Fuel, Loader2, User, Phone, MessageSquareText, Send, CheckCircle2, UserPlus, KeyRound, HelpCircle, AlertCircle, Sun, Moon } from 'lucide-react';
import { sendSupportRequest } from '../../lib/session';
import { Onboarding } from './Onboarding';
import { LangToggle } from './LangToggle';
import { RoutesMap } from './RoutesMap';

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
  /** يُستدعى مع «ابدأ الآن» (الدخول بالبصمة مباشرة إن كانت مفعّلة) */
  onWelcomeStart?: () => void;
}> = ({ step, setStep: rawSetStep, setup, loading, dark, onToggleDark, supportKind, setSupportKind, username, form, onWelcomeStart }) => {
  const { t, i18n } = useTranslation('auth');
  const rich = { b: <b />, br: <br /> };
  // انتقال سلس بين الشاشات: الرأس الملوّن يتقلص واللوحة البيضاء ترتفع (View Transitions عند توفرها)
  const setStep = (s: PhoneStep) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return rawSetStep(s);
    doc.startViewTransition(() => flushSync(() => rawSetStep(s)));
  };
  return (
  <div dir={i18n.dir()} className="auth-phone min-h-[100dvh] flex flex-col">
    {step === 'intro' && <Onboarding onDone={() => setStep('welcome')} />}
    {step === 'welcome' && <Welcome dark={dark} onToggleDark={onToggleDark} onStart={() => { onWelcomeStart?.(); setStep('login'); }} />}

    {step === 'login' && (
      <Shell
        key="login"
        onBack={setup ? undefined : () => setStep('welcome')}
        dark={dark}
        onToggleDark={onToggleDark}
        headline={<Trans t={t} i18nKey={setup ? 'phone.headlineSetup' : 'phone.headlineLogin'} components={rich} />}
      >
        <div className="text-center mb-6">
          <h1 className="text-[26px] font-black text-slate-900 dark:text-white">{setup ? t('setupTitle') : t('title')}</h1>
          {setup ? (
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{t('phone.setupText')}</p>
          ) : (
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              {t('phone.noAccount')}{' '}
              <button type="button" onClick={() => { setSupportKind('account'); setStep('support'); }} className="auth-focus font-bold text-teal-700 dark:text-teal-300 rounded">
                {t('phone.contactSupport')}
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
        headline={<Trans t={t} i18nKey="phone.headlineSupport" components={rich} />}
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
}> = ({ onBack, dark, onToggleDark, headline, children }) => {
  const { t, i18n } = useTranslation('auth');
  const Back = i18n.dir() === 'rtl' ? ArrowRight : ArrowLeft;
  return (
  <>
    <div className="auth-phone-top relative overflow-hidden px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-14 text-white" style={{ viewTransitionName: 'auth-top' }}>
      <Swirls />
      <div className="relative flex items-center justify-between">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label={t('phone.back')}
            className="auth-focus w-11 h-11 rounded-xl flex items-center justify-center bg-white/10 ring-1 ring-white/20 hover:bg-white/20 transition">
            <Back className="w-5 h-5" />
          </button>
        ) : <span className="w-11" />}
        <div className="flex items-center gap-1.5"><LangToggle onColor /><ToggleDark dark={dark} onToggle={onToggleDark} /></div>
      </div>
      {/* عنوان أصغر يتكيّف مع عرض الشاشة: الأيقونات العلوية والنموذج يظهران معًا بلا تمرير في الشاشات القصيرة */}
      <p className="auth-headline relative mt-4 text-[clamp(17px,5.4vw,22px)] font-black leading-[1.5]">{headline}</p>
    </div>
    <div className="auth-sheet relative -mt-9 flex-1 rounded-t-[32px] bg-white dark:bg-slate-950 px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]" style={{ viewTransitionName: 'auth-sheet' }}>
      <div className="max-w-[420px] mx-auto auth-fade">{children}</div>
    </div>
  </>
  );
};

const ToggleDark: React.FC<{ dark: boolean; onToggle: () => void }> = ({ dark, onToggle }) => {
  const { t } = useTranslation('auth');
  return (
  <button type="button" onClick={onToggle} aria-label={dark ? t('theme.toLight') : t('theme.toDark')}
    className="auth-focus w-11 h-11 rounded-xl flex items-center justify-center bg-white/10 ring-1 ring-white/20 hover:bg-white/20 transition">
    {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
  </button>
  );
};

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
const Welcome: React.FC<{ dark: boolean; onToggleDark: () => void; onStart: () => void }> = ({ dark, onToggleDark, onStart }) => {
  const { t } = useTranslation('auth');
  return (
  <>
    <div className="auth-welcome-top relative overflow-hidden flex-1 min-h-[56dvh] flex flex-col px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-14 text-white" style={{ viewTransitionName: 'auth-top' }}>
      <Swirls />
      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur text-[12px] font-bold">
          <span className="auth-live-dot w-2 h-2 rounded-full bg-emerald-300 text-emerald-300" /> {t('phone.systemBadge')}
        </span>
        <div className="flex items-center gap-1.5"><LangToggle onColor /><ToggleDark dark={dark} onToggle={onToggleDark} /></div>
      </div>
      {/* خريطة مسارات نقل الوقود (بدل المشهد التوضيحي بأرقامه الثابتة) */}
      <div className="relative flex-1 flex items-center justify-center pt-4">
        <RoutesMap className="w-full max-w-[420px]" large />
      </div>
    </div>

    <div className="auth-sheet relative -mt-10 rounded-t-[36px] bg-white dark:bg-slate-950 px-7 pt-7 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center" style={{ viewTransitionName: 'auth-sheet' }}>
      {/* الشعار */}
      <div className="auth-rise flex flex-col items-center">
        <span className="auth-logo-ring relative w-[72px] h-[72px] rounded-[22px] p-[2px]">
          <span className="w-full h-full rounded-[20px] bg-white flex items-center justify-center overflow-hidden">
            <img src="/logos/sahara.png" alt={t('phone.logoAlt')} className="w-14 h-14 object-contain" />
          </span>
        </span>
      </div>

      <h1 className="auth-rise d1 mt-5 font-black leading-[1.45] text-slate-900 dark:text-white">
        <span className="block text-[clamp(16px,calc((100vw-56px)/17),22px)]">{t('phone.welcomeKicker')}</span>
        <span className="mt-1.5 text-[26px] flex items-center justify-center gap-2 text-teal-700 dark:text-teal-300">
          <span className="w-9 h-9 rounded-xl bg-teal-50 ring-1 ring-teal-100 dark:bg-teal-500/10 dark:ring-teal-500/20 flex items-center justify-center" aria-hidden>
            <Fuel className="w-5 h-5" />
          </span>
          {t('common:brand.name')}
        </span>
      </h1>
      <p className="auth-rise d2 mt-2.5 text-[15px] leading-7 text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
        {t('phone.welcomeText')}
      </p>
      <button type="button" onClick={onStart} autoFocus
        className="auth-rise d3 auth-btn auth-focus mt-6 w-full h-14 rounded-2xl text-white font-bold text-base">
        {t('phone.start')}
      </button>
    </div>
  </>
  );
};

// ═════ 3) التواصل مع الدعم ═════
const KINDS: { id: SupportKind; label: string; icon: React.ElementType }[] = [
  { id: 'account', label: 'support.kindAccount', icon: UserPlus },
  { id: 'password', label: 'support.kindPassword', icon: KeyRound },
  { id: 'other', label: 'support.kindOther', icon: HelpCircle },
];

const inputCls = 'auth-input-plain w-full h-14 rounded-xl border border-slate-200 bg-white ps-11 pe-4 text-[15px] text-slate-900 placeholder:text-slate-400 dark:bg-slate-950 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500';

const SupportForm: React.FC<{ kind: SupportKind; setKind: (k: SupportKind) => void; username: string; onDone: () => void }> = ({ kind, setKind, username, onDone }) => {
  const { t, i18n } = useTranslation('auth');
  const rtl = i18n.dir() === 'rtl';
  // الحقول ذات dir=ltr (الهاتف واسم المستخدم): الحشوة والمحاذاة تتبع اتجاه الصفحة
  const ltrField = rtl ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left';
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
    if (!name.trim()) return setError(t('validation.fullName'));
    if (phone.replace(/[^\d]/g, '').length < 7) return setError(t('validation.phone'));
    setBusy(true);
    try {
      await sendSupportRequest({ name: name.trim(), phone, username: user.trim(), kind, message: message.trim() });
      setSent(true);
    } catch (err) {
      setError(errorText(err));
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
        <h2 className="mt-5 text-xl font-black text-slate-900 dark:text-white">{t('support.sentTitle')}</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">{t('support.sentText')}</p>
        <button type="button" onClick={onDone} className="auth-btn auth-focus mt-7 w-full h-14 rounded-2xl text-white font-bold">{t('help.back')}</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="text-center mb-6">
        <h1 className="text-[26px] font-black text-slate-900 dark:text-white">{t('support.title')}</h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {t('support.haveAccount')}{' '}
          <button type="button" onClick={onDone} className="auth-focus font-bold text-teal-700 dark:text-teal-300 rounded">{t('title')}</button>
        </p>
      </div>

      <fieldset className="mb-4">
        <legend className="text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-2">{t('support.kind')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setKind(id)} aria-pressed={kind === id}
              className={`auth-focus min-h-[64px] rounded-xl px-1.5 py-2 flex flex-col items-center justify-center gap-1 text-[12px] font-bold transition ring-1 ${
                kind === id
                  ? 'bg-teal-50 text-teal-800 ring-teal-600 dark:bg-teal-500/10 dark:text-teal-200 dark:ring-teal-400'
                  : 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800'
              }`}>
              <Icon className="w-[18px] h-[18px]" /> {t(label)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">{t('fields.fullName')}</span>
          <User className="absolute start-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" aria-hidden />
          <input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder={t('fields.fullName')} autoComplete="name" className={inputCls} />
        </label>
        <label className="relative block">
          <span className="sr-only">{t('fields.phone')}</span>
          <Phone className="absolute start-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" aria-hidden />
          <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} placeholder={t('fields.phone')} type="tel" inputMode="tel" dir="ltr" autoComplete="tel" className={`${inputCls} ${ltrField}`} />
        </label>
        {kind === 'password' && (
          <label className="relative block">
            <span className="sr-only">{t('fields.username')}</span>
            <User className="absolute start-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" aria-hidden />
            <input value={user} onChange={e => setUser(e.target.value.replace(/\s/g, ''))} maxLength={32} placeholder={t('fields.username')} dir="ltr" autoCapitalize="none" className={`${inputCls} ${ltrField}`} />
          </label>
        )}
        <label className="relative block">
          <span className="sr-only">{t('fields.notes')}</span>
          <MessageSquareText className="absolute start-3.5 top-4 w-[18px] h-[18px] text-slate-400" aria-hidden />
          <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500} rows={3} placeholder={t('fields.notesPlaceholder')}
            className="auth-input-plain w-full rounded-xl border border-slate-200 bg-white ps-11 pe-4 py-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 resize-none dark:bg-slate-950 dark:border-slate-700 dark:text-white dark:placeholder:text-slate-500" />
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
        {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> {t('support.sending')}</> : <><Send className="w-[18px] h-[18px]" /> {t('support.send')}</>}
      </button>
      <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">{t('support.note')}</p>
    </form>
  );
};
