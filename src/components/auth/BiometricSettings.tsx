import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Fingerprint, ScanFace, Loader2, AlertCircle, CheckCircle2, X, Lock, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../i18n/errors';
import {
  AuthError, biometricAvailable, biometricUser, enableBiometric, disableBiometric, prepareBiometric, setBioMethod, BIO_DECLINED_PREFIX,
  type BioRegisterOptions,
} from '../../lib/session';
import './auth.css';

/** نص خطأ البصمة مع اسم الخطأ التقني من المتصفح (لمعرفة السبب الحقيقي عند «تعذّر الاستخدام») */
// التفصيل التقني إنجليزي: يُعزل باتجاه LTR (LRI … PDI) حتى لا تختلط أقواسه بالنص العربي
const LRI = String.fromCharCode(0x2066);
const PDI = String.fromCharCode(0x2069);
export const bioErrorText = (e: unknown) => errorText(e) + (e instanceof AuthError && e.detail ? ` ${LRI}(${e.detail})${PDI}` : '');

/**
 * بيانات التسجيل مجلوبة مسبقًا عند فتح النافذة: طلب البصمة يُستدعى مباشرة عند الضغط
 * (Safari في iPhone يرفضه إن سبقه انتظار شبكة). يعيد null إن احتاج الخادم كلمة المرور أولًا
 */
export const usePreparedBio = (active: boolean) => {
  const ref = useRef<BioRegisterOptions | null>(null);
  const [needPw, setNeedPw] = useState(false);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const load = () => prepareBiometric()
      .then(o => { if (alive) ref.current = o; })
      .catch(e => { if (alive && e instanceof AuthError && e.code === 'reauth_required') setNeedPw(true); });
    load();
    // التحدي صالح دقيقتين في الخادم: يُجدَّد قبل انتهائه ما دامت النافذة مفتوحة
    const timer = setInterval(load, 80_000);
    return () => { alive = false; clearInterval(timer); };
  }, [active]);
  return { ref, needPw, setNeedPw };
};

export type BioMethodKey = 'finger' | 'face';
export type BioMethodSet = Record<BioMethodKey, boolean>;
/** الطريقتان محددتان معًا افتراضيًا */
export const useBioMethods = () => useState<BioMethodSet>({ finger: true, face: true });
export const anyBioMethod = (m: BioMethodSet) => m.finger || m.face;
/** حفظ الاختيار على هذا الجهاز: تحدد حركة شاشة الدخول (الوجه أو الإصبع) */
export const saveBioMethod = (m: BioMethodSet) => setBioMethod(m.finger && m.face ? 'both' : m.face ? 'face' : 'finger');

/**
 * تحديد طريقة البصمة: الإصبع والوجه يُحدَّدان معًا أو كل واحدة وحدها، ثم «تفعيل الآن».
 * المتصفح لا يسمح باختيار المستشعر نفسه: مفتاح المرور واحد للجهاز ويفتحه أي قفل بيومتري
 * مسجّل في إعداداته، فتحديد الطريقتين يفعّلهما معًا.
 */
export const BioMethods: React.FC<{ value: BioMethodSet; onChange: (v: BioMethodSet) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const { t } = useTranslation('auth');
  const items = [
    { key: 'finger', Icon: Fingerprint },
    { key: 'face', Icon: ScanFace },
  ] as const;
  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ key, Icon }) => {
          const on = value[key];
          return (
            <button key={key} type="button" role="checkbox" aria-checked={on} disabled={disabled}
              onClick={() => onChange({ ...value, [key]: !on })}
              className={`auth-focus relative min-h-[64px] rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1.5 transition active:scale-[.97] disabled:opacity-60 ${on
                ? 'bg-teal-50 ring-2 ring-teal-500 dark:bg-teal-500/15 dark:ring-teal-400'
                : 'bg-white ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:ring-slate-700 dark:hover:bg-slate-800'}`}>
              <span className={`absolute top-1.5 end-1.5 w-4 h-4 rounded-full flex items-center justify-center ${on ? 'bg-teal-600 text-white' : 'ring-1 ring-slate-300 dark:ring-slate-600'}`}>
                {on && <Check className="w-3 h-3" strokeWidth={3} />}
              </span>
              <Icon className={`w-5 h-5 ${on ? 'text-teal-700 dark:text-teal-300' : 'text-slate-400'}`} />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{t(`bio.${key}`)}</span>
            </button>
          );
        })}
      </div>
      <BioSecureNote />
    </div>
  );
};

