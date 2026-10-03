import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  SlidersHorizontal,
  FileSpreadsheet,
  LayoutTemplate,
  Sparkles,
  ChevronDown,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { EtihadBalanceRecord } from '../../types/finance';
import {
  EtihadPrintReport,
  ETIHAD_PRINT_COLUMNS,
  DEFAULT_ETIHAD_PRINT_COLUMNS,
  PrintPaperSize,
  PrintOrientation,
  PrintDensity
} from './EtihadPrintReport';
import { useLanguage } from '../../context/LanguageContext';

export interface EtihadPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: EtihadBalanceRecord[];
  filterDateLabel?: string;
}

export const EtihadPrintModal: React.FC<EtihadPrintModalProps> = ({
  isOpen,
  onClose,
  records,
  filterDateLabel = 'كافة السجلات'
}) => {
  const { tr } = useLanguage();

  // Print Configuration States with localStorage persistence
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('sahara_etihad_print_columns');
      if (saved) return { ...DEFAULT_ETIHAD_PRINT_COLUMNS, ...JSON.parse(saved) };
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_ETIHAD_PRINT_COLUMNS;
  });

  const [paperSize, setPaperSize] = useState<PrintPaperSize>('auto');
  const [orientation, setOrientation] = useState<PrintOrientation>('auto');
  const [density, setDensity] = useState<PrintDensity>('normal');
  const [showLogos, setShowLogos] = useState<boolean>(true);
  const [showKpiCards, setShowKpiCards] = useState<boolean>(true);
  const [showSignatures, setShowSignatures] = useState<boolean>(true);

  const [isColDropdownOpen, setIsColDropdownOpen] = useState<boolean>(false);
  const [previewZoom, setPreviewZoom] = useState<number>(0.85);

  React.useEffect(() => {
    try {
      localStorage.setItem('sahara_etihad_print_columns', JSON.stringify(visibleColumns));
    } catch (e) {
      console.error(e);
    }
  }, [visibleColumns]);

  const activeColCount = useMemo(() => {
    return ETIHAD_PRINT_COLUMNS.filter(c => visibleColumns[c.id] ?? c.defaultVisible).length;
  }, [visibleColumns]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <>
      {/* 🖨️ THE ONLY ACTIVE PRINT CONTAINER: Exactly 1 copy rendered for physical/PDF print */}
      <div className="print-only">
        <EtihadPrintReport
          records={records}
          filterDateLabel={filterDateLabel}
          visibleColumns={visibleColumns}
          paperSize={paperSize}
          orientation={orientation}
          density={density}
          showHeaderLogos={showLogos}
          showKpiCards={showKpiCards}
          showSignatures={showSignatures}
        />
      </div>

      {/* 🖥️ Screen-Only Modal Preview Container (strictly hidden during print) */}
      <div className="no-print fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
        <div
          className="w-full max-w-[1400px] h-[92vh] max-h-[950px] bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white"
          dir="rtl"
        >
        {/* ========================================================= */}
        {/* TOP BAR                                                   */}
        {/* ========================================================= */}
        <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-700 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
              <Printer className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {tr('معاينة وإعدادات طباعة وحفظ PDF - رصيد الاتحاد')}
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {activeColCount} {tr('أعمدة مفعّلة')}
                </span>
                {activeColCount > 8 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    {tr('وضع A4 الأفقي التلقائي')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {tr('تخصيص كامل للأعمدة، حجم الورقة، التواقيع والترويسة بدقة فيكتور عالية')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{tr('طباعة الآن / حفظ كـ PDF')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={tr('إغلاق')}
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* INTERACTIVE CONTROLS TOOLBAR                              */}
        {/* ========================================================= */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">

            {/* 1. Columns Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsColDropdownOpen(!isColDropdownOpen)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer shadow-2xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{tr('تحديد الأعمدة')}</span>
                <span className="px-1.5 py-0.2 bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200 rounded-md text-[10px] font-mono">
                  {activeColCount}/{ETIHAD_PRINT_COLUMNS.length}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isColDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isColDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsColDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 max-h-[380px] overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                      <span className="font-black text-slate-800 dark:text-slate-100 text-xs">
                        {tr('الأعمدة المضمنة بالطباعة')}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => {
                            const allTrue = ETIHAD_PRINT_COLUMNS.reduce((acc, c) => ({ ...acc, [c.id]: true }), {});
                            setVisibleColumns(allTrue);
                          }}
                          className="text-teal-600 hover:underline px-1 py-0.5 font-bold cursor-pointer"
                        >
                          {tr('عرض الكل')}
                        </button>
                        <span>|</span>
                        <button
                          type="button"
                          onClick={() => setVisibleColumns(DEFAULT_ETIHAD_PRINT_COLUMNS)}
                          className="text-slate-500 hover:underline px-1 py-0.5 font-bold cursor-pointer"
                        >
                          {tr('الافتراضي')}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      {ETIHAD_PRINT_COLUMNS.map((col) => {
                        const isChecked = visibleColumns[col.id] ?? col.defaultVisible;
                        return (
                          <label
                            key={col.id}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-teal-50/80 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setVisibleColumns(prev => ({
                                    ...prev,
                                    [col.id]: e.target.checked
                                  }));
                                }}
                                className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                              />
                              <span>{col.label}</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-normal">
                              {col.category}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 2. Paper Size Selector */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">{tr('المقاس')}:</span>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as PrintPaperSize)}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-bold focus:outline-none cursor-pointer text-xs"
              >
                <option value="auto" className="dark:bg-slate-800">{tr('تلقائي ذكي (Auto)')}</option>
                <option value="a4" className="dark:bg-slate-800">A4 (297×210)</option>
                <option value="a3" className="dark:bg-slate-800">A3 (420×297)</option>
                <option value="a2" className="dark:bg-slate-800">A2 (594×420)</option>
                <option value="legal" className="dark:bg-slate-800">Legal (طويل)</option>
              </select>
            </div>

            {/* 3. Orientation Selector */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs">
              <LayoutTemplate className="w-3.5 h-3.5 text-teal-600" />
              <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">{tr('الاتجاه')}:</span>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as PrintOrientation)}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-bold focus:outline-none cursor-pointer text-xs"
              >
                <option value="auto" className="dark:bg-slate-800">{tr('تلقائي (Auto)')}</option>
                <option value="landscape" className="dark:bg-slate-800">{tr('أفقي (Landscape)')}</option>
                <option value="portrait" className="dark:bg-slate-800">{tr('عمودي (Portrait)')}</option>
              </select>
            </div>

            {/* 4. Density */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs">
              <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">{tr('الكثافة')}:</span>
              <select
                value={density}
                onChange={(e) => setDensity(e.target.value as PrintDensity)}
                className="bg-transparent text-slate-800 dark:text-slate-200 font-bold focus:outline-none cursor-pointer text-xs"
              >
                <option value="compact" className="dark:bg-slate-800">{tr('مكثف (Compact)')}</option>
                <option value="normal" className="dark:bg-slate-800">{tr('قياسي (Normal)')}</option>
                <option value="relaxed" className="dark:bg-slate-800">{tr('مريح (Relaxed)')}</option>
              </select>
            </div>

            {/* 5. Toggles */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700 text-[11px]">
              <label className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLogos}
                  onChange={(e) => setShowLogos(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-3 h-3"
                />
                <span>{tr('الشعارات')}</span>
              </label>

              <label className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showKpiCards}
                  onChange={(e) => setShowKpiCards(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-3 h-3"
                />
                <span>{tr('المؤشرات')}</span>
              </label>

              <label className="flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSignatures}
                  onChange={(e) => setShowSignatures(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-3 h-3"
                />
                <span>{tr('التواقيع')}</span>
              </label>
            </div>

          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPreviewZoom(prev => Math.max(0.4, Number((prev - 0.1).toFixed(2))))}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 cursor-pointer"
              title={tr('تصغير')}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] font-bold w-12 text-center text-slate-700 dark:text-slate-300">
              {Math.round(previewZoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setPreviewZoom(prev => Math.min(1.5, Number((prev + 0.1).toFixed(2))))}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 cursor-pointer"
              title={tr('تكبير')}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom(0.85)}
              className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
              title={tr('إعادة ضبط المقياس')}
            >
              100%
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* LIVE PREVIEW CANVAS AREA                                  */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-200/80 dark:bg-slate-950/70 flex justify-center items-start custom-scrollbar">
          <div
            style={{
              transform: `scale(${previewZoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
            className="w-full max-w-[1100px] shrink-0"
          >
            <EtihadPrintReport
              records={records}
              filterDateLabel={filterDateLabel}
              visibleColumns={visibleColumns}
              paperSize={paperSize}
              orientation={orientation}
              density={density}
              showHeaderLogos={showLogos}
              showKpiCards={showKpiCards}
              showSignatures={showSignatures}
            />
          </div>
        </div>

      </div>
    </div>
    </>,
    document.body
  );
};
