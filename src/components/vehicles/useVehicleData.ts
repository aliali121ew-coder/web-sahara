import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import {
  VEHICLE_FILES_KEY, VEHICLE_REFILLS_KEY, groupDayFills, previousDate, readVehicleFile, vehicleStats,
  type VehicleFile, type VehicleRefill,
} from '../../lib/vehicleFuel';

export type Scope = { kind: 'day'; date: string } | { kind: 'range'; from: string; to: string } | { kind: 'all' };

export interface UploadResult { name: string; ok: boolean; message: string }

/** بيانات تقرير العربات: الملفات المرفوعة وسطورها، والتحليل حسب النطاق المختار */
export const useVehicleData = (scope: Scope | null) => {
  const [files, setFiles] = useSyncedStorage<VehicleFile[]>(VEHICLE_FILES_KEY, []);
  const [refills, setRefills] = useSyncedStorage<VehicleRefill[]>(VEHICLE_REFILLS_KEY, []);

  // قائمة الملفات تُصفَّر كل 24 ساعة: يُحذف سجل الملف فقط وتبقى تفويلاته المخزنة
  const DAY_MS = 24 * 60 * 60 * 1000;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(t); }, []);
  const recentFiles = useMemo(() => files.filter(f => now - Date.parse(f.uploadedAt) < DAY_MS), [files, now, DAY_MS]);
  useEffect(() => {
    if (recentFiles.length !== files.length) setFiles(prev => prev.filter(f => Date.now() - Date.parse(f.uploadedAt) < DAY_MS));
  }, [recentFiles.length, files.length, setFiles, DAY_MS]);

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

  /** يرفع عدة ملفات: كشف نفس الموقع واليوم يستبدل السابق؛ fallbackDate لسطور الكشف التي بلا تاريخ */
  const upload = useCallback(async (list: File[], fallbackDate = ''): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];
    for (const f of list) {
      try {
        const { file, refills: rows, total } = await readVehicleFile(f, fallbackDate);
        setRefills(prev => [...prev.filter(r => r.fileId !== file.id), ...rows]);
        setFiles(prev => [file, ...prev.filter(x => x.id !== file.id)]);
        const mismatch = total !== null && total !== file.totalQty ? ` — تنبيه: مجموع الملف ${total.toLocaleString()} لا يطابق المقروء` : '';
        results.push({ name: f.name, ok: true, message: `${file.rows} سطر · ${file.totalQty.toLocaleString()} لتر · ${file.site}${mismatch}` });
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

  return { files, recentFiles, refills, allFills, dates, active, fills, stats, history, prevDay, prevTotal, upload, removeFile };
};
