import React, { useMemo } from 'react';
import { InboundDelivery } from '../../types';
import { OfficialReportHeaderRow } from '../print/OfficialReportHeader';
import { formatNumber, formatIQD } from '../../lib/utils';
import { useTranslation, Trans } from 'react-i18next';
import { enumText } from '../../i18n/enums';
import { fmtDate } from '../../i18n/format';

export type PrintPaperSize = 'auto' | 'a4' | 'a3' | 'a2' | 'letter' | 'legal';
export type PrintOrientation = 'auto' | 'portrait' | 'landscape';
export type PrintDensity = 'compact' | 'normal' | 'relaxed';

export interface PrintColumnDef {
  id: string;
  /** العنوان: deliveries:print.col.<id>، والفئة: deliveries:print.cat.<category> */
  category: 'basic' | 'specs' | 'finance' | 'logistics';
  defaultVisible: boolean;
  align: 'start' | 'center' | 'end';
  widthWeight: number;
}

export const PRINT_AVAILABLE_COLUMNS: PrintColumnDef[] = [
  { id: 'index', category: 'basic', defaultVisible: true, align: 'center', widthWeight: 3.5 },
  { id: 'company', category: 'basic', defaultVisible: true, align: 'center', widthWeight: 9.0 },
  { id: 'supplier', category: 'basic', defaultVisible: true, align: 'center', widthWeight: 9.5 },
  { id: 'driver', category: 'logistics', defaultVisible: true, align: 'center', widthWeight: 8.5 },
  { id: 'truckNumber', category: 'logistics', defaultVisible: true, align: 'center', widthWeight: 7.5 },
  { id: 'voucherNumber', category: 'basic', defaultVisible: true, align: 'center', widthWeight: 8.5 },
  { id: 'fuelType', category: 'specs', defaultVisible: true, align: 'center', widthWeight: 8.0 },
  { id: 'quantity', category: 'basic', defaultVisible: true, align: 'center', widthWeight: 8.5 },
  { id: 'density', category: 'specs', defaultVisible: true, align: 'center', widthWeight: 6.0 },
  { id: 'color', category: 'specs', defaultVisible: true, align: 'center', widthWeight: 6.5 },
  { id: 'price', category: 'finance', defaultVisible: true, align: 'center', widthWeight: 7.0 },
  { id: 'cost', category: 'finance', defaultVisible: true, align: 'center', widthWeight: 9.5 },
  { id: 'receiptDate', category: 'basic', defaultVisible: true, align: 'center', widthWeight: 8.0 },
  { id: 'status', category: 'basic', defaultVisible: true, align: 'center', widthWeight: 7.0 },
];

export const ALIGN_CLASS: Record<PrintColumnDef['align'], string> = { start: 'text-start', center: 'text-center', end: 'text-end' };

export const DEFAULT_PRINT_COLUMNS: Record<string, boolean> = PRINT_AVAILABLE_COLUMNS.reduce(
  (acc, col) => ({ ...acc, [col.id]: col.defaultVisible }),
  {}
);

export interface InboundPrintReportProps {
  deliveries: InboundDelivery[];
  filterCompany?: string;
  filterSupplier?: string;
  filterFuelType?: string;
  filterMonthYear?: string;
  visibleColumns?: Record<string, boolean>;
  paperSize?: PrintPaperSize;
  orientation?: PrintOrientation;
  density?: PrintDensity;
  showHeaderLogos?: boolean;
  showKpiCards?: boolean;
  showSignatures?: boolean;
  /** اسم الشركة في عنوان الكشف (صحاري كربلاء / الاتحاد) */
  companyName?: string | null;
}

