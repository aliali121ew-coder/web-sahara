import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpToLine, ArrowDownToLine, Truck, Droplets, ChevronLeft, ChevronRight, X, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFuelData } from '../../context/FuelDataContext';
import { formatNumber } from '../../lib/utils';
import { deliveriesOfSupplier, sameSupplier, deliveryCompany } from '../../lib/archiveSuppliers';
import type { InboundDelivery } from '../../types';
import { fmtPrice, CompanyBadges, Avatar, type Company } from './supplierUi';

/** الجهة التي ورد عبرها المورد: الشركة المجهزة، وإن لم تُذكر فالمورد نفسه (المورد صار المجهز أولًا) */
const equipperOf = (d: InboundDelivery) => deliveryCompany(d);

const PAGE_SIZE = 10;
const dayOf = (d: InboundDelivery) => (d.receiptUnloadDate || d.date || '').split(' ')[0].replace(/-/g, '/');
const qtyOf = (d: InboundDelivery) => d.receivedQuantity || d.volumeLiters || 0;
const priceOf = (d: InboundDelivery) => d.productPrice || d.pricePerLiter || 0;

interface Row { d: InboundDelivery; co: Company }

/** بطاقة مؤشر صغيرة أعلى صفحة المورد */
const Tile: React.FC<{ icon: React.ReactNode; tone: string; label: string; value: string; unit?: string; sub?: React.ReactNode; active?: boolean; onClick?: () => void }> = ({ icon, tone, label, value, unit, sub, active, onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={`sup-stat h-full w-full text-start rounded-2xl bg-white dark:bg-slate-900 border shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col min-w-0 ${onClick ? 'cursor-pointer hover:border-teal-400 transition-colors' : ''} ${active ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-200/70 dark:border-slate-800'}`}>
      <div className="sup-stat-pad pt-4 flex items-start justify-between gap-2">
        <span className="sup-stat-title font-medium text-slate-500 dark:text-slate-400 leading-tight">{label}</span>
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>{icon}</span>
      </div>
      <div className="sup-stat-pad mt-1 flex items-baseline gap-1.5 min-w-0">
        <span dir="ltr" className="sup-stat-val font-bold tabular-nums text-slate-900 dark:text-white">{value}</span>
        {unit && <span className="sup-stat-unit text-slate-400 font-medium whitespace-nowrap">{unit}</span>}
      </div>
      <div className="sup-stat-pad sup-stat-row mt-auto pt-2 pb-3.5 text-slate-400 tabular-nums">{sub ?? ' '}</div>
    </Tag>
  );
};

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
    return { max, min, sahara: count('sahara'), etihad: count('etihad'), qty: rows.reduce((a, r) => a + qtyOf(r.d), 0) };
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

  const iqdL = t('units.iqdPerLiter');
  const priceSub = (r: Row | null) => (r ? <span className="inline-flex items-center gap-1.5">{dayOf(r.d)} <CompanyBadges companies={[r.co]} /></span> : '—');
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

      {/* القسم الأول: المؤشرات */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 xl:gap-4">
        <Tile icon={<ArrowUpToLine className="w-4 h-4 text-rose-500" />} tone="bg-rose-50 dark:bg-rose-950/50"
          label={t('profile.highest')} value={stats.max ? fmtPrice(priceOf(stats.max.d)) : '—'} unit={stats.max ? iqdL : undefined} sub={priceSub(stats.max)} />
        <Tile icon={<ArrowDownToLine className="w-4 h-4 text-emerald-600" />} tone="bg-emerald-50 dark:bg-emerald-950/50"
          label={t('profile.lowest')} value={stats.min ? fmtPrice(priceOf(stats.min.d)) : '—'} unit={stats.min ? iqdL : undefined} sub={priceSub(stats.min)} />
        <Tile icon={<Truck className="w-4 h-4 text-sky-600" />} tone="bg-sky-50 dark:bg-sky-950/50"
          label={t('profile.tankersOf', { company: t('receiver.etihad') })} value={formatNumber(stats.etihad)}
          sub={stats.etihad ? t('profile.tapToFilter') : undefined}
          active={company === 'etihad'} onClick={stats.etihad ? () => setCompany(company === 'etihad' ? null : 'etihad') : undefined} />
        <Tile icon={<Truck className="w-4 h-4 text-amber-600" />} tone="bg-amber-50 dark:bg-amber-950/40"
          label={t('profile.tankersOf', { company: t('receiver.sahara') })} value={formatNumber(stats.sahara)}
          sub={stats.sahara ? t('profile.tapToFilter') : undefined}
          active={company === 'sahara'} onClick={stats.sahara ? () => setCompany(company === 'sahara' ? null : 'sahara') : undefined} />
        <div className="col-span-2 sm:col-span-1">
          <Tile icon={<Droplets className="w-4 h-4 text-white" />} tone="bg-teal-500"
            label={t('profile.totalInbound')} value={formatNumber(stats.qty)} unit={t('common:units.liter')}
            sub={t('profile.tankersTotal', { count: rows.length })} />
        </div>
      </div>

      {/* القسم الثاني: جدول الوارد 60% + بطاقة المورد 40% */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:items-stretch">
        <section className="lg:col-span-3 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] overflow-hidden min-w-0 flex flex-col">
          <div className="px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">{t('profile.archiveTitle')}</h2>
              <p className="text-xs text-slate-400 tabular-nums">{t('profile.archiveSummary', { count: filtered.length, qty: formatNumber(filteredQty) })}</p>
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
          <div className="md:hidden p-3 space-y-2.5">
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

          <div className="hidden md:block overflow-x-auto flex-1">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className={th}>{t('profile.col.date')}</th>
                  <th className={th}>{t('table.receiver')}</th>
                  <th className={th}>{t('profile.col.equipper')}</th>
                  <th className={th}>{t('profile.col.driver')}</th>
                  <th className={th}>{t('profile.col.truck')}</th>
                  <th className={th}>{t('profile.col.qty')}</th>
                  <th className={th}>{t('profile.col.price')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-sm text-slate-400">{t('profile.empty')}</td></tr>}
                {pageRows.map(({ d, co }, i) => (
                  <tr key={d.id ?? i} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className={`${td} tabular-nums`}>{dayOf(d)}</td>
                    <td className={td}><CompanyBadges companies={[co]} /></td>
                    <td className={td}><span className="block truncate max-w-[160px]">{equipperOf(d) || name}</span></td>
                    <td className={td}><span className="block truncate max-w-[140px]">{d.driverName || '—'}</span></td>
                    <td className={`${td} tabular-nums`} dir="ltr" style={{ textAlign: 'start' }}>{d.truckNumber || '—'}</td>
                    <td className={`${td} tabular-nums font-semibold text-slate-900 dark:text-white`}>{formatNumber(qtyOf(d))} <span className="text-[11px] font-normal text-slate-400">{t('common:units.liter')}</span></td>
                    <td className={`${td} tabular-nums`}>{priceOf(d) ? fmtPrice(priceOf(d)) : '—'}</td>
                  </tr>
                ))}
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
        <aside className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] overflow-hidden flex flex-col">
          <div className="p-5 text-white bg-gradient-to-br from-teal-600 via-teal-500 to-[#5fb8a3]">
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

          <div className="p-3 sm:p-4 space-y-4 flex-1 flex flex-col">
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
            {(company || equipper) && (
              <button type="button" onClick={() => { setCompany(null); setEquipper(null); }}
                className="mt-auto w-full h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">
                {t('profile.showAll')}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
