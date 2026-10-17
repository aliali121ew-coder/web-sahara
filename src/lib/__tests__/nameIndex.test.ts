import { beforeEach, describe, expect, it } from 'vitest';
import { addAlias, addName, applyNameIndex, isKnownName, matchName, nameKey, readNameIndex, removeEntry, suggestNames, writeNameIndex, type NameIndex } from '../nameIndex';

const idx = (): NameIndex => {
  let i: NameIndex = { supplier: [], company: [] };
  i = addName(i, 'supplier', 'حيدر عبد الله كاظم');
  i = addName(i, 'supplier', 'علي حسين جاسم');
  i = addName(i, 'company', 'شركة المصفى الذهبي');
  i = addName(i, 'company', 'معمل التصويب');
  return i;
};

describe('فهرس المجهزين والشركات', () => {
  beforeEach(() => localStorage.clear());

  it('التطبيع يوحّد الهمزات والتاء المربوطة وأشكال لا والرموز التالفة', () => {
    expect(nameKey('شركة  أحمد')).toBe(nameKey('شركه احمد'));
    expect(nameKey('ﻻفي')).toBe(nameKey('لافي'));
    expect(nameKey('عبد᐀الله')).toBe(nameKey('عبدالله'));
  });

  it('يصحح الاسم التام والكلمات المقلوبة والتشابه العالي، ولا يغيّر الاسم البعيد أو الملتبس', () => {
    const i = idx();
    expect(matchName('حيدر عبدالله كاظم', i.supplier)).toMatchObject({ name: 'حيدر عبد الله كاظم', how: 'exact' });
    expect(matchName('كاظم عبد الله حيدر', i.supplier)).toMatchObject({ how: 'exact' });
    // حرف ناقص وحرف خاطئ (هللا بدل الله)
    expect(matchName('حيدر عبد هللا كاظم', i.supplier)).toMatchObject({ name: 'حيدر عبد الله كاظم', how: 'similar' });
    expect(matchName('شركة المصفي الذهبى', i.company)).toMatchObject({ name: 'شركة المصفى الذهبي' });
    expect(matchName('محمد كريم', i.supplier)).toBeNull();
  });

  it('الشكل الخاطئ المحفوظ يُصحَّح دائمًا، والربط ينتقل لا يتكرر', () => {
    let i = idx();
    const [a, b] = i.company;
    i = addAlias(i, 'company', a.id, 'ﺷﺮﻛﺔ اﻟﺬﻫﺒﻲ');
    expect(matchName('شركة الذهبي', i.company)).toMatchObject({ name: a.name, how: 'alias' });
    i = addAlias(i, 'company', b.id, 'شركة الذهبي');
    expect(i.company[0].aliases).toEqual([]);
    expect(matchName('شركة الذهبي', i.company)).toMatchObject({ name: b.name });
    expect(isKnownName('شركة الذهبي', i.company)).toBe(true);
  });

  it('صفوف الاستيراد: تُصحَّح الخانتان ويُسجَّل ما تغيّر', () => {
    const rows = [
      { supplierName: 'علي حسين جاسن', supplierCompany: 'معمل التصويب', driverName: 'x' },
      { supplierName: 'مجهز جديد', supplierCompany: '', driverName: 'y' },
    ];
    const res = applyNameIndex(rows, idx());
    expect(res.changed).toBe(1);
    expect(res.rows[0].supplierName).toBe('علي حسين جاسم');
    expect(res.rows[0].driverName).toBe('x');
    expect(res.fixes[0]).toEqual([{ field: 'supplierName', from: 'علي حسين جاسن', to: 'علي حسين جاسم', how: 'similar' }]);
    expect(res.rows[1]).toEqual(rows[1]);
  });

  it('الاقتراحات والإضافة بلا تكرار والحذف والحفظ', () => {
    let i = idx();
    expect(suggestNames('حيدر كاظم', i.supplier)[0].name).toBe('حيدر عبد الله كاظم');
    expect(addName(i, 'supplier', 'علي  حسين جاسم')).toBe(i);
    i = removeEntry(i, 'supplier', i.supplier[1].id);
    writeNameIndex(i);
    expect(readNameIndex().supplier.map(e => e.name)).toEqual(['حيدر عبد الله كاظم']);
  });
});
