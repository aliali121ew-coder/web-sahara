import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, AtSign, ShieldCheck, Settings, X, LayoutGrid, Clock } from 'lucide-react';
import { initials, getSessionStarted, type SessionProfile } from '../../lib/session';
import { useLanguage } from '../../context/LanguageContext';

interface Props {
  profile: SessionProfile | null;
  /** مكان زر الملف الشخصي: البطاقة تصعد من فوقه */
  anchor: DOMRect;
  /** الشريط مطوي: البطاقة تظهر بجانبه بدل فوقه */
  beside: boolean;
  isRtl: boolean;
  /** عدد الأقسام المتاحة للمستخدم */
  sectionsCount: number;
  onOpenProfile: () => void;
  onClose: () => void;
}

const WIDTH = 330;

const sinceText = (started: number, tr: (s: string) => string) => {
  if (!started) return '—';
  const min = Math.max(0, Math.floor((Date.now() - started) / 60000));
  if (min < 60) return `${min} ${tr('د')}`;
  const h = Math.floor(min / 60);
  return `${h} ${tr('س')}${min % 60 ? ` ${min % 60} ${tr('د')}` : ''}`;
};

/** بطاقة الملف الشخصي: غلاف بمنظر جبلي يتلاشى للأبيض، صورة دائرية، الاسم والدور، إحصاءات، وزر رئيسي */
export const ProfileCard: React.FC<Props> = ({ profile, anchor, beside, isRtl, sectionsCount, onOpenProfile, onClose }) => {
  const { tr } = useLanguage();
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = () => {
    setOpen(false);
    setTimeout(onClose, 160);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // الموضع: فوق الزر (القائمة مفتوحة) أو بجانب الشريط المطوي، ومحصور داخل الشاشة
  const vw = window.innerWidth, vh = window.innerHeight;
  const width = Math.min(WIDTH, vw - 16);
  const style: React.CSSProperties = { width };
  if (beside) {
    style.bottom = Math.max(8, vh - anchor.bottom);
    if (isRtl) style.right = vw - anchor.left + 10; else style.left = anchor.right + 10;
  } else {
    style.bottom = vh - anchor.top + 10;
    if (isRtl) style.right = Math.max(8, Math.min(vw - anchor.right, vw - width - 8));
    else style.left = Math.max(8, Math.min(anchor.left, vw - width - 8));
  }

  const role = profile?.role || (profile?.is_admin ? tr('مدير النظام') : tr('مستخدم'));

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70]" onClick={close} aria-hidden="true" />
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        role="dialog"
        aria-label={profile?.name || tr('الملف الشخصي')}
        className="fixed z-[71] rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/70 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.35)] overflow-hidden"
        style={{
          ...style,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.97)',
          opacity: open ? 1 : 0,
          transformOrigin: 'bottom center',
          transition: 'transform 260ms cubic-bezier(0.2, 0.9, 0.25, 1.1), opacity 180ms ease-out',
        }}
      >
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
            aria-label={tr('إغلاق')}
            className={`absolute top-3 ${isRtl ? 'left-3' : 'right-3'} w-8 h-8 rounded-full bg-white/90 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-sm hover:bg-white cursor-pointer`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 -mt-14 relative">
          {/* الصورة الدائرية */}
          <div
            className="w-[76px] h-[76px] rounded-full ring-4 ring-white dark:ring-slate-900 shadow-md overflow-hidden flex items-center justify-center text-white text-2xl font-black relative"
            style={{ background: profile?.color || '#2563eb' }}
          >
            {profile?.avatar ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" /> : initials(profile?.name)}
          </div>

          <div className="mt-2.5 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-lg font-black text-slate-900 dark:text-white truncate">{profile?.name || '—'}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{role}</div>
            </div>
            <span className="shrink-0 mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10.5px] font-black ring-1 ring-emerald-200 dark:ring-emerald-900">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{tr('متصل')}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{tr('صحاري كربلاء')}</span>
            <span className="inline-flex items-center gap-1" dir="ltr"><AtSign className="w-3.5 h-3.5" />{profile?.username || 'user'}</span>
          </div>

          {/* الإحصاءات + الزر */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center divide-x divide-slate-200 dark:divide-slate-700 rtl:divide-x-reverse">
              <div className="pe-3">
                <div className="flex items-center gap-1 text-sm font-black text-slate-900 dark:text-white">
                  {profile?.is_admin ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> : null}
                  {profile?.is_admin ? tr('كامل') : tr('محدد')}
                </div>
                <div className="text-[10.5px] text-slate-400">{tr('الصلاحية')}</div>
              </div>
              <div className="px-3">
                <div className="flex items-center gap-1 text-sm font-black text-slate-900 dark:text-white">
                  <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />{sectionsCount}
                </div>
                <div className="text-[10.5px] text-slate-400">{tr('الأقسام')}</div>
              </div>
              <div className="ps-3">
                <div className="flex items-center gap-1 text-sm font-black text-slate-900 dark:text-white whitespace-nowrap">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />{sinceText(getSessionStarted(), tr)}
                </div>
                <div className="text-[10.5px] text-slate-400">{tr('الجلسة')}</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { onOpenProfile(); close(); }}
            className="mt-4 w-full h-11 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4" />{tr('الملف الشخصي والحساب')}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
};
