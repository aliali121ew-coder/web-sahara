import React, { useEffect, useId, useRef, useState } from 'react';
import {
  User, Lock, Eye, EyeOff, Loader2, AlertCircle, Clock, ArrowUpWideNarrow, KeyRound, ShieldCheck, UserCog,
  Sun, Moon, ArrowRight, ArrowLeft, Check, Truck, Fuel, Building2, LockKeyhole, Fingerprint, ScanFace, X,
} from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { errorText } from '../../i18n/errors';
import { LangToggle } from './LangToggle';
import {
  authStatus, loginAccount, setupSystem, AuthError, LAST_USER_KEY, LAST_NAME_KEY,
  biometricAvailable, biometricUser, enableBiometric, loginWithBiometric, savedLogin, resumeLogin, forgetSavedLogin,
  prepareBioLogin, bioAnimationKind, type BioLoginOptions,
  BIO_DECLINED_PREFIX, type BioRegisterOptions,
} from '../../lib/session';
import { RoutesMap } from './RoutesMap';
import { BioMethods, anyBioMethod, bioErrorText, saveBioMethod, useBioMethods, usePreparedBio } from './BiometricSettings';
import { PhoneFlow, type PhoneStep, type SupportKind } from './PhoneFlow';
import { BioAuthOverlay, type BioPhase } from './BioAuthOverlay';
import './auth.css';

// ───── أدوات ─────
const strength = (p: string) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
};
// تسمية كل مستوى في auth:strength.<n>
const STRENGTH = ['#ef4444', '#f97316', '#ca8a04', '#16a34a', '#059669'].map(color => ({ color }));
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const REMEMBER_KEY = 'sahara_remember_me';
const WELCOME_KEY = 'sahara_welcome_seen';
/** رفض عرض تفعيل البصمة لهذا الحساب على هذا الجهاز */
const BIO_DECLINED_KEY = BIO_DECLINED_PREFIX;

