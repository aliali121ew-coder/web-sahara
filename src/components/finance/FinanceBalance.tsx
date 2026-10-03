import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSessionState } from '../../lib/useSessionState';
import { Wallet } from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { useLanguage } from '../../context/LanguageContext';
import { EtihadBalanceRecord, EtihadSummaryMetrics } from '../../types/finance';
import { EtihadBalanceCards } from './EtihadBalanceCards';
import { EtihadBalanceTable } from './EtihadBalanceTable';
import { DateFilterRange } from '../../types/finance';
import { EtihadTransactionModal } from './EtihadTransactionModal';
import { EtihadQuickActions } from './EtihadQuickActions';
import { EtihadSubtabKey } from './EtihadBalanceHubTabs';
import { EtihadPortalHub } from './EtihadPortalHub';
import { EtihadTanksView } from './EtihadTanksView';
import { EtihadBlackOilView } from './EtihadBlackOilView';
import { EtihadMultiSiteReservesView } from './EtihadMultiSiteReservesView';
import { EtihadArchiveView } from './EtihadArchiveView';
import { EtihadReportsCenter } from './EtihadReportsCenter';
import { EtihadPrintReport } from './EtihadPrintReport';
import { EtihadPrintModal } from './EtihadPrintModal';
import { Breadcrumb } from '../navigation/Breadcrumb';
import { SaharaBalanceView } from './SaharaBalanceView';
import { SaharaReportsCenter } from './SaharaReportsCenter';
import { SaharaTanksView } from './SaharaTanksView';
import { SaharaPetrolView } from './SaharaPetrolView';
import { SaharaBlackOilView } from './SaharaBlackOilView';
import { SaharaSiteFarmsView } from './SaharaSiteFarmsView';
import { getBusinessDate } from '../../lib/utils';
import { readEtihadLatestBalance, syncEtihadExtractionTank } from '../../lib/centralTanks';

type CompanyKey = 'etihad' | 'sahara';