/** سطر الأمان تحت أيقونة البصمة */
export const BioSecureNote: React.FC = () => {
  const { t } = useTranslation('auth');
  return (
    <p className="mt-3 inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
      <Lock className="w-3 h-3 shrink-0" /> {t('bio.secureNote')}
    </p>
  );
};

/** إدارة الدخول بالبصمة لهذا الجهاز (من قائمة الحساب): تفعيل في أي وقت أو إيقاف */
export const BiometricSettings: React.FC<{ username: string; onClose: () => void }> = ({ username, onClose }) => {
  const { t, i18n } = useTranslation('auth');
  const [avail, setAvail] = useState<boolean | null>(null);
  const [enabledFor, setEnabledFor] = useState(biometricUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [methods, setMethods] = useBioMethods();
  const { ref: prepared, needPw, setNeedPw } = usePreparedBio(avail === true && !enabledFor);

  useEffect(() => { biometricAvailable().then(setAvail); }, []);
  useEffect(() => {
    // الإغلاق متاح دائمًا، حتى أثناء انتظار البصمة (قد يعلق طلب الجهاز فلا يبقى المستخدم محبوسًا)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (needPw) {
        // بعد كلمة المرور تُجلب بيانات التسجيل؛ إن رفض الجهاز الطلب لتأخره تكفي ضغطة ثانية
        prepared.current = await prepareBiometric(password);
        setNeedPw(false);
        setPassword('');
      }
      await enableBiometric(undefined, prepared.current);
      prepared.current = null;
      saveBioMethod(methods);
      try { localStorage.removeItem(BIO_DECLINED_PREFIX + username.toLowerCase()); } catch { /* تجاهل */ }
      setEnabledFor(biometricUser());
    } catch (e) {
      // مرّت أكثر من 10 دقائق على إدخال كلمة المرور: الخادم يطلبها مجددًا قبل التسجيل
      if (e instanceof AuthError && e.code === 'reauth_required') setNeedPw(true);
      setError(bioErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError('');
    await disableBiometric();
    setEnabledFor('');
    setBusy(false);
  };

  // عبر بوابة إلى body: الرأس فيه تمويه خلفية يحبس العناصر الثابتة داخله
  return createPortal(
    <div dir={i18n.dir()} role="dialog" aria-modal="true" aria-labelledby="bio-settings-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-sm p-0 sm:p-6 auth-fade">
      <div className="relative w-full sm:max-w-md max-h-[100dvh] overflow-y-auto bg-white dark:bg-slate-950 rounded-t-[32px] sm:rounded-[28px] px-6 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center shadow-2xl">
        <button type="button" onClick={onClose} aria-label={t('common:actions.close')}
          className="auth-focus absolute top-4 end-4 w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="w-5 h-5" />
        </button>
        <div className="mx-auto w-16 h-16 rounded-[20px] auth-bio-hero flex items-center justify-center text-white">
          <Fingerprint className="w-8 h-8" />
        </div>
        <h2 id="bio-settings-title" className="mt-5 text-xl font-black text-slate-900 dark:text-white">{t('bio.settingsTitle')}</h2>

        {avail === null ? (
          <div className="flex justify-center py-8"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>
        ) : !avail ? (
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{t('bio.unsupported')}</p>
        ) : enabledFor ? (
          <>
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> {t('bio.enabledHere', { user: enabledFor })}
            </p>
            <button type="button" onClick={disable} disabled={busy}
              className="auth-focus mt-6 w-full h-12 rounded-2xl text-[15px] font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50 dark:ring-rose-500/30 dark:hover:bg-rose-950/40 disabled:opacity-60">
              {t('bio.disable')}
            </button>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-[13px] leading-6 text-slate-500 dark:text-slate-400">{t('bio.text')}</p>
            {needPw && (
              <label className="mt-5 flex items-center gap-2 h-12 px-4 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-teal-500 text-start">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
                  placeholder={t('bio.passwordPrompt')} aria-label={t('fields.password')}
                  onKeyDown={e => { if (e.key === 'Enter' && password) enable(); }}
                  className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400" />
              </label>
            )}
            <BioMethods value={methods} onChange={setMethods} disabled={busy} />
            <button type="button" onClick={enable} disabled={busy || !anyBioMethod(methods) || (needPw && !password)}
              className="auth-btn auth-focus mt-5 w-full h-12 rounded-2xl text-white font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> {t('bio.waiting')}</> : t('bio.enable')}
            </button>
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 flex items-center justify-center gap-2 text-[13px] font-bold text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
};
