import React, { useMemo, useState } from 'react';
import { UserRound, KeyRound, ShieldCheck, ClipboardCheck, Check, ArrowLeft, ArrowRight, RefreshCw, Eye, EyeOff, Crown, Loader2, AtSign, Briefcase, AlertCircle, CheckCircle2 } from 'lucide-react';
import { chatApi } from '../chat/chatApi';
import { PERM_GROUPS, ALL_SECTIONS, type Perms } from '../../lib/permCatalog';
import { PermissionsEditor } from './PermissionsEditor';
import { AvatarPicker, CopyButton, SCORE_LABEL, SCORE_TONE, UserAvatar, btnCls, cardCls, genPassword, inputCls, passwordScore } from './adminUi';

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const ROLE_SUGGESTIONS = ['محاسب', 'مسؤول خزانات', 'مشرف موقع', 'مدخل بيانات', 'مراقب', 'مدير فرع'];

const STEPS = [
  { id: 'identity', label: 'الهوية', hint: 'الاسم واسم المستخدم', icon: UserRound },
  { id: 'security', label: 'الدخول', hint: 'كلمة المرور والدور', icon: KeyRound },
  { id: 'perms', label: 'الصلاحيات', hint: 'الأقسام المسموحة', icon: ShieldCheck },
  { id: 'review', label: 'المراجعة', hint: 'تأكيد وإنشاء', icon: ClipboardCheck },
] as const;

const Field: React.FC<{ label: string; required?: boolean; hint?: React.ReactNode; error?: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }> = ({ label, required, hint, error, icon: Icon, children }) => (
  <label className="block">
    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
      {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}{label}{required && <span className="text-rose-500">*</span>}
    </span>
    {children}
    {error ? <span className="flex items-center gap-1 text-[11px] font-bold text-rose-500 mt-1.5"><AlertCircle className="w-3.5 h-3.5" />{error}</span>
      : hint ? <span className="block text-[11px] text-slate-400 mt-1.5">{hint}</span> : null}
  </label>
);

export interface WizardResult { name: string; username: string; password: string }

