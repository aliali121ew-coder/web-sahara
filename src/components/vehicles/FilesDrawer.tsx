/* eslint-disable i18next/no-literal-string */
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Search, Trash2, Upload, X } from 'lucide-react';
import type { VehicleFile } from '../../lib/vehicleFuel';

/** لون ثابت لكل مستخدم (من اسمه) لصورته الرمزية */
const AVATAR = [
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
];
const avatarTone = (name: string) => AVATAR[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];

const dayKey = (iso: string) => new Date(iso).toDateString();
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 86400000);
  const date = d.toLocaleDateString('ar-IQ-u-nu-latn', { weekday: 'long', day: '2-digit', month: '2-digit' });
  return d.toDateString() === today.toDateString() ? `اليوم · ${date}` : d.toDateString() === y.toDateString() ? `أمس · ${date}` : date;
};
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('ar-IQ-u-nu-latn', { hour: '2-digit', minute: '2-digit' });

/** الملفات المرفوعة: كارت لكل ملف بمن رفعه ومتى، مجمّعة حسب يوم الرفع مع بحث وفلترة بالمستخدم */
export const FilesDrawer: React.FC<{
  files: VehicleFile[];
  editable: boolean;
  onRemove: (id: string) => void;
  onUpload: () => void;
  onClose: () => void;
}> = ({ files, editable, onRemove, onUpload, onClose }) => {
  const [q, setQ] = useState('');
  const [user, setUser] = useState<string | null>(null);

  // الكروت المستعادة بلا وقت رفع تأتي آخر القائمة، الأحدث كشفًا أولًا
  const sorted = useMemo(() => [...files].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt) || b.reportDate.localeCompare(a.reportDate)), [files]);
  const users = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of sorted) m.set(f.by || 'غير معروف', (m.get(f.by || 'غير معروف') || 0) + 1);
    return [...m.entries()];
  }, [sorted]);
  const total = useMemo(() => files.reduce((s, f) => s + f.totalQty, 0), [files]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = sorted.filter(f => (!user || (f.by || 'غير معروف') === user)
      && (!needle || `${f.name} ${f.site} ${f.by} ${f.reportDate}`.toLowerCase().includes(needle)));
    const out: { key: string; label: string; files: VehicleFile[] }[] = [];
    for (const f of list) {
      const k = f.uploadedAt ? dayKey(f.uploadedAt) : 'old';
      const g = out.find(x => x.key === k);
      if (g) g.files.push(f); else out.push({ key: k, label: f.uploadedAt ? dayLabel(f.uploadedAt) : 'ملفات سابقة', files: [f] });
    }
    return out;
  }, [sorted, q, user]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm font-cairo" dir="rtl" onClick={onClose}>
      <aside aria-label="الملفات المرفوعة" className="vehicle-drawer w-full max-w-[460px] h-full flex flex-col bg-slate-50 dark:bg-slate-950 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center"><FileText className="w-5 h-5" /></span>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">الملفات المرفوعة</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{files.length} كشوف · {users.length} مستخدم · {total.toLocaleString()} لتر</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="إغلاق" className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
          <label className="flex items-center gap-2 h-10 mt-3.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus-within:border-sky-400">
            <Search className="w-4 h-4 text-slate-400" />
            <span className="sr-only">بحث في الملفات</span>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث باسم الملف أو الموقع أو المستخدم" className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-400" />
          </label>
          {users.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <button type="button" onClick={() => setUser(null)} className={`h-8 px-3 rounded-full text-xs font-black cursor-pointer ${!user ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}>الكل {files.length}</button>
              {users.map(([u, n]) => (
                <button key={u} type="button" onClick={() => setUser(user === u ? null : u)} className={`h-8 px-3 rounded-full text-xs font-bold cursor-pointer ${user === u ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'}`}>{u} {n}</button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3">
          {groups.map(g => (
            <div key={g.key} className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-xs font-black text-slate-500 dark:text-slate-400"><span>{g.label}</span><span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" /></div>
              {g.files.map(f => {
                const by = f.by || 'غير معروف';
                return (
                  <article key={f.id} className="vehicle-kpi rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs hover:border-sky-300 dark:hover:border-sky-800 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="relative w-10 h-12 shrink-0 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-end justify-center pb-1.5 text-[9px] font-black text-rose-700 dark:text-rose-400">PDF</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-black text-slate-900 dark:text-white truncate" title={f.name}>{f.site}</div>
                          {f.dateSource === 'notes'
                            ? <span className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">التاريخ من الملاحظات</span>
                            : <span className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">تمت القراءة</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={f.name}>{f.name}{f.docNo && ` · مستند ${f.docNo}`}</div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[11px] font-black ${avatarTone(by)}`}>{by.charAt(0)}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{by}</span>
                          {f.uploadedAt && <>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="shrink-0">رُفع {timeLabel(f.uploadedAt)}</span>
                          </>}
                        </div>
                      </div>
                      {editable && (
                        <button type="button" onClick={() => { if (window.confirm(`حذف كشف ${f.site} ليوم ${f.reportDate}؟`)) onRemove(f.id); }} className="p-1.5 -m-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mt-3">
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1.5"><div className="text-[10px] text-slate-500 dark:text-slate-400">تاريخ الكشف</div><div className="text-xs font-black font-mono text-slate-900 dark:text-white">{f.reportDate.slice(5)}</div></div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1.5"><div className="text-[10px] text-slate-500 dark:text-slate-400">السطور</div><div className="text-xs font-black font-mono text-slate-900 dark:text-white">{f.rows}</div></div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 px-2.5 py-1.5"><div className="text-[10px] text-slate-500 dark:text-slate-400">الكمية</div><div className="text-xs font-black text-slate-900 dark:text-white"><span className="font-mono">{f.totalQty.toLocaleString()}</span> لتر</div></div>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
          {!groups.length && <p className="text-sm text-slate-400 text-center py-10">{files.length ? 'لا نتائج مطابقة' : 'لا توجد ملفات مرفوعة'}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center min-w-0">
            {users.slice(0, 4).map(([u], i) => (
              <span key={u} title={u} className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-[11px] font-black ring-2 ring-white dark:ring-slate-900 ${avatarTone(u)} ${i ? '-mr-2' : ''}`}>{u.charAt(0)}</span>
            ))}
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2 truncate">{users.length ? `شارك ${users.length} في الرفع` : 'تبقى الملفات محفوظة'}</span>
          </div>
          {editable && (
            <button type="button" onClick={onUpload} className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-black cursor-pointer"><Upload className="w-4 h-4" />رفع ملفات</button>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
};
