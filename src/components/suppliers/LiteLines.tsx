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
