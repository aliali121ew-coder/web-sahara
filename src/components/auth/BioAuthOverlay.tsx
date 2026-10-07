import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './auth.css';

/** verify = مشهد التعرّف (بعد موافقة نافذة النظام) ، success = علامة الصح الخضراء */
export type BioPhase = 'verify' | 'success';

/** علامة صح خضراء تُرسم: دائرة ثم الصح (مشتركة بين الوجه والإصبع) */
const SuccessCheck: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className="bio-check" aria-hidden>
    <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" className="bio-check-ring" />
    <path d="M31 52 L45 65 L70 38" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" className="bio-check-mark" />
  </svg>
);

/**
 * رمز التعرّف على الوجه: زوايا الإطار + العينان + الأنف + الابتسامة.
 * الزوايا تُرسم ثم تنبض، وملامح الوجه تلتفت يمينًا ويسارًا كأن الكاميرا تتتبّع الوجه
 */
const FaceGlyph: React.FC<{ leaving: boolean }> = ({ leaving }) => (
  <svg viewBox="0 0 100 100" width={78} height={78} className={`bio-face ${leaving ? 'bio-face-out' : ''}`} aria-hidden>
    <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <g className="bio-face-frame">
        <path className="bio-face-corner" d="M32 10 H22 A12 12 0 0 0 10 22 V32" />
        <path className="bio-face-corner" d="M68 10 H78 A12 12 0 0 1 90 22 V32" />
        <path className="bio-face-corner" d="M10 68 V78 A12 12 0 0 0 22 90 H32" />
        <path className="bio-face-corner" d="M90 68 V78 A12 12 0 0 1 78 90 H68" />
      </g>
      <g className="bio-face-features">
        <path className="bio-face-part" d="M35 36 V45" />
        <path className="bio-face-part" d="M65 36 V45" />
        <path className="bio-face-part" d="M51 38 V58 H46" />
        <path className="bio-face-part" d="M37 68 Q50 78 63 68" />
      </g>
    </g>
  </svg>
);

/**
 * بصمة إصبع واقعية: خطوط جلد متداخلة (نمط دوّامة) تُرسم تباعًا، وخط مسح مضيء يمرّ عليها
 * فيلوّنها (قناع يتحرك مع الخط)
 */
const RIDGES = [
  'M12 30 A21 23 0 0 1 52 27',
  'M52 34 C52 43 49 50 45 56',
  'M12 36 C12 44 14 50 18 55',
  'M17 33 A15 16 0 0 1 47 30',
  'M47 37 C47 45 44 51 40 57',
  'M17 39 C17 47 20 53 24 58',
  'M22 35 A10 11 0 0 1 42 32',
  'M42 39 C42 46 40 52 36 58',
  'M22 41 C22 47 24 52 27 56',
  'M27 37 A5 6 0 0 1 37 35',
  'M37 41 C37 47 35 53 32 58',
  'M32 40 C32 46 31 51 29 55',
  'M24 14 C27 12.8 30 12.4 32 12.4 C40 12.4 47 16 51 22',
  'M9 25 C10 22.5 11.5 20 13.5 18',
];
const FingerprintRidges: React.FC<{ leaving: boolean }> = ({ leaving }) => (
  <svg viewBox="0 0 64 64" width={50} height={50} className={`bio-print ${leaving ? 'bio-print-out' : ''}`} aria-hidden>
    <defs>
      {/* القناع يتحرك من الأعلى للأسفل مع خط المسح: ما مرّ عليه يُلوَّن */}
      <linearGradient id="bio-scan-mask" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" />
        <stop offset="1" stopColor="#fff" />
      </linearGradient>
      <mask id="bio-scanned">
        <rect className="bio-print-reveal" x="0" y="0" width="64" height="64" fill="url(#bio-scan-mask)" />
      </mask>
    </defs>
    {/* الخطوط الرمادية (قبل المسح) */}
    <g fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" className="text-slate-300 dark:text-slate-600">
      {RIDGES.map((d, i) => <path key={i} d={d} className="bio-ridge" style={{ animationDelay: `${i * 45}ms` }} />)}
    </g>
    {/* الخطوط الملوّنة (بعد مرور خط المسح) */}
    <g fill="none" stroke="#0d9488" strokeWidth="2.1" strokeLinecap="round" mask="url(#bio-scanned)">
      {RIDGES.map((d, i) => <path key={i} d={d} />)}
    </g>
  </svg>
);

/**
 * مشهد التحقق الحيوي بعد موافقة نافذة النظام (لا يتراكب معها):
 * - الوجه: لوحة داكنة تنزل من الأعلى، الوجه يُرسم ويلتفت، ثم تنطوي الزوايا إلى دائرة خضراء وعلامة صح
 * - الإصبع: لوحة سفلية ببصمة واقعية تُرسم ويمسحها خط مضيء، ثم علامة صح خضراء
 */
export const BioAuthOverlay: React.FC<{ kind: 'face' | 'finger'; phase: BioPhase }> = ({ kind, phase }) => {
  const { t, i18n } = useTranslation('auth');
  const ok = phase === 'success';

  if (kind === 'face') {
    return createPortal(
      <div dir={i18n.dir()} role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[110] flex justify-center pointer-events-none pt-[max(14px,env(safe-area-inset-top))]">
        <div className="bio-face-hud w-[156px] h-[156px] rounded-[38px] flex flex-col items-center justify-center gap-2.5 text-white">
          <div className="relative w-[78px] h-[78px] flex items-center justify-center">
            <FaceGlyph leaving={ok} />
            {ok && <span className="absolute inset-0 flex items-center justify-center"><SuccessCheck size={78} color="#34c759" /></span>}
          </div>
          <span className="text-[13px] font-semibold text-white/85">{ok ? t('bio.verified') : t('bio.faceId')}</span>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div dir={i18n.dir()} className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/40 backdrop-blur-[2px] auth-fade">
      <div role="status" aria-live="polite"
        className="bio-sheet w-full sm:max-w-sm bg-white dark:bg-slate-950 rounded-t-[30px] sm:rounded-[26px] sm:mb-6 px-7 pt-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center shadow-2xl">
        <span className="mx-auto mb-5 block w-10 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden />
        <div className="relative mx-auto w-[84px] h-[84px] flex items-center justify-center">
          <span className={`bio-print-pad absolute inset-0 rounded-[26px] ${ok ? 'bio-print-pad-ok' : ''}`} aria-hidden />
          {!ok && <span className="bio-scanline absolute inset-x-3 h-[2px] rounded-full" aria-hidden />}
          <span className="relative"><FingerprintRidges leaving={ok} /></span>
          {ok && <span className="absolute inset-0 flex items-center justify-center"><SuccessCheck size={70} color="#16a34a" /></span>}
        </div>
        <p className={`mt-4 text-[16px] font-black ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
          {ok ? t('bio.verified') : t('bio.matching')}
        </p>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{ok ? t('bio.signingIn') : t('bio.touchHint')}</p>
      </div>
    </div>,
    document.body,
  );
};
