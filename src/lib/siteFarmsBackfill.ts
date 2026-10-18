import { farmsDates, importFarmsDay, readSiteFarms, FARM_SITES } from './siteFarms';
import { readDailyFarmsFile, type DailyFarmsResult } from './siteFarmsFile';
import { readSaharaRecords } from './saharaLedger';
import { fetchSaharaFileBlob, listSaharaFiles, type SaharaFile } from './saharaFiles';

/**
 * تحليل ملفات أرشيف كشف رصيد شركة الصحاري: كل ملف كشف مرفق بيوم في الأرشيف تُقرأ منه مزارع كل موقع
 * وتُحفظ لذلك اليوم (نفس ما يحدث عند حفظ كشف جديد)، فتكتمل أيام المزارع القديمة في صفحة مزارع الموقع.
 * التاريخ = تاريخ يوم الأرشيف، وإلا تاريخ الكشف داخل الملف. الملف الذي حُلّل مرة لا يُقرأ ثانيةً في هذا المتصفح.
 */

const DONE_KEY = 'sahara_site_farms_backfill_done_v1';
const readDone = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]') as string[]); } catch { return new Set(); }
};
const saveDone = (s: Set<string>) => { try { localStorage.setItem(DONE_KEY, JSON.stringify([...s])); } catch { /* تخزين المتصفح غير متاح */ } };

export interface BackfillDeps {
  list: () => Promise<SaharaFile[]>;
  fetchFile: (f: SaharaFile) => Promise<File>;
  read: (file: File) => Promise<DailyFarmsResult>;
  /** تاريخ يوم الأرشيف لكل سجل (YYYY/MM/DD) */
  recordDates: () => Map<string, string>;
}

const defaultDeps: BackfillDeps = {
  list: listSaharaFiles,
  fetchFile: async f => new File([await fetchSaharaFileBlob(f.id)], f.name, { type: f.type }),
  read: readDailyFarmsFile,
  recordDates: () => new Map(readSaharaRecords().map(r => [r.id, r.date])),
};

/** أيام فيها مزارع محفوظة لأي موقع */
const daysWithFarms = () => {
  const recs = readSiteFarms();
  return new Set(FARM_SITES.flatMap(s => farmsDates(recs, s)));
};

export interface BackfillProgress { done: number; total: number; days: number }

/** ملفات كشف رصيد الصحاري (سجلات sah-) التي لم تُحلَّل بعد ويومها بلا مزارع */
export const pendingArchiveFiles = async (deps: BackfillDeps = defaultDeps) => {
  const done = readDone();
  const dates = deps.recordDates();
  const have = daysWithFarms();
  return (await deps.list())
    .filter(f => f.record_id.startsWith('sah-') && /\.(pdf|xlsx|xls|xlsm)$/i.test(f.name) && !done.has(f.id))
    .filter(f => { const d = dates.get(f.record_id); return !d || !have.has(d); })
    // الأقدم أولًا: الأيام تُبنى بالترتيب
    .sort((a, b) => (dates.get(a.record_id) ?? '').localeCompare(dates.get(b.record_id) ?? '') || a.created_at - b.created_at);
};

/** يحلل الملفات ويحفظ مزارع كل يوم؛ يعيد عدد الأيام التي أُضيفت */
export const backfillFarmsFromArchive = async (onProgress?: (p: BackfillProgress) => void, deps: BackfillDeps = defaultDeps): Promise<BackfillProgress> => {
  const files = await pendingArchiveFiles(deps);
  const dates = deps.recordDates();
  const done = readDone();
  const prog: BackfillProgress = { done: 0, total: files.length, days: 0 };
  onProgress?.(prog);
  for (const f of files) {
    let file: File | null = null;
    try {
      file = await deps.fetchFile(f);
    } catch {
      // تعذّر التنزيل (الشبكة أو الخادم): يُعاد في المرة القادمة
    }
    if (file) {
      try {
        const res = await deps.read(file);
        const day = dates.get(f.record_id) || res.date;
        if (day && Object.keys(res.sites).length && importFarmsDay(day, res.sites).length) prog.days++;
      } catch {
        // ليس كشفًا يوميًا أو لا جدول مزارع فيه: لا يُعاد
      }
      done.add(f.id);
    }
    saveDone(done);
    prog.done++;
    onProgress?.({ ...prog });
  }
  return prog;
};