/** إنشاء حساب على خطوات: الهوية ← الدخول ← الصلاحيات ← المراجعة، مع معاينة حيّة للحساب */
export const CreateAccountWizard: React.FC<{
  prefill?: { name?: string; username?: string };
  takenUsernames: string[];
  onCreated: (r: WizardResult) => void;
}> = ({ prefill, takenUsernames, onCreated }) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(prefill?.name || '');
  const [username, setUsername] = useState((prefill?.username || '').toLowerCase().replace(/[^a-z0-9._-]/g, ''));
  const [role, setRole] = useState('');
  const [avatar, setAvatar] = useState('');
  const [password, setPassword] = useState(() => genPassword());
  const [showPw, setShowPw] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [perms, setPerms] = useState<Perms>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const taken = useMemo(() => new Set(takenUsernames.map(u => u.toLowerCase())), [takenUsernames]);
  const usernameError = !username ? 'اسم المستخدم مطلوب'
    : !USERNAME_RE.test(username) ? '3–32 حرفًا إنجليزيًا صغيرًا أو أرقامًا أو . _ -'
      : taken.has(username) ? 'اسم المستخدم مستخدم مسبقًا' : '';
  const nameError = name.trim() ? '' : 'الاسم مطلوب';
  const pwError = password.length < 8 ? 'كلمة المرور 8 أحرف على الأقل' : '';
  const score = passwordScore(password);

  const stepErrors = [nameError || usernameError, pwError, '', ''];
  const canGo = (i: number) => stepErrors.slice(0, i).every(e => !e);

  const suggestUsername = () => {
    // اقتراح من الاسم العربي غير ممكن حرفيًا؛ نقترح من الوظيفة أو رقمًا متسلسلًا
    const base = 'user';
    let n = takenUsernames.length + 1;
    while (taken.has(`${base}${n}`)) n++;
    setUsername(`${base}${n}`);
  };

  const next = () => {
    setTouched(true);
    if (stepErrors[step]) return;
    setTouched(false);
    setStep(s => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => setStep(s => Math.max(0, s - 1));

  const submit = async () => {
    setError('');
    if (!canGo(STEPS.length)) return;
    setBusy(true);
    try {
      await chatApi.adminCreate({ username, password, name: name.trim(), role: role.trim(), is_admin: isAdmin, perms, ...(avatar ? { avatar } : {}) });
      onCreated({ name: name.trim(), username, password });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const granted = isAdmin ? ALL_SECTIONS.length : Object.keys(perms).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
      <div className={`${cardCls} overflow-hidden`}>
        {/* شريط الخطوات */}
        <ol className="grid grid-cols-4 border-b border-slate-100 dark:border-slate-800">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const on = i === step;
            return (
              <li key={s.id}>
                <button type="button" disabled={!canGo(i)} onClick={() => setStep(i)}
                  className={`w-full flex flex-col sm:flex-row items-center gap-2 px-2 sm:px-4 py-3.5 text-center sm:text-right transition relative ${on ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'} disabled:cursor-not-allowed`}>
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${done ? 'bg-emerald-500 text-white' : on ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-xs font-extrabold ${on ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>{s.label}</span>
                    <span className="hidden md:block text-[10px] text-slate-400 truncate">{s.hint}</span>
                  </span>
                  {on && <span className="absolute bottom-0 inset-x-3 h-0.5 rounded-full bg-blue-600" />}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="p-5 sm:p-6 min-h-[340px]">
          {step === 0 && (
            <div key="s0" className="swipe-in-next space-y-5">
              <StepTitle title="من هو صاحب الحساب؟" desc="الاسم يظهر لزملائه في المحادثة والتقارير، واسم المستخدم يُستخدم لتسجيل الدخول ولا يمكن تغييره لاحقًا." />
              <AvatarPicker value={avatar} name={name} onChange={setAvatar} />
              <Field label="الاسم الكامل" required icon={UserRound} error={touched ? nameError : ''}>
                <input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={60} className={inputCls} placeholder="مثال: علي حسين الكربلائي" />
              </Field>
              <Field label="اسم المستخدم" required icon={AtSign} error={(touched || username) ? usernameError : ''}
                hint={username && !usernameError
                  ? <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> اسم المستخدم متاح</span>
                  : 'حروف إنجليزية صغيرة وأرقام و . _ - فقط'}>
                <div className="relative">
                  <input dir="ltr" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                    maxLength={32} className={`${inputCls} pl-24 font-mono`} placeholder="ali.hussein" autoCapitalize="none" spellCheck={false} />
                  <button type="button" onClick={suggestUsername} className="absolute left-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600">
                    اقتراح
                  </button>
                </div>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div key="s1" className="swipe-in-next space-y-5">
              <StepTitle title="بيانات الدخول والدور" desc="ولّدنا كلمة مرور قوية تلقائيًا. سلّمها للموظف بعد الإنشاء ويستطيع تغييرها من «حسابي»." />
              <Field label="كلمة المرور" required icon={KeyRound} error={touched ? pwError : ''}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input dir="ltr" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} maxLength={128} className={`${inputCls} font-mono tracking-wide pl-20`} />
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex gap-0.5">
                      <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'إخفاء' : 'إظهار'} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <CopyButton text={password} className="w-8 h-8 text-slate-400 hover:text-slate-700 dark:hover:text-white" />
                    </div>
                  </div>
                  <button type="button" onClick={() => setPassword(genPassword())} title="توليد كلمة مرور جديدة" className={`${btnCls} px-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}>
                    <RefreshCw className="w-4 h-4" /><span className="hidden sm:inline">توليد</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map(i => <span key={i} className={`h-1.5 rounded-full ${score >= i ? SCORE_TONE[score] : 'bg-slate-200 dark:bg-slate-700'}`} />)}
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 w-20 text-left">{SCORE_LABEL[score]}</span>
                </div>
              </Field>
              <Field label="الوظيفة" icon={Briefcase} hint="تظهر بجانب الاسم في قائمة المستخدمين والمحادثة">
                <input value={role} onChange={e => setRole(e.target.value)} maxLength={60} className={inputCls} placeholder="اختر من المقترحات أو اكتب وظيفة" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {ROLE_SUGGESTIONS.map(r => (
                    <button key={r} type="button" onClick={() => setRole(r)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${role === r ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </Field>
              <button type="button" onClick={() => setIsAdmin(v => !v)} aria-pressed={isAdmin}
                className={`w-full flex items-start gap-3 p-4 rounded-2xl border-2 text-right transition ${isAdmin ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-800 hover:border-amber-200'}`}>
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isAdmin ? 'bg-amber-500 text-white' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-600'}`}><Crown className="w-5 h-5" /></span>
                <span className="flex-1">
                  <span className="block text-sm font-extrabold text-slate-900 dark:text-white">مدير النظام</span>
                  <span className="block text-xs text-slate-500 mt-0.5">كل الصلاحيات على كل الأقسام، مع إدارة المستخدمين وسجل العمليات. امنحها بحذر.</span>
                </span>
                <span className={`w-11 h-6 rounded-full p-0.5 transition shrink-0 mt-2 ${isAdmin ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                  <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${isAdmin ? '-translate-x-5' : ''}`} />
                </span>
              </button>
            </div>
          )}

          {step === 2 && (
            <div key="s2" className="swipe-in-next space-y-4">
              <StepTitle title="ماذا يستطيع أن يرى ويعدّل؟" desc={isAdmin ? 'مدير النظام يملك كل الصلاحيات تلقائيًا، فلا حاجة لتحديدها.' : 'ابدأ بقالب جاهز ثم عدّل ما تحتاجه. الأقسام غير المفعّلة لا تظهر له ولا تصله بياناتها أصلًا.'} />
              <PermissionsEditor value={perms} onChange={setPerms} disabled={isAdmin} />
            </div>
          )}

          {step === 3 && (
            <div key="s3" className="swipe-in-next space-y-4">
              <StepTitle title="راجع قبل الإنشاء" desc="تأكد من البيانات. بعد الإنشاء تظهر بيانات الدخول مرة واحدة لتسليمها." />
              <dl className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                <ReviewRow label="الاسم" value={<span className="flex items-center gap-2"><UserAvatar name={name} src={avatar} size={28} className="!rounded-lg" />{name}</span>} onEdit={() => setStep(0)} />
                <ReviewRow label="اسم المستخدم" value={<span dir="ltr" className="font-mono">@{username}</span>} onEdit={() => setStep(0)} />
                <ReviewRow label="الوظيفة" value={role || <span className="text-slate-400">—</span>} onEdit={() => setStep(1)} />
                <ReviewRow label="الدور" value={isAdmin ? <span className="inline-flex items-center gap-1 text-amber-600 font-bold"><Crown className="w-3.5 h-3.5" />مدير النظام</span> : 'مستخدم'} onEdit={() => setStep(1)} />
                <ReviewRow label="الصلاحيات" value={isAdmin ? 'كل الأقسام' : granted ? `${granted} قسم` : <span className="text-rose-500 font-bold">بدون صلاحيات (لن يرى أي قسم)</span>} onEdit={() => setStep(2)} />
              </dl>
              {!isAdmin && granted > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {PERM_GROUPS.flatMap(g => g.sections.filter(s => perms[s.id]).map(s => (
                    <span key={s.id} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${perms[s.id] === 2 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'}`}>
                      {g.id === 'pages' ? '' : `${g.label} · `}{s.label} · {perms[s.id] === 2 ? 'تعديل' : 'عرض'}
                    </span>
                  )))}
                </div>
              )}
              {error && <p className="flex items-center gap-1.5 text-sm font-bold text-rose-500"><AlertCircle className="w-4 h-4" />{error}</p>}
            </div>
          )}
        </div>

        {/* أزرار التنقل */}
        <div className="flex items-center gap-2 px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
          <span className="text-[11px] font-bold text-slate-400">الخطوة {step + 1} من {STEPS.length}</span>
          <div className="mr-auto flex gap-2">
            {step > 0 && (
              <button type="button" onClick={back} className={`${btnCls} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200`}>
                <ArrowRight className="w-4 h-4" /> السابق
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next} className={`${btnCls} bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 min-w-28`}>
                التالي <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={busy} className={`${btnCls} bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/25 min-w-36`}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} إنشاء الحساب
              </button>
            )}
          </div>
        </div>
      </div>

      {/* معاينة حيّة */}
      <aside className="lg:sticky lg:top-20 space-y-3">
        <div className={`${cardCls} overflow-hidden`}>
          <div className="h-16 bg-gradient-to-l from-violet-600 via-indigo-600 to-blue-600" />
          <div className="px-5 pb-5 -mt-8">
            <UserAvatar name={name || '؟'} src={avatar} size={64} className="ring-4 ring-white dark:ring-slate-900" />
            <div className="mt-3 flex items-center gap-1.5">
              <span className="font-black text-base text-slate-900 dark:text-white truncate">{name || 'اسم الموظف'}</span>
              {isAdmin && <Crown className="w-4 h-4 text-amber-500" />}
            </div>
            <div className="text-xs text-slate-500 truncate"><span dir="ltr" className="font-mono">@{username || 'username'}</span>{role ? ` · ${role}` : ''}</div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">الأقسام المسموحة</span>
                <b className="text-slate-900 dark:text-white tabular-nums">{granted} / {ALL_SECTIONS.length}</b>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-sky-500 transition-all" style={{ width: `${(granted / ALL_SECTIONS.length) * 100}%` }} />
              </div>
              {PERM_GROUPS.map(g => {
                const n = isAdmin ? g.sections.length : g.sections.filter(s => perms[s.id]).length;
                return (
                  <div key={g.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">{g.label}</span>
                    <span className={`font-bold ${n ? 'text-emerald-600' : 'text-slate-400'}`}>{n ? `${n} قسم` : '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed px-1">المعاينة تتحدث أثناء الكتابة. الحساب يبدأ نشطًا ويستطيع الدخول فور إنشائه.</p>
      </aside>
    </div>
  );
};

const StepTitle: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
  <div>
    <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{title}</h4>
    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
  </div>
);

const ReviewRow: React.FC<{ label: string; value: React.ReactNode; onEdit: () => void }> = ({ label, value, onEdit }) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <dt className="w-28 shrink-0 text-slate-500 text-xs font-bold">{label}</dt>
    <dd className="flex-1 min-w-0 font-bold text-slate-900 dark:text-white truncate">{value}</dd>
    <button type="button" onClick={onEdit} className="text-[11px] font-bold text-blue-600 hover:underline">تعديل</button>
  </div>
);
