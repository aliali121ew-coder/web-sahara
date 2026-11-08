import { describe, expect, it } from 'vitest';
import { FLEET } from '../vehicleFleet';

/** ملفا Excel (1041 راس تريلة، 97 محدثة؛ 1609 خدمية، 72 محدثة) بعد كشف الشفلات: حذف 27 «لا يوجد» وتحديث الـ 55 الباقية */
describe('vehicleFleet', () => {
  it('matches the Excel totals', () => {
    expect(FLEET).toHaveLength(2623);
    expect(FLEET.filter(v => v.updated)).toHaveLength(362);
    const kh = FLEET.filter(v => v.typeKey === 'KH');
    expect(kh).toHaveLength(139);
    expect(kh.every(v => v.updated && v.tanks.length === 1 && v.tanks[0] === 65)).toBe(true);
    const sf = FLEET.filter(v => v.typeKey === 'SF' || v.typeKey === 'SF1');
    expect(sf).toHaveLength(55);
    // الكبير: خزان أكثر من 75 لتر
    const big = FLEET.filter(v => v.typeKey === 'SF1');
    expect(big.every(v => v.type === 'شفل كبير' && v.tanks[0] > 75)).toBe(true);
    expect(FLEET.filter(v => v.typeKey === 'SF').every(v => v.type === 'شفل صغير' && v.tanks[0] <= 75)).toBe(true);
    expect(big.map(v => v.code)).toContain('SF49');
    expect(sf.every(v => v.updated && v.tanks.length)).toBe(true);
    const heads = FLEET.filter(v => v.typeKey === 'HEAD');
    expect(heads).toHaveLength(1041);
    expect(heads.filter(v => v.updated)).toHaveLength(97);
    expect(new Set(FLEET.map(v => v.code)).size).toBe(2623);
  });
  it('reads type, tanks and group', () => {
    const a13 = FLEET.find(v => v.code === 'A13')!;
    expect(a13).toMatchObject({ typeKey: 'A', type: 'اطفاء', updated: true, tanks: [625] });
    expect(FLEET.find(v => v.code === 'SF20')).toMatchObject({ updated: true, tanks: [60] });
    expect(FLEET.find(v => v.code === 'SF49')).toMatchObject({ updated: true, tanks: [260] });
    expect(FLEET.find(v => v.code === 'SF1')).toBeUndefined();
  });
});
