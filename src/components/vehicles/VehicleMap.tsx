/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Plus, X, Trash2, Route as RouteIcon, Crosshair, Check } from 'lucide-react';
import { useSyncedStorage } from '../../lib/useSyncedStorage';
import { getProfile } from '../../lib/session';
import { VEHICLE_ROUTES_KEY, straightKm, type MapPoint, type VehicleRoute } from '../../lib/vehicleFuel';

/** مركز كربلاء */
const CENTER: L.LatLngTuple = [32.616, 44.024];
const COLORS = ['#38bdf8', '#f97316', '#a78bfa', '#34d399', '#f43f5e', '#facc15'];

const colorOf = (vehicle: string) => {
  let h = 0;
  for (const c of vehicle) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
};

type Picking = 'from' | 'to' | null;
interface Draft { vehicle: string; km: string; date: string; fromName: string; toName: string; from: L.LatLng | null; to: L.LatLng | null }

/**
 * خريطة حقيقية (تكبير وتصغير) لمسارات العربات: كل رحلة تُضاف يدويًا بالعربة والمسافة،
 * ويُرسم خطها فقط إن حُددت نقطتا البداية والنهاية على الخريطة.
 */
export const VehicleMap: React.FC<{ date: string | null; vehicles: string[]; editable: boolean; vehicle?: string; title?: string }> = ({ date, vehicles, editable, vehicle, title = 'خريطة المسارات' }) => {
  const [routes, setRoutes] = useSyncedStorage<VehicleRoute[]>(VEHICLE_ROUTES_KEY, []);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const draftLayer = useRef<L.LayerGroup | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const pickRef = useRef<Picking>(null);
  pickRef.current = picking;

  // صفحة العربة: مساراتها فقط وفي كل الفترة
  const visible = useMemo(() => routes.filter(r => (!date || r.date === date) && (!vehicle || r.vehicle === vehicle)), [routes, date, vehicle]);
  const totalKm = visible.reduce((s, r) => s + r.km, 0);

  // إنشاء الخريطة مرة واحدة
  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { center: CENTER, zoom: 9, zoomControl: true, attributionControl: true });
    const sat = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri' }),
      L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
    ]).addTo(m);
    const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    L.control.layers({ 'قمر صناعي': sat, 'شوارع': streets }, undefined, { position: 'topleft' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    draftLayer.current = L.layerGroup().addTo(m);
    m.on('click', e => {
      const p = pickRef.current;
      if (!p) return;
      setDraft(d => (d ? { ...d, [p]: e.latlng } : d));
      setPicking(null);
    });
    map.current = m;
    // الحاوية قد تتغير أبعادها بعد التحميل (الشبكة المرنة)
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(box.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []);

  // رسم المسارات
  useEffect(() => {
    const g = layer.current;
    const m = map.current;
    if (!g || !m) return;
    g.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    for (const r of visible) {
      if (!r.from || !r.to) continue;
      const c = colorOf(r.vehicle);
      const a: L.LatLngTuple = [r.from.lat, r.from.lng];
      const b: L.LatLngTuple = [r.to.lat, r.to.lng];
      const label = `<b dir="ltr">${r.vehicle}</b> · ${r.km.toLocaleString()} كم<br/>${r.from.name || 'بداية'} ← ${r.to.name || 'نهاية'}<br/><span style="color:#64748b">${r.date}</span>`;
      L.polyline([a, b], { color: '#0f172a', weight: 7, opacity: 0.35 }).addTo(g);
      L.polyline([a, b], { color: c, weight: 4, dashArray: '10 8', className: 'vehicle-flow' }).bindTooltip(label, { sticky: true, direction: 'top' }).addTo(g);
      L.circleMarker(a, { radius: 6, color: '#fff', weight: 2, fillColor: c, fillOpacity: 1 }).bindTooltip(r.from.name || 'بداية').addTo(g);
      L.circleMarker(b, { radius: 8, color: c, weight: 3, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(r.to.name || 'نهاية').addTo(g);
      bounds.push(a, b);
    }
    if (bounds.length) m.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 12 });
  }, [visible]);

  // نقاط المسودة
  useEffect(() => {
    const g = draftLayer.current;
    if (!g) return;
    g.clearLayers();
    if (draft?.from) L.circleMarker(draft.from, { radius: 7, color: '#fff', weight: 2, fillColor: '#22c55e', fillOpacity: 1 }).addTo(g);
    if (draft?.to) L.circleMarker(draft.to, { radius: 7, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }).addTo(g);
    if (draft?.from && draft.to) L.polyline([draft.from, draft.to], { color: '#fde047', weight: 3, dashArray: '6 6' }).addTo(g);
  }, [draft]);

  useEffect(() => { if (box.current) box.current.style.cursor = picking ? 'crosshair' : ''; }, [picking]);

  const openForm = () => setDraft({ vehicle: vehicle || '', km: '', date: date || new Date().toLocaleDateString('en-CA').replace(/-/g, '/'), fromName: '', toName: '', from: null, to: null });

  const save = () => {
    if (!draft) return;
    const km = Number(draft.km);
    if (!draft.vehicle.trim() || !(km > 0)) return;
    const pt = (p: L.LatLng | null, name: string): MapPoint | null => (p ? { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), name: name.trim() } : null);
    const p = getProfile();
    const route: VehicleRoute = {
      id: `vr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      vehicle: draft.vehicle.trim(),
      km,
      date: draft.date,
      from: pt(draft.from, draft.fromName),
      to: pt(draft.to, draft.toName),
      note: '',
      by: p?.name || p?.username || '',
      createdAt: new Date().toISOString(),
    };
    setRoutes(prev => [route, ...prev]);
    setDraft(null);
    setPicking(null);
  };

  const focus = (r: VehicleRoute) => {
    if (r.from && r.to) map.current?.flyToBounds(L.latLngBounds([[r.from.lat, r.from.lng], [r.to.lat, r.to.lng]]), { padding: [40, 40], maxZoom: 13 });
  };

  const field = 'w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-hidden focus:border-sky-500';
  const est = draft?.from && draft.to ? straightKm({ lat: draft.from.lat, lng: draft.from.lng, name: '' }, { lat: draft.to.lat, lng: draft.to.lng, name: '' }) : null;

  return (
    <div className="h-full rounded-3xl overflow-hidden bg-slate-950 text-white border border-slate-800 shadow-soft-card flex flex-col">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2"><MapPin className="w-4 h-4 text-sky-400" />{title}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{visible.length} رحلة · {totalKm.toLocaleString()} كم</p>
        </div>
        {editable && !draft && (
          <button type="button" onClick={openForm} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-black cursor-pointer">
            <Plus className="w-3.5 h-3.5" />إضافة مسار
          </button>
        )}
      </div>

      <div className="relative flex-1 min-h-[320px]">
        <div ref={box} className="absolute inset-0 z-0" />
        {picking && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] px-3 py-1.5 rounded-full bg-amber-400 text-slate-900 text-xs font-black shadow-lg flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5" />اضغط على الخريطة لتحديد {picking === 'from' ? 'البداية' : 'النهاية'}
          </div>
        )}
        {draft && (
          <div className="absolute bottom-3 inset-x-3 z-[500] rounded-2xl bg-slate-900/95 backdrop-blur border border-slate-700 p-3 space-y-2 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black flex items-center gap-1.5"><RouteIcon className="w-3.5 h-3.5 text-sky-400" />رحلة جديدة</span>
              <button type="button" onClick={() => { setDraft(null); setPicking(null); }} className="text-slate-400 hover:text-white cursor-pointer" aria-label="إلغاء"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input list="vehicle-route-list" value={draft.vehicle} onChange={e => setDraft({ ...draft, vehicle: e.target.value })} placeholder="العربة" className={field} dir="ltr" />
              <datalist id="vehicle-route-list">{vehicles.map(v => <option key={v} value={v} />)}</datalist>
              <input type="number" min={1} value={draft.km} onChange={e => setDraft({ ...draft, km: e.target.value })} placeholder="المسافة كم" className={field} />
              <input value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} placeholder="YYYY/MM/DD" className={field} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['from', 'to'] as const).map(k => (
                <div key={k} className="flex gap-1">
                  <input value={k === 'from' ? draft.fromName : draft.toName} onChange={e => setDraft({ ...draft, [k === 'from' ? 'fromName' : 'toName']: e.target.value })} placeholder={k === 'from' ? 'من (اختياري)' : 'إلى (اختياري)'} className={field} />
                  <button
                    type="button"
                    onClick={() => setPicking(k)}
                    title="تحديد على الخريطة"
                    className={`shrink-0 px-2 rounded-lg border cursor-pointer ${draft[k] ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : picking === k ? 'bg-amber-400 border-amber-400 text-slate-900' : 'border-slate-700 text-slate-300 hover:border-sky-500'}`}
                  >
                    {draft[k] ? <Check className="w-3.5 h-3.5" /> : <Crosshair className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                {draft.from && draft.to ? `سيُرسم خط · المسافة المستقيمة ≈ ${est} كم` : 'بدون تحديد البداية والنهاية لا يظهر خط على الخريطة'}
              </span>
              <button type="button" onClick={save} disabled={!draft.vehicle.trim() || !(Number(draft.km) > 0)} className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-xs font-black cursor-pointer">حفظ</button>
            </div>
          </div>
        )}
      </div>

      {visible.length > 0 && (
        <div className="max-h-36 overflow-y-auto border-t border-slate-800 divide-y divide-slate-800/80">
          {visible.map(r => (
            <div key={r.id} className="px-4 py-2 flex items-center gap-2 text-[11px] hover:bg-white/5 cursor-pointer" onClick={() => focus(r)}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(r.vehicle) }} />
              <b className="font-mono" dir="ltr">{r.vehicle}</b>
              <span className="text-sky-300 font-mono">{r.km.toLocaleString()} كم</span>
              <span className="text-slate-400 truncate flex-1">{r.from && r.to ? `${r.from.name || 'بداية'} ← ${r.to.name || 'نهاية'}` : 'بدون خط'}</span>
              {editable && (
                <button type="button" onClick={e => { e.stopPropagation(); if (window.confirm('حذف هذه الرحلة؟')) setRoutes(prev => prev.filter(x => x.id !== r.id)); }} className="text-slate-500 hover:text-rose-400 cursor-pointer" aria-label="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
