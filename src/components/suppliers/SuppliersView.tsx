import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, ArrowDownUp, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, Download, Coins, History, TrendingUp, TrendingDown,
  Minus, X, Trash2, ImagePlus, Truck, Check,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFuelData } from '../../context/FuelDataContext';
import { usePermissions } from '../../lib/usePermission';
import { enumText } from '../../i18n/enums';
import { collator } from '../../i18n/format';
import { formatNumber } from '../../lib/utils';
import { deliveriesOfSupplier } from '../../lib/archiveSuppliers';
import type { InboundDelivery, NavTabId, SupplierPriceRecord } from '../../types';

type SortKey = 'name' | 'priceDesc' | 'priceAsc' | 'change' | 'updated';

const PAGE_SIZE = 10;
const CATEGORIES: SupplierPriceRecord['category'][] = ['تجاري', 'رسمي', 'حكومي'];

const dateKey = (d?: string) => (d || '').replace(/-/g, '/');

const fmtPrice = (v: number) => formatNumber(Math.round(v * 100) / 100);

const AVATAR_TONES = ['from-teal-400 to-emerald-600', 'from-sky-400 to-blue-600', 'from-amber-400 to-orange-600', 'from-violet-400 to-purple-600', 'from-rose-400 to-pink-600', 'from-lime-400 to-green-600'];
const toneOf = (id: string) => AVATAR_TONES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
const initialsOf = (name: string) => {
  const words = name.replace(/[()]/g, '').split(/\s+/).filter(w => w && !['شركة', 'شركه', '-', 'و'].includes(w));
  // حرف واحد: الحروف العربية المنفصلة بمسافة تبدو مشوّهة داخل الدائرة
  return (words[0] ?? '').replace(/^ال(?=..)/, '').charAt(0) || '?';
};

const Avatar: React.FC<{ s: Pick<SupplierPriceRecord, 'id' | 'supplierName' | 'logo'>; size: string; text: string }> = ({ s, size, text }) =>
  s.logo ? (
    <img src={s.logo} alt="" className={`${size} rounded-full object-cover shrink-0 bg-white`} />
  ) : (
    <span className={`${size} ${text} rounded-full shrink-0 bg-gradient-to-br ${toneOf(s.id)} text-white font-black flex items-center justify-center select-none`}>
      {initialsOf(s.supplierName)}
    </span>
  );

/** شارة نسبة التغير: ارتفاع / انخفاض / ثابت */
const ChangePill: React.FC<{ pct: number }> = ({ pct }) => {
  const { t } = useTranslation('suppliers');
  const cls = pct > 0 ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/50 dark:text-rose-300'
    : pct < 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300'
    : 'bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-300';
  const label = pct > 0 ? t('change.up') : pct < 0 ? t('change.down') : t('change.stable');
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${cls}`}>{label}{pct !== 0 && <span dir="ltr">{pct > 0 ? '+' : ''}{pct}%</span>}</span>;
};

interface KpiValue { value: string; label: string; tone: 'green' | 'orange'; small?: boolean }
const KpiCard: React.FC<{
  icon: React.ReactNode; iconBg: string; title: string; a: KpiValue; b: KpiValue;
  trend?: { pct: number; text: string }; note?: string; action?: { label: string; onClick: () => void }; className?: string;
}> = ({ icon, iconBg, title, a, b, trend, note, action, className = '' }) => (
  <div className={`${className} rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col min-w-0`}>
    <div className="px-4 pt-4 pb-3 flex-1">
      <div className="flex items-center gap-2.5">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</span>
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate">{title}</span>
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {[a, b].map((v, i) => (
          <div key={i} className="min-w-0">
            <div className={`${v.small ? 'text-sm xl:text-[15px] pt-1' : 'text-lg xl:text-xl'} leading-tight font-bold text-slate-900 dark:text-white truncate tabular-nums`} title={v.value}>{v.value}</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase text-slate-500 dark:text-slate-400 truncate">
              <span className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 ${v.tone === 'green' ? 'border-emerald-500' : 'border-orange-400'}`} />
              {v.label}
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11.5px]">
      {trend ? (
        <span className="flex items-center gap-1.5 min-w-0">
          {trend.pct >= 0
            ? <TrendingUp className={`w-3.5 h-3.5 shrink-0 ${trend.pct > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
            : <TrendingDown className="w-3.5 h-3.5 shrink-0 text-emerald-500" />}
          <span dir="ltr" className={`font-semibold ${trend.pct > 0 ? 'text-rose-500' : trend.pct < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>{trend.pct > 0 ? '+' : ''}{trend.pct}%</span>
          <span className="text-slate-400 truncate">{trend.text}</span>
        </span>
      ) : note ? <span className="text-slate-400 truncate tabular-nums">{note}</span> : <span />}
      {action && (
        <button type="button" onClick={action.onClick} className="font-medium text-slate-700 dark:text-slate-200 hover:text-teal-600 dark:hover:text-teal-400 whitespace-nowrap cursor-pointer">
          {action.label}
        </button>
      )}
    </div>
  </div>
);

/** تصغير الشعار المرفوع إلى 160px قبل حفظه حتى لا يثقل التخزين */
const shrinkImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = () => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const size = 160;
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d')!;
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(c.toDataURL('image/webp', 0.85));
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
});

