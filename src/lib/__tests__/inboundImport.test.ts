import { describe, expect, it } from 'vitest';
import { parsePdfTable, type PdfTextItem } from '../inboundImport';

// هندسة نصوص "ارشيف وارد الصحاري.pdf" الحقيقية (الحافتان الأفقيتان كما يستخرجها pdf.js)
const it_ = (str: string, left: number, right: number, y: number): PdfTextItem => ({ str, left, right, y });
const header = (y: number): PdfTextItem[] => [
  it_('اسم المجهز', 489.6, 500.9, y), it_(' كة المجهزة', 466.1, 478.3, y), it_('ر', 478.2, 478.2, y + 1), it_('الش', 476.1, 480.4, y),
  it_('اسم السائق', 439.8, 450.4, y), it_('رقم العجلة', 415.1, 425.5, y), it_('رقم الفوجر', 399.5, 410.1, y),
  it_('الكميه المستلمة', 371.7, 386.7, y), it_('كثافة المنتج', 349.4, 361.0, y), it_('لون المنتج', 335.8, 345.8, y),
  it_('سعر المنتج', 320.9, 331.7, y), it_('تكلفة المنتج', 296.2, 307.7, y), it_('تاري خ االستالم والتفري غ', 259.1, 280.7, y)
];
const row = (y: number, o: { supplier?: PdfTextItem[]; driver: PdfTextItem[]; voucher: string; qty: [string, number]; cost: string }): PdfTextItem[] => [
  ...(o.supplier ?? [it_('_', 494.6, 495.8, y)]),
  it_('معمل المصف الذهب', 464.7, 481.9, y), it_('ي', 465.5, 465.5, y - 1),
  ...o.driver,
  it_('21L16717', 415.3, 424.7, y), it_(o.voucher, o.voucher === '_' ? 403.9 : 400.3, o.voucher === '_' ? 405.1 : 408.7, y),
  it_(o.qty[0], o.qty[1], 395.6, y), it_('50', 353.9, 356.4, y), it_('عسل', 338.3, 343.2, y), it_('ي', 339.1, 339.1, y - 1),
  it_('د', 331.4, 332.4, y), it_('.', 330.8, 331.4, y), it_('ع', 329.4, 330.8, y), it_('.', 328.8, 329.4, y), it_('500.00', 321.6, 328.2, y),
  it_(' ', 313.4, 316.6, y), it_('د', 316.6, 317.6, y), it_('.', 316.0, 316.6, y), it_('ع', 314.6, 316.0, y), it_('.', 314.0, 314.6, y),
  it_(o.cost, 302.6, 313.4, y), it_('2026-01-09', 266.0, 277.0, y)
];
const ali = (y: number) => [it_('عل', 448.2, 451.3, y), it_('ي', 449.0, 449.0, y - 1), it_(' ', 447.6, 448.2, y), it_(' محمد رضا', 439.0, 449.0, y)];

describe('inbound PDF table', () => {
  const rows = parsePdfTable([[
    ...header(745),
    ...row(738, { supplier: [it_('بر', 498.8, 500.5, 738), it_('كات الساق', 490.4, 499.4, 738), it_('ي', 491.2, 491.2, 737)], driver: [it_('احمد ماجد نجرس', 437.9, 452.9, 738)], voucher: '_', qty: ['14,891', 389.0], cost: '7,445,500' }),
    ...row(728, { driver: ali(728), voucher: '1637486', qty: ['36,115', 389.0], cost: '18,057,500' }),
    ...row(718, { driver: ali(718), voucher: '1637487', qty: ['36,200', 389.0], cost: '18,100,000' }),
    // كمية قصيرة محاذاة لليمين: أقرب لعنوان الفوجر لكنها في موضع أرقام الكمية
    ...row(708, { driver: ali(708), voucher: '1637499', qty: ['498', 392.1], cost: '249,000' })
  ]]);

  it('reads every row with the right columns (split company header, quantity not glued to voucher)', () => {
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ supplierName: 'بركات الساقي', supplierCompany: 'معمل المصف الذهبي', driverName: 'احمد ماجد نجرس', voucherNumber: '', receivedQuantity: 14891, productColor: 'عسلي', productPrice: 500, productCost: 7445500, receiptUnloadDate: '2026/01/09' });
    expect(rows[1]).toMatchObject({ supplierName: '', driverName: 'علي محمد رضا', voucherNumber: '1637486', receivedQuantity: 36115, productCost: 18057500 });
  });
  it('a short right-aligned quantity stays in the quantity column', () => {
    expect(rows[3]).toMatchObject({ voucherNumber: '1637499', receivedQuantity: 498, productCost: 249000 });
  });
});

