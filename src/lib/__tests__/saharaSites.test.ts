import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { isGroupedStation, readSaharaReportFile, siteGroupOf } from '../saharaReportFile';
import { applySaharaReport, newSaharaBalanceForm, saharaSaveBlockers } from '../saharaBalanceForm';

const NAMES = ['الطاقة', 'البياض', 'التسمين', 'البوادي', 'امهات البياض', 'الاجداد', 'الاسفلت', 'مدينة الحجاج'];

describe('site groups (farm balances added to their station)', () => {
  it('maps each site to its station, including text as PDF extracts it', () => {
    expect(siteGroupOf('تسمين مزرعة٢', NAMES)).toBe('التسمين');
    expect(siteGroupOf('تسمين مزرعه ٥١', NAMES)).toBe('التسمين');
    expect(siteGroupOf('مفقس التسمين الثاني', NAMES)).toBe('التسمين');
    expect(siteGroupOf('الامهات التربية ٧ تل الضبع', NAMES)).toBe('البوادي');
    expect(siteGroupOf('االمهات الترر بية', NAMES)).toBe('البوادي');
    expect(siteGroupOf('االمهات الت بية تل الضبع', NAMES)).toBe('البوادي');
    expect(siteGroupOf('انتاج األمهات', NAMES)).toBe('البوادي');
    expect(siteGroupOf('مزرعة الذكور', NAMES)).toBe('البوادي');
    expect(siteGroupOf('مفقس البياض', NAMES)).toBe('البياض');
    expect(siteGroupOf('تربيات البياض الموقع ٣', NAMES)).toBe('البياض');
    expect(siteGroupOf('انتاج البياض ٨', NAMES)).toBe('البياض');
    expect(siteGroupOf('تصفية ماء البياض', NAMES)).toBe('البياض');
    expect(siteGroupOf('خزان الطاقة', NAMES)).toBe('الطاقة');
    expect(siteGroupOf('مفقس االمهات', NAMES)).toBe('البوادي');
    expect(siteGroupOf('مزرعة ١ أمهات البياض', NAMES)).toBe('امهات البياض');
    expect(siteGroupOf('مزرعة أمهات البياض', NAMES)).toBe('امهات البياض');
    expect(siteGroupOf('مزرعة١ الأجداد', NAMES)).toBe('الاجداد');
    expect(siteGroupOf('مزرعة٣ الاجداد', NAMES)).toBe('الاجداد');
    // صف المحطة نفسها يُطابق مباشرة (لا كموقع مجمّع)، والمحطات الأخرى لا تُجمع
    expect(siteGroupOf('محطة امهات البياض', NAMES)).toBeNull();
    expect(siteGroupOf('معمل الاسفلت', NAMES)).toBeNull();
    expect(siteGroupOf('مدينة الحجاج', NAMES)).toBeNull();
  });

  it('sums an Excel sheet into station balances and still saves over the station tank capacity', async () => {
    const rows = [
      ['موقع الخزان', 'الرصيد السابق', 'الوارد', 'المصروف اليومي', 'الرصيد التراكمي'],
      ['محطة النقل', 0, 0, 0, 1248261],
      ['محطة البياض', 0, 0, 0, 119491],
      ['محطة التسمين', 0, 0, 0, 238588],
      ['محطة البوادي', 0, 0, 0, 119844],
      ['تسمين مزرعة١', 0, 0, 0, 48108],
      ['مفقس التسمين الاول', 0, 0, 0, 42599],
      ['الامهات التربية ١', 0, 0, 0, 67865],
      ['انتاج الامهات ٢٤', 0, 0, 0, 96402],
      ['مفقس الامهات', 0, 0, 0, 52615],
      ['مفقس البياض', 0, 0, 0, 3002],
      ['خزان الطاقة', 0, 0, 0, 106383],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
    const file = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], 'report.xlsx');
    const r = await readSaharaReportFile(file, NAMES);
    const bal = Object.fromEntries(r.stations.map(s => [s.matchedStation ?? s.nameInImage, s.balance]));
    expect(bal['الطاقة']).toBe(1248261 + 106383);
    expect(bal['البياض']).toBe(119491 + 3002);
    expect(bal['التسمين']).toBe(238588 + 48108 + 42599);
    expect(bal['البوادي']).toBe(119844 + 67865 + 96402 + 52615);

    const stations = [{ id: 'tasmeen', name: 'التسمين', balance: 0, capacity: 100_000 }, { id: 'asphalt', name: 'الاسفلت', balance: 0, capacity: 100_000 }];
    const applied = applySaharaReport(newSaharaBalanceForm(null, stations), { ...r, date: '2026/10/10', previousCarried: 1 }, stations, []);
    expect(applied.form.stations.tasmeen).toBe('329,295');
    expect(isGroupedStation('التسمين')).toBe(true);
    expect(saharaSaveBlockers(applied.form, [], [], stations)).not.toContain('overCapacity');
    // المحطات غير المجمّعة ما زالت تُمنع فوق سعتها
    expect(saharaSaveBlockers({ ...applied.form, stations: { ...applied.form.stations, asphalt: '200,000' } }, [], [], stations)).toContain('overCapacity');
  });
});
