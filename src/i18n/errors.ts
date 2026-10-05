import i18n from './index';

const AR = /[؀-ۿ]/;

/**
 * نص الخطأ بلغة الواجهة: يُترجم حسب رمز الخطأ (code) القادم من الخادم أو من الجلسة،
 * وإلا تُعرض رسالة الخادم كما هي في العربية، ورسالة عامة في الإنجليزية بدل نص عربي.
 */
export const errorText = (e: unknown, ns = 'auth'): string => {
  const code = (e as { code?: string } | null)?.code;
  if (code && i18n.exists(`${ns}:errors.${code}`)) return i18n.t(`${ns}:errors.${code}`);
  const msg = (e as Error | null)?.message || '';
  if (!msg) return i18n.t(`${ns}:errors.network`, { defaultValue: i18n.t('auth:errors.network') });
  if (i18n.language === 'ar' || !AR.test(msg)) return msg;
  return i18n.t(`${ns}:errors.generic`, { defaultValue: i18n.t('auth:errors.generic') });
};

/**
 * رسالة خطأ من الخادم بلغة الواجهة: العربية تعرض نص الخادم كما هو، وغيرها يُترجم حسب الرمز (server:errors.<code>)،
 * فإن لم يوجد رمز معروف تُعرض رسالة عامة بدل نص عربي.
 */
export const serverText = (data: { error?: string; code?: string; max?: number } | null | undefined, fallback: string): string => {
  const msg = data?.error || '';
  if (i18n.language === 'ar' && msg) return msg;
  if (data?.code && i18n.exists(`server:errors.${data.code}`)) return i18n.t(`server:errors.${data.code}`, { max: data.max });
  if (msg && !AR.test(msg)) return msg;
  return msg ? i18n.t('server:errors.generic') : fallback;
};
