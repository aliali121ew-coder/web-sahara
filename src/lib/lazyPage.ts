import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type LazyPage<P> = LazyExoticComponent<ComponentType<P>> & { preload: () => void };

// React.lazy مع preload: أول استدعاء يبدأ التحميل والبقية تعيد نفس الوعد المخزّن
export function lazyPage<P = {}>(
  loader: () => Promise<Record<string, any>>,
  exportName: string
): LazyPage<P> {
  let promise: Promise<{ default: ComponentType<P> }> | null = null;
  const load = () =>
    (promise ??= loader().then((m) => ({ default: m[exportName] as ComponentType<P> })));
  const Comp = lazy(load) as LazyPage<P>;
  Comp.preload = () => {
    load().catch(() => { promise = null; });
  };
  return Comp;
}
