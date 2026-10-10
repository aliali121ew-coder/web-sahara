import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInstallPrompt } from '../../lib/pwaInstall';

/**
 * بطاقة "ثبّت التطبيق" أسفل الشاشة على الهواتف فقط (تختفي بعد التثبيت أو "لاحقًا" لمدة أسبوع):
 * أندرويد = زر تثبيت مباشر، آيفون = خطوات الإضافة إلى الشاشة الرئيسية من زر المشاركة.
 */
export const InstallCard: React.FC = () => {
  const { t, i18n } = useTranslation('common');
  const { mode, install, dismiss } = useInstallPrompt();
  // تظهر بعد لحظات من الفتح حتى لا تزاحم أول عرض للصفحة
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready || !mode) return null;
  return createPortal(
    <div dir={i18n.dir()} className="no-print fixed z-[95] inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2 rtl:sm:translate-x-1/2 sm:w-[380px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-4 font-cairo animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="" className="w-12 h-12 rounded-2xl shrink-0 shadow-sm" />
        <div className="min-w-0 flex-1">
          <div className="font-black text-sm text-slate-900 dark:text-white">{t('install.title')}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('install.text')}</p>
        </div>
        <button type="button" onClick={dismiss} aria-label={t('install.later')} className="p-1 -m-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      {mode === 'android' ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={dismiss} className="h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold cursor-pointer">
            {t('install.later')}
          </button>
          <button type="button" onClick={install} className="h-11 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-black flex items-center justify-center gap-2 cursor-pointer">
            <Download className="w-4 h-4" />{t('install.button')}
          </button>
        </div>
      ) : (
        <ol className="mt-3 space-y-2 text-xs font-bold text-slate-700 dark:text-slate-200">
          <li className="flex items-center gap-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5">
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center shrink-0">1</span>
            <span className="flex-1">{t('install.iosStep1')}</span>
            <Share className="w-5 h-5 text-sky-500 shrink-0" />
          </li>
          <li className="flex items-center gap-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5">
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center shrink-0">2</span>
            <span className="flex-1">{t('install.iosStep2')}</span>
            <SquarePlus className="w-5 h-5 text-slate-500 shrink-0" />
          </li>
          <li className="flex items-center gap-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5">
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center shrink-0">3</span>
            <span className="flex-1">{t('install.iosStep3')}</span>
          </li>
        </ol>
      )}
    </div>,
    document.body
  );
};