/** هل الشاشة بعرض هاتف؟ */
const useIsPhone = () => {
  const q = '(max-width: 639px)';
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setPhone(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return phone;
};
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type Mode = 'loading' | 'login' | 'help' | 'setup';
type BtnState = 'idle' | 'loading' | 'success';

// ───── حقل بعنوان عائم ─────
type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'placeholder'> & {
  label: string;
  icon: React.ElementType;
  trailing?: React.ReactNode;
  invalid?: boolean;
  children?: React.ReactNode;
};
const Field = React.forwardRef<HTMLInputElement, FieldProps>(({ label, icon: Icon, trailing, invalid, children, id, ...rest }, ref) => {
  // الحقول قد تكون dir=ltr (اسم المستخدم وكلمة المرور)، لذلك تُحسب الجهات من اتجاه الصفحة لا الحقل
  const { i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  return (
  <div className="space-y-1.5">
    <div className="fl-wrap">
      <Icon aria-hidden className={`fl-icon absolute ${rtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 pointer-events-none`} />
      <input
        ref={ref}
        id={id}
        placeholder=" "
        aria-invalid={invalid || undefined}
        {...rest}
        className={`fl-input w-full h-14 rounded-xl border border-slate-200 bg-white ${rtl ? 'pr-11 pl-14' : 'pl-11 pr-14'} pt-1 text-[15px] text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-white`}
      />
      <label htmlFor={id} className="fl-label">{label}</label>
      {trailing && <div className={`absolute ${rtl ? 'left-1.5' : 'right-1.5'} top-1/2 -translate-y-1/2`}>{trailing}</div>}
    </div>
    {children}
  </div>
  );
});
Field.displayName = 'Field';

// ═════ الشاشة ═════
export const AppLogin: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const { t, i18n } = useTranslation('auth');
  const pageDir = i18n.dir();
  const [mode, setMode] = useState<Mode>('loading');
  const [dark, setDark] = useState(() => localStorage.getItem('sahara_theme_mode') === 'dark');
  // الدخول المحفوظ (72 ساعة من آخر إدخال لكلمة المرور): يكفي زر «تسجيل الدخول»
  const [saved, setSaved] = useState(savedLogin);
  const [username, setUsername] = useState(() => savedLogin() || localStorage.getItem(LAST_USER_KEY) || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(() => localStorage.getItem(REMEMBER_KEY) !== '0');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [btn, setBtn] = useState<BtnState>('idle');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const passRef = useRef<HTMLInputElement>(null);
  const errId = useId();
  const phone = useIsPhone();
  // الشرائح التعريفية أول مرة فقط، والترحيب في كل مرة يُطلب فيها تسجيل الدخول (كل 24 ساعة أو بعد الخروج)
  const [phoneStep, setPhoneStepState] = useState<PhoneStep>(() => (localStorage.getItem(WELCOME_KEY) ? 'welcome' : 'intro'));
  const setPhoneStep = (s: PhoneStep) => {
    if (s === 'login' || s === 'support') { try { localStorage.setItem(WELCOME_KEY, '1'); } catch { /* تجاهل */ } }
    setPhoneStepState(s);
    setError('');
    window.scrollTo(0, 0);
  };
  const [supportKind, setSupportKind] = useState<SupportKind>('account');
  // البصمة / بصمة الوجه
  const [bioAvail, setBioAvail] = useState(false);
  const [bioUser] = useState(biometricUser);
  const [bioOffer, setBioOffer] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  // حركة التحقق (الوجه من الأعلى أو الإصبع من الأسفل) وبيانات الدخول المجلوبة مسبقًا
  const [bioPhase, setBioPhase] = useState<BioPhase | null>(null);
  const bioPrepared = useRef<BioLoginOptions | null>(null);
  const bioAbort = useRef<AbortController | null>(null);
  const bioReady = bioAvail && !!bioUser;
  const lastName = (localStorage.getItem(LAST_NAME_KEY) || '').split(' ')[0];
  useEffect(() => { biometricAvailable().then(setBioAvail); }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('sahara_theme_mode', dark ? 'dark' : 'light'); } catch { /* تجاهل */ }
  }, [dark]);

  useEffect(() => {
    authStatus().then(r => setMode(r.setup ? 'setup' : 'login')).catch(() => setMode('login'));
  }, []);

  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockedUntil) { setLockedUntil(0); setError(''); }
    }, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);
  const lockLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const useSaved = mode === 'login' && !!saved && username.trim().toLowerCase() === saved;
  const forgetSaved = () => {
    forgetSavedLogin();
    setSaved('');
    setUsername('');
    setError('');
  };

  const fail = (e: unknown) => {
    setError(errorText(e));
    setShake(s => s + 1);
    // إبطاء بعد محاولات خاطئة (للحساب أو للجهاز): عدّاد تنازلي حتى المحاولة التالية
    if (e instanceof AuthError && (e.code === 'locked' || e.code === 'ip_locked')) {
      setLockedUntil(e.retryAt || Date.now() + 60_000);
      setNow(Date.now());
    }
    setPassword('');
    setConfirm('');
    requestAnimationFrame(() => passRef.current?.focus());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (btn !== 'idle' || lockLeft) return; // منع الإرسال المكرر
    setError('');
    const u = username.trim().toLowerCase();
    const invalid = (msg: string) => { setError(msg); setShake(s => s + 1); };
    if (mode === 'setup') {
      if (!code.trim()) return invalid(t('validation.code'));
      if (!name.trim()) return invalid(t('validation.fullName'));
      if (!USERNAME_RE.test(u)) return invalid(t('validation.username'));
      if (password.length < 8) return invalid(t('validation.passwordLength'));
      if (password !== confirm) return invalid(t('validation.passwordMatch'));
    } else if (useSaved) {
      setBtn('loading');
      try {
        await resumeLogin();
        setBtn('success');
        setTimeout(onSuccess, reducedMotion() ? 0 : 650);
      } catch (err) {
        setBtn('idle');
        // انتهت مهلة الـ 72 ساعة أو أُلغي الدخول المحفوظ: يعود الحقل لطلب كلمة المرور
        if (err instanceof AuthError && err.code === 'resume_expired') setSaved('');
        fail(err);
      }
      return;
    } else if (!u || !password) {
      return invalid(t('validation.credentials'));
    }
    setBtn('loading');
    try {
      if (mode === 'setup') await setupSystem(code.trim(), { username: u, password, name: name.trim() });
      else await loginAccount(u, password, remember);
      localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
      setBtn('success');
      // بعد أول دخول بكلمة المرور على جهاز يدعم البصمة: نعرض تفعيلها (مرة لكل حساب)
      const offer = bioAvail && biometricUser() !== u && !localStorage.getItem(BIO_DECLINED_KEY + u);
      setTimeout(() => (offer ? setBioOffer(true) : onSuccess()), reducedMotion() ? 0 : 650);
    } catch (err) {
      setBtn('idle');
      fail(err);
    }
  };

  // بيانات الدخول بالبصمة تُجلب مسبقًا وتُجدَّد قبل انتهاء صلاحيتها (دقيقتان)، فيبدأ طلب البصمة فور الضغط
  const loadBioOptions = () => { prepareBioLogin(bioUser).then(o => { bioPrepared.current = o; }).catch(() => {}); };
  useEffect(() => {
    if (!bioReady || mode !== 'login') return;
    loadBioOptions();
    const t = setInterval(loadBioOptions, 80_000);
    return () => clearInterval(t);
  }, [bioReady, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const bioLogin = async () => {
    if (bioBusy || btn !== 'idle') return;
    setError('');
    setBioBusy(true);
    // أثناء التحقق تُترك الشاشة لنافذة النظام (أندرويد / iPhone تعرض نافذتها الإلزامية للبصمة)،
    // فحركة التطبيق تظهر بعد النجاح فقط ولا تتراكب فوق نافذة النظام
    const ctrl = new AbortController();
    bioAbort.current = ctrl;
    try {
      await loginWithBiometric(bioUser, bioPrepared.current, ctrl.signal);
      bioPrepared.current = null;
      setBioPhase('success');
      setBtn('success');
      // تبقى علامة الصح الخضراء لحظة ثم يُفتح التطبيق
      setTimeout(onSuccess, reducedMotion() ? 300 : 1100);
    } catch (err) {
      setBioPhase(null);
      if (!(err instanceof AuthError && err.code === 'cancelled')) fail(err);
      loadBioOptions();
    } finally {
      bioAbort.current = null;
      setBioBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => setCaps(e.getModifierState?.('CapsLock') ?? false);
  const setup = mode === 'setup';
  const st = strength(password);
  const hasError = !!error;

  // نموذج الدخول نفسه (مشترك بين الحاسوب والهاتف)
  const renderForm = (phone: boolean) => (
    <>
      {!setup && bioAvail && bioUser && (
        <div className="mb-5 auth-fade">
          <button type="button" onClick={bioLogin} disabled={bioBusy || btn !== 'idle'} aria-busy={bioBusy}
            className="auth-focus w-full rounded-2xl p-4 flex items-center gap-4 text-start bg-teal-50 ring-1 ring-teal-200 hover:bg-teal-100/70 dark:bg-teal-500/10 dark:ring-teal-500/30 dark:hover:bg-teal-500/15 transition disabled:opacity-70">
            <span className="auth-bio-icon w-14 h-14 shrink-0 rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-teal-200 dark:ring-teal-500/30 flex items-center justify-center text-teal-700 dark:text-teal-300">
              {bioBusy ? <Loader2 className="w-7 h-7 animate-spin" /> : <Fingerprint className="w-8 h-8" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-black text-slate-900 dark:text-white">{lastName ? t('welcomeBackName', { name: lastName }) : t('welcomeBack')}</span>
              <span className="block text-[13px] font-semibold text-teal-800 dark:text-teal-300">{t('bioLogin')}</span>
            </span>
            <ScanFace className="w-6 h-6 text-teal-700/60 dark:text-teal-300/60 shrink-0" aria-hidden />
          </button>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-5">
            <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" /> {t('orPassword')} <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      )}
      <form key={shake} onSubmit={submit} noValidate aria-describedby={hasError ? errId : undefined}
        className={`space-y-4 ${shake ? 'auth-shake' : 'auth-fade'}`}>
        {setup && (
          <>
            <Field id="a-code" label={t('fields.code')} icon={KeyRound} dir="ltr" type="password" value={code}
              onChange={e => setCode(e.target.value)} autoComplete="off" autoFocus={!phone} required />
            <Field id="a-name" label={t('fields.fullName')} icon={UserCog} value={name} onChange={e => setName(e.target.value)}
              maxLength={60} autoComplete="name" required />
          </>
        )}
        <Field
          id="a-user" label={t('fields.username')} icon={User} dir="ltr" value={username} invalid={hasError && !setup}
          onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
          maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false} required
          autoFocus={!phone && !setup && !username}
        />
        {useSaved ? (
          <div className="flex items-center gap-3 h-14 rounded-xl px-3.5 bg-teal-50 ring-1 ring-teal-200 dark:bg-teal-500/10 dark:ring-teal-500/30">
            <ShieldCheck className="w-[18px] h-[18px] shrink-0 text-teal-700 dark:text-teal-300" aria-hidden />
            <span className="flex-1 min-w-0 text-[13px] font-bold text-teal-900 dark:text-teal-200">{t('savedLogin')}</span>
            <button type="button" onClick={forgetSaved}
              className="auth-focus min-h-[44px] px-1 text-[13px] font-bold text-teal-700 hover:text-teal-950 underline-offset-4 hover:underline dark:text-teal-300 dark:hover:text-teal-100 rounded-md shrink-0">
              {t('otherAccount')}
            </button>
          </div>
        ) : (
        <Field
          ref={passRef} id="a-pass" label={t('fields.password')} icon={Lock} dir="ltr" invalid={hasError && !setup}
          type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={onKey} onKeyUp={onKey} maxLength={128} required
          autoComplete={setup ? 'new-password' : 'current-password'} autoFocus={!phone && !setup && !!username}
          trailing={
            <button type="button" onClick={() => setShow(v => !v)} aria-pressed={show}
              aria-label={show ? t('hidePassword') : t('showPassword')}
              className="auth-focus w-11 h-11 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition">
              {show ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
            </button>
          }
        >
          {caps && (
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400" role="status">
              <ArrowUpWideNarrow className="w-3.5 h-3.5" /> {t('capsLock')}
            </p>
          )}
          {setup && password && (
            <div className="flex items-center gap-2 pt-0.5">
              <div className="flex-1 grid grid-cols-4 gap-1" aria-hidden>
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors" style={i < st ? { background: STRENGTH[st].color } : undefined} />
                ))}
              </div>
              <span className="text-xs font-bold" style={{ color: STRENGTH[st].color }}>{t('strengthLabel', { level: t(`strength.${st}`) })}</span>
            </div>
          )}
        </Field>
        )}
        {setup && (
          <Field id="a-confirm" label={t('fields.confirmPassword')} icon={Lock} dir="ltr" type={show ? 'text' : 'password'}
            value={confirm} onChange={e => setConfirm(e.target.value)} maxLength={128} autoComplete="new-password" required />
        )}

        {!setup && !useSaved && (
          <div className="flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2.5 min-h-[44px] cursor-pointer select-none text-sm font-semibold text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                className="auth-focus w-[18px] h-[18px] rounded accent-teal-700" />
              {t('remember')}
            </label>
            {phone && (
              <button type="button" onClick={() => { setSupportKind('password'); setPhoneStep('support'); }}
                className="auth-focus min-h-[44px] text-sm font-bold text-teal-700 dark:text-teal-300 rounded-md">
                {t('forgot')}
              </button>
            )}
          </div>
        )}

        {/* رسالة الخطأ: أيقونة + نص (لا نعتمد على اللون وحده) */}
        <div aria-live="assertive" id={errId}>
          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px] font-bold leading-6 bg-rose-50 text-rose-800 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/30">
              {lockLeft ? <Clock className="w-[18px] h-[18px] shrink-0 mt-0.5" /> : <AlertCircle className="w-[18px] h-[18px] shrink-0 mt-0.5" />}
              <span className="flex-1">
                {error}
                {lockLeft > 0 && (
                  <span dir="ltr" className="block font-mono text-base mt-0.5">
                    {String(Math.floor(lockLeft / 60)).padStart(2, '0')}:{String(lockLeft % 60).padStart(2, '0')}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <button type="submit" disabled={btn !== 'idle' || lockLeft > 0} aria-busy={btn === 'loading'}
          className={`auth-btn auth-focus w-full h-14 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:cursor-not-allowed ${btn === 'success' ? 'success' : ''} ${btn === 'idle' && lockLeft ? 'opacity-60' : ''}`}>
          {btn === 'loading' && <><Loader2 className="w-5 h-5 animate-spin" /> {t('submitting')}</>}
          {btn === 'success' && <><Check className="w-5 h-5 auth-pop" strokeWidth={3} /> {t('success')}</>}
          {btn === 'idle' && (setup ? t('submitSetup') : t('submitLogin'))}
        </button>
      </form>

      {/* الاستعادة والمساعدة: مباشرة أسفل النموذج (الحاسوب) */}
      {!setup && !phone && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
          <button type="button" onClick={() => setMode('help')}
            className="auth-focus min-h-[44px] font-bold text-teal-800 hover:text-teal-950 underline-offset-4 hover:underline dark:text-teal-300 dark:hover:text-teal-200 rounded-md">
            {t('forgot')}
          </button>
          <button type="button" onClick={() => setMode('help')}
            className="auth-focus min-h-[44px] font-semibold text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline dark:text-slate-400 dark:hover:text-white rounded-md">
            {t('requestAccount')}
          </button>
        </div>
      )}
      {!setup && <SocialLogin />}
    </>
  );

  const bioEl = bioPhase && <BioAuthOverlay kind={bioAnimationKind()} phase={bioPhase} onCancel={() => bioAbort.current?.abort()} />;

  const offerEl = bioOffer && (
    <BioOffer
      onEnable={async prepared => { await enableBiometric(undefined, prepared); onSuccess(); }}
      onSkip={() => { try { localStorage.setItem(BIO_DECLINED_KEY + username.trim().toLowerCase(), '1'); } catch { /* تجاهل */ } onSuccess(); }}
    />
  );

  // ═════ الهاتف: ترحيب ← دخول ← دعم ═════
  if (phone) {
    return (
      <>
      {offerEl}
      {bioEl}
      <PhoneFlow
        step={setup ? 'login' : phoneStep}
        setStep={setPhoneStep}
        setup={setup}
        loading={mode === 'loading'}
        dark={dark}
        onToggleDark={() => setDark(d => !d)}
        supportKind={supportKind}
        setSupportKind={setSupportKind}
        username={username}
        form={renderForm(true)}
        // «ابدأ الآن» مع بصمة مفعّلة: يبدأ التحقق بالوجه أو الإصبع مباشرة (والنموذج تحته إن أُلغي)
        onWelcomeStart={bioReady && mode === 'login' ? bioLogin : undefined}
      />
      </>
    );
  }

  return (
    <div dir={pageDir} className="auth-page relative flex items-center justify-center p-5 lg:p-8">
      {offerEl}
      {bioEl}
      <div className="auth-glass-frame relative w-full max-w-[1280px] p-2">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] gap-2.5 lg:h-[min(840px,calc(100dvh-5rem))]">

          {/* ═════ بطاقة الدخول ═════ */}
          <section className="relative flex flex-col bg-white dark:bg-slate-950 rounded-[22px] border border-slate-200/80 dark:border-slate-800 px-10 xl:px-16 py-7 overflow-y-auto">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-xl bg-white ring-1 ring-slate-200 dark:ring-slate-700 flex items-center justify-center overflow-hidden">
                  <img src="/logos/sahara.png" alt="" className="w-9 h-9 object-contain" />
                </span>
                <div className="leading-tight">
                  <div className="font-black text-base text-slate-900 dark:text-white">{t('common:brand.name')}</div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('systemName')}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <LangToggle />
                <ThemeButton dark={dark} onToggle={() => setDark(d => !d)} />
              </div>
            </header>

            <main className="flex-1 flex flex-col justify-center w-full max-w-[400px] mx-auto py-10">
              {mode === 'loading' ? (
                <div className="flex justify-center py-20" role="status" aria-label={t('loading')}><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>
              ) : mode === 'help' ? (
                <HelpView onBack={() => setMode('login')} />
              ) : (
                <>
                  <div className="mb-8">
                    {setup && <SetupBadge />}
                    <h1 className="text-[32px] font-black tracking-tight text-slate-900 dark:text-white leading-[1.3]">
                      {setup ? t('setupTitle') : t('welcomeTitle')}
                    </h1>
                    <p className="mt-2 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
                      {setup ? t('setupText') : t('welcomeText')}
                    </p>
                  </div>
                  {renderForm(false)}
                </>
              )}
            </main>

            <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="w-3.5 h-3.5" /> {t('footerSecure')}</span>
              <span>{t('footerCopyright', { year: new Date().getFullYear() })}</span>
            </footer>
          </section>

          <FleetShowcase />
        </div>
      </div>
    </div>
  );
};

/** عرض تفعيل الدخول بالبصمة / بصمة الوجه بعد الدخول بكلمة المرور */
const BioOffer: React.FC<{ onEnable: (prepared: BioRegisterOptions | null) => Promise<void>; onSkip: () => void }> = ({ onEnable, onSkip }) => {
  const { t, i18n } = useTranslation('auth');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // تُجلب بيانات التسجيل فور ظهور العرض ليبدأ طلب البصمة مباشرة عند الضغط (شرط Safari في iPhone)
  const { ref: prepared } = usePreparedBio(true);
  const [methods, setMethods] = useBioMethods();
  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      await onEnable(prepared.current);
      saveBioMethod(methods);
    } catch (e) {
      setError(bioErrorText(e));
      setBusy(false);
    }
  };
  return (
    <div dir={i18n.dir()} role="dialog" aria-modal="true" aria-labelledby="bio-title"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-sm p-0 sm:p-6 auth-fade">
      <div className="relative w-full sm:max-w-md bg-white dark:bg-slate-950 rounded-t-[32px] sm:rounded-[28px] px-7 pt-9 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center shadow-2xl auth-rise">
        <button type="button" onClick={onSkip} aria-label={t('common:actions.close')} className="auth-focus absolute top-4 end-4 w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="w-5 h-5" />
        </button>
        <div className="mx-auto w-16 h-16 rounded-[20px] auth-bio-hero flex items-center justify-center text-white">
          <Fingerprint className="w-8 h-8" />
        </div>
        <h2 id="bio-title" className="mt-5 text-[22px] font-black text-slate-900 dark:text-white">{t('bio.title')}</h2>
        <p className="mt-1.5 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
          {t('bio.text')}
        </p>
        <BioMethods value={methods} onChange={setMethods} disabled={busy} />
        {error && (
          <p role="alert" className="mt-4 flex items-center justify-center gap-2 text-[13px] font-bold text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4" /> {error}
          </p>
        )}
        <button type="button" onClick={enable} disabled={busy || !anyBioMethod(methods)} autoFocus
          className="auth-btn auth-focus mt-6 w-full h-14 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 disabled:opacity-70">
          {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> {t('bio.waiting')}</> : t('bio.enable')}
        </button>
        <button type="button" onClick={onSkip}
          className="auth-focus mt-2 w-full h-12 rounded-2xl text-[15px] font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900">
          {t('bio.later')}
        </button>
      </div>
    </div>
  );
};

