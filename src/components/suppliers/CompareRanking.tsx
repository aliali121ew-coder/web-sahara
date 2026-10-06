import React, { useMemo, useRef, useState } from 'react';
import { motion, MotionConfig, type Variants } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Crown, Trophy, Users, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../lib/utils';
import type { SupplierPriceRecord } from '../../types';
import { Avatar, type Company } from './supplierUi';

export interface RankItem { id: string; name: string; company: Company; value: number; agg: { qty: number; n: number; cost: number; pq: number } }

const OTHER_COLOR = '#cbd5e1';
const compact = (v: number) => (v >= 1e6 ? `${Math.round(v / 1e5) / 10}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : formatNumber(Math.round(v)));
// الثلاثة الأوائل: ذهبي وفضي وبرونزي
const MEDAL = [
  'bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-[0_4px_12px_-4px_rgba(245,158,11,0.7)]',
  'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-[0_4px_12px_-4px_rgba(100,116,139,0.6)]',
  'bg-gradient-to-br from-orange-300 to-orange-500 text-white shadow-[0_4px_12px_-4px_rgba(234,88,12,0.6)]',
];

// تأثير التتابع (Stagger): الصفوف تصعد قليلًا وتظهر واحدًا تلو الآخر كموجة
const listV: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } } };
const rowV: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24, mass: 0.7 } },
};

// موجة المرور: الكارت المؤشَّر عليه يبرز بوضوح وجيرانه يرتفعون أقل فأقل،
// وعند ترك الماوس يعود كل كارت بنابض مرن يتأرجح قليلًا كموج البحر بدل الرجوع الفوري
const LIFT = [-10, -4, -1.5];
// الظل والتكبير يختفيان بلمح البصر حتى لا تبقى كروت «معلّقة» عند التمرير السريع؛ الارتفاع وحده يتأرجح
const fade = { duration: 0.12, ease: 'easeOut' as const };
const waveIn = (d: number) => ({ y: { type: 'spring' as const, stiffness: 520, damping: 26, delay: d * 0.02 }, scale: fade, boxShadow: fade });
const waveOut = (d: number) => ({ y: { type: 'spring' as const, stiffness: 300, damping: 13, mass: 0.6, delay: d * 0.025 }, scale: fade, boxShadow: fade });

/**
 * صف مورد في الترتيب (memo): المرور يغيّر near/back للكروت القريبة فقط، فلا يُعاد رسم الـ30 الباقية.
 * near: بُعده عن الكارت المؤشَّر عليه (0..3، و-1 بلا مرور)، back: بُعده عن آخر كارت تُرك (لتأخير موجة الرجوع)
 */
const RankRow = React.memo<{
  b: RankItem; i: number; logo?: string; max: number; total: number; unit: string; showShare: boolean; near: number; back: number;
  fmtVal: (v: number) => string; onOpen: (id: string) => void; setHover: (id: string | null) => void;
}>(({ b, i, logo, max, total, unit, showShare, near, back, fmtVal, onOpen, setHover }) => {
  const { t } = useTranslation(['suppliers', 'common']);
  const pct = (b.value / max) * 100;
  const share = total ? Math.round((b.value / total) * 1000) / 10 : 0;
  const avg = b.agg.pq ? Math.round((b.agg.cost / b.agg.pq) * 10) / 10 : 0;
  const on = near === 0;
  return (
      <motion.li variants={rowV}>
        <motion.button type="button" onClick={() => onOpen(b.id)} onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)}
          animate={{
            y: near >= 0 ? (LIFT[near] ?? 0) : 0,
            scale: on ? 1.025 : 1,
            boxShadow: on ? '0 14px 30px -12px rgba(13,148,136,0.45)' : '0 0 0 0 rgba(13,148,136,0)',
          }}
          transition={near >= 0 ? waveIn(near) : waveOut(back)}
          className={`group relative w-full text-start rounded-2xl px-3 py-2.5 flex items-center gap-3 border transition-colors cursor-pointer ${on ? 'z-10 bg-teal-50/80 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${MEDAL[i] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            {i === 0 ? <Trophy className="w-3.5 h-3.5" /> : i + 1}
          </span>
          <Avatar s={{ id: b.id, supplierName: b.name, logo }} size="w-9 h-9" text="text-xs" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">{b.name}</span>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.company === 'sahara' ? 'bg-amber-500' : 'bg-sky-500'}`} title={t(`receiver.${b.company}`)} />
              <span className="text-[10.5px] text-slate-400 shrink-0">{t(`receiver.${b.company}`)}</span>
            </div>
            {/* الشريط: عرضه نسبة من الأعلى، والتفاصيل تظهر عند المرور */}
            <div className="mt-1.5 relative h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <span className={`absolute inset-y-0 start-0 rounded-full transition-[width] duration-500 ease-out ${i === 0 ? 'bg-gradient-to-l from-teal-400 via-emerald-500 to-teal-600' : 'bg-gradient-to-l from-teal-300 to-teal-500'}`}
                style={{ width: `${Math.max(1.5, pct)}%` }} />
            </div>
            <div className={`grid grid-cols-3 gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums overflow-hidden transition-all ${on ? 'max-h-6 mt-1.5 opacity-100' : 'max-h-0 opacity-0'}`}>
              <span>{t('profile.metric.qty')}: <b className="text-slate-700 dark:text-slate-200">{compact(b.agg.qty)}</b></span>
              <span>{t('profile.metric.tankers')}: <b className="text-slate-700 dark:text-slate-200">{formatNumber(b.agg.n)}</b></span>
              <span>{t('profile.metric.price')}: <b className="text-slate-700 dark:text-slate-200">{avg ? formatNumber(avg) : '—'}</b></span>
            </div>
          </div>
          <div className="text-end shrink-0 w-28">
            <div className="kpi-num text-[15px] text-slate-900 dark:text-white">{fmtVal(b.value)}</div>
            <div className="text-[10.5px] text-slate-400">{showShare ? `${share}% · ${unit}` : unit}</div>
          </div>
          <ChevronLeft className={`w-4 h-4 text-teal-500 shrink-0 ltr:rotate-180 transition-opacity ${on ? 'opacity-100' : 'opacity-0'}`} />
        </motion.button>
      </motion.li>
  );
});

