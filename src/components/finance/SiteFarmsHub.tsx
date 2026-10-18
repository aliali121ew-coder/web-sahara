import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Sprout, Truck, Warehouse } from 'lucide-react';
import { useSiteFarms } from '../../lib/siteFarms';
import { siteDayTotals } from '../../lib/siteFarmsUsage';
import { DISTRIBUTION_SITE, HUB_SITES, canViewSite } from '../../lib/siteAccess';
import { useSiteRequests } from '../../lib/siteRequests';
import { usePermissions } from '../../lib/usePermission';
import { useSessionState } from '../../lib/useSessionState';
import { SaharaSiteFarmsView } from './SaharaSiteFarmsView';
import './siteFarms.css';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * مزارع المواقع: ستة كروت (الطاقة مركز التوزيع، والتسمين، والبياض، والبوادي، وأمهات البياض، والأجداد).
 * كل حساب يدخل المواقع التي له صلاحيتها فقط (الباقي مقفل)، وحساب موقع واحد يدخل موقعه مباشرة.
 */
export const SiteFarmsHub: React.FC = () => {
  const { t, i18n } = useTranslation(['finance']);
  const H = (k: string, o?: Record<string, unknown>) => t(`finance:siteHub.${k}`, o);
  const perms = usePermissions();
  const records = useSiteFarms();
  const requests = useSiteRequests();
  const [site, setSite] = useSessionState<string | null>('sahara_farm_site', null);
  const allowed = useMemo(() => HUB_SITES.filter(s => canViewSite(perms.canView, s)), [perms.canView]);
  // موقع بلا صلاحية (حفظ قديم في الجلسة): يُغلق
  const open = site && allowed.includes(site) ? site : null;
  // حساب موقع واحد: يفتح موقعه مباشرة أول مرة
  useEffect(() => {
    if (!site && allowed.length === 1) setSite(allowed[0]);
  }, [site, allowed, setSite]);

  if (open) return <SaharaSiteFarmsView key={open} site={open} onBack={() => setSite(null)} />;

  return (
    <div className="sf-root" dir={i18n.dir()}>
      <div className="sf-hub-head">
        <h2>{H('title')}</h2>
        <p>{H('hint')}</p>
      </div>
      <div className="sf-hub">
        {HUB_SITES.map(s => {
          const can = allowed.includes(s);
          const tot = siteDayTotals(records, s);
          const center = s === DISTRIBUTION_SITE;
          const waiting = requests.filter(r => r.source === s && r.status === 'pending').length;
          const moving = requests.filter(r => (r.source === s || r.site === s) && r.status === 'approved').length;
          const Icon = center ? Warehouse : Sprout;
          return (
            <button key={s} type="button" className={`sf-hub-card${center ? ' center' : ''}`} disabled={!can} aria-disabled={!can}
              onClick={() => can && setSite(s)} title={can ? undefined : H('locked')}>
              <span className="sf-hub-top">
                <span className="sf-hub-ico"><Icon className="w-5 h-5" /></span>
                <span className="sf-hub-name">
                  <b>{s}</b>
                  <small>{center ? H('distribution') : tot.farms ? H('farmsCount', { n: tot.farms }) : tot.date ? H('stationOnly') : H('noReport')}</small>
                </span>
                {!can && <Lock className="w-4 h-4 sf-hub-lock" />}
              </span>
              <span className="sf-hub-bal">
                <small>{H('balance')}</small>
                <b>{tot.date ? fmt(tot.balance) : '—'}</b>
              </span>
              <span className="sf-hub-foot">
                <span>{H('consumption')} <b>{tot.date ? fmt(tot.consumption) : '—'}</b></span>
                <span className="font-mono">{tot.date ?? ''}</span>
              </span>
              {(waiting > 0 || moving > 0) && (
                <span className="sf-hub-badges">
                  {waiting > 0 && <span className="wait">{H('waiting', { n: waiting })}</span>}
                  {moving > 0 && <span className="move"><Truck className="w-3 h-3" />{H('moving', { n: moving })}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SiteFarmsHub;