const InboundPrintReportComponent: React.FC<InboundPrintReportProps> = ({
  deliveries,
  filterCompany = 'الكل',
  filterSupplier = 'الكل',
  filterFuelType = 'الكل',
  filterMonthYear = '',
  visibleColumns = DEFAULT_PRINT_COLUMNS,
  paperSize = 'auto',
  orientation = 'auto',
  density = 'normal',
  showHeaderLogos = true,
  showKpiCards = true,
  showSignatures = true,
  companyName = null,
}) => {
  const { t, i18n } = useTranslation(['deliveries', 'common']);
  // 1. Calculate active columns
  const activeCols = useMemo(() => {
    return PRINT_AVAILABLE_COLUMNS.filter(col => visibleColumns[col.id] ?? col.defaultVisible);
  }, [visibleColumns]);

  const activeColCount = activeCols.length;

  // 2. Intelligent Adaptive Paper & Orientation Calculations
  const resolvedOrientation: 'portrait' | 'landscape' = useMemo(() => {
    if (orientation !== 'auto') return orientation;
    return activeColCount > 6 ? 'landscape' : 'portrait';
  }, [orientation, activeColCount]);

  const resolvedPaperSize: 'a4' | 'a3' | 'a2' | 'letter' | 'legal' = useMemo(() => {
    if (paperSize !== 'auto') return paperSize;
    return 'a4';
  }, [paperSize]);

  // 3. Proportional Column Widths
  const totalWeight = useMemo(() => {
    return activeCols.reduce((acc, c) => acc + c.widthWeight, 0);
  }, [activeCols]);

  const colWidths = useMemo(() => {
    const map: Record<string, string> = {};
    activeCols.forEach(col => {
      const pct = ((col.widthWeight / totalWeight) * 100).toFixed(2);
      map[col.id] = `${pct}%`;
    });
    return map;
  }, [activeCols, totalWeight]);

  // 4. Uniform Row Height and Dynamic Typography based on column count & density
  const isHighDensityCols = activeColCount > 10;
  const tableFontSizeClass = isHighDensityCols ? 'text-[9.5px]' : 'text-[10px]';
  const tableHeaderFontSizeClass = isHighDensityCols ? 'text-[10px]' : 'text-[10.5px]';
  const rowPaddingClass = density === 'compact' ? 'py-1' : density === 'relaxed' ? 'py-2' : 'py-1.5';

  // 5. Overall Grand Aggregates
  const grandTotalVolume = deliveries.reduce((acc, d) => acc + (d.receivedQuantity ?? d.volumeLiters ?? 0), 0);
  const grandTotalCost = deliveries.reduce((acc, d) => acc + (d.productCost ?? d.totalCostIqd ?? 0), 0);
  const grandAvgPrice = grandTotalVolume > 0 ? grandTotalCost / grandTotalVolume : 0;

  const currentDateStr = fmtDate(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' });

  const formatTruckNumber = (val?: string) => (val || '-').split('/')[0].trim();
  const formatVoucherNumber = (val?: string) => {
    if (!val) return '-';
    const digits = val.replace(/\D/g, '');
    return digits || val;
  };

  // 5. DETERMINISTIC ADAPTIVE MULTI-PAGE CHUNKING ENGINE (هندسة ملء وتوزيع الصفحات)
  // Page 1 with KPIs fits 20 rows. Subsequent pages without KPIs fit 24 rows to fill the sheet down to footer.
  const pagesData = useMemo(() => {
    const totalItems = deliveries.length;
    if (totalItems === 0) {
      return [{ pageNumber: 1, items: [], startIndex: 0, isFirstPage: true, isLastPage: true }];
    }

    const page1Capacity = showKpiCards ? 22 : 24;
    const subsequentPageCapacity = 24;

    const pages = [];
    let currentIndex = 0;
    let pageNum = 1;

    while (currentIndex < totalItems) {
      const isFirst = pageNum === 1;
      const capacity = isFirst ? page1Capacity : subsequentPageCapacity;
      const chunkSize = Math.min(capacity, totalItems - currentIndex);
      const chunk = deliveries.slice(currentIndex, currentIndex + chunkSize);
      const isLast = (currentIndex + chunkSize) >= totalItems;

      pages.push({
        pageNumber: pageNum,
        items: chunk,
        startIndex: currentIndex,
        isFirstPage: isFirst,
        isLastPage: isLast,
      });

      currentIndex += chunkSize;
      pageNum++;
    }

    return pages;
  }, [deliveries, showKpiCards]);

  const totalPages = pagesData.length;

  // Dynamic CSS @page rule for true 100% paper fit with safe margins
  const pageCssRule = `
    @page {
      size: ${resolvedPaperSize.toUpperCase()} ${resolvedOrientation};
      margin: 5mm 6mm 5mm 6mm;
    }
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        box-shadow: none !important;
        text-shadow: none !important;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      .print-report-root {
        margin: 0 !important;
        padding: 0 !important;
      }
      .print-page-box {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        min-height: 198mm !important;
        height: 198mm !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        box-sizing: border-box !important;
        background: #ffffff !important;
      }
      .print-page-box:not(:last-child) {
        page-break-after: always !important;
        break-after: page !important;
      }
      .print-page-box:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      .print-avoid-break {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      img {
        image-rendering: -webkit-optimize-contrast !important;
        image-rendering: crisp-edges !important;
      }
    }
  `;

  return (
    <div className="print-report-root w-full font-cairo text-slate-900 select-text space-y-6 print:space-y-0" dir={i18n.dir()}>
      {/* Dynamic @page print orientation stylesheet */}
      <style>{pageCssRule}</style>

      {pagesData.map((page) => {
        // Page specific calculations
        const pageVolume = page.items.reduce((acc, d) => acc + (d.receivedQuantity ?? d.volumeLiters ?? 0), 0);
        const pageCost = page.items.reduce((acc, d) => acc + (d.productCost ?? d.totalCostIqd ?? 0), 0);
        const pageAvgPrice = pageVolume > 0 ? pageCost / pageVolume : 0;

        return (
          <div
            key={page.pageNumber}
            className="print-page-box bg-white p-4 sm:p-6 print:p-0 w-full min-h-[720px] flex flex-col justify-between text-start box-border rounded-xl shadow-lg border border-slate-300 print:rounded-none print:shadow-none print:border-none"
          >
            {/* Top Area: Header + Filters + KPIs (Full on Page 1, Compact on subsequent pages) */}
            <div className="w-full shrink-0">
              
              {/* 🏢 1. Official Enterprise Report Header */}
              {showHeaderLogos && (
                <header className="print-header report-header border-b-3 border-slate-900 pb-3 mb-1 block w-full">
                  <OfficialReportHeaderRow badge={t('deliveries:print.badge')} title={companyName ? t('deliveries:print.titleCompany', { company: enumText(companyName) }) : t('deliveries:print.title')} />

                  {/* Applied Filters Sub-strip */}
                  {(filterCompany !== 'الكل' || filterSupplier !== 'الكل' || filterFuelType !== 'الكل' || filterMonthYear) && (
                    <div className="mt-2 pt-1 border-t border-dashed border-slate-300 flex items-center justify-between text-[9.5px] text-slate-700 bg-slate-50 px-3 py-1 rounded">
                      <span className="font-bold text-slate-900">{t('deliveries:print.filtersTitle')}</span>
                      <div className="flex items-center gap-3">
                        {filterCompany !== 'الكل' && <span><Trans t={t} i18nKey="deliveries:print.filter.company" values={{ value: enumText(filterCompany) }} components={{ 1: <strong className="text-blue-900" /> }} /></span>}
                        {filterSupplier !== 'الكل' && <span><Trans t={t} i18nKey="deliveries:print.filter.supplier" values={{ value: enumText(filterSupplier) }} components={{ 1: <strong className="text-blue-900" /> }} /></span>}
                        {filterFuelType !== 'الكل' && <span><Trans t={t} i18nKey="deliveries:print.filter.fuel" values={{ value: enumText(filterFuelType) }} components={{ 1: <strong className="text-blue-900" /> }} /></span>}
                        {filterMonthYear && <span><Trans t={t} i18nKey="deliveries:print.filter.period" values={{ value: filterMonthYear }} components={{ 1: <strong className="text-blue-900" /> }} /></span>}
                      </div>
                    </div>
                  )}
                </header>
              )}

              {/* 🌟 Professional Luxury Divider Line between Header & KPI Cards */}
              {showKpiCards && page.isFirstPage && (
                <div className="my-2.5 flex items-center justify-center">
                  <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
                </div>
              )}

              {/* 📊 2. Executive KPI Highlights Summary Bar (Shown on Page 1) */}
              {showKpiCards && page.isFirstPage && (
                <div className="grid grid-cols-4 gap-2 mb-2 shrink-0">
                  <div className="border border-slate-300 rounded-lg p-1.5 bg-gradient-to-b from-white to-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-600 block">{t('deliveries:print.kpi.volume')}</span>
                    <span className="text-sm font-black font-sans text-blue-950 block">
                      {formatNumber(grandTotalVolume)} <span className="text-[9px] font-cairo text-slate-700">{t('common:units.liter')}</span>
                    </span>
                  </div>

                  <div className="border border-slate-300 rounded-lg p-1.5 bg-gradient-to-b from-white to-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-600 block">{t('deliveries:print.kpi.cost')}</span>
                    <span className="text-sm font-black font-sans text-emerald-900 block">
                      {formatIQD(grandTotalCost)}
                    </span>
                  </div>

                  <div className="border border-slate-300 rounded-lg p-1.5 bg-gradient-to-b from-white to-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-600 block">{t('deliveries:print.kpi.avg')}</span>
                    <span className="text-sm font-black font-sans text-slate-900 block">
                      {grandAvgPrice.toFixed(1)} <span className="text-[9px] font-cairo text-slate-700">{t('deliveries:print.iqdPerLiter')}</span>
                    </span>
                  </div>

                  <div className="border border-slate-300 rounded-lg p-1.5 bg-gradient-to-b from-white to-slate-50 text-center">
                    <span className="text-[9px] font-bold text-slate-600 block">{t('deliveries:print.kpi.count')}</span>
                    <span className="text-sm font-black font-sans text-purple-950 block">
                      {deliveries.length} <span className="text-[9px] font-cairo text-slate-700">{t('deliveries:print.approvedUnit', { count: deliveries.length })}</span>
                    </span>
                  </div>
                </div>
              )}

            </div>

            {/* 📋 3. Data Table with Clear Header Separation */}
            <div className="border-2 border-slate-800 rounded-lg overflow-hidden mt-2 w-full">
              <table className={`w-full border-collapse ${tableFontSizeClass} text-start table-fixed`}>
                <thead>
                  <tr className={`bg-[#0f2b5c] text-white font-black border-b-2 border-slate-800 ${tableHeaderFontSizeClass}`}>
                    {activeCols.map((col) => (
                      <th
                        key={col.id}
                        className={`py-1.5 px-1 whitespace-nowrap border-e border-blue-900 ${ALIGN_CLASS[col.align]} overflow-hidden text-ellipsis`}
                        style={{ width: colWidths[col.id] }}
                      >
                        {t(`deliveries:print.col.${col.id}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {page.items.length === 0 ? (
                    <tr>
                      <td colSpan={activeColCount || 1} className="py-8 text-center text-slate-500 font-bold">
                        {t('deliveries:print.empty')}
                      </td>
                    </tr>
                  ) : (
                    page.items.map((item, idx) => {
                      const absoluteIndex = page.startIndex + idx + 1;
                      const qty = item.receivedQuantity ?? item.volumeLiters ?? 0;
                      const price = item.productPrice ?? item.pricePerLiter ?? 0;
                      const cost = item.productCost ?? item.totalCostIqd ?? (qty * price);
                      const voucher = item.voucherNumber || item.receiptNumber || `VCH-${item.id}`;
                      const fuel = enumText(item.product || 'كاز / ديزل');
                      const receiptDate = item.receiptUnloadDate
                        ? item.receiptUnloadDate.split(' ')[0]
                        : (item.date ? item.date.split(' ')[0] : '2026/08/20');
                      const density = item.productDensity || '0.840';
                      const color = enumText(item.productColor || 'أصفر مخضر');
                      const status = enumText(item.status || 'تم الاستلام');

                      return (
                        <tr
                          key={item.id || idx}
                          className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} h-[25px]`}
                        >
                          {activeCols.map((col) => {
                            switch (col.id) {
                              case 'index':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-0.5 text-center font-sans font-bold text-slate-600 border-e border-slate-300`}>
                                    {absoluteIndex}
                                  </td>
                                );
                              case 'company':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-1 text-center font-bold text-slate-950 border-e border-slate-300 truncate`}>
                                    {enumText(item.company || 'صحاري كربلاء')}
                                  </td>
                                );
                              case 'supplier':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-1 text-center font-semibold text-slate-900 border-e border-slate-300 truncate`}>
                                    {enumText(item.supplierCompany || item.supplierName || 'مصفى كربلاء الدولي')}
                                  </td>
                                );
                              case 'driver':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-1 text-center text-slate-900 border-e border-slate-300 truncate`}>
                                    {item.driverName || t('deliveries:print.unspecified')}
                                  </td>
                                );
                              case 'truckNumber':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-0.5 font-sans font-bold text-slate-900 border-e border-slate-300 text-center truncate`}>
                                    {formatTruckNumber(item.truckNumber)}
                                  </td>
                                );
                              case 'voucherNumber':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-0.5 font-sans font-black text-blue-950 border-e border-slate-300 text-center truncate`}>
                                    {formatVoucherNumber(voucher)}
                                  </td>
                                );
                              case 'fuelType':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-0.5 font-bold text-slate-900 border-e border-slate-300 text-center truncate`}>
                                    {fuel}
                                  </td>
                                );
                              case 'quantity':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-1 font-sans font-black text-slate-950 border-e border-slate-300 text-center`}>
                                    {formatNumber(qty)}
                                  </td>
                                );
                              case 'density':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-0.5 font-sans text-slate-800 border-e border-slate-300 text-center`}>
                                    {density}
                                  </td>
                                );
                              case 'color':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-0.5 text-slate-800 border-e border-slate-300 text-center truncate`}>
                                    {color}
                                  </td>
                                );
                              case 'price':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-0.5 font-sans font-semibold text-slate-900 border-e border-slate-300 text-center`}>
                                    {price.toLocaleString()}
                                  </td>
                                );
                              case 'cost':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-1 font-sans font-black text-emerald-900 border-e border-slate-300 text-center truncate`}>
                                    {formatIQD(cost)}
                                  </td>
                                );
                              case 'receiptDate':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-0.5 font-sans text-slate-800 border-e border-slate-300 text-center`}>
                                    {receiptDate}
                                  </td>
                                );
                              case 'status':
                                return (
                                  <td key={col.id} className={`${rowPaddingClass} px-0.5 font-bold text-blue-800 border-e border-slate-300 text-center truncate`}>
                                    {status}
                                  </td>
                                );
                              default:
                                return <td key={col.id} className={`${rowPaddingClass} px-1 text-center border-e border-slate-300`}>-</td>;
                            }
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* 📌 Table Footer Totals (Matching Header Navy Blue Color & Perfectly Centered) */}
                <tfoot>
                  <tr className={`bg-[#0f2b5c] text-white font-black border-t-2 border-slate-800 ${tableHeaderFontSizeClass}`}>
                    {activeCols.map((col, cIdx) => {
                      if (cIdx === 0) {
                        return (
                          <td key={col.id} className="py-2 px-1 text-center border-e border-blue-900 font-black whitespace-nowrap">
                            {page.isLastPage && totalPages === 1 ? t('deliveries:print.total') : t('deliveries:print.pageTotal', { page: page.pageNumber })}
                          </td>
                        );
                      }
                      if (col.id === 'company') {
                        return (
                          <td key={col.id} className="py-2 px-1.5 text-center border-e border-blue-900 text-[10px] font-black truncate">
                            {page.isLastPage && totalPages > 1
                              ? t('deliveries:print.grandTotal', { count: deliveries.length })
                              : t('deliveries:print.onPage', { count: page.items.length })}
                          </td>
                        );
                      }
                      if (col.id === 'quantity') {
                        const volToDisplay = page.isLastPage && totalPages > 1 ? grandTotalVolume : pageVolume;
                        return (
                          <td key={col.id} className="py-2 px-1 text-center font-sans font-black text-amber-300 border-e border-blue-900 whitespace-nowrap">
                            {formatNumber(volToDisplay)} {t('common:units.liter')}
                          </td>
                        );
                      }
                      if (col.id === 'cost') {
                        const costToDisplay = page.isLastPage && totalPages > 1 ? grandTotalCost : pageCost;
                        return (
                          <td key={col.id} className="py-2 px-1 text-center font-sans font-black text-emerald-300 border-e border-blue-900 whitespace-nowrap">
                            {formatIQD(costToDisplay)}
                          </td>
                        );
                      }
                      if (col.id === 'price') {
                        const priceToDisplay = page.isLastPage && totalPages > 1 ? grandAvgPrice : pageAvgPrice;
                        return (
                          <td key={col.id} className="py-2 px-1 text-center font-sans font-black text-white border-e border-blue-900 whitespace-nowrap">
                            {t('deliveries:print.avg', { value: priceToDisplay.toFixed(1) })}
                          </td>
                        );
                      }
                      return (
                        <td key={col.id} className="py-2 px-1 text-center border-e border-blue-900 text-blue-200 font-normal">
                          -
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom Area: Signatures spaced below table + Official Page Security Footer */}
            <div className="w-full shrink-0 mt-auto pt-2">
              {/* ✍️ 4. Formal Verification & Signatures Section (Rendered on LAST PAGE ONLY, spaced by header height) */}
              {showSignatures && page.isLastPage && (
                <div className="print-avoid-break mt-6 mb-2">
                  <div className="border border-slate-400 rounded p-1.5 bg-slate-50">
                    <div className="text-[9px] font-black text-slate-900 mb-0.5 border-b border-slate-300 pb-0.5 flex items-center justify-between">
                      <span>{t('deliveries:print.approval.title')}</span>
                      <span className="text-[8px] font-bold text-slate-600">
                        {t('deliveries:print.approval.central')}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      
                      {/* Signature 1 */}
                      <div className="border border-dashed border-slate-400 rounded p-1 bg-white flex flex-col justify-between">
                        <span className="text-[8.5px] font-black text-slate-800 block">{t('deliveries:print.sign.preparer')}</span>
                        <div className="h-5 border-b border-slate-200 my-0.5"></div>
                        <span className="text-[7.5px] text-slate-500 block">{t('common:print.signature')}</span>
                      </div>

                      {/* Signature 2 */}
                      <div className="border border-dashed border-slate-400 rounded p-1 bg-white flex flex-col justify-between">
                        <span className="text-[8.5px] font-black text-slate-800 block">{t('deliveries:print.sign.receiver')}</span>
                        <div className="h-5 border-b border-slate-200 my-0.5"></div>
                        <span className="text-[7.5px] text-slate-500 block">{t('common:print.signature')}</span>
                      </div>

                      {/* Signature 3 */}
                      <div className="border border-dashed border-slate-400 rounded p-1 bg-white flex flex-col justify-between">
                        <span className="text-[8.5px] font-black text-slate-800 block">{t('deliveries:print.sign.audit')}</span>
                        <div className="h-5 border-b border-slate-200 my-0.5"></div>
                        <span className="text-[7.5px] text-slate-500 block">{t('common:print.signature')}</span>
                      </div>

                      {/* Signature 4 */}
                      <div className="border border-dashed border-slate-400 rounded p-1 bg-white flex flex-col justify-between">
                        <span className="text-[8.5px] font-black text-slate-800 block">{t('deliveries:print.approval.stampTitle')}</span>
                        <div className="h-5 border-b border-slate-200 my-0.5 flex items-center justify-center">
                          <span className="text-[7px] text-slate-400 border border-slate-300 px-2 rounded font-sans">
                            {t('deliveries:print.approval.stamp')}
                          </span>
                        </div>
                        <span className="text-[7.5px] text-slate-500 block">{t('deliveries:print.approval.final')}</span>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* Official Institutional Security Footer - Compact */}
              <div className="flex items-center justify-between text-[8px] text-slate-500 border-t border-slate-300 pt-0.5">
                <span>{t('deliveries:print.footer')}</span>
                <div className="flex items-center gap-2">
                  <span><Trans t={t} i18nKey="common:print.printDate" values={{ date: currentDateStr }} components={{ 1: <strong /> }} /></span>
                  <span>•</span>
                  <span><Trans t={t} i18nKey="deliveries:print.pageOf" values={{ page: page.pageNumber, count: totalPages }} components={{ 1: <strong /> }} /></span>
                </div>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
};

export const InboundPrintReport = React.memo(InboundPrintReportComponent);
