import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/noto-kufi-arabic';
import '@fontsource-variable/cairo';
import '@fontsource-variable/inter';
import './index.css';
import { i18nReady } from './i18n';
import { initCloudSync } from './lib/cloudSync';
import { AppLogin } from './components/auth/AppLogin';
import { getProfile, refreshProfile } from './lib/session';
import { SyncBadge } from './components/auth/SyncBadge';

// طلب تخزين دائم حتى لا يمسح المتصفح بيانات التطبيق تلقائيًا عند امتلاء المساحة أو إغلاقه
navigator.storage?.persist?.().catch(() => {});

const root = ReactDOM.createRoot(document.getElementById('root')!);

// سحب آخر نسخة من الخادم أولًا، ثم تحميل التطبيق حتى يقرأ البيانات المحدّثة
const start = async () => {
  // الترجمات الأساسية تُحمَّل قبل أول عرض حتى لا تظهر نصوص بلغة أخرى للحظة
  await i18nReady;
  if ((await initCloudSync()) === 'need-login') {
    root.render(<AppLogin onSuccess={start} />);
    return;
  }
  // الصلاحيات: بنسخة محفوظة يُعرض التطبيق فورًا وتُحدَّث في الخلفية (الصفحات تتبع حدث session-profile)،
  // فلا ينتظر الفتح الشبكة في الاتصال الضعيف أو المنقطع. بلا نسخة (أول دخول) تُجلب قبل العرض
  if (getProfile()) void refreshProfile();
  else await refreshProfile();
  const { default: App } = await import('./App');
  root.render(
    <React.StrictMode>
      <App />
      <SyncBadge />
    </React.StrictMode>
  );
};

start();