/**
 * لوحة ترتيب الموردين (بديل الأعمدة المائلة): دونات الحصص في الأعلى، ثم صف لكل مورد
 * بشارة ترتيب وشعار وشريط متدرج بقيمته وحصته؛ الضغط على مورد يفتح تحليل وارده.
 */
export const CompareRanking = React.memo<{
  items: RankItem[]; records: SupplierPriceRecord[]; palette: string[]; unit: string; showShare: boolean;
  fmtVal: (v: number) => string; onOpen: (id: string) => void;
}>(({ items, records, palette, unit, showShare, fmtVal, onOpen }) => {
  const { t } = useTranslation(['suppliers', 'common']);
  const [hover, setHover] = useState<string | null>(null);
  // تتغيّر قائمة الموردين (فلتر/ترتيب) ⇒ تُعاد موجة الظهور
  const waveKey = useMemo(() => items.map(b => b.id).join('|'), [items]);
  const total = items.reduce((a, b) => a + b.value, 0);
  const max = items[0]?.value || 1;
  const recordOf = useMemo(() => new Map(records.map(r => [r.id, r])), [records]);

  // الدونات: أعلى 5 بألوانهم + «الباقي»
  const donut = useMemo(() => {
    const top = items.slice(0, 5).map((b, i) => ({ id: b.id, name: b.name, value: b.value, color: palette[i] }));
    const rest = items.slice(5).reduce((a, b) => a + b.value, 0);
    return rest > 0 ? [...top, { id: '__rest', name: t('compare.others'), value: rest, color: OTHER_COLOR }] : top;
  }, [items, palette, t]);
  const focus = donut.find(d => d.id === hover) ?? null;
  const hoverIdx = hover ? items.findIndex(x => x.id === hover) : -1;
  // آخر كارت تُرك: مركز موجة الرجوع
  const lastIdx = useRef(-1);
  if (hoverIdx >= 0) lastIdx.current = hoverIdx;

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 px-4 sm:px-6 pt-3 pb-4">
      {/* الملخص: دونات الحصص + أرقام سريعة */}
      <div className="lg:w-[320px] shrink-0 rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-gradient-to-b from-white to-slate-50/80 dark:from-slate-900 dark:to-slate-900/60 p-4 flex flex-col">
        <div className="relative h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={donut} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="92%" paddingAngle={showShare ? 2 : 1}
                stroke="none" isAnimationActive={false} onMouseEnter={(_, i) => setHover(donut[i]?.id ?? null)} onMouseLeave={() => setHover(null)}
                onClick={(_, i) => { const d = donut[i]; if (d && d.id !== '__rest') onOpen(d.id); }}>
                {donut.map(d => (
                  <Cell key={d.id} fill={d.color} opacity={!hover || hover === d.id ? 1 : 0.28} style={{ cursor: d.id === '__rest' ? 'default' : 'pointer', transition: 'opacity .2s' }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* مركز الدونات: الإجمالي أو المورد المؤشَّر عليه */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-10">
            <span className="text-[11px] text-slate-400 truncate max-w-full">{focus ? focus.name : t('compare.total')}</span>
            <span className="kpi-num text-[22px] text-slate-900 dark:text-white">{compact(focus ? focus.value : total)}</span>
            {focus && showShare && total > 0 && <span className="kpi-num text-[12px] text-teal-600">{Math.round((focus.value / total) * 1000) / 10}%</span>}
          </div>
        </div>
        <div className="mt-2 space-y-1.5">
          {donut.map(d => (
            <button key={d.id} type="button" onMouseEnter={() => setHover(d.id)} onMouseLeave={() => setHover(null)}
              onClick={() => d.id !== '__rest' && onOpen(d.id)}
              className={`w-full flex items-center gap-2 text-[12px] rounded-lg px-2 py-1 transition-colors ${hover === d.id ? 'bg-slate-100 dark:bg-slate-800' : ''} ${d.id === '__rest' ? 'cursor-default' : 'cursor-pointer'}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="truncate text-slate-700 dark:text-slate-200">{d.name}</span>
              <span className="ms-auto kpi-num text-[12px] text-slate-500">{showShare && total ? `${Math.round((d.value / total) * 1000) / 10}%` : compact(d.value)}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto pt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><Users className="w-3.5 h-3.5" />{t('compare.suppliersCount')}</div>
            <div className="kpi-num text-[18px] text-slate-900 dark:text-white">{formatNumber(items.length)}</div>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><Crown className="w-3.5 h-3.5 text-amber-500" />{t('compare.leaderShare')}</div>
            <div className="kpi-num text-[18px] text-slate-900 dark:text-white">{showShare && total ? `${Math.round((max / total) * 1000) / 10}%` : fmtVal(max)}</div>
          </div>
        </div>
      </div>

      {/* لوحة الترتيب */}
      <MotionConfig reducedMotion="user">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pe-1" aria-label={t('compare.rankingLabel')}>
        <motion.ol key={waveKey} className="space-y-1.5 pt-3 pb-2 px-1" variants={listV} initial="hidden" animate="show">
          {items.map((b, i) => (
            <RankRow key={b.id} b={b} i={i} logo={recordOf.get(b.id)?.logo} max={max} total={total} unit={unit} showShare={showShare}
              near={hoverIdx >= 0 ? Math.min(Math.abs(i - hoverIdx), 3) : -1}
              back={hoverIdx < 0 ? Math.min(Math.abs(i - lastIdx.current), 3) : 0}
              fmtVal={fmtVal} onOpen={onOpen} setHover={setHover} />
          ))}
        </motion.ol>
      </div>
      </MotionConfig>
    </div>
  );
});
