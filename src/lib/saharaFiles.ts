import i18n from '../i18n';
import { serverText } from '../i18n/errors';
import { useCallback, useEffect, useState } from 'react';
import { sessionHeaders } from './session';

/** مرفق (PDF أو Excel) لسجل يوم في رصيد شركة الصحاري — المحتوى على الخادم (worker: /api/files) */
export interface SaharaFile {
  id: string;
  record_id: string;
  name: string;
  type: string;
  size: number;
  created_at: number;
}

const CHANGE_EVENT = 'sahara-files-updated';
const headers = () => sessionHeaders();

// نوع الملف من الامتداد (بعض المتصفحات تترك نوع ملفات Excel فارغًا)
const TYPE_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};
export const ACCEPT_FILES = '.pdf,.xls,.xlsx';
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const fileKind = (f: Pick<SaharaFile, 'type' | 'name'>): 'pdf' | 'excel' =>
  f.type === 'application/pdf' || /\.pdf$/i.test(f.name) ? 'pdf' : 'excel';

const readError = async (res: Response, fallback: string) => {
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return serverText(data, fallback);
};

/** replaceId: الملف الذي سيُستبدل (يُسمح بنفس اسمه، ويُحذف بعد نجاح الرفع) */
export const uploadSaharaFile = async (recordId: string, file: File, replaceId?: string): Promise<void> => {
  const type = TYPE_BY_EXT[file.name.split('.').pop()?.toLowerCase() || ''];
  if (!type) throw new Error(`${file.name}: يُسمح بملفات PDF و Excel فقط`);
  // نفس حد الخادم (worker: MAX_FILE_BYTES) — يُرفض قبل الإرسال حتى لا يضيع وقت الرفع
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}: حجم الملف أكبر من 20MB`);
  const qs = new URLSearchParams({ record: recordId, name: file.name, ...(replaceId ? { replace: replaceId } : {}) });
  const res = await fetch(`/api/files?${qs}`, { method: 'POST', headers: { ...headers(), 'content-type': type }, body: file });
  if (!res.ok) throw new Error(`${file.name}: ${await readError(res, i18n.t('server:errors.upload_failed'))}`);
};

/** جلب محتوى الملف (الطلب يحتاج رمز الدخول، فلا يمكن فتحه كرابط مباشر) */
export const fetchSaharaFileBlob = async (id: string): Promise<Blob> => {
  const res = await fetch(`/api/files/${id}`, { headers: headers(), cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res, i18n.t('server:errors.open_failed')));
  return res.blob();
};

export const deleteSaharaFile = async (id: string): Promise<void> => {
  const res = await fetch(`/api/files/${id}`, { method: 'DELETE', headers: headers() });
  if (!res.ok) throw new Error(await readError(res, i18n.t('server:errors.delete_failed')));
};

/** قائمة المرفقات مجمّعة حسب السجل، مع رفع وحذف يحدّثان القائمة في كل الصفحات */
export const useSaharaFiles = () => {
  const [files, setFiles] = useState<SaharaFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null); // رقم السجل أو الملف الجاري رفعه/حذفه
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/files', { headers: headers(), cache: 'no-store' });
      if (!res.ok) throw new Error(await readError(res, i18n.t('server:errors.attachments_failed')));
      const data = (await res.json()) as { items: SaharaFile[] };
      setFiles(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تحميل المرفقات');
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => { refresh(); };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [refresh]);

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ');
    } finally {
      setBusy(null);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  };

  // نفس الملف (نفس الاسم والصيغة) لا يُرفع مرتين لنفس اليوم؛ الاسم المختلف أو الصيغة المختلفة مسموح
  const isDuplicate = (recordId: string, name: string, except?: string) =>
    files.some(f => f.record_id === recordId && f.id !== except && f.name.toLowerCase() === name.toLowerCase());

  const upload = (recordId: string, list: File[]) =>
    run(recordId, async () => {
      const seen = new Set<string>();
      const skipped: string[] = [];
      for (const f of list) {
        const key = f.name.toLowerCase();
        if (seen.has(key) || isDuplicate(recordId, f.name)) { skipped.push(f.name); continue; }
        seen.add(key);
        await uploadSaharaFile(recordId, f);
      }
      if (skipped.length) throw new Error(`مرفوع مسبقًا لهذا اليوم: ${skipped.join('، ')}`);
    });
  const remove = (id: string) => run(id, () => deleteSaharaFile(id));
  // تغيير ملف: يُرفع الجديد أولًا، ولا يُحذف القديم إلا بعد نجاح الرفع
  const replace = (old: SaharaFile, next: File) =>
    run(old.id, async () => {
      if (isDuplicate(old.record_id, next.name, old.id)) throw new Error(`مرفوع مسبقًا لهذا اليوم: ${next.name}`);
      await uploadSaharaFile(old.record_id, next, old.id);
      await deleteSaharaFile(old.id);
    });
  return { files, busy, error, clearError: () => setError(null), upload, remove, replace };
};