// "ارشيف وارد الاتحاد.pdf" (2026/10): خط بخريطة تالفة (حروف مركّبة برموز U+1400–U+18FF) والتاريخ أخفض من صفه بـ 5.6 نقطة
describe('inbound PDF with a broken font map (Etihad archive)', () => {
  const head: PdfTextItem[] = [
    it_('أسم المجهز', 730.8, 754.1, 547.3), it_('الᣄ', 687, 695.7, 547.3), it_(' كة المجهزة', 666.4, 691.3, 547.3), it_('ᡫ', 691.3, 691.3, 549.4),
    it_('أسم السائق', 608.5, 630.7, 547.3), it_('رقم العجلة', 547.4, 568.8, 547.3), it_('رقم الفوجر', 485.8, 507.7, 547.3),
    it_('الᝣمᘭة', 429.4, 441.1, 547.3), it_('كثافة المنتج', 361.7, 385.9, 547.3), it_('لون المنتج', 302, 322.6, 547.3),
    it_('سعر المنتج', 239.8, 262, 547.3), it_('ت ᜓلفة المنتج', 177.6, 201.4, 547.3),
    it_('تارᗫــــخ اﻻستﻼم والتفᗫᖁــــغ', 105.5, 150.8, 547.3), it_('التعامل', 59.6, 73.7, 547.3)
  ];
  const tail = (y: number, qty: string, density: string, price: string, cost: string, date: string) => [
    it_(qty, 428.3, 440.9, y), it_(density, 371.5, 376.1, y), it_('اصفر', 308.2, 316.7, y), it_(price, 247.6, 254.4, y),
    it_(cost, 175.7, 203.4, y), it_('معرف', 61.8, 71.4, y), it_(date, 117.5, 138.6, y - 5.6)
  ];
  const rows = parsePdfTable([[
    ...head,
    it_('عᣢ', 743.6, 749.5, 531.1), it_(' ', 743.1, 743.8, 531.1), it_(' كᗫᖁم', 735.5, 745.2, 531.1), it_('ᢝ', 745.2, 745.2, 529.7),
    it_('محمد عᘘدﷲ', 608.8, 630.4, 531.1), it_('11547', 552.5, 563.9, 531.1), it_('003457', 489.8, 503.6, 531.1),
    ...tail(531.1, '43,690', '31', '840', '36,699,600 د.ع', '2026-10-12'),
    // بلا فوجر ولا رقم عجلة
    it_('اسعد ᛿امل', 734.9, 751.1, 481.4), it_('ماجد ᣃحان', 609.7, 629.5, 481.4),
    ...tail(481.4, '35,797', '26', '850', '30,427,450 د.ع', '2026-10-12'),
    it_('محطة سبع البوسلطان', 724.8, 760.1, 464.9), it_('3,633', 429.4, 439.7, 464.9), it_('اصفر', 308.2, 316.7, 464.9),
    it_('400', 247.6, 254.4, 464.9), it_('1,453,200 د.ع', 176.8, 202.2, 464.9), it_('معرف', 61.8, 71.4, 464.9), it_('2026-10-12', 117.5, 138.6, 459.2)
  ]]);

  it('repairs the Arabic letters and reads quantity, cost and the shifted date', () => {
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ supplierName: 'علي كريم', driverName: 'محمد عبدالله', truckNumber: '11547', voucherNumber: '003457', receivedQuantity: 43690, productDensity: '31', productPrice: 840, productCost: 36699600, receiptUnloadDate: '2026/10/12' });
    expect(rows[1]).toMatchObject({ supplierName: 'اسعد كامل', driverName: 'ماجد سرحان', voucherNumber: '', receivedQuantity: 35797, receiptUnloadDate: '2026/10/12' });
    expect(rows[2]).toMatchObject({ supplierName: 'محطة سبع البوسلطان', receivedQuantity: 3633, productCost: 1453200 });
  });
});