export const FinanceBalance: React.FC = () => {
  const { activeTab, setCurrentSubpage } = useFuelData();
  const { tr } = useLanguage();

  // Determine active company based on activeTab
  const [selectedCompany, setSelectedCompany] = useState<CompanyKey>(() => {
    if (activeTab === 'finance-sahara') return 'sahara';
    return 'etihad';
  });

  // 🌟 null = Hub View (The 6 feature portal cards)
  // When a card is clicked, enters that dedicated subpage!
  // تبقى الصفحة الفرعية المفتوحة بعد تحديث المتصفح
  const [activeSubtab, setActiveSubtabState] = useSessionState<EtihadSubtabKey | null>('etihad_subtab', null);

  const setActiveSubtab = (subtab: EtihadSubtabKey | null) => {
    setActiveSubtabState(subtab);
  };

  // صفحة الصحاري الفرعية المفتوحة (reserves = مزارع الموقع عند الصحاري)
  type SaharaSubtab = 'balance' | 'tanks' | 'black-oil' | 'reserves' | 'reports' | 'petrol';
  const [saharaSubtab, setSaharaSubtab] = useSessionState<SaharaSubtab | null>('sahara_subtab', null);
  const saharaTitles: Record<SaharaSubtab, string> = {
    balance: tr('رصيد شركة الصحاري'),
    tanks: tr('خزانات الصحاري'),
    'black-oil': tr('نفط أسود'),
    reserves: tr('مزارع الموقع'),
    reports: tr('تقارير الصحاري'),
    petrol: tr('بنزين الصحاري')
  };

  const handleBackToSaharaHub = () => {
    setSaharaSubtab(null);
    setCurrentSubpage(null);
  };

  const handleSelectSaharaSubpage = (subtab: EtihadSubtabKey | 'petrol') => {
    if (subtab !== 'archive') setSaharaSubtab(subtab);
  };

  // Listen for reset events from navigation
  useEffect(() => {
    const handleReset = () => {
      setActiveSubtabState(null);
      setSaharaSubtab(null);
      setCurrentSubpage(null);
    };
    window.addEventListener('sahara:reset-etihad-hub', handleReset);
    return () => window.removeEventListener('sahara:reset-etihad-hub', handleReset);
  }, [setCurrentSubpage]);

  // Restore subpage breadcrumbs on initial load if activeSubtab is present
  useEffect(() => {
    if (selectedCompany === 'sahara') {
      setCurrentSubpage(saharaSubtab
        ? {
            title: saharaTitles[saharaSubtab],
            category: tr('شركة الصحاري'),
            parentTab: 'finance-sahara',
            onBack: () => {
              setSaharaSubtab(null);
              setCurrentSubpage(null);
            }
          }
        : null);
    } else if (activeSubtab) {
      const titlesMap: Record<EtihadSubtabKey, string> = {
        balance: tr('رصيد الشركة'),
        tanks: tr('خزانات الاتحاد'),
        'black-oil': tr('نفط أسود'),
        reserves: tr('رصيد الاحتياطي'),
        archive: tr('أرشيف حركات رصيد الاتحاد'),
        reports: tr('تقارير الاتحاد')
      };

      setCurrentSubpage({
        title: titlesMap[activeSubtab],
        category: tr('شركة الاتحاد'),
        parentTab: 'finance-etihad',
        onBack: () => {
          setActiveSubtab(null);
          setCurrentSubpage(null);
        }
      });
    } else {
      setCurrentSubpage(null);
    }
  }, [activeSubtab, saharaSubtab, selectedCompany, tr, setCurrentSubpage]);

  // Sync if activeTab changes from external navigation (e.g. sidebar)
  // (لا يُعاد الضبط عند أول تحميل حتى تبقى الصفحة الفرعية بعد التحديث)
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    if (activeTab === 'finance-etihad' || activeTab === 'finance') {
      setSelectedCompany('etihad');
    } else if (activeTab === 'finance-sahara') {
      setSelectedCompany('sahara');
    }
    setActiveSubtabState(null);
    setSaharaSubtab(null);
  }, [activeTab]);

  // LocalStorage Persistence for Etihad Balance Records
  const [records, setRecords] = useState<EtihadBalanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('sahara_etihad_balance_records_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load etihad records from storage', e);
    }
    return []; // Empty initial state instead of INITIAL_ETIHAD_RECORDS
  });

  useEffect(() => {
    try {
      localStorage.setItem('sahara_etihad_balance_records_v2', JSON.stringify(records));
      // ملء خزان "موقع الاستخلاص" تلقائيًا من الرصيد الحالي لآخر يوم
      const latestBalance = readEtihadLatestBalance();
      if (latestBalance !== null) syncEtihadExtractionTank(latestBalance);
    } catch (e) {
      console.error('Failed to save etihad records', e);
    }
  }, [records]);

  // Date Filter State
  const [filterRange, setFilterRange] = useState<DateFilterRange>('week');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  
  // Active Record for Preview (Top Cards)
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  
  // Edit Mode (Toggle icons on hover)
  const [isEditMode, setIsEditMode] = useState(false);

  // 1. First date-filter the records
  const dateFilteredRecords = useMemo(() => {
    // الأحدث تاريخًا أولًا (ترتيب الإضافة ليس مضمونًا: قد يُضاف يوم أقدم بعد يوم أحدث)
    let result = [...records].sort((a, b) => b.date.localeCompare(a.date));
    if (filterRange === 'custom' && (appliedStartDate || appliedEndDate)) {
      result = result.filter(r => {
        const rowDate = r.date.replace(/\//g, '-');
        const afterStart = appliedStartDate ? rowDate >= appliedStartDate : true;
        const beforeEnd = appliedEndDate ? rowDate <= appliedEndDate : true;
        return afterStart && beforeEnd;
      });
    } else if (filterRange === 'today') {
      const today = getBusinessDate();
      result = result.filter(r => r.date === today);
    } else if (filterRange === 'week') {
      result = result.slice(0, 7); // Assuming records are already sorted desc
    }
    return result;
  }, [records, filterRange, appliedStartDate, appliedEndDate]);

  // 2. Compute live metrics based ONLY on dateFilteredRecords or activeRecordId
  const metrics: EtihadSummaryMetrics = useMemo(() => {
    // If a row is clicked, display its exact data in the cards
    if (activeRecordId) {
      const activeRecord = records.find(r => r.id === activeRecordId);
      if (activeRecord) {
        const totalSales = (activeRecord.saharaSales || 0) + (activeRecord.cablesSales || 0) + (activeRecord.specialSales || 0) + (activeRecord.otherSales || 0);
        return {
          previousBalance: activeRecord.previousBalance,
          currentBalance: activeRecord.currentBalance,
          todayInbound: activeRecord.purchases || 0,
          todayConsumption: activeRecord.etihadExpense || 0,
          todaySales: totalSales,
          averagePrice: activeRecord.currentPrice || 554,
          oilBalance: activeRecord.oilCurrentBalance || 0,
          averageCost: activeRecord.averageCost || 0,
          totalPurchases: activeRecord.purchases || 0,
          totalEtihadExpense: activeRecord.etihadExpense || 0,
          totalSaharaSales: activeRecord.saharaSales || 0,
          totalCablesSales: activeRecord.cablesSales || 0,
          totalSpecialSales: activeRecord.specialSales || 0,
          totalOtherSales: activeRecord.otherSales || 0,
          recordsCount: 1
        };
      }
    }

    // Determine the target date based on the filter
    const targetDate = filterRange === 'today' ? getBusinessDate() : null;

    if (dateFilteredRecords.length === 0) {
      // If no records for the filtered period, try to find the previous known balance
      let lastKnownBalance = 0; // Fallback default
      let lastKnownPrice = 0;
      
      if (records && records.length > 0) {
        // Find the most recent record overall (assuming they might be sorted by date desc, 
        // but let's be safe and sort them)
        const allSorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
        
        if (targetDate) {
          // Find the most recent record *before* the target date
          const previousRecords = allSorted.filter(r => r.date < targetDate);
          if (previousRecords.length > 0) {
            lastKnownBalance = previousRecords[0].currentBalance;
            lastKnownPrice = previousRecords[0].currentPrice || 554;
          } else if (allSorted.length > 0) {
            lastKnownBalance = allSorted[0].currentBalance;
            lastKnownPrice = allSorted[0].currentPrice || 554;
          }
        } else {
          lastKnownBalance = allSorted[0].currentBalance;
          lastKnownPrice = allSorted[0].currentPrice || 554;
        }
      }

      return {
        previousBalance: lastKnownBalance,
        currentBalance: lastKnownBalance,
        todayInbound: 0,
        todayConsumption: 0,
        todaySales: 0,
        oilBalance: 0,
        averageCost: 0,
        averagePrice: lastKnownPrice,
        totalPurchases: 0,
        totalEtihadExpense: 0,
        totalSaharaSales: 0,
        totalCablesSales: 0,
        totalSpecialSales: 0,
        totalOtherSales: 0,
        totalCost: 0,
        recordsCount: 0
      };
    }

    // The records array is always sorted newest-first by insertion order.
    // Therefore, dateFilteredRecords is also newest-first.
    const newestRecord = dateFilteredRecords[0];

    let totalInbound = 0;
    let totalConsumption = 0;
    let totalSales = 0;

    dateFilteredRecords.forEach(r => {
      totalInbound += (r.purchases || 0);
      totalConsumption += (r.etihadExpense || 0);
      totalSales += ((r.saharaSales || 0) + (r.cablesSales || 0) + (r.specialSales || 0) + (r.otherSales || 0));
    });

    const currentPrice = newestRecord.currentPrice || 554;

    // Based on user request, the previous balance should reflect the previous balance 
    // of the NEWEST record (the last transaction), regardless of the math of totals.
    const startBalance = newestRecord.previousBalance;

    return {
      previousBalance: startBalance, 
      currentBalance: newestRecord.currentBalance,   // Snapshot from newest
      todayInbound: totalInbound,                    // Aggregated
      todayConsumption: totalConsumption,            // Aggregated
      todaySales: totalSales,                        // Aggregated
      averagePrice: currentPrice,                    // Snapshot from newest
      
      // Keep others for type safety
      oilBalance: newestRecord.oilCurrentBalance || 0,
      averageCost: newestRecord.averageCost || 0,
      totalPurchases: totalInbound,
      totalEtihadExpense: totalConsumption,
      totalSaharaSales: 0,
      totalCablesSales: 0,
      totalSpecialSales: 0,
      totalOtherSales: 0,
      recordsCount: dateFilteredRecords.length
    };
  }, [dateFilteredRecords, records, filterRange, activeRecordId]);

  // Handle entering a subpage
  const handleSelectSubpage = (subtab: EtihadSubtabKey) => {
    setActiveSubtab(subtab);

    const titlesMap: Record<EtihadSubtabKey, string> = {
      balance: tr('رصيد الشركة'),
      tanks: tr('خزانات الاتحاد'),
      'black-oil': tr('نفط أسود'),
      reserves: tr('رصيد الاحتياطي'),
      archive: tr('أرشيف حركات رصيد الاتحاد'),
      reports: tr('تقارير الاتحاد')
    };

    setCurrentSubpage({
      title: titlesMap[subtab],
      category: tr('شركة الاتحاد'),
      parentTab: 'finance-etihad',
      onBack: () => {
        setActiveSubtab(null);
        setCurrentSubpage(null);
      }
    });
  };

  const handleBackToHub = () => {
    setActiveSubtab(null);
    setCurrentSubpage(null);
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<EtihadBalanceRecord | null>(null);

  // Handlers for Add, Edit, Delete
  const handleAddNew = () => {
    setEditingRecord(null);
    setIsModalOpen(true);
  };

  const handleEdit = (record: EtihadBalanceRecord) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const handleEditLatest = () => {
    if (records.length > 0) {
      handleEdit(records[0]);
    } else {
      handleAddNew();
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا السجل؟')) {
      setRecords(prev => prev.filter(r => r.id !== id));
      if (activeRecordId === id) setActiveRecordId(null);
    }
  };

  const handleDeleteMany = (ids: string[]) => {
    setRecords(prev => prev.filter(r => !ids.includes(r.id)));
    if (activeRecordId && ids.includes(activeRecordId)) {
      setActiveRecordId(null);
    }
  };

  const handleSaveRecord = (recordPayload: Omit<EtihadBalanceRecord, 'id'>, id?: string) => {
    if (id) {
      setRecords(prev => prev.map(r => r.id === id ? { ...recordPayload, id } : r));
    } else {
      const newRecord: EtihadBalanceRecord = {
        ...recordPayload,
        id: `rec-${Date.now()}`
      };
      setRecords(prev => [newRecord, ...prev]);
    }
  };

  const handleImportBackup = (imported: EtihadBalanceRecord[]) => {
    setRecords(imported);
  };

  const companyTitle = selectedCompany === 'etihad' ? tr('رصيد شركة الاتحاد') : tr('رصيد شركة الصحاري');

  const subpageTitlesMap: Record<EtihadSubtabKey, string> = {
    balance: companyTitle,
    tanks: tr('خزانات الاتحاد'),
    'black-oil': tr('نفط أسود'),
    reserves: tr('رصيد الاحتياطي'),
    archive: tr('أرشيف حركات رصيد الاتحاد'),
    reports: tr('تقارير الاتحاد')
  };

  const subpageDescriptionsMap: Record<EtihadSubtabKey, string> = {
    balance: tr('لوحة متابعة شاملة لأرصدة شركة الاتحاد، الخزانات، النفط الأسود، ورصيد الاحتياطي المتعدد'),
    tanks: tr('متابعة سعات الخزانات الاستراتيجية، مقاييس السوائل البصرية، وحساسات الحرارة والضغط.'),
    'black-oil': tr('المخزون الاستراتيجي المعتمد للنفط الأسود وتجهيز خطوط الإنتاج وأفران المعامل.'),
    reserves: tr('تأمين الاحتياطي الإستراتيجي الموزع على المواقع التشغيلية مع حدود الأمان الإلزامية.'),
    archive: tr('كشوفات الحسابات الدورية، المطابقة والتدقيق المالي، ومؤشرات الاستهلاك.'),
    reports: tr('المرجع الرسمي الموحّد لطباعة كشوفات وتقارير الشركة')
  };

  const activeSubpageTitle = activeSubtab ? subpageTitlesMap[activeSubtab] : companyTitle;
  const activeSubpageDescription = activeSubtab
    ? subpageDescriptionsMap[activeSubtab]
    : tr('لوحة متابعة شاملة لأرصدة شركة الاتحاد، الخزانات، النفط الأسود، ورصيد الاحتياطي المتعدد');

  return (
    <div className="flex-1 flex flex-col space-y-2">

      {/* 🖨️ Clean Printable Report for Browser Print (Hidden on Screen, Shown on Print only when modal is closed and not in archive) */}
      {selectedCompany === 'etihad' && !isPrintModalOpen && activeSubtab !== 'archive' && activeSubtab !== 'reports' && (
        <div className="print-only">
          <EtihadPrintReport
            records={dateFilteredRecords}
            filterDateLabel={filterRange === 'today' ? tr('سجلات اليوم') : filterRange === 'week' ? tr('آخر أسبوع') : tr('كافة السجلات')}
          />
        </div>
      )}

      {/* Main View depending on selected company */}
      {selectedCompany === 'etihad' ? (
        activeSubtab === null ? (
          /* ========================================================= */
          /* 1. MASTER HUB CONTAINER: Encloses Header + 6 Cards Inside  */
          /* ========================================================= */
          <div className="w-full flex-1 flex flex-col mx-auto">
            {/* 🌟 6 Portal Cards enclosed in Master Card 98% with Title 🌟 */}
            <EtihadPortalHub
              onSelectModule={sub => { if (sub !== 'petrol') handleSelectSubpage(sub); }}
              balanceLiters={metrics.currentBalance}
              tanksCapacity={24000000}
              blackOilLiters={38401951}
              reservesSitesCount={4}
            />
          </div>
        ) : (
          /* ========================================================= */
          /* 2. DEDICATED SEPARATE SUBPAGE VIEW                        */
          /* ========================================================= */
          <div className={`w-full mx-auto ${activeSubtab === 'tanks' || activeSubtab === 'archive' ? 'space-y-1.5' : 'space-y-2.5 sm:space-y-3'}`}>
            {/* Breadcrumb Path (مخفي في صفحة الخزانات والأرشيف لأن لهما ترويسة خاصة تتضمن المسار) — هامش ثابت وموحّد في كل صفحات البرنامج */}
            {activeSubtab !== 'tanks' && activeSubtab !== 'archive' && (
              <Breadcrumb
                items={[
                  { label: tr('شركة الاتحاد'), onClick: handleBackToHub },
                  { label: activeSubpageTitle }
                ]}
              />
            )}

            {/* Header with Title & Description (مخفي في صفحات الخزانات والأرشيف والتقارير لأن لها ترويسة خاصة) */}
            {activeSubtab !== 'tanks' && activeSubtab !== 'archive' && activeSubtab !== 'reports' && (
              <div className="!mt-2 w-full flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-soft-card">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-teal-600 via-teal-700 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                          {activeSubpageTitle}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {activeSubpageDescription}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dedicated Subpage View Content */}
            <div className={`${activeSubtab === 'tanks' ? 'space-y-2 pt-0' : 'space-y-3 sm:space-y-3.5'} animate-in fade-in duration-200`}>

              {/* View 1: رصيد الشركة (Company Balance) */}
              {activeSubtab === 'balance' && (
                <div className="space-y-3 sm:space-y-3.5">
                  {/* 1. Top 8 Modern KPI Cards */}
                  <EtihadBalanceCards metrics={metrics} coverageDays={107} />

                  {/* 2. Interactive Ledger Table */}
                  <EtihadBalanceTable
                    records={dateFilteredRecords}
                    filterRange={filterRange}
                    setFilterRange={setFilterRange}
                    appliedStartDate={appliedStartDate}
                    setAppliedStartDate={setAppliedStartDate}
                    appliedEndDate={appliedEndDate}
                    setAppliedEndDate={setAppliedEndDate}
                    onAddNew={handleAddNew}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onDeleteMany={handleDeleteMany}
                    activeRecordId={activeRecordId}
                    onRowClick={setActiveRecordId}
                    isEditMode={isEditMode}
                    maxRows={7}
                  />

                  {/* 3. Bottom Quick Actions Bar */}
                  <EtihadQuickActions
                    onAddNew={handleAddNew}
                    onEditLatest={handleEditLatest}
                    records={records}
                    onImportBackup={handleImportBackup}
                    isEditMode={isEditMode}
                    setIsEditMode={setIsEditMode}
                    onOpenPrintModal={() => setIsPrintModalOpen(true)}
                  />

                </div>
              )}

              {/* View 2: خزانات الاتحاد (Etihad Tanks) */}
              {activeSubtab === 'tanks' && (
                <EtihadTanksView onBack={handleBackToHub} />
              )}

              {/* View 3: نفط أسود (Black Oil) */}
              {activeSubtab === 'black-oil' && (
                <EtihadBlackOilView />
              )}

              {/* View 4: رصيد الاحتياطي (Multi-site Reserves) */}
              {activeSubtab === 'reserves' && (
                <EtihadMultiSiteReservesView />
              )}

              {/* View 6: مركز تقارير الاتحاد (Reports Center) */}
              {activeSubtab === 'reports' && (
                <EtihadReportsCenter
                  records={records}
                  onAddNew={handleAddNew}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDeleteMany={handleDeleteMany}
                  onImportBackup={handleImportBackup}
                  isEditMode={isEditMode}
                  setIsEditMode={setIsEditMode}
                />
              )}

              {/* View 5: أرشيف حركات رصيد الاتحاد (Etihad Balance Archive) */}
              {activeSubtab === 'archive' && (
                <EtihadArchiveView
                  records={records}
                  onBack={() => handleSelectSubpage('balance')}
                  onAddNew={handleAddNew}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDeleteMany={handleDeleteMany}
                  onImportBackup={handleImportBackup}
                  isEditMode={isEditMode}
                  setIsEditMode={setIsEditMode}
                />
              )}

            </div>
          </div>
        )
      ) : (
        /* شركة الصحاري: لوحة البطاقات، ورصيد الشركة مفعّل */
        saharaSubtab ? (
          <div className="w-full flex-1 flex flex-col mx-auto gap-2.5 sm:gap-3">
            {/* صفحة الخزانات لها ترويسة خاصة تتضمن المسار */}
            {saharaSubtab !== 'tanks' && (
              <Breadcrumb
                items={[
                  { label: tr('شركة الصحاري'), onClick: handleBackToSaharaHub },
                  { label: saharaTitles[saharaSubtab] }
                ]}
              />
            )}
            {saharaSubtab === 'balance' ? <SaharaBalanceView />
              : saharaSubtab === 'tanks' ? <SaharaTanksView onBack={handleBackToSaharaHub} />
              : saharaSubtab === 'black-oil' ? <SaharaBlackOilView />
              : saharaSubtab === 'reserves' ? <SaharaSiteFarmsView />
              : saharaSubtab === 'petrol' ? <SaharaPetrolView />
              : <SaharaReportsCenter />}
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col mx-auto">
            <EtihadPortalHub company="sahara" onSelectModule={handleSelectSaharaSubpage} />
          </div>
        )
      )}

      {/* Global Modals: Moved to root to avoid z-index / clipping issues from transform/animate-in */}
      <EtihadTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRecord}
        editRecord={editingRecord}
        lastRecordedPrice={metrics?.averagePrice || 0}
        defaultPreviousBalance={metrics?.currentBalance || 0}
      />

      {/* Global Print & PDF Modal */}
      <EtihadPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        records={dateFilteredRecords}
        filterDateLabel={filterRange === 'today' ? tr('سجلات اليوم') : filterRange === 'week' ? tr('آخر أسبوع') : tr('كافة السجلات')}
      />
    </div>
  );
};
