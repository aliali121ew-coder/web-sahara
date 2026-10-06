import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpToLine, ArrowDownToLine, ArrowUpDown, Truck, Droplets, ChevronLeft, ChevronRight, X, Users } from 'lucide-react';
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
    return { max, min, avg, last: priced[0] ?? null, sahara: count('sahara'), etihad: count('etihad'), qty: rows.reduce((a, r) => a + qtyOf(r.d), 0) };
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

      {/* القسم الأول: ثلاث بطاقات متوازنة (نطاق السعر، الصهاريج حسب الشركة، الوارد الكلي) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 xl:gap-4">
        {/* نطاق السعر: أعلى وأدنى سعر مع شريط يبيّن موضع آخر سعر بينهما */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('profile.priceRange')}</span>
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
                <span dir="ltr" className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{r ? fmtPrice(priceOf(r.d)) : '—'}</span>
                <span className="text-[11px] text-slate-400 tabular-nums ms-auto truncate">{r ? dayOf(r.d) : ''}</span>
              </div>
            ))}
          </div>
          {stats.max && stats.min && stats.last && priceOf(stats.max.d) > priceOf(stats.min.d) && (
            <div className="mt-auto pt-4">
              <div className="relative h-1.5 rounded-full bg-gradient-to-l from-rose-400 via-amber-300 to-emerald-400 rtl:bg-gradient-to-r">
                <span className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-slate-700 dark:border-white shadow"
                  style={{ insetInlineStart: `calc(${Math.round(((priceOf(stats.last.d) - priceOf(stats.min.d)) / (priceOf(stats.max.d) - priceOf(stats.min.d))) * 100)}% - 6px)` }} />
              </div>
              <div className="mt-1.5 text-[11px] text-slate-400 tabular-nums">{t('profile.lastPrice', { price: fmtPrice(priceOf(stats.last.d)) })}</div>
            </div>
          )}
        </div>

        {/* الصهاريج حسب الشركة المستلمة: شريط نسبة، والضغط على شركة يصفّي السجل */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-4 sm:p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('profile.tankersByCompany')}</span>
            <span className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 flex items-center justify-center"><Truck className="w-4 h-4" /></span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['sahara', 'etihad'] as Company[]).map(c => {
              const n = stats[c];
              const on = company === c;
              return (
                <button key={c} type="button" disabled={!n} onClick={() => setCompany(on ? null : c)} aria-pressed={on}
                  className={`rounded-xl px-3 py-2 text-start border transition-colors ${on ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40' : 'border-slate-200/80 dark:border-slate-700 hover:border-teal-400'} disabled:opacity-50 disabled:cursor-default cursor-pointer`}>
                  <span className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${c === 'sahara' ? 'bg-amber-400' : 'bg-sky-500'}`} />{t(`receiver.${c}`)}
                  </span>
                  <span className="block text-xl font-bold tabular-nums text-slate-900 dark:text-white">{formatNumber(n)}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto pt-4">
            <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
              <span className="bg-amber-400" style={{ width: `${rows.length ? (stats.sahara / rows.length) * 100 : 0}%` }} />
              <span className="bg-sky-500" style={{ width: `${rows.length ? (stats.etihad / rows.length) * 100 : 0}%` }} />
            </div>
            <div className="mt-1.5 text-[11px] text-slate-400">{t('profile.tapToFilter')}</div>
          </div>
        </div>

        {/* الوارد الكلي (بطاقة مميزة) */}
        <div className="sm:col-span-2 lg:col-span-1 rounded-2xl p-4 sm:p-5 text-white bg-gradient-to-br from-teal-600 via-teal-500 to-[#5fb8a3] shadow-[0_8px_24px_-10px_rgba(13,148,136,0.6)] flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-white/85">{t('profile.totalInbound')}</span>
            <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center"><Droplets className="w-4 h-4" /></span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span dir="ltr" className="text-[clamp(1.5rem,3vw,2rem)] font-bold tabular-nums leading-tight">{formatNumber(stats.qty)}</span>
            <span className="text-sm text-white/80">{t('common:units.liter')}</span>
          </div>
          <div className="mt-auto pt-4 grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-xl bg-white/15 px-3 py-2">
              <div className="text-white/75">{t('profile.statTankers')}</div>
              <div className="text-[15px] font-bold tabular-nums">{formatNumber(rows.length)}</div>
            </div>
            <div className="rounded-xl bg-white/15 px-3 py-2">
              <div className="text-white/75">{t('profile.avgPrice')}</div>
              <div className="text-[15px] font-bold tabular-nums">{stats.avg ? fmtPrice(Math.round(stats.avg * 10) / 10) : '—'}</div>
            </div>
          </div>
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
        <aside className="order-first lg:order-none lg:col-span-2 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] overflow-hidden flex flex-col">
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
