import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, ArrowDownUp, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, Download, Coins, History, TrendingUp, TrendingDown,
  Minus, X, Trash2, ImagePlus, Truck, Check, Phone, MapPin, BarChart3,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFuelData } from '../../context/FuelDataContext';
import { usePermissions } from '../../lib/usePermission';
import { enumText } from '../../i18n/enums';
import { collator } from '../../i18n/format';
import { formatNumber } from '../../lib/utils';
import { deliveriesOfSupplier, sameSupplier, archiveIdentity, buildArchiveSuppliers } from '../../lib/archiveSuppliers';
import { requestInboundFocus, focusFromDelivery } from '../../lib/inboundFocus';
import { setSessionValue, useSessionState } from '../../lib/useSessionState';
import { SupplierProfile } from './SupplierProfile';
import { SuppliersCompare } from './SuppliersCompare';
import { PriceLogModal } from './PriceLogModal';
import type { InboundDelivery, NavTabId, SupplierPriceRecord } from '../../types';
import { ChangePill, fmtPrice, CompanyBadges, Avatar, type Company } from './supplierUi';

type SortKey = 'name' | 'priceDesc' | 'priceAsc' | 'change' | 'updated';

const PAGE_SIZE = 10;

const dateKey = (d?: string) => (d || '').replace(/-/g, '/');

/** بطاقة مؤشر: رقم رئيسي واحد واضح، وتحته سطران هادئان (اسم ← قيمة) بدل أرقام متجاورة */
const StatCard: React.FC<{
  icon: React.ReactNode; iconBg: string; title: string; value: string; unit?: string; valueClass?: string;
  rows: { label: string; value: React.ReactNode }[];
}> = ({ icon, iconBg, title, value, unit, valueClass = 'text-slate-900 dark:text-white', rows }) => (
  <div className="sup-stat rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col min-w-0">
    <div className="sup-stat-pad pt-4 flex items-start justify-between gap-2">
      <span className="sup-stat-title font-medium text-slate-500 dark:text-slate-400 leading-tight">{title}</span>
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</span>
    </div>
    <div className="sup-stat-pad mt-1 flex items-baseline gap-1.5 min-w-0">
      <span dir="ltr" className={`sup-stat-val font-bold tabular-nums ${valueClass}`}>{value}</span>
      {unit && <span className="sup-stat-unit text-slate-400 font-medium whitespace-nowrap">{unit}</span>}
    </div>
    <dl className="sup-stat-pad mt-auto pt-3 pb-3.5 space-y-1.5">
      {/* المفتاح بالترتيب لا بالنص: قبل تحميل ملف الترجمة قد يتطابق نصّا سطرين فيبقى سطر قديم معلّقًا */}
      {rows.map((r, i) => (
        <div key={i} className="sup-stat-row flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 first:border-t-0 first:pt-0">
          <dt className="text-slate-400 leading-tight">{r.label}</dt>
          <dd className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">{r.value}</dd>
        </div>
      ))}
    </dl>
  </div>
);

