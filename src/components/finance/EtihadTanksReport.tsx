import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Droplets, Fuel, Layers, X, ChevronRight, ChevronLeft, History, LayoutGrid, Check, CalendarDays, Table2, ShieldCheck, Cylinder, ClipboardList } from 'lucide-react';
import { useBlackOilLedger, ComputedBlackOilRecord, BLACK_OIL_SECTION_KEYS, type BlackOilCompany } from '../../lib/blackOilLedger';
import { formatNumber, getBusinessDate } from '../../lib/utils';
import { useCentralTanks, resolveGasoilSectionKey, resolveSaharaGasoilSectionKey, tankLiters, getPreviousLiters } from '../../lib/centralTanks';
import { OFFICIAL_TABLE_TANK_UNITS, TankUnitRow } from '../tanks/TanksOverview';
import { OfficialReportHeaderRow } from '../print/OfficialReportHeader';
import { RealisticTank } from '../tanks/RealisticTank';
import { getBlackOilAvgDaily } from './BlackOilDailyLedger';
import { useTranslation, Trans } from 'react-i18next';

type GroupKey = 'black-oil' | 'gasoil';
type SectionKey = 'balances' | 'coverage' | 'drawings' | 'fill';

interface GroupData {
  key: GroupKey;
  title: string;
  dailyBurn: number; // لتر/يوم لحساب أيام التأمين
  tanks: TankUnitRow[];
  /** الشركة صاحبة الكشف (عنوان الكشف وبادئة رقم الوثيقة) */
  company: BlackOilCompany;
}

/** عناوين أقسام الكشف: finance:tanksReport.section.<key> */
const SECTION_KEYS: SectionKey[] = ['balances', 'coverage', 'drawings', 'fill'];

const SECTION_ICONS: Record<SectionKey, React.ElementType> = {
  balances: Table2,
  coverage: ShieldCheck,
  drawings: Cylinder,
  fill: ClipboardList
};

const TANKER_LITERS = 36000; // سعة الصهريج القياسية لحساب عدد الصهاريج المطلوبة

const pctOf = (t: TankUnitRow) => (t.capacityLiters ? (tankLiters(t) / t.capacityLiters) * 100 : 0);

// الحد الأدنى: تحته يتلوّن الخزان بالبرتقالي في الكشف (نسبة من السعة)
const ALARM_LOW = 20;

/** خزان أسطواني للطباعة: قبة، جسم، سطح سائل، ومسطرة جانبية — أزرق موحد، وبرتقالي تحت الحد الأدنى */
const PrintTank: React.FC<{ tank: TankUnitRow }> = ({ tank }) => {
  const { t } = useTranslation(['finance', 'common']);
  const p = Math.min(100, Math.max(0, pctOf(tank)));
  return (
    <div className="flex flex-col items-center text-center">
      <RealisticTank percent={p} alarmPercent={ALARM_LOW} />
      <div className="text-[11px] font-black text-slate-900 mt-1">{tank.name}</div>
      <div className="text-[18px] font-black font-mono tabular-nums text-slate-950 leading-tight">{p.toFixed(1)}%</div>
      <div className="text-[9px] font-mono text-slate-600">{t('finance:tanksReport.litersMeters', { liters: formatNumber(tankLiters(tank)), meters: tank.levelMeters.toFixed(2) })}</div>
    </div>
  );
};

const SectionTitle: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <div className="flex items-center gap-2 border-b border-slate-400 pb-1 mb-1.5">
    <span className="w-5 h-5 rounded-sm bg-slate-900 text-white text-[10px] font-black flex items-center justify-center">{n}</span>
    <span className="text-[11.5px] font-black text-slate-900">{children}</span>
  </div>
);