const EMPTY: SupplierPriceRecord = {
  id: '', supplierName: '', product: '', priceIqd: 0, previousPriceIqd: 0, changePercent: 0,
  category: 'تجاري', availability: 'متوفر', lastUpdated: '',
};

const SupplierModal: React.FC<{ initial: SupplierPriceRecord; isNew: boolean; onClose: () => void; onSave: (s: SupplierPriceRecord) => void; onDelete?: () => void }> = ({ initial, isNew, onClose, onSave, onDelete }) => {
  const { t } = useTranslation(['suppliers', 'common']);
  const [f, setF] = useState<SupplierPriceRecord>(initial);
  const [price, setPrice] = useState(initial.priceIqd ? String(initial.priceIqd) : '');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof SupplierPriceRecord>(k: K, v: SupplierPriceRecord[K]) => setF(p => ({ ...p, [k]: v }));
  const priceNum = Number(price.replace(/,/g, ''));
  const valid = f.supplierName.trim() && f.product.trim() && priceNum > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const input = 'w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';
  const label = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={isNew ? t('modal.addTitle') : t('modal.editTitle')}
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{isNew ? t('modal.addTitle') : t('modal.editTitle')}</h3>
          <button type="button" onClick={onClose} aria-label={t('common:actions.close')} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <Avatar s={f.id ? f : { ...f, id: 'new' }} size="w-16 h-16" text="text-lg" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg border border-teal-500 text-teal-600 dark:text-teal-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer">
                <ImagePlus className="w-4 h-4" /> {t('modal.logo')}
              </button>
              {f.logo && (
                <button type="button" onClick={() => set('logo', undefined)} className="h-9 px-3 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">{t('modal.removeLogo')}</button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) set('logo', await shrinkImage(file));
              }} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={label}>{t('fields.name')}</label>
              <input className={input} value={f.supplierName} onChange={e => set('supplierName', e.target.value)} autoFocus />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>{t('fields.product')}</label>
              <input className={input} value={f.product} onChange={e => set('product', e.target.value)} />
            </div>
            <div>
              <label className={label}>{t('fields.price')}</label>
              <input className={input} dir="ltr" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} />
              {!isNew && priceNum > 0 && priceNum !== initial.priceIqd && (
                <p className="mt-1.5 text-[11px] text-teal-600 dark:text-teal-400">{t('modal.priceNote', { old: fmtPrice(initial.priceIqd) })}</p>
              )}
            </div>
            <div>
                <label className={label}>{t('fields.category')}</label>
                <select className={input} value={f.category} onChange={e => set('category', e.target.value as SupplierPriceRecord['category'])}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{enumText(c)}</option>)}
                </select>
            </div>
            <div>
              <label className={label}>{t('fields.phone')}</label>
              <input className={input} dir="ltr" inputMode="tel" value={f.phone ?? ''} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className={label}>{t('fields.location')}</label>
              <input className={input} value={f.location ?? ''} onChange={e => set('location', e.target.value)} />
            </div>
            <div>
              <label className={label}>{t('fields.contactName')}</label>
              <input className={input} value={f.contactName ?? ''} onChange={e => set('contactName', e.target.value)} />
            </div>
            <div>
              <label className={label}>{t('fields.contactRole')}</label>
              <input className={input} value={f.contactRole ?? ''} onChange={e => set('contactRole', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
          {onDelete ? (
            <button type="button" onClick={() => { if (window.confirm(t('modal.deleteConfirm', { name: f.supplierName }))) onDelete(); }}
              className="h-10 px-3 rounded-lg text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 cursor-pointer">
              <Trash2 className="w-4 h-4" /> {t('common:actions.delete')}
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">{t('common:actions.cancel')}</button>
            <button type="button" disabled={!valid}
              onClick={() => onSave({ ...f, supplierName: f.supplierName.trim(), product: f.product.trim(), priceIqd: priceNum, id: f.id || `sup-${Date.now()}` })}
              className="h-10 px-5 rounded-lg text-sm font-semibold bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1.5 cursor-pointer">
              <Check className="w-4 h-4" /> {t('common:actions.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** قائمة منسدلة صغيرة تُغلق عند الضغط خارجها */
const useOutside = (open: boolean, close: () => void) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, close]);
  return ref;
};

export const SuppliersView: React.FC = () => {
  const { t } = useTranslation(['suppliers', 'common']);
  const { supplierPrices, saharaDeliveries, etihadDeliveries, saveSupplier, deleteSupplier, setActiveTab } = useFuelData();
  const editable = usePermissions().canEdit('suppliers');

  const [selectedId, setSelectedId] = useState<string | undefined>(() => supplierPrices[0]?.id);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [sortOpen, setSortOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ rec: SupplierPriceRecord; isNew: boolean } | null>(null);
  const sortRef = useOutside(sortOpen, () => setSortOpen(false));
  const menuRef = useOutside(menuOpen, () => setMenuOpen(false));

  const selected = supplierPrices.find(s => s.id === selectedId) ?? supplierPrices[0];

  const allDeliveries = useMemo(
    () => [...saharaDeliveries.map(d => ({ d, tab: 'deliveries-sahara' as NavTabId })), ...etihadDeliveries.map(d => ({ d, tab: 'deliveries-etihad' as NavTabId }))],
    [saharaDeliveries, etihadDeliveries]
  );
  /** شحنات المورد في أرشيف الوارد (الشركتين): الأحدث أولًا، مع مجموع الكمية */
  const inboundOf = useMemo(() => {
    const cache = new Map<string, { last?: { d: InboundDelivery; tab: NavTabId }; total: number; count: number; lastDay: string; lastDayCount: number }>();
    return (s: SupplierPriceRecord) => {
      if (!cache.has(s.id)) {
        const hits = deliveriesOfSupplier(allDeliveries, x => x.d, s.supplierName);
        hits.sort((a, b) => dateKey(b.d.receiptUnloadDate || b.d.date).localeCompare(dateKey(a.d.receiptUnloadDate || a.d.date)));
        const total = hits.reduce((a, { d }) => a + (d.receivedQuantity || d.volumeLiters || 0), 0);
        // صهاريج آخر يوم وارد من المورد
        const lastDay = hits[0] ? dateKey(hits[0].d.receiptUnloadDate || hits[0].d.date) : '';
        const lastDayCount = lastDay ? hits.filter(({ d }) => dateKey(d.receiptUnloadDate || d.date) === lastDay).length : 0;
        cache.set(s.id, { last: hits[0], total, count: hits.length, lastDay, lastDayCount });
      }
      return cache.get(s.id)!;
    };
  }, [allDeliveries]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = supplierPrices.filter(s =>
      (!q || s.supplierName.toLowerCase().includes(q) || s.product.toLowerCase().includes(q) || (s.contactName ?? '').toLowerCase().includes(q))
    );
    const cmp = collator();
    const by: Record<SortKey, (a: SupplierPriceRecord, b: SupplierPriceRecord) => number> = {
      name: (a, b) => cmp.compare(a.supplierName, b.supplierName),
      priceDesc: (a, b) => b.priceIqd - a.priceIqd,
      priceAsc: (a, b) => a.priceIqd - b.priceIqd,
      change: (a, b) => b.changePercent - a.changePercent,
      updated: (a, b) => dateKey(b.lastUpdated).localeCompare(dateKey(a.lastUpdated)),
    };
    return [...list].sort(by[sort]);
  }, [supplierPrices, query, sort]);

  const marketAvg = supplierPrices.length ? supplierPrices.reduce((a, s) => a + s.priceIqd, 0) / supplierPrices.length : 0;

  const exportCsv = () => {
    const head = [t('table.supplier'), t('fields.product'), t('fields.category'), t('table.current'), t('table.previous'), t('table.change'), t('table.updated')];
    const list = checked.size ? rows.filter(r => checked.has(r.id)) : rows;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const body = list.map(s => [s.supplierName, s.product, enumText(s.category), s.priceIqd, s.previousPriceIqd, `${s.changePercent}%`, s.lastUpdated].map(esc).join(','));
    const blob = new Blob(['﻿' + [head.map(esc).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${t('csvFile')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const iqdL = t('units.iqdPerLiter');
  const sel = selected ? inboundOf(selected) : undefined;
  const last = sel?.last;
  const lastQty = last ? (last.d.receivedQuantity || last.d.volumeLiters || 0) : 0;
  const lastPrice = last ? (last.d.productPrice || last.d.pricePerLiter || 0) : 0;
  const diff = selected ? selected.priceIqd - selected.previousPriceIqd : 0;
  const vsMarket = selected && marketAvg ? Math.round(((selected.priceIqd - marketAvg) / marketAvg) * 1000) / 10 : 0;

  const SORTS: { id: SortKey; label: string }[] = [
    { id: 'name', label: t('sort.name') }, { id: 'priceDesc', label: t('sort.priceDesc') }, { id: 'priceAsc', label: t('sort.priceAsc') },
    { id: 'change', label: t('sort.change') }, { id: 'updated', label: t('sort.updated') },
  ];

  // 10 موردين في كل صفحة؛ البحث أو الترتيب يعيد للصفحة الأولى
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  useEffect(() => { setPage(0); }, [query, sort]);
  const allChecked = pageRows.length > 0 && pageRows.every(r => checked.has(r.id));
  const th = 'px-4 py-3 text-start text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const td = 'px-4 py-3 text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap';

  return (
    <div className="space-y-5 pb-10">
      {/* ── رأس المورد المختار ── */}
      {selected ? (
        <section key={selected.id} className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-5 animate-[fadeIn_.25s_ease]">
          <div className="flex items-center gap-5 sm:gap-7 flex-1 min-w-0">
            <span className="p-1 rounded-full bg-white dark:bg-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.12)] shrink-0">
              <Avatar s={selected} size="w-20 h-20 sm:w-24 sm:h-24" text="text-2xl sm:text-3xl" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl sm:text-[28px] leading-tight font-bold text-slate-900 dark:text-white truncate">{selected.supplierName}</h1>
                <span className="px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-300 text-xs font-medium">{enumText(selected.category)}</span>
              </div>
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-3">
                {[
                  { k: t('fields.product'), v: selected.product },
                  { k: t('fields.phone'), v: selected.phone, ltr: true },
                  { k: t('fields.location'), v: selected.location },
                ].map(({ k, v, ltr }) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[13px] text-slate-500 dark:text-slate-400">{k}</dt>
                    <dd className="mt-1 text-[14.5px] font-medium text-slate-800 dark:text-slate-100 truncate" dir={ltr && v ? 'ltr' : undefined} style={ltr && v ? { textAlign: 'end' } : undefined}>
                      {v || <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="lg:w-64 shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-6 py-5">
            <div className="text-[13px] text-slate-500 dark:text-slate-400">{t('header.representative')}</div>
            <div className="mt-2.5 flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 dark:from-slate-600 dark:to-slate-700 text-white font-bold flex items-center justify-center shrink-0">
                {(selected.contactName || '?').trim().charAt(0)}
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-medium text-slate-900 dark:text-white truncate">{selected.contactName || t('header.noContact')}</div>
                <div className="text-xs text-slate-400 truncate">{selected.contactRole || '—'}</div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-10 text-center text-slate-400">{t('empty')}</section>
      )}

      {/* ── البطاقات ── */}
      {selected && (
        <div key={`k-${selected.id}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 xl:gap-4 animate-[fadeIn_.25s_ease]">
          <KpiCard
            icon={<Coins className="w-4 h-4 text-white" />} iconBg="bg-amber-400"
            title={t('cards.current')}
            a={{ value: fmtPrice(selected.priceIqd), label: iqdL, tone: 'green' }}
            b={{ value: selected.lastUpdated || '—', label: t('cards.updatedOn'), tone: 'orange', small: true }}
            trend={{ pct: selected.changePercent, text: t('cards.vsPrevious') }}
          />
          <KpiCard
            icon={<History className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50 dark:bg-teal-950/60"
            title={t('cards.previous')}
            a={{ value: fmtPrice(selected.previousPriceIqd), label: iqdL, tone: 'green' }}
            b={{ value: `${diff > 0 ? '+' : ''}${fmtPrice(diff)}`, label: t('cards.difference'), tone: 'orange' }}
            trend={{ pct: selected.changePercent, text: t('cards.lastChange') }}
          />
          <KpiCard
            icon={selected.changePercent > 0 ? <TrendingUp className="w-4 h-4 text-rose-500" /> : selected.changePercent < 0 ? <TrendingDown className="w-4 h-4 text-emerald-600" /> : <Minus className="w-4 h-4 text-slate-500" />}
            iconBg={selected.changePercent > 0 ? 'bg-rose-50 dark:bg-rose-950/50' : selected.changePercent < 0 ? 'bg-emerald-50 dark:bg-emerald-950/50' : 'bg-slate-100 dark:bg-slate-800'}
            title={t('cards.change')}
            a={{ value: `${selected.changePercent > 0 ? '+' : ''}${selected.changePercent}%`, label: selected.changePercent > 0 ? t('change.up') : selected.changePercent < 0 ? t('change.down') : t('change.stable'), tone: 'green' }}
            b={{ value: fmtPrice(marketAvg), label: t('cards.marketAvg'), tone: 'orange' }}
            trend={{ pct: vsMarket, text: t('cards.vsMarket') }}
          />
          <KpiCard
            icon={<Truck className="w-4 h-4 text-sky-600" />} iconBg="bg-sky-50 dark:bg-sky-950/50"
            title={t('cards.tankers')}
            a={{ value: sel?.lastDayCount ? formatNumber(sel.lastDayCount) : '—', label: t('cards.lastDay'), tone: 'green' }}
            b={{ value: sel?.count ? formatNumber(sel.count) : '—', label: t('cards.totalTankers'), tone: 'orange' }}
            note={sel?.lastDay ? t('cards.lastDayOn', { date: sel.lastDay }) : t('cards.noInbound')}
          />
          <div className="sm:col-span-2 lg:col-span-1 rounded-2xl p-4 flex flex-col items-center justify-center text-center text-white bg-gradient-to-br from-teal-600 via-teal-500 to-[#9dcf9f] shadow-[0_8px_24px_-8px_rgba(13,148,136,0.55)] min-h-[150px]">
            <div className="text-[13px] text-white/85 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> {t('cards.lastInbound')}</div>
            {last ? (
              <>
                <div className="mt-1.5 text-2xl font-bold leading-tight tabular-nums">{formatNumber(lastQty)} <span className="text-sm font-semibold">{t('common:units.liter')}</span></div>
                <div className="mt-1 text-[11.5px] text-white/80 tabular-nums">{last.d.receiptUnloadDate || last.d.date}{lastPrice ? ` · ${fmtPrice(lastPrice)} ${iqdL}` : ''}</div>
                <button type="button" onClick={() => setActiveTab(last.tab)} className="mt-3 w-full max-w-[150px] h-8 rounded-full bg-white/20 hover:bg-white/30 text-[12.5px] font-medium transition-colors cursor-pointer">
                  {t('cards.viewDetails')}
                </button>
              </>
            ) : (
              <div className="mt-2 text-sm text-white/85">{t('cards.noInbound')}</div>
            )}
          </div>
        </div>
      )}

      {/* ── الجدول ── */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="px-4 sm:px-6 pt-3 border-b border-slate-200/80 dark:border-slate-800 overflow-x-auto">
          <div className="flex items-center min-w-max">
            <span className="relative py-3 text-[14.5px] font-semibold text-slate-900 dark:text-white whitespace-nowrap">
              {t('tabs.all', { count: supplierPrices.length })}
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-teal-500" />
            </span>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
            <label className="relative w-full sm:w-56">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('toolbar.search')} aria-label={t('toolbar.search')}
                className="w-full h-10 ps-9 pe-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[13px] text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15" />
            </label>
            <div ref={sortRef} className="relative">
              <button type="button" onClick={() => setSortOpen(o => !o)} aria-expanded={sortOpen}
                className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-[13px] text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                <ArrowDownUp className="w-4 h-4" /> {t('toolbar.sortBy')}
              </button>
              {sortOpen && (
                <div className="absolute z-30 top-full mt-1.5 start-0 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-1">
                  {SORTS.map(s => (
                    <button key={s.id} type="button" onClick={() => { setSort(s.id); setSortOpen(false); }}
                      className={`w-full px-3 py-2 rounded-lg text-start text-[13px] flex items-center justify-between cursor-pointer ${sort === s.id ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 font-semibold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      {s.label}{sort === s.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={menuRef} className="relative ms-auto">
              <button type="button" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen}
                className="h-10 ps-4 pe-3 rounded-lg border border-teal-500 text-teal-600 dark:text-teal-400 text-[13px] font-medium flex items-center gap-2 hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer">
                {t('toolbar.actions')} <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              {menuOpen && (
                <div className="absolute z-30 top-full mt-1.5 end-0 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-1">
                  {editable && (
                    <button type="button" onClick={() => { setMenuOpen(false); setEditing({ rec: { ...EMPTY }, isNew: true }); }}
                      className="w-full px-3 py-2 rounded-lg text-start text-[13px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer">
                      <Plus className="w-4 h-4 text-teal-500" /> {t('toolbar.add')}
                    </button>
                  )}
                  <button type="button" onClick={() => { setMenuOpen(false); exportCsv(); }}
                    className="w-full px-3 py-2 rounded-lg text-start text-[13px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer">
                    <Download className="w-4 h-4 text-teal-500" /> {checked.size ? t('toolbar.exportSelected', { count: checked.size }) : t('toolbar.export')}
                  </button>
                </div>
              )}
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className={`${th} w-10`}>
                    <input type="checkbox" aria-label={t('table.selectAll')} checked={allChecked}
                      onChange={() => setChecked(prev => { const n = new Set(prev); pageRows.forEach(r => (allChecked ? n.delete(r.id) : n.add(r.id))); return n; })}
                      className="w-4 h-4 rounded border-slate-300 accent-teal-500 cursor-pointer" />
                  </th>
                  <th className={th}>{t('table.supplier')}</th>
                  <th className={th}>{t('table.current')}</th>
                  <th className={th}>{t('table.previous')}</th>
                  <th className={th}>{t('table.change')}</th>
                  <th className={th}>{t('table.updated')}</th>
                  <th className={th}>{t('table.inbound')}</th>
                  <th className={th}>{t('table.tankers')}</th>
                  <th className={th}>{t('table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={9} className="py-12 text-center text-sm text-slate-400">{t('empty')}</td></tr>
                )}
                {pageRows.map(s => {
                  const active = s.id === selected?.id;
                  const inb = inboundOf(s);
                  return (
                    <tr key={s.id} onClick={() => setSelectedId(s.id)} aria-selected={active}
                      className={`border-t border-slate-100 dark:border-slate-800 cursor-pointer transition-colors ${active ? 'bg-teal-50/70 dark:bg-teal-950/30' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}`}>
                      <td className={td} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" aria-label={t('table.select', { name: s.supplierName })} checked={checked.has(s.id)}
                          onChange={() => setChecked(prev => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
                          className="w-4 h-4 rounded border-slate-300 accent-teal-500 cursor-pointer" />
                      </td>
                      <td className={td}>
                        <div className="flex items-center gap-2.5">
                          <Avatar s={s} size="w-8 h-8" text="text-[10px]" />
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate max-w-[240px]">{s.supplierName}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[240px]">{s.product}</div>
                          </div>
                        </div>
                      </td>
                      <td className={`${td} font-semibold text-slate-900 dark:text-white tabular-nums`}>{fmtPrice(s.priceIqd)}</td>
                      <td className={`${td} tabular-nums`}>{fmtPrice(s.previousPriceIqd)}</td>
                      <td className={td}><ChangePill pct={s.changePercent} /></td>
                      <td className={`${td} tabular-nums`}>{s.lastUpdated}</td>
                      <td className={td}>
                        {inb.count ? (
                          <span className="tabular-nums font-semibold text-slate-900 dark:text-white">{formatNumber(inb.total)} <span className="text-[11px] font-normal text-slate-400">{t('common:units.liter')}</span></span>
                        ) : '—'}
                      </td>
                      <td className={`${td} tabular-nums`}>{inb.count ? formatNumber(inb.count) : '—'}</td>
                      <td className={td} onClick={e => e.stopPropagation()}>
                        {editable ? (
                          <button type="button" onClick={() => setEditing({ rec: s, isNew: false })}
                            className="h-7 px-3 rounded-md bg-teal-500 hover:bg-teal-600 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                            <Pencil className="w-3 h-3" /> {t('common:actions.edit')}
                          </button>
                        ) : (
                          <button type="button" onClick={() => setSelectedId(s.id)}
                            className="h-7 px-3 rounded-md border border-teal-500 text-teal-600 dark:text-teal-400 text-xs font-medium cursor-pointer">
                            {t('table.view')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </div>
        {rows.length > PAGE_SIZE && (
          <div className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {t('pager.range', { from: safePage * PAGE_SIZE + 1, to: safePage * PAGE_SIZE + pageRows.length, total: rows.length })}
            </span>
            <nav aria-label={t('pager.label')} className="flex items-center gap-1">
              <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label={t('pager.prev')}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                <ChevronRight className="w-3.5 h-3.5 ltr:rotate-180" /> {t('pager.prev')}
              </button>
              {Array.from({ length: pageCount }, (_, i) => (
                <button key={i} type="button" onClick={() => setPage(i)} aria-current={i === safePage ? 'page' : undefined}
                  className={`w-8 h-8 rounded-lg text-xs font-medium tabular-nums cursor-pointer ${i === safePage ? 'bg-teal-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  {i + 1}
                </button>
              ))}
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label={t('pager.next')}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                {t('pager.next')} <ChevronLeft className="w-3.5 h-3.5 ltr:rotate-180" />
              </button>
            </nav>
          </div>
        )}
      </section>

      {editing && (
        <SupplierModal
          key={editing.isNew ? 'new' : editing.rec.id}
          initial={editing.rec}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={rec => { saveSupplier(rec); setSelectedId(rec.id); setEditing(null); }}
          onDelete={editing.isNew ? undefined : () => {
            deleteSupplier(editing.rec.id);
            if (selectedId === editing.rec.id) setSelectedId(supplierPrices.find(s => s.id !== editing.rec.id)?.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};
