import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { i18nAllReady } from '../i18n';
import { isStaleChunkError, reloadForNewBuild } from './staleBuild';

export type LazyPage<P> = LazyExoticComponent<ComponentType<P>> & { preload: () => void };

// React.lazy مع preload: أول استدعاء يبدأ التحميل والبقية تعيد نفس الوعد المخزّن
export function lazyPage<P = {}>(
  loader: () => Promise<Record<string, any>>,
  exportName: string
): LazyPage<P> {
  let promise: Promise<{ default: ComponentType<P> }> | null = null;
  const load = () =>
    // الصفحة لا تظهر قبل وصول ترجمتها: بلا ذلك تظهر مفاتيح خام (sahara.title...) لجزء من الثانية ثم تتبدّل
    (promise ??= Promise.all([loader(), i18nAllReady])
      .then(([m]) => ({ default: m[exportName] as ComponentType<P> }))
      .catch(e => {
        promise = null;
        // ملف الصفحة من نسخة قديمة حُذف بعد نشر جديد: إعادة تحميل التطبيق بدل صفحة فارغة
        if (isStaleChunkError(e) && reloadForNewBuild()) return new Promise<never>(() => {});
        throw e;
      }));
  const Comp = lazy(load) as LazyPage<P>;
  Comp.preload = () => {
    load().catch(() => { promise = null; });
  };
  return Comp;
}
