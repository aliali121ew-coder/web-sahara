import { beforeEach, describe, expect, it } from 'vitest';
import { isOnDashboard, readDashboardSuppliers, setOnDashboard } from '../dashboardSuppliers';

describe('موردو كارت مؤشرات الأسعار', () => {
  beforeEach(() => localStorage.clear());

  it('غير المعلَّم لا يظهر، والعلامة تُحفظ باسم المورد بلا تكرار وتُزال', () => {
    expect(isOnDashboard(readDashboardSuppliers(), 'اطراف النخيل')).toBe(false);
    setOnDashboard('اطراف النخيل', true);
    setOnDashboard('اطراف  النخيل', true);
    expect(readDashboardSuppliers()).toEqual(['اطراف النخيل']);
    // نفس المورد بكتابة مختلفة (همزة / «شركة»)
    expect(isOnDashboard(readDashboardSuppliers(), 'أطراف النخيل')).toBe(true);
    expect(isOnDashboard(readDashboardSuppliers(), 'علي كريم')).toBe(false);
    setOnDashboard('أطراف النخيل', false);
    expect(readDashboardSuppliers()).toEqual([]);
  });
});
