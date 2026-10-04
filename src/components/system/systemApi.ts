import { sessionHeaders } from '../../lib/session';

/** واجهة لوحة إدارة النظام (/api/system/*) — لمدير النظام فقط */

export interface BackupRow {
  id: string; kind: 'daily' | 'manual' | 'pre-restore' | 'monthly'; r2_key: string; size: number; raw_size: number;
  rows: number; tables: number; sha256: string; status: string; note: string; created_at: number; created_by: string;
}
export interface JobRow { id: number; name: string; started_at: number; finished_at: number; status: 'running' | 'ok' | 'error'; details: string; triggered_by: string }
export interface Usage { count: number; bytes: number; byPrefix: Record<string, { count: number; bytes: number }> }
export interface Overview {
  db: { latencyMs: number; sizeBytes: number | null; tables: { name: string; rows: number }[] };
  r2: { latencyMs: number; files: Usage; backups: Usage };
  collections: Record<string, number>;
  legacyFiles: number;
  lastBackup: BackupRow | null;
  nextRun: number;
  maintenance: { by: string; since: number; reason: string } | null;
  jobs: JobRow[];
}
export interface TablePage {
  name: string;
  columns: { name: string; type: string; pk: boolean; secret: boolean }[];
  total: number; offset: number; limit: number;
  rows: Record<string, unknown>[];
}
export interface R2File { key: string; size: number; uploaded: string; type: string; name: string | null }

export class SystemApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch('/api/system' + path, {
    ...init,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', ...sessionHeaders(), ...(init.headers || {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new SystemApiError(data.error || 'تعذّر الاتصال بالخادم', res.status);
  return data;
}
const post = <T>(path: string, body: unknown = {}) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const systemApi = {
  overview: () => call<Overview>('/overview'),
  table: (name: string, q: { offset?: number; limit?: number; q?: string } = {}) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    return call<TablePage>(`/tables/${encodeURIComponent(name)}?${p}`);
  },
  backups: () => call<{ items: BackupRow[] }>('/backups'),
  runBackup: () => post<{ item: BackupRow }>('/backups/run'),
  restore: (id: string) => post<{ restoredRows: number; preRestoreId: string }>(`/backups/${encodeURIComponent(id)}/restore`, { confirm: 'استرجاع' }),
  deleteBackup: (id: string) => call(`/backups/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  /** تنزيل نسخة كملف (عبر fetch لأن الطلب يحتاج ترويسات الجلسة) */
  download: async (row: BackupRow) => {
    const res = await fetch(`/api/system/backups/${encodeURIComponent(row.id)}/download`, { headers: sessionHeaders(), cache: 'no-store' });
    if (!res.ok) throw new SystemApiError('تعذّر تنزيل النسخة', res.status);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = row.r2_key.split('/').pop() || 'backup.json.gz';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
  files: (prefix: 'sahara/' | 'chat/', cursor?: string) => call<{ items: R2File[]; cursor: string | null }>(`/files?prefix=${prefix}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`),
  migrateFiles: () => post<{ moved: number; bytes: number }>('/files/migrate'),
  orphans: () => call<{ items: string[] }>('/files/orphans'),
  deleteOrphans: () => call<{ deleted: number }>('/files/orphans', { method: 'DELETE' }),
  jobs: () => call<{ items: JobRow[]; nextRun: number }>('/jobs'),
  runJob: (job: 'daily' | 'monthly' | 'cleanup', month?: string) => post<{ result: unknown }>('/maintenance/run', { job, month }),
  setMaintenance: (on: boolean, reason?: string) => post<{ maintenance: Overview['maintenance'] }>('/maintenance/mode', { on, reason }),
};

/** حجم مقروء: 1.2 MB */
export const fmtBytes = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
};
export const fmtNum = (n: number) => n.toLocaleString('en');
export const fmtDuration = (ms: number) => (ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)} ث` : `${Math.round(ms / 60_000)} د`);
