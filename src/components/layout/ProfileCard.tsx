import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, AtSign, ShieldCheck, Settings, X, LayoutGrid, Clock, Camera, PenLine, Check, Loader2, Trash2 } from 'lucide-react';
import { resizeAvatar } from '../admin/adminUi';
import { initials, getSessionStarted, type SessionProfile } from '../../lib/session';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useConnection } from '../../lib/useConnection';

type CardProfile = Pick<SessionProfile, 'name' | 'username' | 'role' | 'avatar' | 'color' | 'is_admin'>;

interface Props {
  profile: CardProfile | null;
  /** مكان الزر: البطاقة تصعد من فوقه. بدونه تظهر وسط الشاشة */
  anchor?: DOMRect | null;
  /** الشريط مطوي: البطاقة تظهر بجانبه بدل فوقه */
  beside?: boolean;
  /** ملاصقة للعنصر (زر العين): يمينه أو يساره حسب المساحة، وتبدأ من مستواه */
  nextTo?: boolean;
  isRtl: boolean;
  /** عدد الأقسام المتاحة للمستخدم (null = كل الأقسام) */
  sectionsCount: number | null;
  /** شارة الحالة (الافتراضي: متصل) */
  status?: { label: string; on: boolean };
  /** الإحصاء الثالث (الافتراضي: مدة الجلسة الحالية) */
  lastStat?: { label: string; value: string };
  actionLabel?: string;
  /** حسابي: يسمح بتغيير الاسم والصورة فقط من داخل البطاقة */
  onSaveSelf?: (v: { name: string; avatar: string }) => Promise<void>;
  onOpenProfile: () => void;
  onClose: () => void;
}

const WIDTH = 330;
const EST_HEIGHT = 410;

const sinceText = (started: number, t: TFunction) => {
  if (!started) return '—';
  const min = Math.max(0, Math.floor((Date.now() - started) / 60000));
  if (min < 60) return t('common:time.minutesShort', { count: min });
  const h = Math.floor(min / 60);
  return min % 60 ? t('common:time.hoursMinutesShort', { h, m: min % 60 }) : t('common:time.hoursShort', { count: h });
};

