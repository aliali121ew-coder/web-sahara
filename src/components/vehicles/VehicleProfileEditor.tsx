/* eslint-disable i18next/no-literal-string */
import React, { useRef, useState } from 'react';
import { X, Camera, Trash2, Loader2, IdCard } from 'lucide-react';
import { getProfile } from '../../lib/session';
import { VEHICLE_TYPES, shrinkImage, type VehicleProfile } from '../../lib/vehicleFuel';

export const emptyProfile = (vehicle: string): VehicleProfile => ({
  id: vehicle, type: '', tankLiters: null, dailyLimit: null, driver: '', department: '', notes: '', photo: '', updatedAt: '', by: '',
});

/** نافذة ملف العربة: الصورة، النوع، سعة الخزان، الحصة اليومية، السائق المعتمد */
export const VehicleProfileEditor: React.FC<{
  vehicle: string;
  profile: VehicleProfile | undefined;
  drivers: string[];
  onSave: (p: VehicleProfile) => void;
  onClose: () => void;
}> = ({ vehicle, profile, drivers, onSave, onClose }) => {
  const [p, setP] = useState<VehicleProfile>(profile || emptyProfile(vehicle));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setErr('');
    try { setP(x => ({ ...x, photo: '' })); const photo = await shrinkImage(f); setP(x => ({ ...x, photo })); }
    catch (e) { setErr(e instanceof Error ? e.message : 'تعذّرت قراءة الصورة'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };

  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v)) || null);
  const save = () => {
    const u = getProfile();
    onSave({ ...p, driver: p.driver.trim(), department: p.department.trim(), notes: p.notes.trim(), updatedAt: new Date().toISOString(), by: u?.name || u?.username || '' });
  };

  const field = 'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-sky-500';
  const label = 'text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 block';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
      <div className="vehicle-page w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2"><IdCard className="w-5 h-5 text-sky-500" />ملف العربة <span className="font-mono" dir="ltr">{vehicle}</span></h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" aria-label="إغلاق"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-5">
          {/* الصورة */}
          <div className="md:col-span-2">
            <input ref={input} type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); void pick(e.dataTransfer.files?.[0]); }}
              className="group relative w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500 bg-slate-50 dark:bg-slate-800 cursor-pointer"
            >
              <img src={p.photo || '/trucks/semi_truck.jpg'} alt="" className={`absolute inset-0 w-full h-full ${p.photo ? 'object-cover' : 'object-contain opacity-40'}`} />
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-950/0 group-hover:bg-slate-950/40 text-transparent group-hover:text-white transition-all text-xs font-black">
                {busy ? <Loader2 className="w-6 h-6 animate-spin text-sky-500" /> : <Camera className="w-6 h-6" />}
                {p.photo ? 'تغيير الصورة' : 'أضف صورة العربة'}
              </span>
              {!p.photo && !busy && <span className="absolute bottom-2 inset-x-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:opacity-0">اضغط أو اسحب صورة هنا</span>}
            </button>
            {p.photo && (
              <button type="button" onClick={() => setP({ ...p, photo: '' })} className="mt-2 flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" />إزالة الصورة</button>
            )}
            {err && <p className="mt-2 text-xs text-rose-500">{err}</p>}
          </div>

          {/* البيانات */}
          <div className="md:col-span-3 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <span className={label}>نوع العربة</span>
              <div className="flex flex-wrap gap-1.5">
                {VEHICLE_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => setP({ ...p, type: p.type === t ? '' : t })} className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all ${p.type === t ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-sky-400'}`}>{t}</button>
                ))}
              </div>
            </div>
            <label>
              <span className={label}>سعة الخزان (لتر)</span>
              <input type="number" min={0} value={p.tankLiters ?? ''} onChange={e => setP({ ...p, tankLiters: num(e.target.value) })} className={field} placeholder="مثال: 400" />
            </label>
            <label>
              <span className={label}>الحصة اليومية (لتر)</span>
              <input type="number" min={0} value={p.dailyLimit ?? ''} onChange={e => setP({ ...p, dailyLimit: num(e.target.value) })} className={field} placeholder="اختياري" />
            </label>
            <label className="col-span-2">
              <span className={label}>السائق المعتمد</span>
              <input list="vehicle-profile-drivers" value={p.driver} onChange={e => setP({ ...p, driver: e.target.value })} className={field} placeholder="اختر من سائقي الكشوف أو اكتب" />
              <datalist id="vehicle-profile-drivers">{drivers.map(d => <option key={d} value={d} />)}</datalist>
            </label>
            <label className="col-span-2">
              <span className={label}>القسم / الموقع</span>
              <input value={p.department} onChange={e => setP({ ...p, department: e.target.value })} className={field} placeholder="مثال: قسم النقل" />
            </label>
            <label className="col-span-2">
              <span className={label}>ملاحظات</span>
              <textarea rows={2} value={p.notes} onChange={e => setP({ ...p, notes: e.target.value })} className={field} />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 p-5 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] text-slate-500">سعة الخزان والحصة والسائق تُستخدم لكشف التفويل المخالف تلقائيًا</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer">إلغاء</button>
            <button type="button" onClick={save} disabled={busy} className="px-5 py-2 rounded-xl bg-gradient-to-l from-sky-500 to-indigo-600 text-white text-sm font-black shadow-lg shadow-sky-500/25 disabled:opacity-50 cursor-pointer">حفظ</button>
          </div>
        </div>
      </div>
    </div>
  );
};
