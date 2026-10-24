import { OFFICIAL_TABLE_TANK_UNITS } from '../components/tanks/TanksOverview';
import { readCentralTanks, resolveSaharaGasoilSectionKey, resolveSaharaPetrolSectionKey, setSectionTankLiters, tankLiters } from './centralTanks';
import { readTanksReportFile, slotLabel, TANKS_FILE_SLOTS } from './tanksReportFile';
import { attachDayReport, siteAnnualRecord } from './saharaFiles';
import { readSaharaReportFile } from './saharaReportFile';
import { importFarmsFromReport, readAnnualFarmsFile } from './siteFarmsFile';
import { importAnnual, type AnnualImport } from './siteFarms';
import { readPetrolReportFile } from './petrolReportFile';
import { parseBlackOilReport } from './blackOilReportFile';
import { computeSahara, readSaharaRecords, updateSaharaRecords } from './saharaLedger';
import { computePetrol, readPetrolRecords, updatePetrolRecords, PETROL_STATIONS } from './petrolLedger';
import { BLACK_OIL_SECTION_KEYS, BLACK_OIL_SITES, computeBlackOil, getBlackOilAvgDaily, readBlackOilRecords, updateBlackOilRecords, type BlackOilCompany } from './blackOilLedger';
import { applySaharaReport, newSaharaBalanceForm, saharaDraft, saharaSaveBlockers, type SaharaStation } from './saharaBalanceForm';
import { applyPetrolReport, newPetrolForm, petrolRecord, petrolSaveBlockers, type PetrolStation } from './petrolForm';
import { applyBlackOilReport, blackOilDerived, blackOilRecord, blackOilSaveBlockers, newBlackOilForm } from './blackOilForm';
import { readEtihadReportFile } from './etihadReportFile';
import { cascadeEtihadBalances } from './balanceCascade';
import { readEtihadLatestBalance, syncEtihadExtractionTank } from './centralTanks';
import { notifySyncedStorage } from './useSyncedStorage';
import { archiveKeyCounts, inboundRowDelivery, parseInboundFile, pickUnrecorded } from './inboundImport';
import { applyNameIndex, readNameIndex } from './nameIndex';
import type { EtihadBalanceRecord } from '../types/finance';
import type { InboundDelivery } from '../types';
import type { BulkKind } from './bulkUpload';

/**
 * الرفع المتعدد التلقائي: كل ملف يمر بنفس دوال نافذة قسمه (التعبئة من الملف، بناء السجل، شروط الحفظ)
 * ثم يُحفظ ويُرفق بالأرشيف — بلا فتح النوافذ. اليوم المحفوظ يبقى بانتظار "تأكيد البيانات" كالمعتاد.
 * لا يُستبدل يوم موجود، ولا يُحفظ ملف بلا تاريخ (في النافذة كان المستخدم يرى التاريخ ويصححه).
 */
export type BulkSkipReason = 'noDate' | 'dateTaken' | 'noPrevious' | 'overCapacity' | 'noConsumption' | 'noAverage' | 'negative' | 'noStations' | 'noTanks' | 'noSites' | 'noSite' | 'duplicate' | 'noRows' | 'readFailed';

/** نتيجة شركة واحدة من ملف يخص الشركتين (تقرير النفط الأسود) */
export interface BulkCompanyOutcome { saved: boolean; reasons?: BulkSkipReason[] }

export interface BulkResult {
  status: 'saved' | 'skipped';
  date?: string;
  reasons?: BulkSkipReason[];
  /** ملاحظات لا تمنع الحفظ: مواقع غير مطابقة، فرق عن رصيد الكشف، فشل إرفاق الملف، ونتيجة كل شركة */
  notes?: { unmatched?: string[]; diff?: number; attachFailed?: boolean; tanksMissing?: string[]; tanksOver?: string[]; farmsFailed?: boolean; site?: string; annual?: AnnualImport[]; companies?: Partial<Record<BlackOilCompany, BulkCompanyOutcome>>; inbound?: { added: number; recorded: number } };
  error?: string;
}

/** وارد الاتحاد: الشحنات الموجودة (مع ما أُضيف في نفس الرفع) والإضافة عبر مخزن التطبيق */
export interface BulkInboundStore {
  existing: () => Pick<InboundDelivery, 'company' | 'receiptUnloadDate' | 'date' | 'voucherNumber' | 'receiptNumber' | 'receivedQuantity' | 'volumeLiters'>[];
  add: (d: Omit<InboundDelivery, 'id'>) => void;
}
export interface BulkContext {
  /** تاريخ الملف (من فحصه): للشحنات التي بلا تاريخ في صفها */
  fileDate?: string | null;
  inbound?: BulkInboundStore;
}