/** بطاقة الملف الشخصي: غلاف بمنظر جبلي يتلاشى للأبيض، صورة دائرية، الاسم والدور، إحصاءات، وزر رئيسي */
export const ProfileCard: React.FC<Props> = ({ profile, anchor, beside, nextTo, isRtl, sectionsCount, status, lastStat, actionLabel, onSaveSelf, onOpenProfile, onClose }) => {
  const { t } = useTranslation(['nav', 'common']);
  const online = useConnection();
  const [open, setOpen] = useState(false);
  // تعديل الاسم والصورة (حسابي فقط)
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(profile?.name || '');
  const [draftAvatar, setDraftAvatar] = useState(profile?.avatar || '');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const startEdit = () => { setDraftName(profile?.name || ''); setDraftAvatar(profile?.avatar || ''); setEditError(''); setEditing(true); };
  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setEditError('');
    try { setDraftAvatar(await resizeAvatar(file)); } catch (e) { setEditError((e as Error).message); }
  };
  const saveSelf = async () => {
    if (!onSaveSelf) return;
    if (!draftName.trim()) return setEditError(t('nav:profile.nameRequired'));
    setSaving(true);
    setEditError('');
    try {
      await onSaveSelf({ name: draftName.trim(), avatar: draftAvatar });
      setEditing(false);
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = () => {
    setOpen(false);
    setTimeout(onClose, 160);
  };

  const editingRef = useRef(false);
  editingRef.current = editing;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); if (editingRef.current) setEditing(false); else close(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // الموضع: فوق الزر (القائمة مفتوحة) أو بجانب الشريط المطوي، ومحصور داخل الشاشة
  const vw = window.innerWidth, vh = window.innerHeight;
  const width = Math.min(WIDTH, vw - 16);
  const style: React.CSSProperties = { width };
  if (!anchor) {
    style.top = '50%';
    style.left = `calc(50% - ${width / 2}px)`;
    style.marginTop = -200;
  } else if (nextTo) {
    const gap = 8;
    const spaceLeft = anchor.left - gap, spaceRight = vw - anchor.right - gap;
    // يمين/يسار الصف حسب المساحة الأكبر، وإن لم تكفِ أيٌّ منهما يغطي طرف الصف
    if (spaceLeft >= width || spaceLeft >= spaceRight) style.left = Math.max(8, anchor.left - gap - width);
    else style.left = Math.min(vw - width - 8, anchor.right + gap);
    style.top = Math.min(Math.max(8, anchor.top - 24), Math.max(8, vh - EST_HEIGHT - 8));
  } else if (beside) {
    style.bottom = Math.max(8, vh - anchor.bottom);
    if (isRtl) style.right = vw - anchor.left + 10; else style.left = anchor.right + 10;
  } else {
    style.bottom = vh - anchor.top + 10;
    if (isRtl) style.right = Math.max(8, Math.min(vw - anchor.right, vw - width - 8));
    else style.left = Math.max(8, Math.min(anchor.left, vw - width - 8));
  }

  const role = profile?.role || (profile?.is_admin ? t('nav:profile.admin') : t('nav:profile.user'));

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[70] bg-slate-900/25 dark:bg-black/50 backdrop-blur-[6px] backdrop-saturate-150 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={close}
        aria-hidden="true"
      />
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        role="dialog"
        aria-label={profile?.name || t('nav:profile.title')}
        className="fixed z-[71] rounded-[26px] isolate"
        style={{
          ...style,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.97)',
          opacity: open ? 1 : 0,
          transformOrigin: nextTo ? (style.left !== undefined && Number(style.left) < anchor!.left ? 'top right' : 'top left') : 'bottom center',
          transition: 'transform 260ms cubic-bezier(0.2, 0.9, 0.25, 1.1), opacity 180ms ease-out',
        }}
      >
        {/* توهّج ناعم بلون المستخدم خلف البطاقة */}
        <div
          aria-hidden="true"
          className="absolute -inset-5 -z-10 rounded-[40px] blur-2xl opacity-60 dark:opacity-45 pointer-events-none"
          style={{ background: `radial-gradient(60% 55% at 50% 30%, ${profile?.color || '#2563eb'}55, transparent 70%), radial-gradient(70% 60% at 50% 100%, rgba(15,23,42,0.35), transparent 70%)` }}
        />
        {/* إطار متدرّج رقيق + ظل متعدد الطبقات */}
        <div
          className="relative rounded-[26px] p-px bg-gradient-to-b from-white via-slate-200/80 to-slate-300/70 dark:from-slate-600/80 dark:via-slate-700/60 dark:to-slate-800"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.06), 0 8px 16px -4px rgba(15,23,42,0.10), 0 24px 48px -12px rgba(15,23,42,0.28), 0 48px 96px -24px rgba(15,23,42,0.30)' }}
        >
        <div className="relative rounded-[25px] bg-white dark:bg-slate-900 overflow-hidden">
          {/* لمعة خفيفة أعلى البطاقة */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80 z-10" />
        {/* الغلاف: سماء وجبال بطبقات، تتلاشى للأبيض من الأسفل */}
        <div className="relative h-[150px]">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 330 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="pc-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#b9c7c4" />
                <stop offset="1" stopColor="#e6ece9" />
              </linearGradient>
            </defs>
            <rect width="330" height="150" fill="url(#pc-sky)" />
            <path d="M0 92 L48 58 L82 74 L130 30 L172 70 L214 44 L262 78 L300 52 L330 66 V150 H0Z" fill="#9fb3a8" opacity="0.55" />
            <path d="M0 104 L40 84 L92 98 L150 62 L196 92 L238 72 L290 96 L330 84 V150 H0Z" fill="#6f8f7c" opacity="0.7" />
            <path d="M0 122 L60 100 L118 116 L176 92 L230 114 L282 100 L330 112 V150 H0Z" fill="#4c6f5b" opacity="0.8" />
          </svg>
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-white dark:to-slate-900" />
          <button
            type="button"
            onClick={close}
            aria-label={t('common:actions.close')}
            className={`absolute top-3 ${isRtl ? 'left-3' : 'right-3'} w-8 h-8 rounded-full bg-white/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-sm hover:bg-white cursor-pointer`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 -mt-14 relative">
          {/* الصورة الدائرية */}
          {(() => {
            const shownAvatar = editing ? draftAvatar : profile?.avatar;
            const shownName = editing ? draftName : profile?.name;
            const face = shownAvatar ? <img src={shownAvatar} alt="" className="w-full h-full object-cover" /> : initials(shownName);
            const cls = 'w-[76px] h-[76px] rounded-full ring-4 ring-white dark:ring-slate-900 shadow-md overflow-hidden flex items-center justify-center text-white text-2xl font-black relative';
            if (!editing) return <div className={cls} style={{ background: profile?.color || '#2563eb' }}>{face}</div>;
            return (
              <div className="flex items-end gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} aria-label={t('nav:profile.changePhoto')} className={`${cls} group cursor-pointer`} style={{ background: profile?.color || '#2563eb' }}>
                  {face}
                  <span className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-90 group-hover:opacity-100 transition">
                    <Camera className="w-6 h-6 text-white" />
                  </span>
                </button>
                {draftAvatar && (
                  <button type="button" onClick={() => setDraftAvatar('')} className="mb-1 inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />{t('nav:profile.removePhoto')}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
            );
          })()}

          <div className="mt-2.5 flex items-start justify-between gap-2">
            <div className="min-w-0">
              {editing ? (
                <input
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveSelf(); }}
                  maxLength={60}
                  autoFocus
                  aria-label={t('nav:profile.name')}
                  className="w-full h-10 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 bg-white dark:bg-slate-900 text-base font-black text-slate-900 dark:text-white outline-none"
                />
              ) : (
                <div className="text-lg font-black text-slate-900 dark:text-white truncate">{profile?.name || '—'}</div>
              )}
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{role}</div>
            </div>
            {(() => {
              const st = status ?? (online ? { label: t('common:status.online'), on: true } : { label: t('common:status.offline'), on: false });
              return (
                <span className={`shrink-0 mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-black ring-1 ${st.on ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-900' : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-900'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.on ? 'bg-emerald-500' : 'bg-rose-500'}`} />{st.label}
                </span>
              );
            })()}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{t('common:brand.company')}</span>
            <span className="inline-flex items-center gap-1" dir="ltr"><AtSign className="w-3.5 h-3.5" />{profile?.username || 'user'}</span>
          </div>

          {/* الإحصاءات + الزر */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 flex items-stretch divide-x divide-slate-200 dark:divide-slate-700 rtl:divide-x-reverse">
              <div className="pe-3">
                <div className="flex items-center gap-1 text-sm font-black text-slate-900 dark:text-white">
                  {profile?.is_admin ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> : null}
                  {profile?.is_admin ? t('nav:profile.permissionFull') : t('nav:profile.permissionLimited')}
                </div>
                <div className="text-[10.5px] text-slate-400">{t('nav:profile.permission')}</div>
              </div>
              <div className="px-3">
                <div className="flex items-center gap-1 text-sm font-black text-slate-900 dark:text-white">
                  <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />{sectionsCount === null ? t('nav:profile.sectionsAll') : sectionsCount}
                </div>
                <div className="text-[10.5px] text-slate-400">{t('nav:profile.sections')}</div>
              </div>
              <div className="ps-3 min-w-0 flex-1">
                <div className="flex items-start gap-1 text-sm font-black text-slate-900 dark:text-white leading-tight">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />{lastStat ? lastStat.value : sinceText(getSessionStarted(), t)}
                </div>
                <div className="text-[10.5px] text-slate-400">{lastStat ? lastStat.label : t('nav:profile.session')}</div>
              </div>
            </div>
          </div>

          {editing ? (
            <>
              {editError && <p className="mt-3 text-xs font-bold text-rose-600">{editError}</p>}
              <div className="mt-4 flex items-center gap-2">
                <button type="button" onClick={() => setEditing(false)} disabled={saving} className="h-11 px-5 rounded-full text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  {t('common:actions.cancel')}
                </button>
                <button type="button" onClick={saveSelf} disabled={saving} className="flex-1 h-11 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-60 cursor-pointer">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{t('common:actions.save')}
                </button>
              </div>
            </>
          ) : (
          <button
            type="button"
            onClick={() => { if (onSaveSelf) { startEdit(); return; } onOpenProfile(); close(); }}
            className="mt-4 w-full h-11 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer"
          >
            {onSaveSelf ? <PenLine className="w-4 h-4" /> : <Settings className="w-4 h-4" />}{onSaveSelf ? t('nav:profile.updateInfo') : actionLabel ?? t('nav:profile.accountSettings')}
          </button>
          )}
        </div>
        </div>
        </div>
      </div>
    </>,
    document.body
  );
};
