import { describe, expect, it } from 'vitest';
import { canReadKey, canWriteKey, isKeyDisabled, sanitizeDisabled } from '../permCatalog';

describe('dashboard readers', () => {
  // الواجهة الرئيسية تعرض "تفاصيل النفط الأسود": من يرى الرئيسية فقط يجب أن يستلم سجلَي النفط الأسود
  it('a dashboard-only account reads both black-oil ledgers but cannot write them', () => {
    const perms = { dashboard: 1 as const };
    for (const key of ['sahara_black_oil_daily_ledger_v1', 'etihad_black_oil_daily_ledger_v1']) {
      expect(canReadKey(perms, false, key)).toBe(true);
      expect(canWriteKey(perms, false, key)).toBe(false);
    }
  });
});

describe('disabled pages', () => {
  it('stops a key only when every page that reads it is off', () => {
    // الواردات يقرؤها أيضًا لوحة التحكم والتقارير
    expect(isKeyDisabled('sahara_inbound_deliveries', new Set(['deliveries-sahara']))).toBe(false);
    expect(isKeyDisabled('sahara_inbound_deliveries', new Set(['deliveries-sahara', 'dashboard', 'reports']))).toBe(true);
    expect(isKeyDisabled('sahara_vehicle_refills_v1', new Set(['deliveries-sahara', 'dashboard', 'reports']))).toBe(false);
  });
  it('never stops shared keys or keys without a rule', () => {
    const all = new Set(sanitizeDisabled(['dashboard', 'prices', 'suppliers', 'deliveries-sahara', 'deliveries-etihad', 'tasks']));
    expect(isKeyDisabled('sahara_notifications', all)).toBe(false);
    expect(isKeyDisabled('sahara_suppliers_list', all)).toBe(false);
    expect(isKeyDisabled('unknown_key', all)).toBe(false);
  });
  it('keeps settings on and drops unknown sections', () => {
    expect(sanitizeDisabled(['settings', 'dashboard', 'nope', 'dashboard', 3])).toEqual(['dashboard']);
    expect(sanitizeDisabled('x')).toEqual([]);
  });
});
