import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SiteFarmsRecord } from '../../lib/siteFarms';
import { siteDayTotals } from '../../lib/siteFarmsUsage';
import { DISTRIBUTION_SITE, HUB_SITES } from '../../lib/siteAccess';
import { inTransit, type SiteRequest } from '../../lib/siteRequests';

const W = 640, H = 400;
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));

/** مواضع المواقع: الطاقة (مركز التوزيع) في الوسط، والخمسة حولها */
const positions = (): Record<string, { x: number; y: number }> => {
  const out: Record<string, { x: number; y: number }> = { [DISTRIBUTION_SITE]: { x: W / 2, y: H / 2 + 12 } };
  const others = HUB_SITES.filter(s => s !== DISTRIBUTION_SITE);
  others.forEach((s, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / others.length;
    out[s] = { x: W / 2 + Math.cos(a) * 240, y: H / 2 + 12 + Math.sin(a) * 132 };
  });
  return out;
};

/** مسار منحنٍ قليلًا بين موقعين (من ← إلى) */
const route = (a: { x: number; y: number }, b: { x: number; y: number }, bend = 0.12) => {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const nx = -(b.y - a.y) * bend, ny = (b.x - a.x) * bend;
  return `M${a.x},${a.y} Q${mx + nx},${my + ny} ${b.x},${b.y}`;
};

/** شاحنة صغيرة (تتجه يمينًا؛ animateMotion يديرها مع اتجاه المسار) */
const Truck: React.FC = () => (
  <g transform="translate(-13,-9)">
    <rect x="0" y="2" width="17" height="11" rx="2" fill="#f59e0b" stroke="#92400e" strokeWidth="1" />
    <path d="M17 5 h5 l4 4 v4 h-9 z" fill="#fbbf24" stroke="#92400e" strokeWidth="1" />
    <circle cx="6" cy="15" r="2.6" fill="#1e293b" />
    <circle cx="21" cy="15" r="2.6" fill="#1e293b" />
  </g>
);

/**
 * مركز المراقبة لمركز التوزيع (الطاقة): المواقع على الخريطة برصيد آخر كشف لكل موقع،
 * والطلبات الموافَق عليها شاحنات تسير من الموقع المطلوب منه إلى الموقع الطالب، والطلبات المنتظرة خطوط متقطعة.
 */
export const SiteNetworkMap: React.FC<{
  records: SiteFarmsRecord[];
  requests: SiteRequest[];
  focus?: string;
  height?: number;
  onPick?: (site: string) => void;
}> = ({ records, requests, focus, height = 380, onPick }) => {
  const { t } = useTranslation(['finance']);
  const pos = useMemo(positions, []);
  const totals = useMemo(() => Object.fromEntries(HUB_SITES.map(s => [s, siteDayTotals(records, s)])), [records]);
  const moving = inTransit(requests).filter(r => pos[r.site] && pos[r.source]);
  const waiting = requests.filter(r => r.status === 'pending' && pos[r.site] && pos[r.source]);

  return (
    <div className="sf-net" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={t('finance:siteHub.networkTitle')}>
        <defs>
          <radialGradient id="sf-net-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="var(--sf-farm)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--sf-farm)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={W / 2} cy={H / 2 + 12} r="150" fill="url(#sf-net-glow)" />
        {/* طرق التوزيع من المركز */}
        {HUB_SITES.filter(s => s !== DISTRIBUTION_SITE).map(s => (
          <path key={s} d={route(pos[DISTRIBUTION_SITE], pos[s], 0.05)} className="sf-net-road" />
        ))}
        {/* طلبات تنتظر الموافقة */}
        {waiting.map(r => <path key={r.id} d={route(pos[r.source], pos[r.site])} className="sf-net-wait" />)}
        {/* شاحنات في الطريق */}
        {moving.map((r, i) => {
          const d = route(pos[r.source], pos[r.site]);
          return (
            <g key={r.id}>
              <path d={d} className="sf-net-trip" />
              <g>
                <Truck />
                <animateMotion dur="7s" repeatCount="indefinite" rotate="auto" path={d} begin={`${-i * 1.7}s`} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
              </g>
            </g>
          );
        })}
        {/* المواقع */}
        {HUB_SITES.map(s => {
          const p = pos[s];
          const center = s === DISTRIBUTION_SITE;
          const tot = totals[s];
          const up = !center && p.y < H / 2 - 20;
          return (
            <g key={s} className={`sf-net-node${s === focus ? ' on' : ''}${onPick ? ' click' : ''}`} transform={`translate(${p.x},${p.y})`}
              onClick={onPick ? () => onPick(s) : undefined}>
              <circle r={center ? 34 : 26} className={center ? 'hub' : 'site'} />
              <text y={center ? 5 : 4} textAnchor="middle" className="ico">{center ? '⛽' : '🌿'}</text>
              {/* الاسم والرصيد في الجهة البعيدة عن المركز حتى لا تغطيهما الطرق والشاحنات */}
              <text y={up ? -46 : center ? 52 : 43} textAnchor="middle" className="nm">{s}</text>
              <text y={up ? -32 : center ? 68 : 58} textAnchor="middle" className="bal">{tot.date ? `${short(tot.balance)} ${t('finance:siteFarms.liter')}` : '—'}</text>
            </g>
          );
        })}
      </svg>
      <div className="sf-net-legend">
        <span><i className="road" />{t('finance:siteHub.legendRoad')}</span>
        <span><i className="wait" />{t('finance:siteHub.legendWaiting', { n: waiting.length })}</span>
        <span><i className="trip" />{t('finance:siteHub.legendTransit', { n: moving.length })}</span>
      </div>
    </div>
  );
};

export default SiteNetworkMap;
