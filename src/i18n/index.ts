import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

/**
 * التدويل: i18next مع ملفات JSON لكل لغة ولكل قسم (namespace) تُحمَّل عند الحاجة.
 * اللغات المفعّلة: العربية (الافتراضية) والإنجليزية. الأرقام غربية (0-9) في اللغتين.
 */
export const LANG_KEY = 'sahara_language';
export const SUPPORTED_LANGS = ['ar', 'en'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

export const isAppLang = (v: unknown): v is AppLang => SUPPORTED_LANGS.includes(v as AppLang);
export const dirOf = (lang: string): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr');

/** اللغة الأولى: الاختيار المحفوظ، ثم لغة المتصفح، ثم العربية */
const detectLanguage = (): AppLang => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (isAppLang(saved)) return saved;
  } catch { /* تجاهل */ }
  // الافتراضي العربية دائمًا (لا تُتبع لغة المتصفح)؛ الإنجليزية فقط إن اختارها المستخدم من زر اللغة
  return 'ar';
};

/** تحديث سمات الصفحة (اللغة والاتجاه والعنوان) مع كل تبديل */
const applyDocumentLanguage = (lang: string) => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = dirOf(lang);
  const title = i18n.t('common:meta.title', { lng: lang, defaultValue: '' });
  if (title) document.title = title;
  const desc = document.querySelector('meta[name="description"]');
  const d = i18n.t('common:meta.description', { lng: lang, defaultValue: '' });
  if (desc && d) desc.setAttribute('content', d);
};

i18n
  .use(resourcesToBackend((lng: string, ns: string) => import(`./locales/${lng}/${ns}.json`)))
  .use(initReactI18next);

i18n.on('languageChanged', lang => {
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* تجاهل */ }
  applyDocumentLanguage(lang);
});
i18n.on('loaded', () => applyDocumentLanguage(i18n.language));

/** يُنتظر قبل أول عرض حتى لا تظهر مفاتيح خام أو نصوص بلغة أخرى للحظة */
export const i18nReady = i18n.init({
  lng: detectLanguage(),
  fallbackLng: 'ar',
  supportedLngs: [...SUPPORTED_LANGS],
  ns: ['common', 'nav', 'auth', 'server'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
}).then(() => applyDocumentLanguage(i18n.language));

/** كل أقسام الترجمة (تُستخرج من الملفات نفسها فلا تتقادم قائمة يدوية) */
const ALL_NAMESPACES = Object.keys(import.meta.glob('./locales/ar/*.json')).map(p => p.replace(/^.*\/(.+)\.json$/, '$1'));

/**
 * تحميل بقية الأقسام (لوحة المعلومات والمالية والخزانات...) فور جاهزية الأساسية، دون انتظارها قبل أول عرض.
 * الصفحات الكسولة تنتظر هذا الوعد قبل ظهورها (lib/lazyPage.ts)، فلا تظهر مفاتيح خام مثل sahara.title لجزء من الثانية.
 * الفشل (انقطاع الشبكة) لا يمنع العرض: تبقى النصوص الافتراضية. والانتظار بسقف زمني.
 */
const MAX_WAIT_MS = 2000;
export const i18nAllReady: Promise<void> = i18nReady
  .then(() => Promise.race([
    i18n.loadNamespaces(ALL_NAMESPACES),
    // شبكة بطيئة جدًا: لا يُؤخَّر العرض أكثر من ثانيتين (يكمل التحميل في الخلفية وتتحدّث النصوص تلقائيًا)
    new Promise(resolve => setTimeout(resolve, MAX_WAIT_MS))
  ]))
  .then(() => undefined, () => undefined);

export default i18n;