/** رقم بإشارة ولون حسب الاتجاه (ارتفاع السعر أحمر، انخفاضه أخضر) */
/** مؤشر اتجاه بأسلوب لوحات المال: خط اتجاه داخل مربع ناعم بلون خفيف */
const TrendMark: React.FC<{ v: number }> = ({ v }) =>
  v === 0 ? null : (
    <span className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-md shrink-0 ${v > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`}>
      {v > 0 ? <TrendingUp className="w-3 h-3" strokeWidth={2.75} /> : <TrendingDown className="w-3 h-3" strokeWidth={2.75} />}
    </span>
  );

const Signed: React.FC<{ v: number; suffix?: string; text?: string }> = ({ v, suffix = '', text }) => (
  <span className={`inline-flex items-center gap-1.5 ${v > 0 ? 'text-rose-500' : v < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
    <TrendMark v={v} />
    <span dir="ltr">{text ?? `${v > 0 ? '+' : ''}${v}${suffix}`}</span>
  </span>
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
  category: 'تجاري', availability: 'متوفر', lastUpdated: '', company: 'sahara',
};

const SupplierModal: React.FC<{ initial: SupplierPriceRecord; isNew: boolean; onClose: () => void; onSave: (s: SupplierPriceRecord) => void; onDelete?: () => void }> = ({ initial, isNew, onClose, onSave, onDelete }) => {
  const { t } = useTranslation(['suppliers', 'common']);
  const [f, setF] = useState<SupplierPriceRecord>(initial);
  const [price, setPrice] = useState(initial.priceIqd ? String(initial.priceIqd) : '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof SupplierPriceRecord>(k: K, v: SupplierPriceRecord[K]) => setF(p => ({ ...p, [k]: v }));
  const priceNum = Number(price.replace(/,/g, ''));
  const valid = f.supplierName.trim() && f.product.trim() && priceNum > 0;
  const priceChanged = !isNew && priceNum > 0 && priceNum !== initial.priceIqd;
  const delta = priceChanged && initial.priceIqd ? Math.round(((priceNum - initial.priceIqd) / initial.priceIqd) * 10000) / 100 : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // إيقاف تمرير الصفحة خلف النافذة
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const save = () => valid && onSave({ ...f, supplierName: f.supplierName.trim(), product: f.product.trim(), density: (f.density ?? '').trim(), color: (f.color ?? '').trim(), priceIqd: priceNum, id: f.id || `sup-${Date.now()}` });
  const input = 'w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white outline-none transition-colors placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10';
  const label = 'block text-[12.5px] font-medium text-slate-600 dark:text-slate-300 mb-1.5';
  const section = 'text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-3';

  // النافذة تُعرض فوق الصفحة كلها (portal) فتغطي الهيدر والقائمة بالتعتيم والضبابية كاملة
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-900/45 backdrop-blur-md animate-[overlayIn_.18s_ease]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={isNew ? t('modal.addTitle') : t('modal.editTitle')}
        className="w-full max-w-xl max-h-[94vh] flex flex-col rounded-3xl animate-[dialogIn_.22s_cubic-bezier(.2,.9,.3,1.2)] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.45)] overflow-hidden"
        onMouseDown={e => e.stopPropagation()}>

        {/* الرأس: الشعار مع زر تغييره، والعنوان واسم المورد */}
        <div className="relative px-5 sm:px-6 pt-5 pb-4 bg-gradient-to-b from-teal-50/80 to-transparent dark:from-teal-950/30">
          <button type="button" onClick={onClose} aria-label={t('common:actions.close')}
            className="absolute top-4 end-4 w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-white/80 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <span className="block p-1 rounded-full bg-white dark:bg-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.12)]">
                <Avatar s={f.id ? f : { ...f, id: 'new' }} size="w-16 h-16" text="text-xl" />
              </span>
              <button type="button" onClick={() => fileRef.current?.click()} aria-label={t('modal.logo')} title={t('modal.logo')}
                className="absolute -bottom-0.5 -end-0.5 w-7 h-7 rounded-full bg-teal-500 hover:bg-teal-600 text-white border-2 border-white dark:border-slate-900 flex items-center justify-center cursor-pointer">
                <ImagePlus className="w-3.5 h-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) set('logo', await shrinkImage(file));
              }} />
            </div>
            <div className="min-w-0 pe-10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{isNew ? t('modal.addTitle') : t('modal.editTitle')}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{f.supplierName || t('modal.newHint')}</p>
              {f.logo && (
                <button type="button" onClick={() => set('logo', undefined)} className="mt-1 text-[12px] font-medium text-rose-500 hover:underline cursor-pointer">{t('modal.removeLogo')}</button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {/* البيانات الأساسية */}
          <section>
            <h4 className={section}>{t('modal.sectionBasic')}</h4>
            <div className="space-y-4">
              <div>
                <label className={label}>{t('fields.name')}</label>
                <input className={`${input} px-3.5`} value={f.supplierName} onChange={e => set('supplierName', e.target.value)} autoFocus />
              </div>
              <div>
                <label className={label}>{t('fields.product')}</label>
                <input className={`${input} px-3.5`} value={f.product} onChange={e => set('product', e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>{t('fields.density')}</label>
                  <input className={`${input} px-3.5 tabular-nums`} dir="ltr" style={{ textAlign: 'start' }} inputMode="decimal" placeholder="0.840"
                    value={f.density ?? ''} onChange={e => set('density', e.target.value.replace(/[^\d.,]/g, ''))} />
                </div>
                <div>
                  <label className={label}>{t('fields.color')}</label>
                  <input className={`${input} px-3.5`} value={f.color ?? ''} onChange={e => set('color', e.target.value)} />
                </div>
              </div>
            </div>
          </section>

          {/* السعر والشركة المستلمة */}
          <section>
            <h4 className={section}>{t('modal.sectionPrice')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>{t('cards.current')}</label>
                <div className="relative">
                  <input className={`${input} ps-3.5 pe-24 text-base font-semibold tabular-nums`} inputMode="decimal" value={price}
                    onChange={e => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} />
                  <span className="absolute inset-y-0 end-3 flex items-center text-[12px] text-slate-400 pointer-events-none">{t('units.iqdPerLiter')}</span>
                </div>
              </div>
              <div>
                <label className={label}>{t('table.receiver')}</label>
                <div className="grid grid-cols-2 gap-1 p-1 h-11 rounded-xl bg-slate-100 dark:bg-slate-800">
                  {(['sahara', 'etihad'] as Company[]).map(c => (
                    <button key={c} type="button" onClick={() => set('company', c)} aria-pressed={f.company === c}
                      className={`rounded-lg text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${f.company === c ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                      <span className={`w-2 h-2 rounded-full ${c === 'sahara' ? 'bg-amber-500' : 'bg-sky-500'}`} />{t(`receiver.${c}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* معاينة أثر تغيير السعر */}
            {priceChanged && (
              <div className={`mt-3 rounded-xl px-3.5 py-2.5 flex items-center gap-3 text-[12.5px] ${delta > 0 ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-emerald-50 dark:bg-emerald-950/30'}`}>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${delta > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-600'}`}>
                  {delta > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </span>
                <span className="flex-1 text-slate-600 dark:text-slate-300">{t('modal.priceNote', { old: fmtPrice(initial.priceIqd) })}</span>
                <span dir="ltr" className={`font-semibold tabular-nums ${delta > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{delta > 0 ? '+' : ''}{delta}%</span>
              </div>
            )}
          </section>

          {/* التواصل */}
          <section>
            <h4 className={section}>{t('modal.sectionContact')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>{t('fields.phone')}</label>
                <div className="relative">
                  <Phone className="absolute top-1/2 -translate-y-1/2 start-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input className={`${input} ps-10 pe-3.5`} dir="ltr" style={{ textAlign: 'start' }} inputMode="tel" value={f.phone ?? ''} onChange={e => set('phone', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={label}>{t('fields.location')}</label>
                <div className="relative">
                  <MapPin className="absolute top-1/2 -translate-y-1/2 start-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input className={`${input} ps-10 pe-3.5`} value={f.location ?? ''} onChange={e => set('location', e.target.value)} />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* التذييل: الحذف بتأكيد داخلي، والإلغاء والحفظ */}
        <div className="shrink-0 px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-900">
          {onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] text-rose-600">{t('modal.deleteAsk')}</span>
                <button type="button" onClick={onDelete} className="h-9 px-3 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[13px] font-semibold cursor-pointer">{t('common:actions.delete')}</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="h-9 px-2 rounded-lg text-[13px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">{t('common:actions.cancel')}</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="h-10 px-3 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 cursor-pointer">
                <Trash2 className="w-4 h-4" /> {t('common:actions.delete')}
              </button>
            )
          ) : <span />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">{t('common:actions.cancel')}</button>
            <button type="button" disabled={!valid} onClick={save}
              className="h-10 px-5 rounded-xl text-sm font-semibold bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center gap-1.5 shadow-[0_6px_16px_-6px_rgba(13,148,136,0.6)] cursor-pointer">
              <Check className="w-4 h-4" /> {t('common:actions.save')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
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
  // صفحة المورد الكاملة (تبقى مفتوحة بعد تحديث الصفحة): اسمه في الأرشيف وشركة السجل الذي فُتحت منه
  const [profileState, setProfile] = useSessionState<{ name: string; company?: Company } | string | null>('supplier_profile', null);
  const profile = typeof profileState === 'string' ? { name: profileState } : profileState;

  // يُعرض أولًا آخر مورد تحدّث سعره (نفس ترتيب الجدول الافتراضي)
  const [selectedId, setSelectedId] = useState<string | undefined>(() =>
    [...supplierPrices].sort((a, b) => dateKey(b.lastUpdated).localeCompare(dateKey(a.lastUpdated)))[0]?.id);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ rec: SupplierPriceRecord; isNew: boolean } | null>(null);
  const sortRef = useOutside(sortOpen, () => setSortOpen(false));
  const menuRef = useOutside(menuOpen, () => setMenuOpen(false));

  const selected = supplierPrices.find(s => s.id === selectedId) ?? supplierPrices[0];
  // المقارنة تُبنى من الأرشيف وحده (أسماء وشركات وأرقام)؛ من سجلات الأسعار يُؤخذ الشعار فقط
  const archiveSuppliers = useMemo(() => buildArchiveSuppliers(saharaDeliveries, etihadDeliveries).map(a => {
    const rec = supplierPrices.find(s => s.id === a.id) ?? supplierPrices.find(s => s.company === a.company && sameSupplier(s.supplierName, a.supplierName));
    return rec?.logo ? { ...a, logo: rec.logo } : a;
  }), [saharaDeliveries, etihadDeliveries, supplierPrices]);

  const allDeliveries = useMemo(
    () => [...saharaDeliveries.map(d => ({ d, tab: 'deliveries-sahara' as NavTabId })), ...etihadDeliveries.map(d => ({ d, tab: 'deliveries-etihad' as NavTabId }))],
    [saharaDeliveries, etihadDeliveries]
  );
  /** شحنات المورد في أرشيف الوارد (الشركتين): الأحدث أولًا، مع مجموع الكمية */
  const inboundOf = useMemo(() => {
    const cache = new Map<string, { last?: { d: InboundDelivery; tab: NavTabId }; count: number; lastDay: string; lastDayCount: number; lastDayQty: number; companies: Company[] }>();
    return (s: SupplierPriceRecord) => {
      if (!cache.has(s.id)) {
        const pool = s.company ? allDeliveries.filter(x => x.tab === (s.company === 'etihad' ? 'deliveries-etihad' : 'deliveries-sahara')) : allDeliveries;
        const hits = deliveriesOfSupplier(pool, x => x.d, s.supplierName);
        hits.sort((a, b) => dateKey(b.d.receiptUnloadDate || b.d.date).localeCompare(dateKey(a.d.receiptUnloadDate || a.d.date)));
        // صهاريج آخر يوم وارد من المورد
        const lastDay = hits[0] ? dateKey(hits[0].d.receiptUnloadDate || hits[0].d.date) : '';
        const dayHits = lastDay ? hits.filter(({ d }) => dateKey(d.receiptUnloadDate || d.date) === lastDay) : [];
        const lastDayQty = dayHits.reduce((a, { d }) => a + (d.receivedQuantity || d.volumeLiters || 0), 0);
        // الشركة المستلمة: أرشيف الصحاري أو الاتحاد (أو كلاهما)
        const companies = (['sahara', 'etihad'] as Company[]).filter(c => hits.some(h => h.tab === (c === 'etihad' ? 'deliveries-etihad' : 'deliveries-sahara')));
        cache.set(s.id, { last: hits[0], count: hits.length, lastDay, lastDayCount: dayHits.length, lastDayQty, companies });
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

  // متوسط السوق لكل شركة على حدة (أسعار الصحاري والاتحاد مختلفة): موزون بالكمية من شحنات الأرشيف المسعّرة
  // لآخر 30 يومًا، ويتوسع إلى 90 يومًا إن كانت الشحنات أقل من 10
  const market = useMemo(() => {
    const cutoff = (days: number) => {
      const d = new Date(Date.now() - days * 86400000);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    };
    const calc = (ds: InboundDelivery[]) => {
      for (const days of [30, 90]) {
        const from = cutoff(days);
        const priced = ds.filter(d => (d.productPrice || d.pricePerLiter || 0) > 0 && dateKey(d.receiptUnloadDate || d.date) >= from);
        if (priced.length >= 10 || days === 90) {
          const qty = priced.reduce((a, d) => a + (d.receivedQuantity || d.volumeLiters || 0), 0);
          const cost = priced.reduce((a, d) => a + (d.receivedQuantity || d.volumeLiters || 0) * (d.productPrice || d.pricePerLiter || 0), 0);
          return { avg: qty ? Math.round((cost / qty) * 10) / 10 : 0, days };
        }
      }
      return { avg: 0, days: 90 };
    };
    return { sahara: calc(saharaDeliveries), etihad: calc(etihadDeliveries) };
  }, [saharaDeliveries, etihadDeliveries]);

  const exportCsv = () => {
    const head = [t('table.receiver'), t('table.supplier'), t('fields.product'), t('fields.category'), t('table.current'), t('table.previous'), t('table.change'), t('table.updated')];
    const list = rows;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const body = list.map(s => [inboundOf(s).companies.map(c => t(`receiver.${c}`)).join(' + ') || '—', s.supplierName, s.product, enumText(s.category), s.priceIqd, s.previousPriceIqd, `${s.changePercent}%`, s.lastUpdated].map(esc).join(','));
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
  /** «عرض التفاصيل»: أرشيف وارد الشركة (التقارير ← الوارد) مصفّى على المورد وآخر يوم وارد له */
  const openArchive = () => {
    if (!last || !sel) return;
    const scope = last.tab === 'deliveries-etihad' ? 'etihad' : 'sahara';
    requestInboundFocus(focusFromDelivery(last.d, scope, sel.lastDay));
    setSessionValue(`${scope}_subtab`, 'reports');
    setSessionValue(`${scope}_reports_tab`, 'inbound');
    setActiveTab(scope === 'etihad' ? 'finance-etihad' : 'finance-sahara');
  };
  // مجموع آخر يوم وارد (كل صهاريجه) كما في الجدول
  const lastQty = sel?.lastDayQty ?? 0;
  const diff = selected ? selected.priceIqd - selected.previousPriceIqd : 0;
  const ownCo: Company = selected?.company ?? 'sahara';
  const otherCo: Company = ownCo === 'sahara' ? 'etihad' : 'sahara';
  const ownMarket = market[ownCo];
  const inBothCompanies = !!selected && supplierPrices.some(x => x.id !== selected.id && x.company === otherCo && sameSupplier(x.supplierName, selected.supplierName));
  const vsMarket = selected && selected.priceIqd && ownMarket.avg ? Math.round(((selected.priceIqd - ownMarket.avg) / ownMarket.avg) * 1000) / 10 : 0;
  const marketLabel = (c: Company) => t('cards.marketAvgOf', { company: t(`receiver.${c}`), period: t('common:units.days', { count: market[c].days }) });

  const SORTS: { id: SortKey; label: string }[] = [
    { id: 'updated', label: t('sort.updated') }, { id: 'name', label: t('sort.name') }, { id: 'priceDesc', label: t('sort.priceDesc') },
    { id: 'priceAsc', label: t('sort.priceAsc') }, { id: 'change', label: t('sort.change') },
  ];

  // 10 موردين في كل صفحة؛ البحث أو الترتيب يعيد للصفحة الأولى
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  // أرقام الصفحات: 5 حول الصفحة الحالية حتى لا يتجاوز الشريط عرض الهاتف
  const winStart = Math.max(0, Math.min(safePage - 2, pageCount - 5));
  const pageWindow = Array.from({ length: Math.min(5, pageCount) }, (_, i) => winStart + i);
  useEffect(() => { setPage(0); }, [query, sort]);
  const th = 'px-3 xl:px-4 py-3 text-start text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const td = 'px-3 xl:px-4 py-3 text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap';

  if (profile) return <SupplierProfile name={profile.name} initialCompany={profile.company} onBack={() => setProfile(null)} />;

  return (
    <div className="space-y-5 pb-10">
      {/* ── رأس المورد المختار ── */}
      {selected ? (
        <section key={selected.id} className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-5 animate-[fadeIn_.25s_ease]">
          <div className="flex items-start sm:items-center gap-4 sm:gap-7 flex-1 min-w-0">
            <span className="p-1 rounded-full bg-white dark:bg-slate-900 shadow-[0_4px_14px_rgba(15,23,42,0.12)] shrink-0">
              <Avatar s={selected} size="w-16 h-16 sm:w-24 sm:h-24" text="text-xl sm:text-3xl" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-lg sm:text-[28px] leading-tight font-bold text-slate-900 dark:text-white break-words">{selected.supplierName}</h1>
                <span className="px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-300 text-xs font-medium">{enumText(selected.category)}</span>
              </div>
              <dl className="mt-3 sm:mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 sm:gap-x-8 gap-y-3">
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
          {/* بطاقة ملف المورد: تفتح صفحة المورد الكاملة (وارد الشركتين والمجهزون) */}
          <button type="button" onClick={() => setProfile({ name: archiveIdentity(selected, saharaDeliveries, etihadDeliveries) ?? selected.supplierName, company: selected.company })}
            className="group lg:w-72 shrink-0 rounded-2xl p-4 text-start bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 hover:border-teal-400 hover:bg-teal-50/60 dark:hover:bg-teal-950/30 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <span className="p-0.5 rounded-xl bg-white dark:bg-slate-900 shadow-sm shrink-0"><Avatar s={selected} size="w-11 h-11" text="text-base" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{t('profile.cardLabel')}</div>
                <div className="text-[15px] font-semibold text-slate-900 dark:text-white truncate">{selected.supplierName}</div>
              </div>
              <span className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center shrink-0 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5">
                <ChevronLeft className="w-4 h-4 ltr:rotate-180" />
              </span>
            </div>
          </button>
        </section>
      ) : (
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-10 text-center text-slate-400">{t('empty')}</section>
      )}

      {/* ── البطاقات ── */}
      {selected && (
        <div key={`k-${selected.id}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 xl:gap-4 animate-[fadeIn_.25s_ease]">
          <StatCard
            icon={<History className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50 dark:bg-teal-950/60"
            title={t('cards.previous')}
            value={fmtPrice(selected.previousPriceIqd)} unit={iqdL}
            rows={[
              { label: t('cards.lastChange'), value: selected.history?.[1]?.date || selected.lastUpdated || '—' },
              {
                label: t('cards.diffFromCurrent'),
                value: (
                  <span className={`inline-flex items-center gap-1.5 ${diff > 0 ? 'text-rose-500' : diff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    <TrendMark v={diff} />
                    <span className="tabular-nums">{fmtPrice(Math.abs(diff))}</span> {t('common:units.iqd')}
                  </span>
                ),
              },
            ]}
          />
          <StatCard
            icon={<Coins className="w-4 h-4 text-white" />} iconBg="bg-amber-400"
            title={t('cards.current')}
            value={fmtPrice(selected.priceIqd)} unit={iqdL}
            rows={[
              { label: t('cards.updatedOn'), value: selected.lastUpdated || '—' },
              { label: t('cards.vsPrevious'), value: <Signed v={selected.changePercent} suffix="%" /> },
            ]}
          />
          <StatCard
            icon={selected.changePercent > 0 ? <TrendingUp className="w-4 h-4 text-rose-500" /> : selected.changePercent < 0 ? <TrendingDown className="w-4 h-4 text-emerald-600" /> : <Minus className="w-4 h-4 text-slate-500" />}
            iconBg={selected.changePercent > 0 ? 'bg-rose-50 dark:bg-rose-950/50' : selected.changePercent < 0 ? 'bg-emerald-50 dark:bg-emerald-950/50' : 'bg-slate-100 dark:bg-slate-800'}
            title={t('cards.change')}
            value={`${selected.changePercent > 0 ? '+' : ''}${selected.changePercent}%`}
            valueClass={selected.changePercent > 0 ? 'text-rose-500' : selected.changePercent < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}
            unit={selected.changePercent > 0 ? t('change.up') : selected.changePercent < 0 ? t('change.down') : t('change.stable')}
            rows={[
              { label: marketLabel(ownCo), value: ownMarket.avg ? fmtPrice(ownMarket.avg) : '—' },
              { label: t('cards.vsMarket'), value: ownMarket.avg && selected.priceIqd ? <Signed v={vsMarket} suffix="%" /> : '—' },
              // متوسط الشركة الأخرى فقط إن كان نفس المورد يورّد لها أيضًا
              ...(inBothCompanies ? [{ label: marketLabel(otherCo), value: <span className="text-slate-400 font-medium">{market[otherCo].avg ? fmtPrice(market[otherCo].avg) : '—'}</span> }] : []),
            ]}
          />
          <StatCard
            icon={<Truck className="w-4 h-4 text-sky-600" />} iconBg="bg-sky-50 dark:bg-sky-950/50"
            title={t('cards.tankers')}
            value={sel?.lastDayCount ? formatNumber(sel.lastDayCount) : '—'}
            rows={[
              { label: t('cards.lastDay'), value: sel?.lastDay || '—' },
              { label: t('cards.totalTankers'), value: sel?.count ? formatNumber(sel.count) : '—' },
            ]}
          />
          <div className="sm:col-span-2 lg:col-span-1 rounded-2xl p-4 flex flex-col items-center justify-center text-center text-white bg-gradient-to-br from-teal-600 via-teal-500 to-[#9dcf9f] shadow-[0_8px_24px_-8px_rgba(13,148,136,0.55)] min-h-[150px]">
            <div className="text-[13px] text-white/85 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> {t('cards.lastInbound')}</div>
            {last ? (
              <>
                <div className="mt-1.5 text-2xl font-bold leading-tight tabular-nums">{formatNumber(lastQty)} <span className="text-sm font-semibold">{t('common:units.liter')}</span></div>
                <button type="button" onClick={openArchive} className="mt-3 w-full max-w-[150px] h-8 rounded-full bg-white/20 hover:bg-white/30 text-[12.5px] font-medium transition-colors cursor-pointer">
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
            {/* مقارنة كل الموردين بيانيًا */}
            <button type="button" onClick={() => setCompareOpen(true)}
              className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-[13px] text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-teal-600 hover:border-teal-400 cursor-pointer">
              <BarChart3 className="w-4 h-4" /> {t('compare.button')}
            </button>
            {compareOpen && <SuppliersCompare suppliers={archiveSuppliers} sahara={saharaDeliveries} etihad={etihadDeliveries} onClose={() => setCompareOpen(false)} />}
            {/* السجل: كل عملية حفظ في الموردين وأسعار المشتريات، ومطابقتها مع الجدولين */}
            <button type="button" onClick={() => setLogOpen(true)}
              className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-[13px] text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-teal-600 hover:border-teal-400 cursor-pointer">
              <History className="w-4 h-4" /> {t('log.button')}
            </button>
            {logOpen && <PriceLogModal editable={editable} onClose={() => setLogOpen(false)} />}
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
                    <Download className="w-4 h-4 text-teal-500" /> {t('toolbar.export')}
                  </button>
                </div>
              )}
            </div>
        </div>

        {/* الهاتف والتابلت: بطاقة لكل مورد بدل الجدول العريض */}
        <div className="lg:hidden px-3 sm:px-4 pb-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.length === 0 && <p className="sm:col-span-2 py-10 text-center text-sm text-slate-400">{t('empty')}</p>}
          {pageRows.map(s => {
            const active = s.id === selected?.id;
            const inb = inboundOf(s);
            return (
              <article key={s.id} onClick={() => setSelectedId(s.id)} aria-selected={active}
                className={`rounded-2xl border p-3.5 cursor-pointer transition-colors ${active ? 'border-teal-400 bg-teal-50/60 dark:bg-teal-950/30 dark:border-teal-700' : 'border-slate-200/80 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}`}>
                <div className="flex items-center gap-3">
                  <Avatar s={s} size="w-10 h-10" text="text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{s.supplierName}</div>
                    <div className="text-[11px] text-slate-400 truncate">{s.product}</div>
                  </div>
                  <CompanyBadges companies={inb.companies} />
                  <ChangePill pct={s.changePercent} />
                </div>
                <dl className="mt-3 grid grid-cols-2 min-[480px]:grid-cols-4 sm:grid-cols-2 gap-2 text-center">
                  {[
                    { k: t('table.current'), v: fmtPrice(s.priceIqd), strong: true },
                    { k: t('table.previous'), v: fmtPrice(s.previousPriceIqd) },
                    { k: t('table.density'), v: s.density || '—' },
                    { k: t('table.color'), v: s.color || '—' },
                  ].map(({ k, v, strong }) => (
                    <div key={k} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-1.5 py-2 min-w-0">
                      <dt className="text-[10.5px] text-slate-400 truncate">{k}</dt>
                      <dd className={`mt-0.5 text-[13px] tabular-nums truncate ${strong ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 tabular-nums">{t('table.updated')}: {s.lastUpdated || '—'}</span>
                  {editable && (
                    <button type="button" onClick={e => { e.stopPropagation(); setEditing({ rec: s, isNew: false }); }}
                      className="h-7 px-3 rounded-md bg-teal-500 hover:bg-teal-600 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                      <Pencil className="w-3 h-3" /> {t('common:actions.edit')}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className={th}>{t('table.receiver')}</th>
                  <th className={th}>{t('table.supplier')}</th>
                  <th className={th}>{t('table.product')}</th>
                  <th className={th}>{t('table.density')}</th>
                  <th className={th}>{t('table.color')}</th>
                  <th className={th}>{t('table.current')}</th>
                  <th className={th}>{t('table.previous')}</th>
                  <th className={th}>{t('table.change')}</th>
                  <th className={th}>{t('table.updated')}</th>
                  <th className={th}>{t('table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={10} className="py-12 text-center text-sm text-slate-400">{t('empty')}</td></tr>
                )}
                {pageRows.map(s => {
                  const active = s.id === selected?.id;
                  const inb = inboundOf(s);
                  return (
                    <tr key={s.id} onClick={() => setSelectedId(s.id)} aria-selected={active}
                      className={`border-t border-slate-100 dark:border-slate-800 cursor-pointer transition-colors ${active ? 'bg-teal-50/70 dark:bg-teal-950/30' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}`}>
                      <td className={td}><CompanyBadges companies={inb.companies} /></td>
                      <td className={td}>
                        <div className="flex items-center gap-2.5">
                          <Avatar s={s} size="w-8 h-8" text="text-xs" />
                          <span className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate max-w-[200px] xl:max-w-[280px]">{s.supplierName}</span>
                        </div>
                      </td>
                      <td className={td}><span className="block truncate max-w-[160px]">{s.product || '—'}</span></td>
                      <td className={`${td} tabular-nums`} dir="ltr" style={{ textAlign: 'start' }}>{s.density || '—'}</td>
                      <td className={td}><span className="block truncate max-w-[120px]">{s.color || '—'}</span></td>
                      <td className={`${td} font-semibold text-slate-900 dark:text-white tabular-nums`}>{fmtPrice(s.priceIqd)}</td>
                      <td className={`${td} tabular-nums`}>{fmtPrice(s.previousPriceIqd)}</td>
                      <td className={td}><ChangePill pct={s.changePercent} /></td>
                      <td className={`${td} tabular-nums`}>{s.lastUpdated}</td>
                      <td className={td} onClick={e => e.stopPropagation()}>
                        {editable ? (
                          <button type="button" onClick={() => setEditing({ rec: s, isNew: false })} aria-label={t('common:actions.edit')} title={t('common:actions.edit')}
                            className="h-7 px-2 xl:px-3 rounded-md bg-teal-500 hover:bg-teal-600 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                            <Pencil className="w-3 h-3" /> <span className="hidden xl:inline">{t('common:actions.edit')}</span>
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
                <ChevronRight className="w-3.5 h-3.5 ltr:rotate-180" /> <span className="hidden sm:inline">{t('pager.prev')}</span>
              </button>
              {pageWindow.map(i => (
                <button key={i} type="button" onClick={() => setPage(i)} aria-current={i === safePage ? 'page' : undefined}
                  className={`w-8 h-8 rounded-lg text-xs font-medium tabular-nums cursor-pointer ${i === safePage ? 'bg-teal-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  {i + 1}
                </button>
              ))}
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label={t('pager.next')}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                <span className="hidden sm:inline">{t('pager.next')}</span> <ChevronLeft className="w-3.5 h-3.5 ltr:rotate-180" />
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
