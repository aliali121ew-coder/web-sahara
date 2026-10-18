// @vitest-environment jsdom
import { Activity, act, createElement, type FC } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { setSessionValue, useSessionState } from '../useSessionState';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Probe: FC = () => {
  const [sub] = useSessionState<string | null>('sahara_subtab', null);
  const [tab] = useSessionState('sahara_reports_tab', 'balance');
  return createElement('span', null, `${sub}/${tab}`);
};

describe('الانتقال لتبويب في صفحة مخفية (عرض التفاصيل في صفحة الموردين)', () => {
  afterEach(() => { sessionStorage.clear(); document.body.innerHTML = ''; });

  it('صفحة الشركة المحمّلة في الخلفية تفتح على التقارير ← الوارد عند ظهورها', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    const render = (mode: 'visible' | 'hidden') => root.render(createElement(Activity, { mode, children: createElement(Probe) }));
    await act(async () => render('visible'));
    expect(el.textContent).toBe('null/balance');
    // المستخدم في صفحة الموردين: صفحة الشركة مخفية، والزر يطلب تبويب الوارد
    await act(async () => render('hidden'));
    await act(async () => { setSessionValue('sahara_subtab', 'reports'); setSessionValue('sahara_reports_tab', 'inbound'); });
    await act(async () => render('visible'));
    expect(el.textContent).toBe('reports/inbound');
    // والصفحة الظاهرة تتغير فورًا كما كانت
    await act(async () => setSessionValue('sahara_reports_tab', 'farms'));
    expect(el.textContent).toBe('reports/farms');
    await act(async () => root.unmount());
  });
});