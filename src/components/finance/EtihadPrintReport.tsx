import React, { useMemo } from 'react';
import { EtihadBalanceRecord } from '../../types/finance';
import { formatNumber } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '../../i18n/format';

export type PrintPaperSize = 'auto' | 'a4' | 'a3' | 'a2' | 'letter' | 'legal';
export type PrintOrientation = 'auto' | 'portrait' | 'landscape';
export type PrintDensity = 'compact' | 'normal' | 'relaxed';

export interface PrintColumnDef {
  id: string;
  /** العنوان: finance:etihadPrint.col.<id>، والفئة: finance:etihadPrint.cat.<category> */
  category: 'basic' | 'flow' | 'sales' | 'extra';
  defaultVisible: boolean;
  align: 'start' | 'center' | 'end';
  widthWeight: number;
}

export const ETIHAD_PRINT_COLUMNS: PrintColumnDef[] = [
  { id: 'index', category: 'basic', defaultVisible: true, align: 'center', widthWeight: 3.5 },
  { id: 'date', category: 'basic', defaultVisible: true, align: 'center', widthWeight: 7.5 },
  { id: 'previousBalance', category: 'basic', defaultVisible: true, align: 'center', widthWeight: 9.5 },
  { id: 'purchases', category: 'flow', defaultVisible: true, align: 'center', widthWeight: 9.5 },
  { id: 'etihadExpense', category: 'flow', defaultVisible: true, align: 'center', widthWeight: 9.0 },
  { id: 'saharaSales', category: 'sales', defaultVisible: true, align: 'center', widthWeight: 8.5 },
  { id: 'cablesSales', category: 'sales', defaultVisible: true, align: 'center', widthWeight: 8.5 },
  { id: 'otherSales', category: 'sales', defaultVisible: true, align: 'center', widthWeight: 8.0 },
  { id: 'totalSales', category: 'sales', defaultVisible: true, align: 'center', widthWeight: 9.0 },
  { id: 'currentBalance', category: 'basic', defaultVisible: true, align: 'center', widthWeight: 10.0 },
  { id: 'price', category: 'extra', defaultVisible: false, align: 'center', widthWeight: 6.5 },
  { id: 'notes', category: 'extra', defaultVisible: false, align: 'start', widthWeight: 10.0 },
];

export const ALIGN_CLASS: Record<PrintColumnDef['align'], string> = { start: 'text-start', center: 'text-center', end: 'text-end' };

export const DEFAULT_ETIHAD_PRINT_COLUMNS: Record<string, boolean> = ETIHAD_PRINT_COLUMNS.reduce(
  (acc, col) => ({ ...acc, [col.id]: col.defaultVisible }),
  {}
);

export interface EtihadPrintReportProps {
  records: EtihadBalanceRecord[];
  title?: string;
  subtitle?: string;
  filterDateLabel?: string;
  visibleColumns?: Record<string, boolean>;
  paperSize?: PrintPaperSize;
  orientation?: PrintOrientation;
  density?: PrintDensity;
  showHeaderLogos?: boolean;
  showKpiCards?: boolean;
  showSignatures?: boolean;
}

