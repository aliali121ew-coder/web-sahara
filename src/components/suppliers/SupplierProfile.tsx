import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpToLine, ArrowDownToLine, ArrowUpDown, Truck, Droplets, TrendingUp, TrendingDown, Minus, Percent, ChevronLeft, ChevronRight, X, Users, ArrowUp, ArrowDown, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFuelData } from '../../context/FuelDataContext';
import { formatNumber } from '../../lib/utils';
import { fmtDate } from '../../i18n/format';
import { deliveriesOfSupplier, sameSupplier, deliveryCompany, supplierKey } from '../../lib/archiveSuppliers';
import type { InboundDelivery } from '../../types';
import { fmtPrice, CompanyBadges, Avatar, type Company } from './supplierUi';
import { SupplierMonthlyChart } from './SupplierMonthlyChart';
import { PriceSpark, ShareRing } from './ProfileMinis';

/** الجهة التي ورد عبرها المورد: الشركة المجهزة، وإن لم تُذكر فالمورد نفسه (المورد صار المجهز أولًا) */
// اختلاف الكتابة («السده» / «السدة» / مسافات زائدة) يُوحَّد على أول صيغة ظهرت، فلا يتكرر المجهز في القائمة
const canonical = new Map<string, string>();
const equipperOf = (d: InboundDelivery) => {
  const raw = deliveryCompany(d);
  if (!raw) return raw;
  const key = supplierKey(raw);
  if (!canonical.has(key)) canonical.set(key, raw);
  return canonical.get(key)!;
};

const PAGE_SIZE = 10;
const dayOf = (d: InboundDelivery) => (d.receiptUnloadDate || d.date || '').split(' ')[0].replace(/-/g, '/');
const qtyOf = (d: InboundDelivery) => d.receivedQuantity || d.volumeLiters || 0;
const priceOf = (d: InboundDelivery) => d.productPrice || d.pricePerLiter || 0;

interface Row { d: InboundDelivery; co: Company }

