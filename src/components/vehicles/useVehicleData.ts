import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import {
  VEHICLE_FILES_KEY, VEHICLE_REFILLS_KEY, groupDayFills, previousDate, readVehicleFile, vehicleStats, withOrphanFiles,
  type VehicleFile, type VehicleRefill,
} from '../../lib/vehicleFuel';

export type Scope = { kind: 'day'; date: string } | { kind: 'range'; from: string; to: string } | { kind: 'all' };

export interface UploadResult { name: string; ok: boolean; message: string; notes?: string[] }

/** بيانات تقرير العربات: الملفات المرفوعة وسطورها، والتحليل حسب النطاق المختار */
export const useVehicleData = (scope: Scope | null) => {
  const [files, setFiles] = useSyncedStorage<VehicleFile[]>(VEHICLE_FILES_KEY, []);
  const [refills, setRefills] = useSyncedStorage<VehicleRefill[]>(VEHICLE_REFILLS_KEY, []);
  // أحدث التفويلات للرفع: الملفات تُرفع واحدًا تلو الآخر من نفس النداء ولا ينتظر كل ملف إعادة الرسم
  const latestRefills = useRef(refills);
  useEffect(() => { latestRefills.current = refills; }, [refills]);

  // الملفات تبقى محفوظة لتُقارن الأيام وتُصحَّح الكشوف القديمة، ومنها ما يُستعاد من تفويلاته (انظر withOrphanFiles)
  const allFiles = useMemo(() => withOrphanFiles(files, refills), [files, refills]);

  const allFills = useMemo(() => groupDayFills(refills), [refills]);
  const dates = useMemo(() => [...new Set(allFills.map(f => f.date))].sort(), [allFills]);
  const active: Scope = scope ?? (dates.length ? { kind: 'day', date: dates[dates.length - 1] } : { kind: 'all' });

  const fills = useMemo(
    () => (active.kind === 'all' ? allFills
      : active.kind === 'range' ? allFills.filter(f => f.date >= active.from && f.date <= active.to)
      : allFills.filter(f => f.date === active.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allFills, active.kind, active.kind === 'day' ? active.date : '', active.kind === 'range' ? `${active.from}|${active.to}` : '']
  );
  const stats = useMemo(() => vehicleStats(fills).sort((a, b) => b.total - a.total), [fills]);
  /** تاريخ كل عربة الكامل (للنافذة التفصيلية والمعدلات) بغض النظر عن النطاق */
  const history = useMemo(() => new Map(vehicleStats(allFills).map(s => [s.vehicle, s])), [allFills]);

  const prevDay = active.kind === 'day' ? previousDate(dates, active.date) : null;
  const prevTotal = useMemo(
    () => (prevDay ? allFills.filter(f => f.date === prevDay).reduce((s, f) => s + f.qty, 0) : null),
    [allFills, prevDay]
  );

  /**
   * يرفع عدة ملفات، وكل ملف قد يضم عدة كشوف مدموجة. الكشف المرفوع مسبقًا (نفس الموقع والتاريخ، أو نفس رقم المستند)
   * يُتخطى مع تنبيه، ويُقارن بالتفويلات لأنها الأصل؛ fallbackDate لسطور الكشف التي بلا تاريخ
   */
  const upload = useCallback(async (list: File[], fallbackDate = ''): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];
    for (const f of list) {
      try {
        // الأكبر أولًا: نسخة جزئية من كشف داخل نفس الملف المدموج تُتخطى ويبقى الكامل
        const sheets = (await readVehicleFile(f, fallbackDate)).sort((a, b) => b.file.rows - a.file.rows);
        const have = new Set(latestRefills.current.map(r => r.fileId));
        const fresh = sheets.filter(s => !have.has(s.file.id) && !!have.add(s.file.id));
        const skipped = sheets.filter(s => !fresh.includes(s));
        const notes = [
          ...skipped.map(({ file }) => `مرفوع مسبقًا ولم يُرفع: ${file.site} · ${file.docNo ? `مستند ${file.docNo}` : file.reportDate}`),
          ...fresh.filter(s => s.total !== null && s.total !== s.file.totalQty)
            .map(({ file, total }) => `${file.site} · ${file.reportDate}: مجموع الملف ${total?.toLocaleString()} لا يطابق المقروء ${file.totalQty.toLocaleString()}`),
        ];
        if (!fresh.length) {
          results.push({ name: f.name, ok: false, message: 'مرفوع مسبقًا — لم يُرفع شيء', notes });
          continue;
        }
        const ids = new Set(fresh.map(s => s.file.id));
        const rows = fresh.flatMap(s => s.refills);
        latestRefills.current = [...latestRefills.current, ...rows];
        setRefills(prev => [...prev.filter(r => !ids.has(r.fileId)), ...rows]);
        setFiles(prev => [...fresh.map(s => s.file), ...prev.filter(x => !ids.has(x.id))]);
        const liters = rows.reduce((s, r) => s + r.qty, 0).toLocaleString();
        const where = fresh.length > 1 ? `${fresh.length} كشوف` : fresh[0].file.site;
        results.push({ name: f.name, ok: true, message: `${rows.length} سطر · ${liters} لتر · ${where}`, notes });
      } catch (e) {
        results.push({ name: f.name, ok: false, message: e instanceof Error ? e.message : 'تعذّرت قراءة الملف' });
      }
    }
    return results;
  }, [setFiles, setRefills]);

  const removeFile = useCallback((id: string) => {
    setRefills(prev => prev.filter(r => r.fileId !== id));
    setFiles(prev => prev.filter(f => f.id !== id));
  }, [setFiles, setRefills]);

  return { files: allFiles, refills, allFills, dates, active, fills, stats, history, prevDay, prevTotal, upload, removeFile };
};
