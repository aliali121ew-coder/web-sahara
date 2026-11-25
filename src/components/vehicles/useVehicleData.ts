import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import {
  VEHICLE_FILES_KEY, VEHICLE_HIDDEN_KEY, fileDayStart, groupDayFills, previousDate, readVehicleFile, vehicleStats,
  type VehicleFile,
} from '../../lib/vehicleFuel';
import { removeVehicleFileRows, uploadVehicleSheets, useVehicleRefills } from '../../lib/vehicleRefillStore';

export type Scope = { kind: 'day'; date: string } | { kind: 'range'; from: string; to: string } | { kind: 'all' };

export interface UploadResult { name: string; ok: boolean; message: string; notes?: string[] }

/** بيانات تقرير العربات: الملفات المرفوعة وسطورها، والتحليل حسب النطاق المختار */
export const useVehicleData = (scope: Scope | null) => {
  const [files, setFiles] = useSyncedStorage<VehicleFile[]>(VEHICLE_FILES_KEY, []);
  // سطور التفويل من R2 (ملف لكل شهر) مع نسخة في IndexedDB على الجهاز — لا D1 ولا مساحة المتصفح المحدودة
  const { rows: refills, status: refillsStatus } = useVehicleRefills();

  // قائمة الملفات تُصفَّر كل يوم الساعة 7 صباحًا: يُحذف سجل الملف فقط وتبقى تفويلاته المخزنة
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(t); }, []);
  const recentFiles = useMemo(() => files.filter(f => Date.parse(f.uploadedAt) >= fileDayStart(now)), [files, now]);
  useEffect(() => {
    if (recentFiles.length !== files.length) setFiles(prev => prev.filter(f => Date.parse(f.uploadedAt) >= fileDayStart(Date.now())));
  }, [recentFiles.length, files.length, setFiles]);

  // العربات المحذوفة تُخفى من كل التحليل، وتفويلاتها تبقى في التخزين حتى تُستعاد
  const [hidden, setHidden] = useSyncedStorage<string[]>(VEHICLE_HIDDEN_KEY, []);
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const allFills = useMemo(() => groupDayFills(refills).filter(f => !hiddenSet.has(f.vehicle)), [refills, hiddenSet]);
  const hideVehicle = useCallback((v: string) => setHidden(prev => (prev.includes(v) ? prev : [...prev, v])), [setHidden]);
  const restoreVehicle = useCallback((v: string) => setHidden(prev => prev.filter(x => x !== v)), [setHidden]);
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
   * يرفع عدة ملفات، وكل ملف قد يضم عدة كشوف مدموجة. الكشف المرفوع مسبقًا (نفس الموقع والتاريخ وعدد العربات، أو نفس رقم المستند)
   * يُتخطى مع تنبيه، ويتحقق الخادم من ذلك على كل الكشوف المحفوظة؛ fallbackDate لسطور الكشف التي بلا تاريخ
   */
  const upload = useCallback(async (list: File[], fallbackDate = ''): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];
    for (const f of list) {
      try {
        const sheets = await readVehicleFile(f, fallbackDate);
        // التحقق من التكرار والدمج على الخادم (يرى كل الكشوف المرفوعة من كل الأجهزة)
        const out = await uploadVehicleSheets(sheets.map(s => ({ fileId: s.file.id, legacyId: s.legacyId, rows: s.refills })));
        const byId = new Map(out.map(r => [r.fileId, r]));
        const notes: string[] = [];
        for (const s of sheets) {
          const r = byId.get(s.file.id);
          if (r?.status === 'dup') notes.push(`كشف ${s.file.site} بتاريخ ${s.file.reportDate} (${s.file.rows} عربة) مسجل مسبقًا${s.file.docNo ? ` · مستند ${s.file.docNo}` : ''}`);
          else if (s.total !== null && s.total !== s.file.totalQty) notes.push(`${s.file.site} · ${s.file.reportDate}: مجموع الملف ${s.total.toLocaleString()} لا يطابق المقروء ${s.file.totalQty.toLocaleString()}`);
        }
        const dupRows = out.reduce((n, r) => n + r.dupRows, 0);
        if (dupRows) notes.push(`تخطّي ${dupRows} تفويلة مسجلة مسبقًا من كشف آخر`);
        const usable = sheets.filter(s => byId.get(s.file.id)?.status === 'ok');
        if (!usable.length) {
          const allDup = out.every(r => r.status === 'dup');
          const uniq = [...new Set(notes)];
          const single = allDup && uniq.length === 1;
          results.push({ name: f.name, ok: false, message: single ? uniq[0] : allDup ? 'التواريخ مسجلة مسبقًا — لم يُرفع شيء' : 'كل تفويلات الملف مسجلة مسبقًا — لم يُرفع شيء', notes: single ? [] : uniq });
          continue;
        }
        // قائمة ملفات اليوم (صغيرة وتُصفَّر كل يوم): بعدد السطور التي حُفظت فعلًا
        const kept = usable.map(s => {
          const n = byId.get(s.file.id)!.kept;
          const share = n === s.refills.length ? s.file.totalQty : Math.round(s.file.totalQty * (n / s.refills.length));
          return { ...s.file, rows: n, totalQty: share };
        });
        const ids = new Set(kept.map(k => k.id));
        setFiles(prev => [...kept, ...prev.filter(x => !ids.has(x.id))]);
        const rowsN = kept.reduce((n, k) => n + k.rows, 0);
        const liters = kept.reduce((n, k) => n + k.totalQty, 0).toLocaleString();
        const where = kept.length > 1 ? `${kept.length} كشوف` : kept[0].site;
        results.push({ name: f.name, ok: true, message: `${rowsN} سطر · ${liters} لتر · ${where}`, notes: [...new Set(notes)] });
      } catch (e) {
        results.push({ name: f.name, ok: false, message: e instanceof Error ? e.message : 'تعذّرت قراءة الملف' });
      }
    }
    return results;
  }, [setFiles]);

  const removeFile = useCallback((id: string) => {
    removeVehicleFileRows(id)
      .then(() => setFiles(prev => prev.filter(f => f.id !== id)))
      .catch(e => window.alert(e instanceof Error ? e.message : 'تعذّر حذف الكشف'));
  }, [setFiles]);

  return { files, recentFiles, refills, refillsStatus, allFills, dates, active, fills, stats, history, prevDay, prevTotal, upload, removeFile, hidden, hideVehicle, restoreVehicle };
};
