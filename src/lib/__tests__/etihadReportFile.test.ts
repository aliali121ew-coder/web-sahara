import { describe, expect, it } from 'vitest';
import { parseEtihadGrid, parseEtihadPdfLines, type EtihadPdfItem } from '../etihadReportFile';

// أسطر ملف "وقود الاتحاد" كما يستخرجها pdf.js (النص ومنتصف موضعه الأفقي)
const PDF_LINES: EtihadPdfItem[][] = 
[[{"text":"مصـــــــــروف الوقــــــود","cx":253},{"text":"/","cx":207},{"text":"كـــــــــــــاز","cx":179}],[{"text":"LAST UPDATED:","cx":583},{"text":"2026-10-07","cx":663}],[{"text":"الرصيد","cx":677},{"text":"السابق","cx":649},{"text":"الرصيد","cx":289},{"text":"الحالي","cx":261},{"text":"الوارد","cx":374},{"text":"المبيعات","cx":469},{"text":"االستهالك","cx":566},{"text":"معدل","cx":199},{"text":"السعر","cx":176},{"text":"د","cx":161},{"text":".","cx":157},{"text":"ع","cx":153}],[{"text":"36,301","cx":469},{"text":"33,217","cx":566},{"text":"10,994,558","cx":663},{"text":"855","cx":178},{"text":"10,968,965","cx":275},{"text":"43,925","cx":372}]]
;

describe('etihad report file', () => {
  it('reads the daily PDF sheet by column position', () => {
    expect(parseEtihadPdfLines(PDF_LINES)).toEqual({
      previous: 10994558, consumption: 33217, sales: 36301, inbound: 43925, current: 10968965, price: 855, operationalGas: null, cleanGas: null, date: '2026/10/07'
    });
  });

  it('reads the same sheet from Excel by column index', () => {
    const grid = [
      ['مصروف الوقود / كاز'],
      ['LAST UPDATED:', '2026-10-07'],
      ['الرصيد السابق', 'الاستهلاك', 'المبيعات', 'الوارد', 'الرصيد الحالي', 'معدل السعر د.ع'],
      [10994558, 33217, 36301, 43925, 10968965, 855]
    ];
    expect(parseEtihadGrid(grid)).toMatchObject({ previous: 10994558, consumption: 33217, sales: 36301, inbound: 43925, current: 10968965, price: 855, date: '2026/10/07' });
  });

  // الكشف الأحدث: جدول "تفاصيل أخرى" تحت الجدول الرئيسي (كاز نظيف يمينًا، كاز تشغيلى يسارًا)
  it('reads operational and clean gas from the details table (PDF)', () => {
    const lines: EtihadPdfItem[][] = [
      ...PDF_LINES,
      [{ text: 'تفاصيل أخرى', cx: 434 }],
      [{ text: 'كاز', cx: 600 }, { text: 'نظيف', cx: 570 }, { text: 'كاز', cx: 330 }, { text: 'تشغيلى', cx: 300 }],
      [{ text: '1,187,061', cx: 305 }, { text: '561,951', cx: 565 }]
    ];
    expect(parseEtihadPdfLines(lines)).toMatchObject({ previous: 10994558, current: 10968965, operationalGas: 1187061, cleanGas: 561951 });
  });

  it('reads operational and clean gas from Excel (value under the label, or beside it)', () => {
    const base = [
      ['الرصيد السابق', 'الاستهلاك', 'المبيعات', 'الوارد', 'الرصيد الحالي', 'معدل السعر د.ع'],
      [10994558, 33217, 36301, 43925, 10968965, 855],
      ['', 'تفاصيل أخرى']
    ];
    expect(parseEtihadGrid([...base, ['كاز تشغيلى', '', 'كاز نظيف'], ['1,187,061', '', 561951]])).toMatchObject({ operationalGas: 1187061, cleanGas: 561951, inbound: 43925 });
    expect(parseEtihadGrid([...base, ['كاز تشغيلي', 1187061], ['كاز نظيف', 561951]])).toMatchObject({ operationalGas: 1187061, cleanGas: 561951 });
  });
});
