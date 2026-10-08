import i18n from '../i18n';
import { fmtList } from '../i18n/format';
import { useEffect, useState } from 'react';

/**
 * النسخة التجريبية: الخادم يعلن عنها في /api/chat/auth/status (DEMO_MODE في wrangler env demo).
 * يُسأل مرة واحدة لكل فتح للبرنامج.
 */
let demoPromise: Promise<boolean> | null = null;
export const loadDemoMode = () =>
  (demoPromise ??= fetch('/api/chat/auth/status', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : {}))
    .then((d: { demo?: boolean }) => !!d.demo)
    .catch(() => false));

export const useDemoMode = () => {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    let alive = true;
    loadDemoMode().then(d => alive && setDemo(d));
    return () => { alive = false; };
  }, []);
  return demo;
};

const HOUR = 3600_000;
const DAY = 24 * HOUR;
/** مدد حساب التجربة المتاحة (من ساعة إلى شهر) — التسميات في admin:demo.duration.<key> */
export const DEMO_DURATIONS = [
  { key: 'h1', ms: HOUR },
  { key: 'h6', ms: 6 * HOUR },
  { key: 'h12', ms: 12 * HOUR },
  { key: 'd1', ms: DAY },
  { key: 'd3', ms: 3 * DAY },
  { key: 'w1', ms: 7 * DAY },
  { key: 'w2', ms: 14 * DAY },
  { key: 'm1', ms: 30 * DAY },
] as const;
export type DemoDurationKey = (typeof DEMO_DURATIONS)[number]['key'];
export const DEFAULT_DEMO_DURATION: DemoDurationKey = 'd1';
export const demoDurationMs = (key: DemoDurationKey) => DEMO_DURATIONS.find(d => d.key === key)!.ms;

/** الوقت المتبقي مقسّمًا (للعرض: "يومان و3 ساعات") */
export const remainingParts = (expiresAt: number, now = Date.now()) => {
  const ms = Math.max(0, expiresAt - now);
  return { expired: ms === 0, days: Math.floor(ms / DAY), hours: Math.floor((ms % DAY) / HOUR), minutes: Math.floor((ms % HOUR) / 60_000) };
};

/** الوقت المتبقي نصًا: "يومان و3 ساعات" أو "ساعتان و10 دقائق" */
export const remainingText = (expiresAt: number, now = Date.now()) => {
  const p = remainingParts(expiresAt, now);
  const parts: string[] = [];
  if (p.days) parts.push(i18n.t('common:units.days', { count: p.days }));
  if (p.hours) parts.push(i18n.t('common:units.hours', { count: p.hours }));
  if (!p.days && (p.minutes || !p.hours)) parts.push(i18n.t('common:units.minutes', { count: p.minutes }));
  return fmtList(parts);
};
