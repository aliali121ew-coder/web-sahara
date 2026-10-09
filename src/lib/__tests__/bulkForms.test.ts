import { describe, expect, it } from 'vitest';
import { applySaharaReport, newSaharaBalanceForm, saharaDraft, saharaSaveBlockers } from '../saharaBalanceForm';
import { applyPetrolReport, newPetrolForm, petrolRecord, petrolSaveBlockers } from '../petrolForm';
import { applyBlackOilReport, blackOilDerived, blackOilSaveBlockers, newBlackOilForm } from '../blackOilForm';
import { detectKind } from '../bulkUpload';
import { computeSahara } from '../saharaLedger';

// أرقام كشف "وقود الصحاري" ليوم 2026/10/07 (الملف الحقيقي)
const saharaSheet = {
  generators: 10134, vehicles: 34346, farms: 41623, sentToFarms: 378932, inboundInternal: 378932, inboundEtihad: 10800, inboundExternal: 179941,
  previousCarried: 8979065, currentInFile: 9083703, tableTotal: 9083703, date: '2026/10/07', notes: '',
  stations: [{ nameInImage: 'محطة النقل', matchedStation: null, balance: 1784170 }, { nameInImage: 'محطة التسمين', matchedStation: 'التسمين', balance: 340241 }]
};
const saharaStations = [
  { id: 'taqa', name: 'الطاقة', balance: 0, capacity: 5_000_000 },
  { id: 'tasmeen', name: 'التسمين', balance: 0, capacity: 1_000_000 }
];

describe('sahara balance form (shared by window and bulk upload)', () => {
  it('fills from the sheet: date, previous, override, sites (النقل → الطاقة)', () => {
    const res = applySaharaReport(newSaharaBalanceForm(null, saharaStations), saharaSheet, saharaStations, []);
    expect(res.form.date).toBe('2026/10/07');
    expect(res.form.stations).toEqual({ taqa: '1,784,170', tasmeen: '340,241' });
    const draft = saharaDraft(res.form);
    expect(draft).toMatchObject({ vehicles: 34346, farms: 41623, generators: 10134, sales: 378932, previousOverride: 8979065, currentOverride: 9083703 });
    expect(draft.inboundExternal).toEqual({ government: 179941, etihad: 10800 });
  });
  it('refuses an existing day', () => {
    const existing = [{ ...saharaDraft(newSaharaBalanceForm(null, saharaStations)), id: 'sah-1', date: '2026/10/07' }];
    const res = applySaharaReport(newSaharaBalanceForm(null, saharaStations), saharaSheet, saharaStations, computeSahara(existing));
    expect(saharaSaveBlockers(res.form, existing, computeSahara(existing), saharaStations)).toContain('dateTaken');
  });
});

describe('petrol form', () => {
  const stations = [{ id: 'a', name: 'الطاقة', balance: 0, capacity: 30000 }];
  it('takes the sheet date and the opening balance when no earlier day exists', () => {
    const res = applyPetrolReport(newPetrolForm([], stations), {
      date: '2026/10/07', previous: 23670, inboundQty: 0, inboundInternal: 0, notes: '',
      stations: [{ nameInFile: 'الطاقة', matched: 'الطاقة', consumption: 4159, balance: 17162 }]
    }, stations, []);
    expect(petrolSaveBlockers(res.form, [], stations)).toEqual([]);
    expect(petrolRecord(res.form, [])).toMatchObject({ date: '2026/10/07', consumption: { a: 4159 }, stationBalances: { a: 17162 }, previousOverride: 23670 });
  });
});

describe('black oil form', () => {
  it('reads the Sahara site and derives the current balance from the real tank balance', () => {
    const sites = [{ key: 'sahara' }];
    const form = applyBlackOilReport(newBlackOilForm([], 320000, sites), {
      sahara: { actual: 32215187, program: null, capacity: 40005000, empty: 7789813, diff: null, inbound: null, consumption: 218572 }
    }, '2026/10/07');
    const d = blackOilDerived(form, [], sites);
    expect(form.date).toBe('2026/10/07');
    expect(d.fCurrent).toBe(32215187);
    expect(d.fPrevious).toBe(32215187 + 218572);
    expect(blackOilSaveBlockers(form, d, [])).toEqual([]);
  });
});

describe('bulk file type detection', () => {
  it('tells the sheets apart by their own markers (PDF text with broken لا)', () => {
    expect(detectKind('موقف النفط األسود موقف الريان الرصيد الحقيقي بالخزانت').kind).toBe('black-oil');
    expect(detectKind('تقرير البـــانزين اليومي المــدور الســابق المصـروف الفعلي').kind).toBe('petrol');
    expect(detectKind('المدوّر السابق الرصيد المرسل الى المزارع المصروف الفعلي').kind).toBe('balance');
    expect(detectKind('LAST UPDATED: الرصيد السابق معدل السعر').problem).toBe('etihad');
    expect(detectKind('رقم الفوجر اسم السائق').problem).toBe('inbound');
    expect(detectKind('أي نص آخر').problem).toBe('unknown');
  });
});