/** صفحة الكشف الرسمية لمجموعة خزانات واحدة */
const TanksReportPage: React.FC<{
  group: GroupData;
  sections: Record<SectionKey, boolean>;
  pageIndex: number;
  pageCount: number;
  issuedAt: Date;
  /** يوم العمل للكشف (لعمليات الحفظ السابقة) */
  asOfDate?: string;
}> = ({ group, sections, pageIndex, pageCount, issuedAt, asOfDate }) => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const today = asOfDate ?? getBusinessDate();
  const rows = group.tanks.map(t => {
    const prev = getPreviousLiters(t.id, today);
    return { tank: t, current: tankLiters(t), previous: prev?.liters ?? null, prevDate: prev?.date ?? null, pct: pctOf(t) };
  });
  const totalCurrent = rows.reduce((a, r) => a + r.current, 0);
  const totalCapacity = group.tanks.reduce((a, t) => a + t.capacityLiters, 0);
  const totalPrevious = rows.length && rows.every(r => r.previous !== null) ? rows.reduce((a, r) => a + (r.previous || 0), 0) : null;
  const totalPct = totalCapacity ? (totalCurrent / totalCapacity) * 100 : 0;
  const freeSpace = Math.max(0, totalCapacity - totalCurrent);
  const coverageDays = group.dailyBurn ? Math.floor(totalCurrent / group.dailyBurn) : 0;
  const coverageDate = (() => {
    const d = new Date(issuedAt);
    d.setDate(d.getDate() + coverageDays);
    return d.toLocaleDateString('en-CA').replace(/-/g, '/');
  })();
  const prevDateLabel = rows.find(r => r.prevDate)?.prevDate;
  const docNo = `${group.company === 'sahara' ? 'SH' : 'ET'}-TNK-${today.replace(/\//g, '')}-${String(pageIndex + 1).padStart(2, '0')}`;
  const issued = `${issuedAt.toLocaleDateString('en-CA').replace(/-/g, '/')} ${issuedAt.toTimeString().slice(0, 5)}`;

  const th = 'bg-slate-900 text-white px-2 py-1.5 text-[10px] font-black text-center border border-slate-900';
  const td = 'px-2 py-1.5 text-[10.5px] text-slate-800 text-center font-mono tabular-nums border-x border-slate-200';
  const zebra = (i: number) => (i % 2 ? 'bg-slate-50' : 'bg-white');
  const delta = (cur: number, prev: number | null) => {
    if (prev === null) return <span className="text-slate-400">—</span>;
    const d = cur - prev;
    if (d === 0) return <span className="text-slate-500">0</span>;
    return <span className={d > 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{d > 0 ? '▲' : '▼'} {formatNumber(Math.abs(d))}</span>;
  };

  const showRow1 = sections.balances || sections.coverage;
  const showRow2 = sections.drawings || sections.fill;
  let n = 0;

  return (
    <div className="print-page-box bg-white text-slate-900 p-6 print:p-0 w-full flex flex-col gap-3 text-start break-after-page font-cairo" dir={i18n.dir()}>
      {/* الترويسة + بيانات الوثيقة */}
      <header className="print-header report-header border-b-[3px] border-double border-slate-900 pb-2 block w-full">
        <OfficialReportHeaderRow badge={t('finance:tanksReport.badge')} title={t(group.company === 'sahara' ? 'finance:tanksReport.titleSahara' : 'finance:tanksReport.titleEtihad')} />
        <div className="mt-2 grid grid-cols-4 border border-slate-300 text-[9.5px]">
          {[
            [t('finance:tanksReport.meta.section'), group.title],
            [t('finance:tanksReport.meta.docNo'), docNo],
            [t('finance:tanksReport.meta.issued'), issued],
            [t('finance:tanksReport.meta.businessDay'), today]
          ].map(([k, v], i) => (
            <div key={k} className={`px-2.5 py-1 flex items-center justify-between gap-2 ${i ? 'border-r border-slate-300' : ''}`}>
              <span className="text-slate-500 font-bold">{k}</span>
              <span className="font-mono font-black text-slate-900">{v}</span>
            </div>
          ))}
        </div>
      </header>

      {group.tanks.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">{t('finance:tanksReport.noTanks')}</div>
      ) : (
        <>
          {/* شريط المؤشرات الرئيسية */}
          <div className="grid grid-cols-4 border border-slate-400">
            {[
              [t('finance:tanksReport.sum.capacity'), formatNumber(totalCapacity)],
              [t('finance:tanksReport.sum.current'), formatNumber(totalCurrent)],
              [t('finance:blackOil.col.fill'), `${totalPct.toFixed(1)}%`],
              [t('finance:tanksReport.sum.free'), formatNumber(freeSpace)]
            ].map(([k, v]) => (
              <div key={k} className="px-3 py-1.5 border-l border-slate-300">
                <div className="text-[9px] font-bold text-slate-500">{k}</div>
                <div className="text-[14px] font-black font-mono tabular-nums text-slate-950">{v}</div>
              </div>
            ))}
          </div>

          {/* الصف الأول: جدول الأرصدة 70% + مؤشر التأمين 30% */}
          {showRow1 && (
            <div className={`grid gap-4 ${sections.balances && sections.coverage ? 'grid-cols-[7fr_3fr]' : 'grid-cols-1'}`}>
              {sections.balances && (
                <div className="flex flex-col">
                  <SectionTitle n={++n}>{t('finance:tanksReport.section.balances')}</SectionTitle>
                  <table className="w-full flex-1 border-collapse border-b border-slate-300">
                    <thead>
                      <tr>
                        <th className={th}>{t('finance:tanksReport.col.no')}</th>
                        <th className={`${th} text-start`}>{t('finance:tanksReport.col.tank')}</th>
                        <th className={th}>{t('finance:tanksReport.col.previous')}{prevDateLabel && <div className="text-[8px] font-bold text-slate-300">{prevDateLabel}</div>}</th>
                        <th className={th}>{t('finance:tanksReport.col.current')}</th>
                        <th className={th}>{t('finance:tanksReport.col.change')}</th>
                        <th className={th}>{t('finance:tanksReport.col.pct')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r.tank.id} className={zebra(i)}>
                          <td className={td}>{i + 1}</td>
                          <td className={`${td} font-cairo font-bold text-start`}>{r.tank.name}</td>
                          <td className={td}>{r.previous === null ? '—' : formatNumber(r.previous)}</td>
                          <td className={`${td} font-black text-slate-950`}>{formatNumber(r.current)}</td>
                          <td className={td}>{delta(r.current, r.previous)}</td>
                          <td className={`${td} font-black`}>{r.pct.toFixed(1)}%</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-900 bg-slate-100">
                        <td className={`${td} font-cairo font-black`} colSpan={2}>{t('finance:archive.total')}</td>
                        <td className={`${td} font-black`}>{totalPrevious === null ? '—' : formatNumber(totalPrevious)}</td>
                        <td className={`${td} font-black text-slate-950`}>{formatNumber(totalCurrent)}</td>
                        <td className={td}>{delta(totalCurrent, totalPrevious)}</td>
                        <td className={`${td} font-black`}>{totalPct.toFixed(1)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {sections.coverage && (
                <div className="flex flex-col">
                  <SectionTitle n={++n}>{t('finance:tanksReport.coverageTitle')}</SectionTitle>
                  <div className="flex-1 border border-slate-400 p-3 flex flex-col justify-between gap-2">
                    <div className="flex items-baseline gap-1.5">
                      <Trans t={t} i18nKey="finance:tanksReport.coverageDays" count={coverageDays} components={{ 1: <span className="text-[34px] font-black leading-none text-slate-950 font-mono" />, 2: <span className="text-[12px] font-black text-slate-700" /> }} />
                    </div>
                    <div className="h-2 bg-slate-200">
                      <div className="h-full bg-slate-800" style={{ width: `${Math.min(100, (coverageDays / 120) * 100)}%` }} />
                    </div>
                    <table className="w-full text-[9.5px]">
                      <tbody>
                        <tr><td className="text-slate-500 py-0.5">{t('finance:saharaPetrol.runOutDate')}</td><td className="font-mono font-black text-end">{coverageDate}</td></tr>
                        <tr><td className="text-slate-500 py-0.5">{t('finance:ledger.dailyConsumption')}</td><td className="font-mono font-black text-end">{formatNumber(group.dailyBurn)} {t('common:units.liter')}</td></tr>
                        <tr><td className="text-slate-500 py-0.5">{t('finance:tanksReport.calcBalance')}</td><td className="font-mono font-black text-end">{formatNumber(totalCurrent)} {t('common:units.liter')}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* الصف الثاني: الوضع الحالي للخزانات + متطلبات الملء */}
          {showRow2 && (
            <div className={`grid gap-4 ${sections.drawings && sections.fill ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {sections.drawings && (() => {
                const idx = ++n;
                return (
                  <div className="border border-slate-400 rounded-md overflow-hidden flex flex-col">
                    <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-sm bg-white text-slate-900 text-[10px] font-black flex items-center justify-center">{idx}</span>
                      <span className="text-[11.5px] font-black">{t('finance:tanksReport.currentState')}</span>
                    </div>
                    <div className="flex-1 grid items-center divide-x divide-x-reverse divide-slate-200" style={{ gridTemplateColumns: `repeat(${Math.min(group.tanks.length, 4)}, minmax(0, 1fr))` }}>
                      {group.tanks.map(t => (
                        <div key={t.id} className="p-3">
                          <PrintTank tank={t} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {sections.fill && (
                <div className="flex flex-col">
                  <SectionTitle n={++n}>{t('finance:tanksReport.section.fill')}</SectionTitle>
                  <table className="w-full flex-1 border-collapse border-b border-slate-300">
                    <thead>
                      <tr>
                        <th className={`${th} text-start`}>{t('finance:tanksReport.col.tank')}</th>
                        <th className={th}>{t('finance:tanksReport.col.capacity')}</th>
                        <th className={th}>{t('finance:tanksReport.col.need')}</th>
                        <th className={th}>{t('finance:tanksReport.col.ratio')}</th>
                        <th className={th}>{t('finance:tanksReport.col.tankers')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.tanks.map((t, i) => {
                        const need = Math.max(0, t.capacityLiters - tankLiters(t));
                        return (
                          <tr key={t.id} className={zebra(i)}>
                            <td className={`${td} font-cairo font-bold text-start`}>{t.name}</td>
                            <td className={td}>{formatNumber(t.capacityLiters)}</td>
                            <td className={`${td} font-black text-slate-950`}>{formatNumber(need)}</td>
                            <td className={td}>{(100 - Math.min(100, pctOf(t))).toFixed(1)}%</td>
                            <td className={td}>{formatNumber(Math.ceil(need / TANKER_LITERS))}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-slate-900 bg-slate-100">
                        <td className={`${td} font-cairo font-black`}>{t('finance:archive.total')}</td>
                        <td className={`${td} font-black`}>{formatNumber(totalCapacity)}</td>
                        <td className={`${td} font-black text-slate-950`}>{formatNumber(freeSpace)}</td>
                        <td className={`${td} font-black`}>{(100 - totalPct).toFixed(1)}%</td>
                        <td className={`${td} font-black`}>{formatNumber(Math.ceil(freeSpace / TANKER_LITERS))}</td>
                      </tr>
                      <tr style={{ height: 1 }}>
                        <td colSpan={5} className="pt-1 text-[8px] text-slate-500 text-start">* {t('finance:tanksReport.tankerNote', { liters: formatNumber(TANKER_LITERS) })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* التواقيع + تذييل الوثيقة */}
      <footer className="mt-auto pt-2">
        {/* التواقيع بنفس تصميم كشف الوارد */}
        <div className="print-avoid-break mb-2">
          <div className="border border-slate-400 rounded p-1.5 bg-slate-50">
            <div className="text-[9px] font-black text-slate-900 mb-0.5 border-b border-slate-300 pb-0.5 flex items-center justify-between">
              <span>{t('finance:tanksReport.approval.title')}</span>
              <span className="text-[8px] font-bold text-slate-600">{t('finance:tanksReport.approval.central')}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[t('common:print.role.tanks'), t('common:print.role.site'), t('common:print.role.general')].map(r => (
                <div key={r} className="border border-dashed border-slate-400 rounded p-1 bg-white flex flex-col justify-between">
                  <span className="text-[8.5px] font-black text-slate-800 block">{r}</span>
                  <div className="h-5 border-b border-slate-200 my-0.5"></div>
                  <span className="text-[7.5px] text-slate-500 block">{t('common:print.signature')}</span>
                </div>
              ))}
              <div className="border border-dashed border-slate-400 rounded p-1 bg-white flex flex-col justify-between">
                <span className="text-[8.5px] font-black text-slate-800 block">{t('finance:tanksReport.approval.stampTitle')}</span>
                <div className="h-5 border-b border-slate-200 my-0.5 flex items-center justify-center">
                  <span className="text-[7px] text-slate-400 border border-slate-300 px-2 rounded font-sans">{t('finance:tanksReport.approval.stamp')}</span>
                </div>
                <span className="text-[7.5px] text-slate-500 block">{t('finance:tanksReport.approval.final')}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 mt-2 pt-1 text-[8.5px] text-slate-400">
          <span>{t('finance:tanksReport.issuedBy', { docNo })}</span>
          <span className="font-mono">{t('finance:tanksReport.pageOf', { page: pageIndex + 1, count: pageCount })}</span>
        </div>
      </footer>
    </div>
  );
};

/** تبويب "جرد الخزانات": سجل عمليات الحفظ (10 لكل صفحة) + معاينة وطباعة كشف كل عملية */
export const EtihadTanksReport: React.FC<{ company?: BlackOilCompany }> = ({ company = 'etihad' }) => {
  const { t, i18n } = useTranslation(['finance', 'common']);
  const [centralTanks] = useCentralTanks(OFFICIAL_TABLE_TANK_UNITS);
  const { computed } = useBlackOilLedger(company);
  const blackOilKey = BLACK_OIL_SECTION_KEYS[company];
  const [groupChoice, setGroupChoice] = useState<'black-oil' | 'gasoil' | 'both'>('both');
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ balances: true, coverage: true, drawings: true, fill: true });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ComputedBlackOilRecord | null>(null);
  const [showSections, setShowSections] = useState(false);
  const PAGE_SIZE = 10;

  // سعة خزانات النفط الأسود (لنسبة الامتلاء والمطلوب للامتلاء في سجل العمليات)
  const blackOilCapacity = useMemo(
    () => centralTanks.filter(t => t.sectionKey === blackOilKey).reduce((a, t) => a + t.capacityLiters, 0),
    [centralTanks, blackOilKey]
  );

  const saves = useMemo(() => [...computed].reverse(), [computed]);
  const totalPages = Math.max(1, Math.ceil(saves.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageRows = saves.slice(startIndex, startIndex + PAGE_SIZE);

  // الخزانات كما كانت وقت الحفظ (مناسيب العملية المختارة فوق تعريفات الخزانات الحالية)
  const tanksAtSave = useMemo(() => {
    const snap = selected?.tanksSnapshot;
    if (!snap) return centralTanks;
    return centralTanks.map(t => (snap[t.id] !== undefined ? { ...t, levelMeters: snap[t.id] } : t));
  }, [centralTanks, selected]);

  const groups: GroupData[] = useMemo(() => {
    const gasoilKey = company === 'sahara' ? resolveSaharaGasoilSectionKey(tanksAtSave) : resolveGasoilSectionKey(tanksAtSave);
    return [
      { key: 'black-oil', title: t('finance:tanksReport.group.blackOil'), company, dailyBurn: selected?.avgDaily ?? getBlackOilAvgDaily(company), tanks: tanksAtSave.filter(t => t.sectionKey === blackOilKey) },
      { key: 'gasoil', title: t('finance:tanksReport.group.gasoil'), company, dailyBurn: 175000, tanks: gasoilKey ? tanksAtSave.filter(t => t.sectionKey === gasoilKey) : [] }
    ];
  }, [tanksAtSave, selected, company, blackOilKey]);

  const selectedGroups = groups.filter(g => groupChoice === 'both' || g.key === groupChoice);
  const anySection = Object.values(sections).some(Boolean);

  const groupOptions = [
    { key: 'black-oil' as const, label: t('finance:tanksReport.group.blackOil'), icon: Droplets },
    { key: 'gasoil' as const, label: t('finance:tanksReport.group.gasoil'), icon: Fuel },
    { key: 'both' as const, label: t('finance:tanksReport.group.both'), icon: Layers }
  ];

  const issuedAt = useMemo(
    () => (selected?.savedAt ? new Date(selected.savedAt) : selected ? new Date(selected.date.replace(/\//g, '-') + 'T12:00:00') : new Date()),
    [selected]
  );
  const pages = (withKeys: boolean) =>
    selectedGroups.map((g, i) => (
      <TanksReportPage
        key={withKeys ? g.key : undefined}
        group={g}
        sections={sections}
        pageIndex={i}
        pageCount={selectedGroups.length}
        issuedAt={issuedAt}
        asOfDate={selected?.date}
      />
    ));

  const th = 'p-3.5';

  return (
    <>
      <div className="no-print">
        {/* سجل عمليات الحفظ */}
        <div className="!mt-2 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>{t('finance:tanksReport.logTitle')}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('finance:tanksReport.logHint')}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-[#eef2f8] dark:bg-[#1c2b44] text-[#1c3b6f] dark:text-blue-100 border-b-2 border-[#1c3b6f]/70 dark:border-blue-900 font-black text-[11.5px] whitespace-nowrap font-sans select-none">
                  <th className={th}>#</th>
                  <th className={th}>{t('finance:tanksReport.col.prevBalance')}</th>
                  <th className={th}>{t('finance:blackOil.form.inboundL')}</th>
                  <th className={th}>{t('finance:blackOil.form.consumptionL')}</th>
                  <th className={th}>{t('finance:tanksReport.col.currentShort')}</th>
                  <th className={th}>{t('finance:blackOil.col.fill')}</th>
                  <th className={th}>{t('finance:tanksReport.col.needFull')}</th>
                  <th className={th}>{t('finance:blackOil.col.date')}</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-sm text-slate-500 dark:text-slate-400 font-sans">
                      {t('finance:tanksReport.logEmpty')}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r, idx) => {
                    const fill = blackOilCapacity ? (r.current / blackOilCapacity) * 100 : 0;
                    const need = Math.max(0, blackOilCapacity - r.current);
                    return (
                      <tr key={r.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors whitespace-nowrap">
                        <td className="p-3.5 text-slate-400 font-sans text-center">{startIndex + idx + 1}</td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-300">{formatNumber(r.previous)}</td>
                        <td className="p-3.5 font-bold text-emerald-600 dark:text-emerald-400">{formatNumber(r.inbound)}</td>
                        <td className="p-3.5 font-bold text-red-600 dark:text-red-400">{formatNumber(r.consumption)}</td>
                        <td className="p-3.5 font-black text-slate-900 dark:text-white">{formatNumber(r.current)}</td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2 min-w-[110px]">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, Math.max(0, fill))}%` }} />
                            </div>
                            <span className="font-black text-slate-900 dark:text-white">{fill.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-700 dark:text-slate-300">{formatNumber(need)}</td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white font-sans">{r.date}</td>
                        <td className="p-3.5">
                          <button
                            type="button"
                            onClick={() => setSelected(r)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-[11px] font-bold cursor-pointer active:scale-95 transition-all font-sans"
                            title={r.tanksSnapshot ? t('finance:tanksReport.printThis') : t('finance:tanksReport.printOld')}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            {t('common:print.print')}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {saves.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-600 dark:text-slate-400">
                <Trans
                  t={t}
                  i18nKey="common:pagination.showing"
                  values={{ from: startIndex + 1, to: startIndex + pageRows.length, total: saves.length }}
                  components={{ 1: <strong className="font-bold text-slate-900 dark:text-white font-mono" />, 2: <strong className="font-bold text-blue-700 dark:text-blue-400 font-mono" /> }}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1"
                >
                  <ChevronRight className="w-4 h-4 ltr:rotate-180" />
                  <span>{t('common:pagination.prev')}</span>
                </button>
                <div className="flex items-center gap-1 mx-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => totalPages <= 5 || p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .map((p, i, arr) => (
                      <React.Fragment key={p}>
                        {i > 0 && p - arr[i - 1] > 1 && <span className="px-1 text-slate-400 font-mono">...</span>}
                        <button
                          type="button"
                          onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-xl font-bold font-mono text-xs cursor-pointer ${
                            safePage === p
                              ? 'bg-blue-600 text-white font-black'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1"
                >
                  <span>{t('common:pagination.next')}</span>
                  <ChevronLeft className="w-4 h-4 ltr:rotate-180" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* معاينة كشف العملية المختارة ثم الطباعة */}
      {selected && createPortal(
        <div className="no-print fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" dir={i18n.dir()} onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-6xl max-h-full flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
                  <Printer className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-black text-slate-900 dark:text-white leading-tight whitespace-nowrap">{t('finance:tanksReport.previewTitle')}</div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      <CalendarDays className="w-3 h-3 text-blue-600" />
                      <span className="font-mono">{selected.date}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-nowrap items-center gap-2 shrink-0">
                <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                  {groupOptions.map(o => {
                    const Icon = o.icon;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setGroupChoice(o.key)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                          groupChoice === o.key ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                {/* مربع الأقسام: يفتح شبكة 2×2 لاختيار أقسام الكشف */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSections(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                      showSections ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    {t('finance:tanksReport.sectionsLabel')}
                    <span className="font-mono px-1.5 rounded-md bg-blue-600 text-white text-[10px]">{Object.values(sections).filter(Boolean).length}/4</span>
                  </button>
                  {showSections && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowSections(false)} />
                      <div className="absolute left-0 top-full mt-1 z-20 w-[17rem] p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl grid grid-cols-2 gap-1">
                        {SECTION_KEYS.map(k => {
                          const Icon = SECTION_ICONS[k];
                          const on = sections[k];
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setSections(prev => ({ ...prev, [k]: !prev[k] }))}
                              className={`flex items-center gap-1.5 h-8 px-2 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all whitespace-nowrap ${
                                on
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300'
                              }`}
                            >
                              <span className={`shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center ${on ? 'bg-blue-600 text-white' : 'border border-slate-300 dark:border-slate-600'}`}>
                                {on && <Check className="w-2.5 h-2.5" />}
                              </span>
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <span>{t(`finance:tanksReport.section.${k}`)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                {/* الطباعة والإغلاق متجاوران دائمًا */}
                <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={!anySection}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  {t('common:print.print')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="group flex items-center gap-1.5 pl-3 pr-2 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-sm hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-slate-100 dark:hover:text-slate-900 cursor-pointer active:scale-95 transition-all"
                  title={t('common:actions.close')}
                >
                  <span className="w-5 h-5 rounded-lg bg-slate-100 dark:bg-slate-700 group-hover:bg-white/15 dark:group-hover:bg-slate-900/10 flex items-center justify-center transition-colors">
                    <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </span>
                  {t('common:actions.close')}
                </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-700/50 dark:bg-slate-950/90">
              {anySection ? (
                <div className="space-y-5 min-w-[900px]">
                  {selectedGroups.map((g, i) => (
                    <div key={g.key} className="rounded-xl shadow-2xl border border-slate-400 overflow-hidden bg-white">
                      <TanksReportPage group={g} sections={sections} pageIndex={i} pageCount={selectedGroups.length} issuedAt={issuedAt} asOfDate={selected.date} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-sm text-slate-200">{t('finance:tanksReport.pickSection')}</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* نسخة الطباعة (للعملية المختارة فقط) */}
      {selected && anySection && <div className="print-only">{pages(true)}</div>}
    </>
  );
};

export default EtihadTanksReport;
