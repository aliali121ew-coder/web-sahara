import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { applyAppUpdate, useAppUpdateAvailable } from '../../lib/appUpdate';

const MOBILE_QUERY = '(max-width: 767px)';
const COUNTDOWN_SECONDS = 10;

/** حقل كتابة نشط: لا يُحدَّث التطبيق تلقائيًا حتى لا يضيع ما يُكتب */
const typing = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

/**
 * تحديث البرنامج بعد نشر نسخة جديدة:
 * - الحاسبة: زر «تحديث» في الشريط العلوي يعدّ 10 ثوانٍ ثم يُحدِّث تلقائيًا، وبضغطه تُحدَّث الصفحة فورًا
 * - الهاتف: نافذة «سيتم تحديث البرنامج خلال 10 ثوانٍ» ثم تحديث تلقائي
 *   (العد يتوقف والتطبيق في الخلفية أو أثناء الكتابة في حقل، ويكمل بعدها)
 */
export const AppUpdateButton: React.FC = () => {
  const { t } = useTranslation('common');
  const available = useAppUpdateAvailable();
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [left, setLeft] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    if (!available) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || typing()) return;
      setLeft(s => {
        if (s <= 1) {
          window.clearInterval(id);
          applyAppUpdate();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [available]);

  if (!available) return null;

  return (
    <>
      <button
        onClick={applyAppUpdate}
        title={`${t('appUpdate.available')} — ${t('appUpdate.mobileBody', { count: left })}`}
        aria-label={`${t('appUpdate.available')} — ${t('appUpdate.mobileBody', { count: left })}`}
        className="relative inline-flex items-center justify-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl text-white bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 shadow-md shadow-emerald-500/25 transition-all active:scale-95 whitespace-nowrap"
      >
        <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
        <RefreshCw className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline text-[12.5px] font-black">{t('appUpdate.button')}</span>
        {!mobile && (
          <span className="min-w-[22px] h-[22px] px-1 rounded-full bg-white/25 text-[11.5px] font-black font-mono tabular-nums leading-[22px] text-center">{left}</span>
        )}
      </button>

      {mobile && (
        <div className="fixed inset-x-3 bottom-4 z-[60] rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur p-3.5 flex items-center gap-3" role="status" aria-live="polite">
          <div className="relative w-11 h-11 shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <RefreshCw className="absolute w-11 h-11 p-2.5 text-emerald-300 animate-spin [animation-duration:2.5s]" />
            <span className="relative text-sm font-black font-mono tabular-nums">{left}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black leading-tight">{t('appUpdate.mobileTitle')}</div>
            <div className="text-[11.5px] text-slate-300 mt-0.5">{t('appUpdate.mobileBody', { count: left })}</div>
          </div>
          <button
            onClick={applyAppUpdate}
            className="shrink-0 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black active:scale-95 transition"
          >
            {t('appUpdate.now')}
          </button>
        </div>
      )}
    </>
  );
};
