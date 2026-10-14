import { describe, expect, it } from 'vitest';
import { canReadKey, canWriteKey } from '../permCatalog';

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