export const SupplierProfile: React.FC<{ name: string; onBack: () => void }> = ({ name, onBack }) => {
  const { t } = useTranslation(['suppliers', 'common']);
  const { saharaDeliveries, etihadDeliveries, supplierPrices } = useFuelData();
  const [company, setCompany] = useState<Company | null>(null);
  const [equipper, setEquipper] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => { window.scrollTo({ top: 0 }); document.querySelector('main')?.scrollTo?.({ top: 0 }); }, [name]);

  // كل شحنات المورد من أرشيفي الصحاري والاتحاد، الأحدث أولًا
  const rows = useMemo<Row[]>(() => {
    const items: Row[] = [...saharaDeliveries.map(d => ({ d, co: 'sahara' as Company })), ...etihadDeliveries.map(d => ({ d, co: 'etihad' as Company }))];
    return deliveriesOfSupplier(items, x => x.d, name).sort((a, b) => dayOf(b.d).localeCompare(dayOf(a.d)));
  }, [saharaDeliveries, etihadDeliveries, name]);

  const record = supplierPrices.find(s => sameSupplier(s.supplierName, name));
  const avatarRec = { id: record?.id ?? name, supplierName: name, logo: record?.logo };

  const stats = useMemo(() => {
    const priced = rows.filter(r => priceOf(r.d) > 0);
    const max = priced.reduce<Row | null>((m, r) => (!m || priceOf(r.d) > priceOf(m.d) ? r : m), null);
    const min = priced.reduce<Row | null>((m, r) => (!m || priceOf(r.d) < priceOf(m.d) ? r : m), null);
    const count = (c: Company) => rows.filter(r => r.co === c).length;
    const pq = priced.reduce((a, r) => a + qtyOf(r.d), 0);
    const avg = pq ? priced.reduce((a, r) => a + qtyOf(r.d) * priceOf(r.d), 0) / pq : 0;
    // آخر 30 سعرًا بترتيب زمني للمسار المصغّر
    const spark = priced.slice(0, 30).map(r => priceOf(r.d)).reverse();
    return { max, min, avg, spark, last: priced[0] ?? null, sahara: count('sahara'), etihad: count('etihad'), qty: rows.reduce((a, r) => a + qtyOf(r.d), 0) };
  }, [rows]);

  // نسبة التغيّر الشهرية: آخر شهر فيه وارد مسعّر مقابل الشهر الذي فيه وارد قبله
  const weekly = useMemo(() => {
    const weekOf = (day: string) => {
      const [y, m] = day.split('/').map(Number);
      return new Date(y, m - 1, 1);
    };
    const acc = new Map<number, { cost: number; q: number; n: number; start: Date }>();
    rows.forEach(({ d }) => {
      const day = dayOf(d);
      if (!/^\d{4}\/\d{2}\/\d{2}$/.test(day) || priceOf(d) <= 0) return;
      const w = weekOf(day);
      const a = acc.get(w.getTime()) ?? { cost: 0, q: 0, n: 0, start: w };
      a.cost += qtyOf(d) * priceOf(d); a.q += qtyOf(d); a.n += 1;
      acc.set(w.getTime(), a);
    });
    const weeks = [...acc.values()].sort((a, b) => b.start.getTime() - a.start.getTime());
    const [cur, prev] = weeks;
    if (!cur) return null;
    const curP = cur.cost / cur.q;
    const prevP = prev ? prev.cost / prev.q : 0;
    const pct = prevP ? Math.round(((curP - prevP) / prevP) * 1000) / 10 : null;
    const qtyPct = prev && prev.q ? Math.round(((cur.q - prev.q) / prev.q) * 1000) / 10 : null;
    return { cur, prev, curP, prevP, pct, qtyPct };
  }, [rows]);

  // المجهزون لكل شركة مستلمة: عدد الصهاريج والكمية، الأكثر توريدًا أولًا
  const equippers = useMemo(() => {
    const by: Record<Company, Map<string, { name: string; count: number; qty: number }>> = { sahara: new Map(), etihad: new Map() };
    rows.forEach(({ d, co }) => {
      const n = equipperOf(d) || name;
      const e = by[co].get(n) ?? { name: n, count: 0, qty: 0 };
      e.count += 1; e.qty += qtyOf(d);
      by[co].set(n, e);
    });
    return (['sahara', 'etihad'] as Company[])
      .map(c => ({ co: c, list: [...by[c].values()].sort((a, b) => b.count - a.count) }))
      .filter(g => g.list.length);
  }, [rows, name]);
  const equipperTotal = equippers.reduce((a, g) => a + g.list.length, 0);

  const filtered = rows.filter(r => (!company || r.co === company) && (!equipper || (equipperOf(r.d) || name) === equipper));
  useEffect(() => { setPage(0); }, [company, equipper]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const filteredQty = filtered.reduce((a, r) => a + qtyOf(r.d), 0);
  // للسجل: السعر السابق لكل شحنة (أقدم شحنة مسعّرة بعدها)، وملخص كل شهر، وأكبر كمية لشريط الكمية
  const log = useMemo(() => {
    const prev = new Map<Row, number>();
    let older = 0;
    for (let k = filtered.length - 1; k >= 0; k--) {
      const p = priceOf(filtered[k].d);
      if (older) prev.set(filtered[k], older);
      if (p) older = p;
    }
    const months = new Map<string, { n: number; qty: number }>();
    filtered.forEach(r => { const m = dayOf(r.d).slice(0, 7); const a = months.get(m) ?? { n: 0, qty: 0 }; a.n++; a.qty += qtyOf(r.d); months.set(m, a); });
    const maxQty = filtered.reduce((a, r) => Math.max(a, qtyOf(r.d)), 0) || 1;
    return { prev, months, maxQty };
  }, [filtered]);

  const iqdL = t('units.iqdPerLiter');
  const th = 'px-3 py-3 text-start text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const td = 'px-3 py-3 text-[13px] text-slate-700 dark:text-slate-300 whitespace-nowrap';

  return (
    <div className="space-y-5 pb-10 animate-[fadeIn_.25s_ease]">
      {/* الرأس: رجوع + اسم المورد */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack}
          className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
          <ArrowRight className="w-4 h-4 ltr:rotate-180" /> {t('profile.back')}
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <Avatar s={avatarRec} size="w-10 h-10" text="text-sm" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">{name}</h1>
            <p className="text-xs text-slate-400">{t('profile.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* القسم الأول: أربع بطاقات بخط موحّد (Inter للأرقام): نطاق السعر، التغيّر الأسبوعي، الصهاريج حسب الشركة، الوارد الكلي */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 xl:gap-4">
        {/* نطاق السعر: أعلى وأدنى سعر مع شريط يبيّن موضع آخر سعر بينهما */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="kpi-label text-slate-500 dark:text-slate-400">{t('profile.priceRange')}</span>
            <span className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 flex items-center justify-center"><ArrowUpDown className="w-4 h-4" /></span>
          </div>
          <div className="mt-3 space-y-2.5">
            {[
              { r: stats.max, label: t('profile.highest'), icon: <ArrowUpToLine className="w-3.5 h-3.5" />, tone: 'text-rose-500 bg-rose-500/10' },
              { r: stats.min, label: t('profile.lowest'), icon: <ArrowDownToLine className="w-3.5 h-3.5" />, tone: 'text-emerald-600 bg-emerald-500/10' },
            ].map(({ r, label, icon, tone }) => (
              <div key={label} className="flex items-center gap-2.5 min-w-0">
                <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${tone}`}>{icon}</span>
                <span className="text-[13px] text-slate-500 dark:text-slate-400 w-16 shrink-0">{label}</span>
                <span dir="ltr" className="kpi-num text-[22px] text-slate-900 dark:text-white">{r ? fmtPrice(priceOf(r.d)) : '—'}</span>
                <span className="kpi-sub text-slate-400 tabular-nums ms-auto truncate">{r ? dayOf(r.d) : ''}</span>
              </div>
            ))}
          </div>
          {stats.last && stats.spark.length > 1 && (
            <div className="mt-auto pt-4">
              <PriceSpark prices={stats.spark} avg={stats.avg} label={t('profile.priceRange')} />
              <div className="mt-2 flex items-center justify-between gap-2 kpi-sub text-slate-400 tabular-nums">
                <span>{t('profile.lastPrice', { price: fmtPrice(priceOf(stats.last.d)) })}</span>
                {stats.avg > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 border-t border-dashed border-slate-400" />{t('profile.avgPrice')} {fmtPrice(Math.round(stats.avg * 10) / 10)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* نسبة التغيّر الشهرية: سعر آخر شهر مقابل الشهر السابق؛ الارتفاع أحمر والانخفاض أخضر */}
        {(() => {
          const pct = weekly?.pct ?? null;
          const up = pct !== null && pct > 0, down = pct !== null && pct < 0;
          const tone = up ? 'text-rose-500' : down ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500';
          const badge = up ? 'bg-rose-500/10 text-rose-500' : down ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500';
          const range = (w?: { start: Date }) => (w ? fmtDate(w.start, { month: 'long', year: 'numeric' }) : '—');
          return (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-4 sm:p-5 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <span className="kpi-label text-slate-500 dark:text-slate-400">{t('profile.monthlyChange')}</span>
                <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center"><Percent className="w-4 h-4" /></span>
              </div>
              <div className="mt-2.5 flex items-center gap-2.5">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${badge}`}>
                  {up ? <TrendingUp className="w-5 h-5" strokeWidth={2.5} /> : down ? <TrendingDown className="w-5 h-5" strokeWidth={2.5} /> : <Minus className="w-5 h-5" />}
                </span>
                <span dir="ltr" className={`kpi-num text-[28px] ${tone}`}>{pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`}</span>
              </div>
              <dl className="mt-auto pt-3 space-y-1.5 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-500 dark:text-slate-400">{range(weekly?.cur)}</dt>
                  <dd className="kpi-num text-[13px] text-slate-800 dark:text-slate-100">{weekly ? fmtPrice(Math.round(weekly.curP * 10) / 10) : '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <dt className="text-slate-500 dark:text-slate-400">{range(weekly?.prev)}</dt>
                  <dd className="kpi-num text-[13px] text-slate-800 dark:text-slate-100">{weekly?.prev ? fmtPrice(Math.round(weekly.prevP * 10) / 10) : '—'}</dd>
                </div>
                {weekly && !weekly.prev && <div className="kpi-sub text-slate-400">{t('profile.noPrevMonth')}</div>}
              </dl>
            </div>
          );
        })()}

        {/* الصهاريج حسب الشركة المستلمة: شريط نسبة، والضغط على شركة يصفّي السجل */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="kpi-label text-slate-500 dark:text-slate-400">{t('profile.tankersByCompany')}</span>
            <span className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center"><Truck className="w-4 h-4" /></span>
          </div>
          {/* حلقة الحصص + بطاقتا الشركتين (الضغط يصفّي السجل) */}
          <div className="mt-3 flex items-center gap-3">
            <ShareRing counts={{ sahara: stats.sahara, etihad: stats.etihad }} active={company}
              center={<><span className="kpi-num text-[18px] text-slate-900 dark:text-white">{formatNumber(rows.length)}</span><span className="text-[10px] text-slate-400">{t('profile.statTankers')}</span></>} />
            <div className="flex-1 min-w-0 space-y-1.5">
              {(['sahara', 'etihad'] as Company[]).map(c => {
                const n = stats[c];
                const on = company === c;
                const share = rows.length ? Math.round((n / rows.length) * 100) : 0;
                return (
                  <button key={c} type="button" disabled={!n} onClick={() => setCompany(on ? null : c)} aria-pressed={on}
                    className={`w-full rounded-xl px-2.5 py-1.5 flex items-center gap-2 text-start border transition-colors ${on ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40' : 'border-slate-200/80 dark:border-slate-700 hover:border-teal-400'} disabled:opacity-50 disabled:cursor-default cursor-pointer`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${c === 'sahara' ? 'bg-amber-400' : 'bg-sky-500'}`} />
                    <span className="text-[12px] text-slate-500 dark:text-slate-400 truncate">{t(`receiver.${c}`)}</span>
                    <span className="ms-auto kpi-num text-[16px] text-slate-900 dark:text-white">{formatNumber(n)}</span>
                    <span className="kpi-sub text-slate-400 tabular-nums w-9 text-end">{share}%</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-auto pt-3 kpi-sub text-slate-400">{t('profile.tapToFilter')}</div>
        </div>

        {/* الوارد الكلي: أبيض متدرج إلى أخضر فاتح */}
        <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-white via-emerald-50/70 to-teal-100/80 dark:from-slate-900 dark:via-emerald-950/30 dark:to-teal-900/40 border border-emerald-200/70 dark:border-emerald-900/50 shadow-[0_6px_20px_-10px_rgba(16,185,129,0.45)] flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="kpi-label text-emerald-800/80 dark:text-emerald-200/80">{t('profile.totalInbound')}</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center"><Droplets className="w-4 h-4" /></span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 min-w-0">
            <span dir="ltr" className="kpi-num text-[clamp(1.5rem,2.4vw,2rem)] text-slate-900 dark:text-white truncate">{formatNumber(stats.qty)}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('common:units.liter')}</span>
          </div>
          <div className="mt-auto pt-4 grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-xl bg-white/70 dark:bg-slate-900/50 border border-emerald-100 dark:border-emerald-900/40 px-3 py-2">
              <div className="text-slate-500 dark:text-slate-400">{t('profile.statTankers')}</div>
              <div className="kpi-num text-[16px] text-slate-900 dark:text-white">{formatNumber(rows.length)}</div>
            </div>
            <div className="rounded-xl bg-white/70 dark:bg-slate-900/50 border border-emerald-100 dark:border-emerald-900/40 px-3 py-2">
              <div className="text-slate-500 dark:text-slate-400">{t('profile.avgPrice')}</div>
              <div className="kpi-num text-[16px] text-slate-900 dark:text-white">{stats.avg ? fmtPrice(Math.round(stats.avg * 10) / 10) : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* القسم الثاني: جدول الوارد 60% + بطاقة المورد 40% */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:items-stretch lg:h-[700px]">
        <section className="lg:col-span-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] overflow-hidden min-w-0 flex flex-col lg:h-full lg:min-h-0">
          <div className="px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-300 flex items-center justify-center shrink-0"><ClipboardList className="w-4.5 h-4.5" /></span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">{t('profile.archiveTitle')}</h2>
                <p className="text-xs text-slate-400 tabular-nums">{t('profile.archiveSummary', { count: filtered.length, qty: formatNumber(filteredQty) })}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {company && (
                <button type="button" onClick={() => setCompany(null)} className="h-7 ps-2.5 pe-2 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 text-xs font-medium flex items-center gap-1 cursor-pointer">
                  {t(`receiver.${company}`)} <X className="w-3 h-3" />
                </button>
              )}
              {equipper && (
                <button type="button" onClick={() => setEquipper(null)} className="h-7 ps-2.5 pe-2 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 text-xs font-medium flex items-center gap-1 cursor-pointer max-w-[220px]">
                  <span className="truncate">{equipper}</span> <X className="w-3 h-3 shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* الهاتف والتابلت: بطاقات */}
          <div className="md:hidden p-3 space-y-2.5 lg:overflow-y-auto lg:flex-1 lg:min-h-0">
            {pageRows.length === 0 && <p className="py-10 text-center text-sm text-slate-400">{t('profile.empty')}</p>}
            {pageRows.map(({ d, co }, i) => (
              <article key={d.id ?? i} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-white tabular-nums">{dayOf(d)}</span>
                  <CompanyBadges companies={[co]} />
                </div>
                <div className="mt-1 text-xs text-slate-500 truncate">{equipperOf(d) || name} · {d.driverName || '—'}</div>
                <div className="mt-2 flex items-center justify-between text-[13px] tabular-nums">
                  <span className="font-semibold text-slate-900 dark:text-white">{formatNumber(qtyOf(d))} <span className="text-[11px] font-normal text-slate-400">{t('common:units.liter')}</span></span>
                  <span className="text-slate-600 dark:text-slate-300">{priceOf(d) ? `${fmtPrice(priceOf(d))} ${iqdL}` : '—'}</span>
                </div>
              </article>
            ))}
          </div>

          {/* سطح المكتب: مجمّع حسب الشهر؛ السعر ثم الكمية بعد الشركة المجهزة */}
          <div className="hidden md:block overflow-auto flex-1 min-h-0">
            <table className="w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur">
                <tr>
                  <th className={th}>{t('profile.col.date')}</th>
                  <th className={th}>{t('table.receiver')}</th>
                  <th className={th}>{t('profile.col.equipper')}</th>
                  <th className={th}>{t('profile.col.price')}</th>
                  <th className={th}>{t('profile.col.qty')}</th>
                  <th className={th}>{t('profile.col.driver')}</th>
                  <th className={th}>{t('profile.col.truck')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-sm text-slate-400">{t('profile.empty')}</td></tr>}
                {pageRows.map((r, i) => {
                  const { d, co } = r;
                  const day = dayOf(d);
                  const month = day.slice(0, 7);
                  const newMonth = i === 0 || dayOf(pageRows[i - 1].d).slice(0, 7) !== month;
                  const mAgg = log.months.get(month);
                  const [y, m, dd] = day.split('/').map(Number);
                  const date = y ? new Date(y, (m || 1) - 1, dd || 1) : null;
                  const price = priceOf(d), before = log.prev.get(r) ?? 0;
                  const delta = price && before ? price - before : 0;
                  const plate = (d.truckNumber || '').trim();
                  const noPlate = !plate || plate === 'غير محدد';
                  const driver = (d.driverName || '').trim();
                  return (
                    <React.Fragment key={d.id ?? i}>
                      {newMonth && (
                        <tr>
                          <td colSpan={7} className="px-4 pt-4 pb-1.5">
                            <div className="flex items-center gap-2 text-[12px]">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{date ? fmtDate(date, { month: 'long', year: 'numeric' }) : month}</span>
                              <span className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-700" />
                              {mAgg && <span className="text-slate-400 tabular-nums">{t('profile.archiveSummary', { count: mAgg.n, qty: formatNumber(mAgg.qty) })}</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition-colors">
                        <td className={`${td} border-b border-slate-100 dark:border-slate-800`}>
                          <div className="tabular-nums font-medium text-slate-800 dark:text-slate-100">{day}</div>
                          {date && <div className="text-[11px] text-slate-400">{fmtDate(date, { weekday: 'long' })}</div>}
                        </td>
                        <td className={`${td} border-b border-slate-100 dark:border-slate-800`}><CompanyBadges companies={[co]} /></td>
                        <td className={`${td} border-b border-slate-100 dark:border-slate-800`}><span className="block truncate max-w-[130px]">{equipperOf(d) || name}</span></td>
                        <td className={`${td} border-b border-slate-100 dark:border-slate-800`}>
                          {price ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[13.5px] font-bold tabular-nums text-slate-900 dark:text-white">{fmtPrice(price)}</span>
                              {delta !== 0 && (
                                <span title={t('profile.lastPrice', { price: fmtPrice(before) })}
                                  className={`inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10.5px] font-semibold tabular-nums ${delta > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-600'}`}>
                                  {delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{fmtPrice(Math.abs(delta))}
                                </span>
                              )}
                            </span>
                          ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className={`${td} border-b border-slate-100 dark:border-slate-800`}>
                          <div className="tabular-nums"><b className="font-semibold text-slate-900 dark:text-white">{formatNumber(qtyOf(d))}</b> <span className="text-[11px] text-slate-400">{t('common:units.liter')}</span></div>
                          <div className="mt-1 h-1 w-20 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <span className="block h-full rounded-full bg-teal-400/80" style={{ width: `${(qtyOf(d) / log.maxQty) * 100}%` }} />
                          </div>
                        </td>
                        <td className={`${td} border-b border-slate-100 dark:border-slate-800`}>
                          {driver ? (
                            <span className="inline-flex items-center gap-2 max-w-[130px]">
                              <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[11px] font-bold flex items-center justify-center shrink-0">{driver[0]}</span>
                              <span className="truncate">{driver}</span>
                            </span>
                          ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className={`${td} border-b border-slate-100 dark:border-slate-800`}>
                          {noPlate ? <span className="text-[12px] text-slate-400 dark:text-slate-500">{plate || '—'}</span> : (
                            <span dir="ltr" className="inline-block rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 font-mono text-[12px] text-slate-700 dark:text-slate-200 tracking-wide">{plate}</span>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="mt-auto px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {t('pager.range', { from: safePage * PAGE_SIZE + 1, to: safePage * PAGE_SIZE + pageRows.length, total: filtered.length })}
              </span>
              <nav aria-label={t('pager.label')} className="flex items-center gap-1">
                <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label={t('pager.prev')}
                  className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  <ChevronRight className="w-4 h-4 ltr:rotate-180" />
                </button>
                <span className="px-2 text-xs text-slate-500 tabular-nums">{safePage + 1} / {pageCount}</span>
                <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label={t('pager.next')}
                  className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  <ChevronLeft className="w-4 h-4 ltr:rotate-180" />
                </button>
              </nav>
            </div>
          )}
        </section>

        {/* بطاقة المورد والمجهزين */}
        <aside className="order-first lg:order-none lg:col-span-2 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] overflow-hidden flex flex-col lg:h-full lg:min-h-0">
          <div className="shrink-0 p-5 text-white bg-gradient-to-br from-teal-600 via-teal-500 to-[#5fb8a3]">
            <div className="flex items-center gap-3">
              <span className="p-0.5 rounded-xl bg-white/30 shrink-0"><Avatar s={avatarRec} size="w-14 h-14" text="text-xl" /></span>
              <div className="min-w-0">
                <div className="text-lg font-bold leading-tight truncate">{name}</div>
                <div className="text-xs text-white/80 truncate">{record?.product || t('profile.subtitle')}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { v: formatNumber(rows.length), k: t('profile.statTankers') },
                { v: formatNumber(equipperTotal), k: t('profile.statEquippers') },
                { v: rows[0] ? dayOf(rows[0].d) : '—', k: t('profile.statLast') },
              ].map(x => (
                <div key={x.k} className="min-w-0">
                  <div className="text-[15px] font-bold tabular-nums truncate">{x.v}</div>
                  <div className="text-[11px] text-white/75 truncate">{x.k}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 sm:p-4 flex-1 min-h-0 flex flex-col gap-3">
            {/* قائمة الشركات المجهزة: تمرير عند كثرتها */}
            <div className="space-y-4 overflow-y-auto max-h-[300px] lg:max-h-none lg:flex-1 lg:min-h-0 pe-1 -me-1">
            {equippers.length === 0 && <p className="py-8 text-center text-sm text-slate-400">{t('profile.empty')}</p>}
            {equippers.map(g => (
              <div key={g.co}>
                <div className="px-1 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                    <CompanyBadges companies={[g.co]} />
                    <Users className="w-3.5 h-3.5 text-slate-400" /> {t('profile.equippersCount', { count: g.list.length })}
                  </span>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {g.list.map((e, i) => {
                    const active = equipper === e.name && company === g.co;
                    return (
                      <li key={e.name}>
                        <button type="button" onClick={() => { if (active) { setEquipper(null); setCompany(null); } else { setEquipper(e.name); setCompany(g.co); } }}
                          className={`w-full px-2 py-2.5 rounded-xl flex items-center gap-3 text-start cursor-pointer transition-colors ${active ? 'bg-teal-50 dark:bg-teal-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                          <span className="w-6 text-xs font-semibold text-slate-400 tabular-nums">#{i + 1}</span>
                          <Avatar s={{ id: e.name, supplierName: e.name }} size="w-8 h-8" text="text-xs" />
                          <span className="flex-1 min-w-0 text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate">{e.name}</span>
                          <span className="text-end tabular-nums shrink-0">
                            <span className="block text-[13px] font-semibold text-slate-900 dark:text-white">{formatNumber(e.count)}</span>
                            <span className="block text-[10.5px] text-slate-400">{t('profile.tankersShort')}</span>
                          </span>
                          <span className="w-20 text-end tabular-nums shrink-0 hidden sm:block">
                            <span className="block text-[13px] font-semibold text-slate-700 dark:text-slate-200">{formatNumber(e.qty)}</span>
                            <span className="block text-[10.5px] text-slate-400">{t('common:units.liter')}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            </div>
            {(company || equipper) && (
              <button type="button" onClick={() => { setCompany(null); setEquipper(null); }}
                className="shrink-0 w-full h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">
                {t('profile.showAll')}
              </button>
            )}
            {/* الرسم البياني: الوارد الشهري حسب الشركة، بارتفاع ثابت أسفل البطاقة */}
            <div className="shrink-0 h-[220px] pt-3 border-t border-slate-100 dark:border-slate-800">
              <SupplierMonthlyChart rows={rows} name={name} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