const ETIHAD_KEY = 'sahara_etihad_balance_records_v2';
const ETIHAD_COMPANY = 'شركة الاتحاد' as const;
const SAHARA_COMPANY = 'صحاري كربلاء' as const;
const dayOf = (d: string) => (d || '').trim().split(' ')[0].replace(/-/g, '/');
const readEtihadRecords = (): EtihadBalanceRecord[] => {
  try { const v = JSON.parse(localStorage.getItem(ETIHAD_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};

const tanks = () => readCentralTanks(OFFICIAL_TABLE_TANK_UNITS).filter(t => !t.hidden);

/** محطات كاز الصحاري: نفس ما تعرضه صفحة الرصيد */
const saharaStations = (): SaharaStation[] => {
  const all = tanks();
  const key = resolveSaharaGasoilSectionKey(all);
  if (!key) return [];
  return all.filter(t => t.sectionKey === key)
    .map(t => ({ id: t.id, name: t.name.replace(/^موقع\s+/, ''), balance: tankLiters(t), capacity: t.capacityLiters }));
};

/** محطات البنزين: نفس ما تعرضه صفحة البنزين */
const petrolStations = (): PetrolStation[] => {
  const all = tanks();
  const clean = (n: string) => n.replace(/^موقع\s+/, '').trim();
  const key = resolveSaharaPetrolSectionKey(all);
  const petrolTanks = key ? all.filter(t => t.sectionKey === key) : [];
  return PETROL_STATIONS.map(({ name, capacity }) => {
    const pt = petrolTanks.find(p => clean(p.name) === name);
    return pt ? { id: pt.id, name, balance: tankLiters(pt), capacity: pt.capacityLiters || capacity } : { id: `st:${name}`, name, balance: 0, capacity };
  });
};

const tankSnapshot = () => Object.fromEntries(readCentralTanks(OFFICIAL_TABLE_TANK_UNITS).map(t => [t.id, t.levelMeters]));

/** إرفاق الملف بالأرشيف؛ فشله لا يلغي الحفظ لكنه يُذكر في النتيجة */
const attach = async (recordId: string, file: File) => {
  try { await attachDayReport(recordId, file); return true; } catch { return false; }
};

export const processBulkFile = async (kind: BulkKind, file: File, progress: (p: number) => void, canEdit: (perm: string) => boolean, ctx: BulkContext = {}): Promise<BulkResult> => {
  progress(8);
  try {
    if (kind === 'etihad-balance') {
      // كشف وقود الاتحاد: نفس حساب نافذة "تسجيل حركة رصيد" (الوارد ← المشتريات، الاستهلاك، المبيعات)
      const r = await readEtihadReportFile(file);
      progress(45);
      if (!r.date) return { status: 'skipped', reasons: ['noDate'] };
      const date = dayOf(r.date);
      const records = readEtihadRecords();
      if (records.some(x => dayOf(x.date) === date)) return { status: 'skipped', date, reasons: ['dateTaken'] };
      const before = records.filter(x => dayOf(x.date) < date).sort((a, b) => dayOf(b.date).localeCompare(dayOf(a.date)));
      const previous = before[0]?.currentBalance ?? r.previous;
      if (previous === null || previous === undefined) return { status: 'skipped', date, reasons: ['noPrevious'] };
      const purchases = r.inbound ?? 0, etihadExpense = r.consumption ?? 0, sales = r.sales ?? 0;
      const totalDeductions = etihadExpense + sales;
      if (totalDeductions > previous + purchases) return { status: 'skipped', date, reasons: ['negative'] };
      const currentBalance = previous + purchases - totalDeductions;
      const newest = [...records].sort((a, b) => dayOf(b.date).localeCompare(dayOf(a.date)))[0];
      const record: EtihadBalanceRecord = {
        id: `rec-${Date.now()}`,
        date,
        previousBalance: previous,
        purchases,
        etihadExpense,
        saharaSales: 0,
        cablesSales: 0,
        specialSales: 0,
        otherSales: sales,
        operationalGas: r.operationalGas ?? 0,
        cleanGas: r.cleanGas ?? 0,
        totalDeductions,
        currentBalance,
        oilPreviousBalance: 0,
        oilInbound: 0,
        oilSales: 0,
        oilCurrentBalance: 0,
        currentPrice: r.price ?? before[0]?.currentPrice ?? newest?.currentPrice ?? 0,
        averageCost: 535,
        notes: '',
        createdAt: new Date().toISOString(),
      };
      // الأيام اللاحقة يُعاد حساب رصيدها من هذا اليوم (كالحفظ من النافذة)
      localStorage.setItem(ETIHAD_KEY, JSON.stringify(cascadeEtihadBalances([record, ...records], date)));
      notifySyncedStorage(ETIHAD_KEY);
      const latest = readEtihadLatestBalance();
      if (latest !== null) syncEtihadExtractionTank(latest);
      progress(80);
      const attached = await attach(record.id, file);
      const diff = r.current !== null ? Math.round(currentBalance - r.current) : 0;
      return { status: 'saved', date, notes: { diff: diff || undefined, attachFailed: !attached } };
    }

    if (kind === 'etihad-inbound' || kind === 'sahara-inbound') {
      // ملف الوارد (الصحاري أو الاتحاد): كل شحنة غير مسجّلة (بصمة التاريخ + الفوجر + الكمية) تُضاف، والمسجّل يُتجاوز
      const company = kind === 'sahara-inbound' ? SAHARA_COMPANY : ETIHAD_COMPANY;
      if (!ctx.inbound) return { status: 'skipped', reasons: ['readFailed'] };
      const rows = applyNameIndex(await parseInboundFile(file), readNameIndex()).rows
        .map(row => ({ ...row, receiptUnloadDate: row.receiptUnloadDate || ctx.fileDate || '' }));
      progress(45);
      const dated = rows.filter(row => row.receiptUnloadDate);
      if (!rows.length) return { status: 'skipped', reasons: ['noRows'] };
      if (!dated.length) return { status: 'skipped', reasons: ['noDate'] };
      const picked = pickUnrecorded(dated, archiveKeyCounts(ctx.inbound.existing().filter(d => d.company === company)));
      if (!picked.rows.length) return { status: 'skipped', reasons: ['duplicate'] };
      for (const row of picked.rows) ctx.inbound.add(inboundRowDelivery(row, row.receiptUnloadDate, company));
      progress(80);
      const dates = picked.rows.map(row => row.receiptUnloadDate).sort();
      return { status: 'saved', date: dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} – ${dates[dates.length - 1]}`, notes: { inbound: { added: picked.rows.length, recorded: dated.length - picked.rows.length } } };
    }

    if (kind === 'balance') {
      const stations = saharaStations();
      if (!stations.length) return { status: 'skipped', reasons: ['noStations'] };
      const r = await readSaharaReportFile(file, stations.map(s => s.name));
      progress(45);
      if (!r.date) return { status: 'skipped', reasons: ['noDate'] };
      const records = readSaharaRecords();
      const computed = computeSahara(records);
      const applied = applySaharaReport(newSaharaBalanceForm(computed[computed.length - 1], stations), r, stations, computed);
      const blockers = saharaSaveBlockers(applied.form, records, computed, stations);
      progress(65);
      if (blockers.length) return { status: 'skipped', date: applied.form.date, reasons: blockers };
      const record = { ...saharaDraft(applied.form), id: `sah-${Date.now()}`, savedAt: new Date().toISOString() };
      updateSaharaRecords(prev => [...prev, record]);
      progress(80);
      const attached = await attach(record.id, file);
      // مزارع الموقع من نفس الكشف (لمن يملك تعديلها)؛ فشلها لا يلغي حفظ اليوم
      const farms = canEdit('sahara.reserves') ? await importFarmsFromReport(file, record.date).then(() => true, () => false) : true;
      return {
        status: 'saved', date: record.date,
        notes: { unmatched: applied.unmatched.map(u => u.name), diff: applied.check?.diff || undefined, attachFailed: !attached, farmsFailed: !farms || undefined }
      };
    }

    if (kind === 'petrol') {
      const stations = petrolStations();
      const data = await readPetrolReportFile(file, stations.map(s => s.name));
      progress(45);
      if (!data.date) return { status: 'skipped', reasons: ['noDate'] };
      const computed = computePetrol(readPetrolRecords());
      const applied = applyPetrolReport(newPetrolForm(computed, stations), data, stations, computed);
      const blockers = petrolSaveBlockers(applied.form, computed, stations);
      progress(65);
      if (blockers.length) return { status: 'skipped', date: applied.form.date, reasons: blockers };
      const record = petrolRecord(applied.form, computed);
      updatePetrolRecords(prev => [...prev, record]);
      progress(80);
      const attached = await attach(record.id, file);
      return { status: 'saved', date: record.date, notes: { unmatched: applied.unmatched, attachFailed: !attached } };
    }

    if (kind === 'site-annual') {
      // الملف السنوي لموقع (يُعاد رفعه يوميًا): يُدمج مع المحفوظ، والملف الذي لا جديد فيه مكرر
      const res = await readAnnualFarmsFile(file);
      progress(45);
      if (!res.site) return { status: 'skipped', reasons: ['noSite'] };
      const done = importAnnual(res.site, res.years);
      progress(80);
      if (!done.length) return { status: 'skipped', reasons: ['duplicate'] };
      // الملف نفسه يُحفظ في أرشيف تقرير مزارع الموقع (آخر ملف لكل موقع)
      const attached = await attach(siteAnnualRecord(res.site), file);
      return { status: 'saved', notes: { annual: done, site: res.site, attachFailed: !attached } };
    }

    if (kind === 'tanks') {
      // ملف الخزانات: نسب قسم النفط الأسود في الأعلى (الشكل الحالي) أو كميات 9 خزانات نفط أسود (القديم)
      // → خزانات قسم النفط الأسود للصحاري بالترتيب
      const reading = await readTanksReportFile(file);
      progress(45);
      if (reading.values.every(v => v === null)) return { status: 'skipped', reasons: ['noTanks'] };
      const res = setSectionTankLiters(BLACK_OIL_SECTION_KEYS.sahara, reading.values, OFFICIAL_TABLE_TANK_UNITS, reading.unit);
      progress(80);
      if (!res.filled) return { status: 'skipped', reasons: ['noTanks'] };
      // النسب: خزانات القسم التي لم تقابلها نسبة؛ القديم: خزانات الملف التي لم تُقرأ أو لا يقابلها خزان في القسم
      const missing = reading.unit === 'percent'
        ? res.unfilled
        : TANKS_FILE_SLOTS.filter((_, i) => reading.values[i] === null || i >= res.sectionSize).map(slotLabel);
      return { status: 'saved', notes: { tanksMissing: missing, tanksOver: res.over } };
    }

    // النفط الأسود: التقرير اليومي الواحد فيه مواقف الشركتين (الريان والسكر للاتحاد، والصحاري)،
    // فيُقرأ مرة واحدة ويُحفظ يوم كل شركة في سجلها (لمن يملك صلاحية تعديل نفطها الأسود)
    const all = [...BLACK_OIL_SITES.sahara, ...BLACK_OIL_SITES.etihad];
    const { sites: report, date } = await parseBlackOilReport(file, all.map(x => ({ key: x.key, words: x.words })));
    progress(45);
    if (!date) return { status: 'skipped', reasons: ['noDate'] };
    const companies = (['sahara', 'etihad'] as const).filter(c =>
      canEdit(c === 'sahara' ? 'sahara.black-oil' : 'etihad.black-oil') && BLACK_OIL_SITES[c].some(s => report[s.key]));
    if (!companies.length) return { status: 'skipped', date, reasons: ['noSites'] };
    const outcome: Partial<Record<BlackOilCompany, BulkCompanyOutcome>> = {};
    let saved: string | undefined;
    let attachFailed = false;
    for (const [n, company] of companies.entries()) {
      const sites = BLACK_OIL_SITES[company];
      const records = readBlackOilRecords(company);
      const computed = computeBlackOil(records);
      const form = applyBlackOilReport(newBlackOilForm(computed, getBlackOilAvgDaily(company), sites), report, date);
      const derived = blackOilDerived(form, computed, sites);
      const blockers = blackOilSaveBlockers(form, derived, records);
      if (blockers.length) { outcome[company] = { saved: false, reasons: blockers }; continue; }
      const record = blackOilRecord(form, derived, undefined, tankSnapshot);
      updateBlackOilRecords(company, prev => [...prev, record]);
      if (!(await attach(record.id, file))) attachFailed = true;
      outcome[company] = { saved: true };
      saved = record.date;
      progress(65 + Math.round(((n + 1) / companies.length) * 25));
    }
    if (!saved) {
      return { status: 'skipped', date, reasons: [...new Set(Object.values(outcome).flatMap(o => o?.reasons || []))], notes: { companies: outcome } };
    }
    return { status: 'saved', date: saved, notes: { attachFailed, companies: outcome } };
  } catch (e) {
    return { status: 'skipped', reasons: ['readFailed'], error: e instanceof Error ? e.message : String(e) };
  } finally {
    progress(100);
  }
};
