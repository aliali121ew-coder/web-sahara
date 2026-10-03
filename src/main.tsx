import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { initCloudSync } from './lib/cloudSync';
import { AppLogin } from './components/auth/AppLogin';
import { refreshProfile } from './lib/session';
import { SyncBadge } from './components/auth/SyncBadge';

// طلب تخزين دائم حتى لا يمسح المتصفح بيانات التطبيق تلقائيًا عند امتلاء المساحة أو إغلاقه
navigator.storage?.persist?.().catch(() => {});

const root = ReactDOM.createRoot(document.getElementById('root')!);

// سحب آخر نسخة من الخادم أولًا، ثم تحميل التطبيق حتى يقرأ البيانات المحدّثة
const start = async () => {
  if ((await initCloudSync()) === 'need-login') {
    root.render(<AppLogin onSuccess={start} />);
    return;
  }
  refreshProfile();
  const { default: App } = await import('./App');
  root.render(
    <React.StrictMode>
      <App />
      <SyncBadge />
    </React.StrictMode>
  );
};

start();