export const EtihadPrintReport: React.FC<EtihadPrintReportProps> = ({
  records,
  title,
  subtitle,
  filterDateLabel,
  visibleColumns = DEFAULT_ETIHAD_PRINT_COLUMNS,
  paperSize = 'auto',
  orientation = 'auto',
  density = 'normal',
  showHeaderLogos = true,
  showKpiCards = true,
  showSignatures = true,
}) => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  title = title ?? t('finance:etihadPrint.title');
  subtitle = subtitle ?? t('finance:etihadPrint.subtitle');
  filterDateLabel = filterDateLabel ?? t('finance:etihadArchive.allCumulative');
  // 1. Calculate active columns
  const activeCols = useMemo(() => {
    return ETIHAD_PRINT_COLUMNS.filter(col => visibleColumns[col.id] ?? col.defaultVisible);
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
  const isHighDensityCols = activeColCount > 9;
  const tableFontSizeClass = isHighDensityCols ? 'text-[9.5px]' : 'text-[10px]';
  const tableHeaderFontSizeClass = isHighDensityCols ? 'text-[10px]' : 'text-[10.5px]';
  const rowPaddingClass = density === 'compact' ? 'py-1' : density === 'relaxed' ? 'py-2' : 'py-1.5';

  // 5. Overall Grand Aggregates
  const grandTotalPurchases = useMemo(() => records.reduce((acc, r) => acc + (r.purchases || 0), 0), [records]);
  const grandTotalExpense = useMemo(() => records.reduce((acc, r) => acc + (r.etihadExpense || 0), 0), [records]);
  const grandTotalSales = useMemo(() => {
    return records.reduce((acc, r) => {
      return acc + (r.saharaSales || 0) + (r.cablesSales || 0) + (r.specialSales || 0) + (r.otherSales || 0);
    }, 0);
  }, [records]);

  const latestBalance = records.length > 0 ? records[0].currentBalance : 0;
  const initialBalance = records.length > 0 ? records[records.length - 1].previousBalance : 0;

  const currentDateStr = fmtDate(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' });

  // 6. MULTI-PAGE CHUNKING ENGINE
  const pagesData = useMemo(() => {
    const totalItems = records.length;
    if (totalItems === 0) {
      return [{ pageNumber: 1, items: [], startIndex: 0, isFirstPage: true, isLastPage: true }];
    }

    const page1Capacity = showKpiCards ? (density === 'compact' ? 18 : 14) : 20;
    const subsequentPageCapacity = density === 'compact' ? 24 : 20;

    const pages = [];
    let currentIndex = 0;
    let pageNum = 1;

    while (currentIndex < totalItems) {
      const isFirst = pageNum === 1;
      const capacity = isFirst ? page1Capacity : subsequentPageCapacity;
      const chunkSize = Math.min(capacity, totalItems - currentIndex);
      const chunk = records.slice(currentIndex, currentIndex + chunkSize);
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
  }, [records, showKpiCards, density]);

  const totalPages = pagesData.length;

  // Dynamic CSS @page rule for true 100% paper fit with safe margins
  const pageCssRule = `
    @page {
      size: ${resolvedPaperSize.toUpperCase()} ${resolvedOrientation};
      margin: 6mm 8mm 6mm 8mm;
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
        min-height: auto !important;
        height: auto !important;
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
        const pagePurchases = page.items.reduce((acc, r) => acc + (r.purchases || 0), 0);
        const pageExpense = page.items.reduce((acc, r) => acc + (r.etihadExpense || 0), 0);
        const pageSales = page.items.reduce((acc, r) => {
          return acc + (r.saharaSales || 0) + (r.cablesSales || 0) + (r.specialSales || 0) + (r.otherSales || 0);
        }, 0);

        return (
          <div
            key={page.pageNumber}
            className="print-page-box bg-white p-4 sm:p-6 print:p-0 w-full min-h-[720px] flex flex-col justify-between text-start box-border rounded-xl shadow-lg border border-slate-300 print:rounded-none print:shadow-none print:border-none"
          >
            {/* Top Area: Header + Filters + KPIs (Full on Page 1, Compact on subsequent pages) */}
            <div className="w-full shrink-0">

              {/* 🏢 1. Official Enterprise Report Header */}
              {showHeaderLogos && (
                <header className="print-header report-header border-b-2 border-slate-900 pb-2.5 mb-1.5 block w-full">
                  <div className="flex flex-row items-center justify-between gap-4 w-full">

                    {/* Right Section: Group Logos & Agricultural Entity Name */}
                    <div className="flex flex-col items-start gap-1 shrink-0">
                      <div className="flex flex-row items-center gap-2 flex-nowrap">
                        <img
                          src="/logos/sahara.png"
                          alt={t('common:enum.company.sahara')}
                          className="h-9 w-auto object-contain shrink-0"
                        />
                        <img
                          src="/logos/sama.png"
                          alt={t('common:print.logo.sama')}
                          className="h-9 w-auto object-contain shrink-0"
                        />
                        <img
                          src="/logos/bawadi.png"
                          alt={t('common:print.logo.bawadi')}
                          className="h-8 w-auto object-contain shrink-0"
                        />
                        <img
                          src="/logos/kac.png"
                          alt={t('common:print.logo.kac')}
                          className="h-8 w-auto object-contain shrink-0"
                        />
                      </div>
                      <div className="mt-0.5">
                        <h1 className="text-[12.5px] font-black text-slate-950 leading-tight whitespace-nowrap">
                          {t('common:print.groupName')}
                        </h1>
                        <p className="text-[9.5px] font-bold text-slate-700 whitespace-nowrap">
                          {t('common:print.fuelDepartment')}
                        </p>
                      </div>
                    </div>

                    {/* Center Section: Official Clean Title */}
                    <div className="text-center flex flex-col items-center justify-center flex-1 min-w-0 px-3">
                      <div className="inline-block px-4 py-0.5 rounded-full bg-slate-900 text-white text-[10.5px] font-black tracking-wide mb-1">
                        {t('finance:etihadPrint.badge')}
                      </div>
                      <h2 className="text-base sm:text-lg font-black text-slate-950 tracking-tight leading-snug">
                        {title}
                      </h2>
                      <p className="text-[10px] text-slate-600 font-bold mt-0.5">
                        {subtitle}
                      </p>
                    </div>

                    {/* Left Section: Strategic Partner Logo in Pure Arabic */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <img
                        src="/logos/etihad.png"
                        alt={t('common:enum.company.etihad')}
                        className="h-10 w-auto object-contain shrink-0"
                      />
                      <div className="text-end">
                        <span className="text-[12px] font-black text-slate-950 block leading-tight whitespace-nowrap">
                          {t('common:print.etihadGroup')}
                        </span>
                        <span className="text-[9px] font-bold text-teal-800 block whitespace-nowrap">
                          {t('finance:etihadPrint.etihadDept')}
                        </span>
                      </div>
                    </div>

                  </div>
                </header>
              )}

              {/* 📊 2. Report Metadata Ribbon */}
              <div className="flex items-center justify-between bg-slate-100/90 text-slate-800 text-[10px] px-3 py-1 rounded-md mb-2 border border-slate-300 font-bold">
                <div className="flex items-center gap-4">
                  <span>
                    <strong className="text-slate-950">{t('finance:etihadPrint.range')}</strong> {filterDateLabel}
                  </span>
                  <span>
                    <strong className="text-slate-950">{t('finance:etihadPrint.issued')}</strong> {currentDateStr}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span>
                    <strong className="text-slate-950">{t('finance:etihadPrint.recordCount')}</strong> {t('finance:etihadPrint.txCount', { count: records.length })}
                  </span>
                  <span>
                    <strong className="text-slate-950">{t('finance:etihadPrint.pageLabel')}</strong> {t('finance:etihadPrint.pageNofM', { page: page.pageNumber, count: totalPages })}
                  </span>
                </div>
              </div>

              {/* 📈 3. KPI Mini Summary Cards (Shown only on Page 1 if enabled) */}
              {showKpiCards && page.isFirstPage && (
                <div className="grid grid-cols-5 gap-2 mb-2">
                  <div className="p-2 bg-slate-50 border border-slate-300 rounded-lg text-center">
                    <span className="text-[9.5px] text-slate-600 font-bold block mb-0.5">{t('finance:etihadPrint.opening')}</span>
                    <span className="text-xs font-black text-slate-900 font-mono">
                      {formatNumber(initialBalance)} <span className="text-[9px] font-cairo">{t('common:units.liter')}</span>
                    </span>
                  </div>

                  <div className="p-2 bg-emerald-50/70 border border-emerald-300 rounded-lg text-center">
                    <span className="text-[9.5px] text-emerald-800 font-bold block mb-0.5">{t('finance:etihadArchive.totalInbound')}</span>
                    <span className="text-xs font-black text-emerald-900 font-mono">
                      {formatNumber(grandTotalPurchases)} <span className="text-[9px] font-cairo">{t('common:units.liter')}</span>
                    </span>
                  </div>

                  <div className="p-2 bg-rose-50/70 border border-rose-300 rounded-lg text-center">
                    <span className="text-[9.5px] text-rose-800 font-bold block mb-0.5">{t('finance:tx.etihadExpense')}</span>
                    <span className="text-xs font-black text-rose-900 font-mono">
                      {formatNumber(grandTotalExpense)} <span className="text-[9px] font-cairo">{t('common:units.liter')}</span>
                    </span>
                  </div>

                  <div className="p-2 bg-amber-50/70 border border-amber-300 rounded-lg text-center">
                    <span className="text-[9.5px] text-amber-800 font-bold block mb-0.5">{t('finance:etihadArchive.totalSales')}</span>
                    <span className="text-xs font-black text-amber-900 font-mono">
                      {formatNumber(grandTotalSales)} <span className="text-[9px] font-cairo">{t('common:units.liter')}</span>
                    </span>
                  </div>

                  <div className="p-2 bg-teal-50/80 border border-teal-300 rounded-lg text-center">
                    <span className="text-[9.5px] text-teal-800 font-bold block mb-0.5">{t('finance:etihadPrint.closing')}</span>
                    <span className="text-xs font-black text-teal-900 font-mono">
                      {formatNumber(latestBalance)} <span className="text-[9px] font-cairo">{t('common:units.liter')}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* 📋 4. Official Table View */}
              <div className="w-full overflow-hidden border border-slate-800 rounded-md">
                <table className={`w-full text-start border-collapse ${tableFontSizeClass}`}>
                  <thead>
                    <tr className="bg-slate-900 text-white font-black border-b border-slate-900">
                      {activeCols.map(col => (
                        <th
                          key={col.id}
                          style={{ width: colWidths[col.id] }}
                          className={`py-2 px-2 border-e border-slate-700 font-black text-center whitespace-nowrap ${tableHeaderFontSizeClass} ${
                            col.id === 'purchases' ? 'bg-emerald-950 text-emerald-200' :
                            col.id === 'etihadExpense' ? 'bg-rose-950 text-rose-200' :
                            col.id === 'currentBalance' ? 'bg-teal-950 text-teal-200 font-black' : ''
                          }`}
                        >
                          {t(`finance:etihadPrint.col.${col.id}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 font-mono">
                    {page.items.map((record, rIdx) => {
                      const sequence = page.startIndex + rIdx + 1;
                      const isEven = rIdx % 2 === 1;
                      const salesTotal = (record.saharaSales || 0) + (record.cablesSales || 0) + (record.specialSales || 0) + (record.otherSales || 0);

                      return (
                        <tr
                          key={record.id}
                          className={`${isEven ? 'bg-slate-50/80' : 'bg-white'} border-b border-slate-200 text-slate-900`}
                        >
                          {activeCols.map(col => {
                            let cellContent: React.ReactNode = null;

                            switch (col.id) {
                              case 'index':
                                cellContent = <span className="text-slate-500 font-sans font-bold">{sequence}</span>;
                                break;
                              case 'date':
                                cellContent = <span className="font-sans font-bold">{record.date}</span>;
                                break;
                              case 'previousBalance':
                                cellContent = <span className="font-bold text-slate-700">{formatNumber(record.previousBalance)}</span>;
                                break;
                              case 'purchases':
                                cellContent = <span className="font-bold text-emerald-800">{formatNumber(record.purchases || 0)}</span>;
                                break;
                              case 'etihadExpense':
                                cellContent = <span className="font-bold text-rose-800">{formatNumber(record.etihadExpense || 0)}</span>;
                                break;
                              case 'saharaSales':
                                cellContent = <span className="text-slate-800">{formatNumber(record.saharaSales || 0)}</span>;
                                break;
                              case 'cablesSales':
                                cellContent = <span className="text-slate-800">{formatNumber(record.cablesSales || 0)}</span>;
                                break;
                              case 'otherSales':
                                cellContent = <span className="text-slate-800">{formatNumber(record.otherSales || 0)}</span>;
                                break;
                              case 'totalSales':
                                cellContent = <span className="font-bold text-slate-900">{formatNumber(salesTotal)}</span>;
                                break;
                              case 'currentBalance':
                                cellContent = <span className="font-black text-teal-900 text-[10.5px]">{formatNumber(record.currentBalance)}</span>;
                                break;
                              case 'price':
                                cellContent = <span>{record.currentPrice || 0}</span>;
                                break;
                              case 'notes':
                                cellContent = <span className="font-sans text-[9px] text-slate-600 line-clamp-1">{record.notes || '-'}</span>;
                                break;
                              default:
                                cellContent = '-';
                            }

                            return (
                              <td
                                key={col.id}
                                className={`${rowPaddingClass} px-2 border-e border-slate-300 ${ALIGN_CLASS[col.align]} whitespace-nowrap ${
                                  col.id === 'purchases' ? 'bg-emerald-50/30' :
                                  col.id === 'etihadExpense' ? 'bg-rose-50/30' :
                                  col.id === 'currentBalance' ? 'bg-teal-50/40 font-black' : ''
                                }`}
                              >
                                {cellContent}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Page Subtotal Footer */}
                  <tfoot>
                    <tr className="bg-slate-200/90 text-slate-950 font-black border-t-2 border-slate-800">
                      {activeCols.map((col, cIdx) => {
                        if (cIdx === 0) {
                          return (
                            <td key={col.id} colSpan={2} className="py-1.5 px-2 text-center border-e border-slate-400 font-sans text-[10px]">
                              {t('finance:etihadPrint.pageTotal', { count: page.items.length })}
                            </td>
                          );
                        }
                        if (cIdx === 1) return null; // skipped due to colSpan

                        let sumValue: React.ReactNode = '-';
                        if (col.id === 'purchases') sumValue = formatNumber(pagePurchases);
                        else if (col.id === 'etihadExpense') sumValue = formatNumber(pageExpense);
                        else if (col.id === 'totalSales') sumValue = formatNumber(pageSales);
                        else if (col.id === 'currentBalance' && page.items.length > 0) {
                          sumValue = formatNumber(page.items[0].currentBalance);
                        }

                        return (
                          <td
                            key={col.id}
                            className={`py-1.5 px-2 ${ALIGN_CLASS[col.align]} border-e border-slate-400 font-mono text-[10px] font-black`}
                          >
                            {sumValue}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>

            </div>

            {/* Bottom Area: Signatures & Enterprise Footer */}
            <div className="w-full shrink-0 pt-3 mt-3 border-t border-slate-300">
              {showSignatures && (
                <div className="grid grid-cols-4 gap-4 text-center text-[10.5px] text-slate-900 font-bold mb-3">
                  <div className="space-y-6">
                    <span>{t('finance:etihadPrint.sign.preparer')}</span>
                    <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto"></div>
                  </div>
                  <div className="space-y-6">
                    <span>{t('finance:etihadPrint.sign.audit')}</span>
                    <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto"></div>
                  </div>
                  <div className="space-y-6">
                    <span>{t('finance:etihadPrint.sign.manager')}</span>
                    <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto"></div>
                  </div>
                  <div className="space-y-6">
                    <span>{t('finance:etihadPrint.sign.approval')}</span>
                    <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto"></div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[9px] text-slate-500 font-sans pt-1 border-t border-slate-200">
                <span>{t('finance:etihadPrint.footer', { year: new Date().getFullYear() })}</span>
                <span className="font-mono font-bold text-slate-700">{t('finance:tanksReport.pageOf', { page: page.pageNumber, count: totalPages })}</span>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
};