const ThemeButton: React.FC<{ dark: boolean; onToggle: () => void; onColor?: boolean }> = ({ dark, onToggle, onColor }) => {
  const { t } = useTranslation('auth');
  return (
  <button type="button" onClick={onToggle} aria-label={dark ? t('theme.toLight') : t('theme.toDark')}
    className={`auth-focus w-11 h-11 rounded-xl flex items-center justify-center transition ${
      onColor ? 'text-white bg-white/10 ring-1 ring-white/20 hover:bg-white/20'
        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'}`}>
    {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
  </button>
  );
};

const SetupBadge = () => {
  const { t } = useTranslation('auth');
  return (
  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30 mb-3">
    <UserCog className="w-3.5 h-3.5" /> {t('setupBadge')}
  </span>
  );
};

// ───── الدخول عبر مزوّدات خارجية (تُفعَّل لاحقًا) ─────
/**
 * لتفعيل مزوّد: اجعل enabled: true واربط onClick بمسار المصادقة على الخادم (OAuth).
 * الدخول الخارجي يجب أن يُربط بحساب موجود أصدره مدير النظام، ولا يُنشئ حسابًا جديدًا.
 */
const SSO_PROVIDERS: { id: string; name: string; enabled: boolean; icon: React.ReactNode }[] = [
  {
    id: 'google', name: 'Google', enabled: false,
    icon: (
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden>
        <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.55-5.17 3.55-8.66z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.37-2.29V6.6H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.4l4-3.11z" />
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.6l4 3.11C6.22 6.86 8.87 4.75 12 4.75z" />
      </svg>
    ),
  },
  {
    id: 'apple', name: 'Apple', enabled: false,
    icon: (
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-slate-900 dark:text-white" fill="currentColor" aria-hidden>
        <path d="M16.37 12.73c-.03-2.6 2.13-3.86 2.22-3.92-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.95-3.94.95-.82 0-2.07-.93-3.4-.9a5.04 5.04 0 0 0-4.26 2.58c-1.82 3.15-.47 7.82 1.3 10.38.87 1.25 1.9 2.66 3.25 2.61 1.3-.05 1.8-.84 3.38-.84 1.57 0 2.02.84 3.4.81 1.4-.02 2.29-1.27 3.15-2.53.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.72-1.04-2.75-4.17zM13.8 5.08c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.09 3.18 1.15.09 2.32-.58 3.04-1.46z" />
      </svg>
    ),
  },
  {
    id: 'facebook', name: 'Facebook', enabled: false,
    icon: (
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden>
        <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
      </svg>
    ),
  },
  {
    id: 'x', name: 'X', enabled: false,
    icon: (
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-slate-900 dark:text-white" fill="currentColor" aria-hidden>
        <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z" />
      </svg>
    ),
  },
];

const SocialLogin: React.FC = () => {
  const { t } = useTranslation('auth');
  const [note, setNote] = useState('');
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-4">
        <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" /> {t('sso.or')} <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="flex justify-center gap-2.5">
        {SSO_PROVIDERS.map(p => (
          <button
            key={p.id}
            type="button"
            aria-disabled={!p.enabled}
            aria-label={t('sso.via', { name: p.name })}
            title={t('sso.via', { name: p.name })}
            onClick={() => setNote(p.enabled ? '' : t('sso.notEnabled', { name: p.name }))}
            className="auth-focus w-11 h-11 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 dark:bg-slate-900 dark:hover:bg-slate-800 flex items-center justify-center transition active:scale-95"
          >
            {p.icon}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="empty:hidden mt-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">{note}</p>
    </div>
  );
};

// ───── المساعدة: نسيت كلمة المرور / طلب حساب ─────
const HelpView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { t, i18n } = useTranslation('auth');
  const Back = i18n.dir() === 'rtl' ? ArrowRight : ArrowLeft;
  return (
  <div className="auth-fade">
    <h1 className="text-[28px] font-black tracking-tight text-slate-900 dark:text-white leading-[1.3]">{t('help.title')}</h1>
    <p className="mt-2 mb-7 text-[15px] leading-7 text-slate-600 dark:text-slate-400">
      {t('help.text')}
    </p>
    <ol className="space-y-4">
      {[
        { icon: ShieldCheck, title: t('help.step1Title'), d: t('help.step1Text') },
        { icon: KeyRound, title: t('help.step2Title'), d: t('help.step2Text') },
        { icon: Lock, title: t('help.step3Title'), d: t('help.step3Text') },
      ].map(({ icon: Icon, title, d }) => (
        <li key={title} className="flex items-start gap-3.5">
          <span className="w-11 h-11 shrink-0 rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-100 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20 flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </span>
          <div className="pt-0.5">
            <div className="text-[15px] font-bold text-slate-900 dark:text-white">{title}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">{d}</div>
          </div>
        </li>
      ))}
    </ol>
    <button type="button" onClick={onBack} autoFocus
      className="auth-focus mt-8 w-full h-14 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 ring-1 ring-slate-300 text-slate-800 hover:bg-slate-50 dark:ring-slate-700 dark:text-slate-100 dark:hover:bg-slate-900 transition">
      <Back className="w-4 h-4" /> {t('help.back')}
    </button>
  </div>
  );
};

// أرقام تعريفية بالشركة (أكثر من…)، لا بيانات تشغيل حيّة: الشاشة قبل تسجيل الدخول
const KPIS = [
  { icon: Truck, value: 3600, label: 'showcase.kpiVehicles', plus: true },
  { icon: Building2, value: 35, label: 'showcase.kpiStations', plus: true },
  { icon: Fuel, value: 62570310, label: 'showcase.kpiFuel', plus: false },
];

/** عدّاد يصعد بنعومة عند الظهور */
const CountUp: React.FC<{ to: number }> = ({ to }) => {
  const [v, setV] = useState(() => (reducedMotion() ? to : 0));
  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      // rAF قد يمرّر وقتًا أقدم قليلًا من t0، فنقيّد التقدّم بين 0 و 1
      const p = Math.min(1, Math.max(0, (t - t0) / 1400));
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v.toLocaleString('en-US')}</>;
};

const FleetShowcase: React.FC = () => {
  const { t } = useTranslation('auth');
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <section aria-label={t('showcase.label')} className="auth-show hidden lg:flex relative overflow-hidden rounded-[22px] text-white flex-col p-7 xl:p-9">
      <div className="auth-grid" />

      {/* شريط الحالة */}
      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full auth-glass text-[13px] font-bold">
          <span className="auth-live-dot w-2 h-2 rounded-full bg-emerald-400 text-emerald-400" /> {t('showcase.live')}
        </span>
        <span dir="ltr" className="font-mono text-[13px] text-white/70 tabular-nums">
          {time.toLocaleTimeString('en-GB', { hour12: false })}
        </span>
      </div>

      {/* الخريطة المصغّرة */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center py-6">
        <RoutesMap className="w-full max-w-[600px]" />
      </div>

      {/* المؤشرات */}
      <div className="relative grid grid-cols-3 gap-3">
        {KPIS.map(({ icon: Icon, value, label, plus }) => (
          <div key={label} className="auth-glass rounded-2xl px-4 py-3.5 text-center">
            <div className="flex items-center justify-center gap-2 text-white/70 text-xs font-semibold mb-1.5">
              <Icon className="w-4 h-4 text-teal-300" /> {t(label)}
            </div>
            {/* «أكثر من» تحت العنوان والرقم تحتها، بنفس الترتيب في البطاقات الثلاث */}
            <div className="text-[11px] font-bold text-teal-200/90">{t('showcase.moreThan')}</div>
            <div className="text-[22px] xl:text-2xl font-black tabular-nums"><span dir="ltr" className="inline-block"><CountUp to={value} />{plus && '+'}</span></div>
          </div>
        ))}
      </div>

      {/* الرسالة */}
      <div className="relative mt-7">
        <h2 className="text-[26px] xl:text-[30px] font-black leading-[1.35] tracking-tight">
          <Trans t={t} i18nKey="showcase.headline" components={{ 1: <span className="text-teal-300" /> }} />
        </h2>
        <p className="mt-2 text-[15px] leading-7 text-white/70 max-w-lg">
          {t('showcase.text')}
        </p>
      </div>
    </section>
  );
};
