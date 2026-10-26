/* eslint-disable i18next/no-literal-string */
import React, { useMemo, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import type { DayFill } from '../../lib/vehicleFuel';

interface Node { name: string; liters: number; vehicles: number; incoming: number; x: number; y: number; r: number; hub: boolean }
interface Link { from: Node; to: Node; count: number }

const W = 320;
const H = 300;

/**
 * خريطة تخطيطية لمواقع التفويل (لا جغرافية): المواقع التي رُفعت كشوفها في المركز،
 * والمواقع السابقة التي جاءت منها العربات حولها، والخط بسماكة عدد العربات المنتقلة.
 */
export const SitesMap: React.FC<{ fills: DayFill[] }> = ({ fills }) => {
  const [hover, setHover] = useState<string | null>(null);

  const { nodes, links } = useMemo(() => {
    const hubs = new Map<string, { liters: number; vehicles: Set<string> }>();
    const outer = new Map<string, number>();
    const flows = new Map<string, number>();
    for (const f of fills) {
      for (const s of f.sites) {
        const h = hubs.get(s) || { liters: 0, vehicles: new Set<string>() };
        h.liters += f.qty / f.sites.length;
        h.vehicles.add(f.vehicle);
        hubs.set(s, h);
        if (f.prevSite && f.prevSite !== s) {
          outer.set(f.prevSite, (outer.get(f.prevSite) || 0) + 1);
          const k = `${f.prevSite}→${s}`;
          flows.set(k, (flows.get(k) || 0) + 1);
        }
      }
    }
    const hubList = [...hubs.entries()].sort((a, b) => b[1].liters - a[1].liters);
    const outerList = [...outer.entries()].filter(([n]) => !hubs.has(n)).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const maxL = Math.max(1, ...hubList.map(([, h]) => h.liters));
    const nodes: Node[] = [];
    hubList.forEach(([name, h], i) => {
      const a = (i / Math.max(1, hubList.length)) * Math.PI * 2;
      const d = hubList.length > 1 ? 42 : 0;
      nodes.push({ name, liters: h.liters, vehicles: h.vehicles.size, incoming: 0, x: W / 2 + Math.cos(a) * d, y: H / 2 + Math.sin(a) * d, r: 16 + 12 * (h.liters / maxL), hub: true });
    });
    const maxIn = Math.max(1, ...outerList.map(([, c]) => c));
    outerList.forEach(([name, c], i) => {
      const a = -Math.PI / 2 + (i / outerList.length) * Math.PI * 2;
      nodes.push({ name, liters: 0, vehicles: 0, incoming: c, x: W / 2 + Math.cos(a) * 118, y: H / 2 + Math.sin(a) * 112, r: 7 + 7 * (c / maxIn), hub: false });
    });
    const by = new Map(nodes.map(n => [n.name, n]));
    const links: Link[] = [];
    flows.forEach((count, k) => {
      const [a, b] = k.split('→');
      const from = by.get(a);
      const to = by.get(b);
      if (from && to) links.push({ from, to, count });
    });
    return { nodes, links };
  }, [fills]);

  const maxLink = Math.max(1, ...links.map(l => l.count));
  const transfers = links.reduce((s, l) => s + l.count, 0);

  return (
    <div className="h-full rounded-3xl overflow-hidden bg-slate-950 text-white border border-slate-800 shadow-soft-card flex flex-col">
      <div className="px-5 pt-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black flex items-center gap-2"><MapPin className="w-4 h-4 text-sky-400" />خريطة مواقع التفويل</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">من أين جاءت العربات قبل تفويلها هنا</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">{transfers} انتقال</span>
      </div>

      <div className="relative flex-1 min-h-[260px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full" role="img" aria-label="خريطة مواقع التفويل">
          <defs>
            <pattern id="vgrid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M16 0H0V16" fill="none" stroke="rgb(51 65 85 / 0.35)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="vhub">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#vgrid)" />
          <circle cx={W / 2} cy={H / 2} r={115} fill="none" stroke="rgb(56 189 248 / 0.12)" strokeDasharray="3 5" />
          <circle cx={W / 2} cy={H / 2} r={60} fill="none" stroke="rgb(56 189 248 / 0.08)" />
          {links.map(l => {
            const mx = (l.from.x + l.to.x) / 2 + (l.to.y - l.from.y) * 0.18;
            const my = (l.from.y + l.to.y) / 2 - (l.to.x - l.from.x) * 0.18;
            const on = !hover || hover === l.from.name || hover === l.to.name;
            return (
              <path
                key={l.from.name + l.to.name}
                d={`M${l.from.x},${l.from.y} Q${mx},${my} ${l.to.x},${l.to.y}`}
                fill="none"
                stroke="#38bdf8"
                strokeOpacity={on ? 0.85 : 0.15}
                strokeWidth={1 + 3 * (l.count / maxLink)}
                strokeDasharray="4 6"
                className="vehicle-flow"
              />
            );
          })}
          {nodes.map(n => (
            <g key={n.name} onMouseEnter={() => setHover(n.name)} onMouseLeave={() => setHover(null)} className="cursor-default">
              {n.hub && <circle cx={n.x} cy={n.y} r={n.r * 2.2} fill="url(#vhub)" />}
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.hub ? '#0ea5e9' : '#1e293b'} stroke={n.hub ? '#bae6fd' : '#38bdf8'} strokeWidth={n.hub ? 2 : 1.2} />
              <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={n.hub ? 11 : 9} fontWeight={800} fill="white">
                {n.hub ? n.vehicles : n.incoming}
              </text>
              <text x={n.x} y={n.y + n.r + 12} textAnchor="middle" fontSize={9} fontWeight={700} fill={hover === n.name ? '#e0f2fe' : '#94a3b8'}>
                {n.name.length > 16 ? `${n.name.slice(0, 15)}…` : n.name}
              </text>
            </g>
          ))}
          {!nodes.length && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={11} fill="#64748b">لا توجد بيانات</text>}
        </svg>
      </div>

      <div className="px-5 pb-4 pt-2 border-t border-slate-800/80 flex items-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" />موقع الكشف (عدد العربات)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-sky-400 bg-slate-800" />موقع سابق</span>
        <Navigation className="w-3 h-3 mr-auto text-sky-500" />
      </div>
    </div>
  );
};
