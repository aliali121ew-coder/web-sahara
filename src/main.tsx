import React from 'react';
import ReactDOM from 'react-dom/client';
// قبل أي عرض: وضع الأجهزة الضعيفة (يطفئ التأثيرات الثقيلة)
import './lib/perfMode';
import '@fontsource-variable/noto-kufi-arabic';
import '@fontsource-variable/cairo';
import '@fontsource-variable/inter';
import './index.css';
import { i18nReady, i18nAllReady } from './i18n';
import { initCloudSync } from './lib/cloudSync';
import { AppLogin } from './components/auth/AppLogin';
import { getProfile, refreshProfile } from './lib/session';
import { SyncBadge } from './components/auth/SyncBadge';
// يلتقط طلب التثبيت (أندرويد) مبكرًا قبل عرض الواجهة
import { InstallCard } from './components/layout/InstallCard';

// طلب تخزين دائم حتى لا يمسح المتصفح بيانات التطبيق تلقائيًا عند امتلاء المساحة أو إغلاقه
navigator.storage?.persist?.().catch(() => {});

const root = ReactDOM.createRoot(document.getElementById('root')!);

// سحب آخر نسخة من الخادم أولًا، ثم تحميل التطبيق حتى يقرأ البيانات المحدّثة
const start = async () => {
  // الترجمات الأساسية تُحمَّل قبل أول عرض حتى لا تظهر نصوص بلغة أخرى للحظة
  await i18nReady;
  if ((await initCloudSync()) === 'need-login') {
    root.render(<><AppLogin onSuccess={start} /><InstallCard /></>);
    return;
  }
  // الصلاحيات: بنسخة محفوظة يُعرض التطبيق فورًا وتُحدَّث في الخلفية (الصفحات تتبع حدث session-profile)،
  // فلا ينتظر الفتح الشبكة في الاتصال الضعيف أو المنقطع. بلا نسخة (أول دخول) تُجلب قبل العرض
  if (getProfile()) void refreshProfile();
  else await refreshProfile();
  // الترجمات الكاملة تُحمَّل بالتوازي مع كود التطبيق، فلا تظهر مفاتيح خام عند أول عرض
  const [{ default: App }] = await Promise.all([import('./App'), i18nAllReady]);
  root.render(
    <React.StrictMode>
      <App />
      <SyncBadge />
      <InstallCard />
    </React.StrictMode>
  );
};

start();
