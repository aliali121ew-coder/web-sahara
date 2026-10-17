// @vitest-environment jsdom
import { Activity, act, createElement, type FC } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { setOnDashboard, useDashboardSuppliers } from '../dashboardSuppliers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Probe: FC = () => createElement('span', null, useDashboardSuppliers().join('|'));

describe('كارت مؤشرات الأسعار: التحديث بلا رفرش', () => {
  afterEach(() => { localStorage.clear(); document.body.innerHTML = ''; });

  it('الصفحة المخفية (الرئيسية في الخلفية) تعرض الاختيار الجديد فور ظهورها', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    const render = (mode: 'visible' | 'hidden') => root.render(createElement(Activity, { mode, children: createElement(Probe) }));
    await act(async () => render('visible'));
    expect(el.textContent).toBe('');
    // الانتقال لصفحة الموردين: الرئيسية تُخفى، ثم توضع علامة صح
    await act(async () => render('hidden'));
    await act(async () => setOnDashboard('اطراف النخيل', true));
    await act(async () => render('visible'));
    expect(el.textContent).toBe('اطراف النخيل');
    // والصفحة الظاهرة تتغير فورًا
    await act(async () => setOnDashboard('علي كريم', true));
    expect(el.textContent).toBe('اطراف النخيل|علي كريم');
    await act(async () => root.unmount());
  });
});