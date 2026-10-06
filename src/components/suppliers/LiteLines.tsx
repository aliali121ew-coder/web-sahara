import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { line, curveMonotoneX } from 'victory-vendor/d3-shape';

/**
 * رسم خفيف جدًا يُستخدم أثناء سحب شريط النطاق فقط: خطوط SVG مباشرة بلا مكتبة رسوم،
 * فلا حساب لمحاور أو تلميحات أو تعبئة؛ عند الإفلات يعود الرسم الكامل.
 * الإحداثيات بنفس هوامش الرسم الكامل حتى لا يقفز المنحنى عند التبديل.
 */
export interface LiteSeries { id: string; color: string; dashed?: boolean }
type Point = Record<string, unknown> & { key: string };

const M = { top: 16, right: 16, bottom: 30, left: 52 };

type LiteProps = {
  points: Point[]; series: LiteSeries[]; ticks: string[]; tickLabel: (k: string) => string; yFrom?: 'zero' | 'data'; format: (v: number) => string;
};

/** قياس فوري للحاوية ثم متابعة تغيّر حجمها */
const useSize = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, size };
};

/** المحور الأفقي والشبكة وتسميات القيم (مشتركة بين الخطوط والأعمدة) */
const Frame: React.FC<{ size: { w: number; h: number }; yTicks: number[]; y: (v: number) => number; iw: number; ticks: { x: number; label: string; key: string }[]; format: (v: number) => string }> = ({ size, yTicks, y, iw, ticks, format }) => (
  <>
    {yTicks.map((v, i) => (
      <g key={i}>
        <line x1={M.left} x2={M.left + iw} y1={y(v)} y2={y(v)} stroke="#94a3b8" strokeOpacity={0.15} strokeDasharray="3 4" />
        <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fontWeight={600} fill="#64748b">{format(v)}</text>
      </g>
    ))}
    {ticks.map(t => <text key={t.key} x={t.x} y={size.h - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill="#64748b">{t.label}</text>)}
  </>
);

/** أعمدة خفيفة أثناء السحب: مستطيلات SVG مباشرة، عمود لكل سلسلة داخل كل فترة */
export const LiteBars: React.FC<LiteProps> = ({ points, series, ticks, tickLabel, yFrom = 'zero', format }) => {
  const { ref, size } = useSize();
  const geo = useMemo(() => {
    const { w, h } = size;
    if (!w || !h || !points.length) return null;
    let lo = Infinity, hi = -Infinity;
    points.forEach(p => series.forEach(s => { const v = p[s.id]; if (typeof v === 'number') { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    if (!isFinite(hi)) return null;
    const min = yFrom === 'zero' ? 0 : lo - (hi - lo) * 0.08;
    const max = hi + (hi - min) * 0.08 || 1;
    const iw = w - M.left - M.right, ih = h - M.top - M.bottom;
    const band = iw / points.length;
    const bw = Math.max(1, Math.min(34, (band * 0.72) / Math.max(1, series.length)));
    const y = (v: number) => M.top + ih - ((v - min) / (max - min)) * ih;
    const base = y(Math.max(min, 0));
    const rects: { k: string; x: number; y: number; h: number; color: string }[] = [];
    points.forEach((p, i) => {
      const x0 = M.left + band * i + (band - bw * series.length) / 2;
      series.forEach((s, j) => {
        const v = p[s.id];
        if (typeof v !== 'number') return;
        const top = y(v);
        rects.push({ k: `${p.key}-${s.id}`, x: x0 + j * bw, y: Math.min(top, base), h: Math.max(1, Math.abs(base - top)), color: s.color });
      });
    });
    const index = new Map(points.map((p, i) => [p.key, i]));
    const tk = ticks.flatMap(k => { const i = index.get(k); return i == null ? [] : [{ key: k, x: M.left + band * i + band / 2, label: tickLabel(k) }]; });
    return { rects, y, iw, bw, tk, yTicks: [0, 0.25, 0.5, 0.75, 1].map(f => min + (max - min) * f) };
  }, [size, points, series, yFrom, ticks, tickLabel]);
  return (
    <div ref={ref} className="w-full h-full">
      {geo && (
        <svg width={size.w} height={size.h} className="block">
          <Frame size={size} yTicks={geo.yTicks} y={geo.y} iw={geo.iw} ticks={geo.tk} format={format} />
          {geo.rects.map(r => <rect key={r.k} x={r.x} y={r.y} width={Math.max(1, geo.bw - 1)} height={r.h} rx={Math.min(4, geo.bw / 3)} fill={r.color} fillOpacity={0.85} />)}
        </svg>
      )}
    </div>
  );
};

export const LiteLines: React.FC<{
  points: Point[]; series: LiteSeries[]; ticks: string[]; tickLabel: (k: string) => string; yFrom?: 'zero' | 'data'; format: (v: number) => string;
}> = ({ points, series, ticks, tickLabel, yFrom = 'zero', format }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // قياس فوري عند الظهور حتى تُرسم الخطوط من أول حركة سحب
    const r = el.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const { w, h } = size;
    if (!w || !h || !points.length) return null;
    let lo = Infinity, hi = -Infinity;
    points.forEach(p => series.forEach(s => { const v = p[s.id]; if (typeof v === 'number') { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
    if (!isFinite(hi)) return null;
    const min = yFrom === 'zero' ? 0 : lo - (hi - lo) * 0.08;
    const max = hi + (hi - min) * 0.08 || 1;
    const iw = w - M.left - M.right, ih = h - M.top - M.bottom;
    const n = Math.max(1, points.length - 1);
    const x = (i: number) => M.left + (points.length === 1 ? iw / 2 : (i / n) * iw);
    const y = (v: number) => M.top + ih - ((v - min) / (max - min)) * ih;
    const index = new Map(points.map((p, i) => [p.key, i]));
    const paths = series.map(s => {
      const pts = points.map((p, i) => [i, p[s.id]] as const).filter(([, v]) => typeof v === 'number') as [number, number][];
      const gen = line<[number, number]>().x(d => x(d[0])).y(d => y(d[1])).curve(curveMonotoneX);
      return { ...s, d: gen(pts) ?? '' };
    });
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => min + (max - min) * f);
    return { paths, x, y, yTicks, iw, index };
  }, [size, points, series, yFrom]);

  return (
    <div ref={ref} className="w-full h-full">
      {geo && (
        <svg width={size.w} height={size.h} className="block">
          {geo.yTicks.map((v, i) => (
            <g key={i}>
              <line x1={M.left} x2={M.left + geo.iw} y1={geo.y(v)} y2={geo.y(v)} stroke="#94a3b8" strokeOpacity={0.15} strokeDasharray="3 4" />
              <text x={M.left - 8} y={geo.y(v)} dy="0.32em" textAnchor="end" fontSize={11} fontWeight={600} fill="#64748b">{format(v)}</text>
            </g>
          ))}
          {ticks.map(k => {
            const i = geo.index.get(k);
            return i == null ? null : (
              <text key={k} x={geo.x(i)} y={size.h - 8} textAnchor="middle" fontSize={11} fontWeight={600} fill="#64748b">{tickLabel(k)}</text>
            );
          })}
          {geo.paths.map(p => (
            <path key={p.id} d={p.d} fill="none" stroke={p.color} strokeWidth={2} strokeDasharray={p.dashed ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </svg>
      )}
    </div>
  );
};
