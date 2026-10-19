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

  it('لكل شركة علامتها: تعليم صف الصحاري لا يمس صف الاتحاد', () => {
    setOnDashboard('اسعد كاظم', true, 'sahara');
    expect(isOnDashboard(readDashboardSuppliers(), 'اسعد كاظم', 'sahara')).toBe(true);
    expect(isOnDashboard(readDashboardSuppliers(), 'اسعد كاظم', 'etihad')).toBe(false);
    setOnDashboard('اسعد كاظم', true, 'etihad');
    setOnDashboard('اسعد كاظم', false, 'sahara');
    expect(isOnDashboard(readDashboardSuppliers(), 'اسعد كاظم', 'sahara')).toBe(false);
    expect(isOnDashboard(readDashboardSuppliers(), 'اسعد كاظم', 'etihad')).toBe(true);
  });

  it('الصيغة القديمة (الاسم وحده) تعني الشركتين، وإلغاء شركة يُبقي الأخرى', () => {
    setOnDashboard('اسعد كاظم', true);
    expect(isOnDashboard(readDashboardSuppliers(), 'اسعد كاظم', 'sahara')).toBe(true);
    expect(isOnDashboard(readDashboardSuppliers(), 'اسعد كاظم', 'etihad')).toBe(true);
    setOnDashboard('اسعد كاظم', false, 'sahara');
    expect(isOnDashboard(readDashboardSuppliers(), 'اسعد كاظم', 'sahara')).toBe(false);
    expect(isOnDashboard(readDashboardSuppliers(), 'اسعد كاظم', 'etihad')).toBe(true);
  });
});
