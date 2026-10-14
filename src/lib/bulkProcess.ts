import { OFFICIAL_TABLE_TANK_UNITS } from '../components/tanks/TanksOverview';
import { readCentralTanks, resolveSaharaGasoilSectionKey, resolveSaharaPetrolSectionKey, setSectionTankLiters, tankLiters } from './centralTanks';
import { readTanksReportFile, slotLabel, TANKS_FILE_SLOTS } from './tanksReportFile';
import { attachDayReport } from './saharaFiles';
import { readSaharaReportFile } from './saharaReportFile';
import { readPetrolReportFile } from './petrolReportFile';
import { parseBlackOilReport } from './blackOilReportFile';
import { computeSahara, readSaharaRecords, updateSaharaRecords } from './saharaLedger';
import { computePetrol, readPetrolRecords, updatePetrolRecords, PETROL_STATIONS } from './petrolLedger';
import { BLACK_OIL_SECTION_KEYS, BLACK_OIL_SITES, computeBlackOil, getBlackOilAvgDaily, readBlackOilRecords, updateBlackOilRecords, type BlackOilCompany } from './blackOilLedger';
import { applySaharaReport, newSaharaBalanceForm, saharaDraft, saharaSaveBlockers, type SaharaStation } from './saharaBalanceForm';
import { applyPetrolReport, newPetrolForm, petrolRecord, petrolSaveBlockers, type PetrolStation } from './petrolForm';
import { applyBlackOilReport, blackOilDerived, blackOilRecord, blackOilSaveBlockers, newBlackOilForm } from './blackOilForm';
import type { BulkKind } from './bulkUpload';

/**
 * الرفع المتعدد التلقائي: كل ملف يمر بنفس دوال نافذة قسمه (التعبئة من الملف، بناء السجل، شروط الحفظ)
 * ثم يُحفظ ويُرفق بالأرشيف — بلا فتح النوافذ. اليوم المحفوظ يبقى بانتظار "تأكيد البيانات" كالمعتاد.
 * لا يُستبدل يوم موجود، ولا يُحفظ ملف بلا تاريخ (في النافذة كان المستخدم يرى التاريخ ويصححه).
 */
export type BulkSkipReason = 'noDate' | 'dateTaken' | 'noPrevious' | 'overCapacity' | 'noConsumption' | 'noAverage' | 'negative' | 'noStations' | 'noTanks' | 'noSites' | 'readFailed';

/** نتيجة شركة واحدة من ملف يخص الشركتين (تقرير النفط الأسود) */
export interface BulkCompanyOutcome { saved: boolean; reasons?: BulkSkipReason[] }

export interface BulkResult {
  status: 'saved' | 'skipped';
  date?: string;
  reasons?: BulkSkipReason[];
  /** ملاحظات لا تمنع الحفظ: مواقع غير مطابقة، فرق عن رصيد الكشف، فشل إرفاق الملف، ونتيجة كل شركة */
  notes?: { unmatched?: string[]; diff?: number; attachFailed?: boolean; tanksMissing?: string[]; tanksOver?: string[]; companies?: Partial<Record<BlackOilCompany, BulkCompanyOutcome>> };
  error?: string;
}

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

export const processBulkFile = async (kind: BulkKind, file: File, progress: (p: number) => void, canEdit: (perm: string) => boolean): Promise<BulkResult> => {
  progress(8);
  try {
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
      return {
        status: 'saved', date: record.date,
        notes: { unmatched: applied.unmatched.map(u => u.name), diff: applied.check?.diff || undefined, attachFailed: !attached }
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

    if (kind === 'tanks') {
      // ملف الخزانات: كميات 9 خزانات نفط أسود فقط → خزانات قسم النفط الأسود للصحاري بالترتيب
      const liters = await readTanksReportFile(file);
      progress(45);
      if (liters.every(v => v === null)) return { status: 'skipped', reasons: ['noTanks'] };
      const res = setSectionTankLiters(BLACK_OIL_SECTION_KEYS.sahara, liters, OFFICIAL_TABLE_TANK_UNITS);
      progress(80);
      if (!res.filled) return { status: 'skipped', reasons: ['noTanks'] };
      // خزانات الملف التي لم تُقرأ أو لا يقابلها خزان في القسم
      const missing = TANKS_FILE_SLOTS.filter((_, i) => liters[i] === null || i >= res.sectionSize).map(slotLabel);
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
