import React from 'react';
import { createPortal } from 'react-dom';
import { Fingerprint } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './auth.css';

export type BioPhase = 'scan' | 'success';

/** علامة صح خضراء تُرسم: دائرة ثم الصح (مشتركة بين الوجه والإصبع) */
const SuccessCheck: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className="bio-check" aria-hidden>
    <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" className="bio-check-ring" />
    <path d="M31 52 L45 65 L70 38" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" className="bio-check-mark" />
  </svg>
);

/** رمز مسح الوجه: زوايا الإطار + العينان + الأنف + الابتسامة، يُرسم بخطوط متحركة */
const FaceGlyph: React.FC = () => (
  <svg viewBox="0 0 100 100" width={78} height={78} className="bio-face" aria-hidden>
    <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <path className="bio-face-corner" d="M32 10 H22 A12 12 0 0 0 10 22 V32" />
      <path className="bio-face-corner" d="M68 10 H78 A12 12 0 0 1 90 22 V32" />
      <path className="bio-face-corner" d="M10 68 V78 A12 12 0 0 0 22 90 H32" />
      <path className="bio-face-corner" d="M90 68 V78 A12 12 0 0 1 78 90 H68" />
      <path className="bio-face-part" d="M35 36 V45" />
      <path className="bio-face-part" d="M65 36 V45" />
      <path className="bio-face-part" d="M51 38 V58 H46" />
      <path className="bio-face-part" d="M37 68 Q50 78 63 68" />
    </g>
  </svg>
);

/**
 * حركة التحقق الحيوي أثناء الدخول.
 * - الوجه: لوحة داكنة تنزل من الأعلى (بأسلوب Face ID) ثم علامة صح خضراء
 * - الإصبع: لوحة سفلية مثل «ابدأ الآن» برمز بصمة يُمسح ثم علامة صح خضراء
 * طلب البصمة الفعلي يعرضه النظام نفسه؛ هذه الحركة مرافقة له وتؤكد النجاح.
 */
export const BioAuthOverlay: React.FC<{ kind: 'face' | 'finger'; phase: BioPhase; onCancel: () => void }> = ({ kind, phase, onCancel }) => {
  const { t, i18n } = useTranslation('auth');
  const ok = phase === 'success';

  if (kind === 'face') {
    return createPortal(
      <div dir={i18n.dir()} role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[110] flex justify-center pointer-events-none pt-[max(14px,env(safe-area-inset-top))]">
        <div className="bio-face-hud w-[156px] h-[156px] rounded-[38px] flex flex-col items-center justify-center gap-2.5 text-white">
          <div className="relative w-[78px] h-[78px] flex items-center justify-center">
            {ok ? <SuccessCheck size={78} color="#34c759" /> : <FaceGlyph />}
          </div>
          <span className="text-[13px] font-semibold text-white/85">{ok ? t('bio.verified') : t('bio.faceId')}</span>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div dir={i18n.dir()} className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] auth-fade">
      <div role="status" aria-live="polite"
        className="bio-sheet w-full sm:max-w-md bg-white dark:bg-slate-950 rounded-t-[32px] sm:rounded-[28px] sm:mb-6 px-7 pt-8 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center shadow-2xl">
        <span className="mx-auto mb-6 block w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden />
        <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
          {ok ? (
            <SuccessCheck size={104} color="#16a34a" />
          ) : (
            <>
              <span className="bio-ripple absolute inset-0 rounded-full" aria-hidden />
              <span className="bio-ripple d2 absolute inset-0 rounded-full" aria-hidden />
              <span className="relative w-24 h-24 rounded-full bg-teal-50 dark:bg-teal-500/10 ring-1 ring-teal-200 dark:ring-teal-500/30 flex items-center justify-center overflow-hidden">
                <Fingerprint className="bio-fp w-14 h-14 text-teal-700 dark:text-teal-300" strokeWidth={1.6} />
                <span className="bio-scanline absolute inset-x-3 h-[3px] rounded-full" aria-hidden />
              </span>
            </>
          )}
        </div>
        <p className={`mt-5 text-[17px] font-black ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
          {ok ? t('bio.verified') : t('bio.touchSensor')}
        </p>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{ok ? t('bio.signingIn') : t('bio.touchHint')}</p>
        {!ok && (
          <button type="button" onClick={onCancel}
            className="auth-focus mt-6 w-full h-12 rounded-2xl text-[15px] font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900">
            {t('common:actions.cancel')}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
};
