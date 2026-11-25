import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Truck } from 'lucide-react';
import { DISTRIBUTION_SITE, HUB_SITES, canViewSite } from '../../lib/siteAccess';
import { useSiteRequests } from '../../lib/siteRequests';
import { usePermissions } from '../../lib/usePermission';
import { useSessionState } from '../../lib/useSessionState';
import { SaharaSiteFarmsView } from './SaharaSiteFarmsView';
import { AnnualIcon, ChickIcon, EggIcon, EnergyIcon, HenEggIcon, HenIcon } from './SiteHubIcons';
import './siteFarms.css';

/** كارت «المصروف السنوي»: الصفحة القديمة (كل المواقع) */
const ANNUAL = '__annual__';

/** لكل كارت: رسمه ولونه — الدجاجة تكبر مع عمر القطيع (التسمين صوص، البوادي أكبر، الأجداد الأكبر) */
const CARD: Record<string, { art: React.ReactNode; c1: string; c2: string }> = {
  الطاقة: { art: <EnergyIcon size={88} />, c1: '#f59e0b', c2: '#ea580c' },
  التسمين: { art: <ChickIcon size={64} />, c1: '#10b981', c2: '#047857' },
  البياض: { art: <EggIcon size={84} />, c1: '#ec4899', c2: '#be185d' },
  البوادي: { art: <HenIcon size={86} tone="white" />, c1: '#0ea5e9', c2: '#0369a1' },
  'امهات البياض': { art: <HenEggIcon size={80} />, c1: '#a855f7', c2: '#7e22ce' },
  الاجداد: { art: <HenIcon size={108} tone="gold" />, c1: '#eab308', c2: '#a16207' },
  [ANNUAL]: { art: <AnnualIcon size={80} />, c1: '#6366f1', c2: '#4338ca' },
};

/**
 * مزارع المواقع: كروت ثلاثية الأبعاد تطفو في وسط الصفحة — المواقع الستة (الطاقة مركز التوزيع)
 * و«المصروف السنوي» (الصفحة القديمة لكل المواقع). كل حساب يدخل مواقعه فقط، والمصروف السنوي لصلاحية الاحتياطي.
 */
export const SiteFarmsHub: React.FC = () => {
  const { t, i18n } = useTranslation(['finance']);
  const H = (k: string, o?: Record<string, unknown>) => t(`finance:siteHub.${k}`, o);
  const perms = usePermissions();
  const requests = useSiteRequests();
  const [open, setOpen] = useSessionState<string | null>('sahara_farm_site', null);
  const allowed = useMemo(() => HUB_SITES.filter(s => canViewSite(perms.canView, s)), [perms.canView]);
  const canAnnual = perms.canView('sahara.reserves');
  const can = (k: string) => (k === ANNUAL ? canAnnual : allowed.includes(k));
  const current = open && can(open) ? open : null;
  // حساب موقع واحد (بلا المصروف السنوي): يفتح موقعه مباشرة أول مرة
  useEffect(() => {
    if (!open && allowed.length === 1 && !canAnnual) setOpen(allowed[0]);
  }, [open, allowed, canAnnual, setOpen]);

  if (current === ANNUAL) return <SaharaSiteFarmsView mode="annual" onBack={() => setOpen(null)} />;
  if (current) return <SaharaSiteFarmsView key={current} site={current} onBack={() => setOpen(null)} onOpenSite={s => { if (can(s)) setOpen(s); }} />;

  const cards = [...HUB_SITES, ANNUAL];
  return (
    <div className="sf-root sf-float-page" dir={i18n.dir()}>
      <div className="sf-hub-head">
        <h2>{H('title')}</h2>
        <p>{H('hint')}</p>
      </div>
      <div className="sf-float-stage">
        {cards.map(k => {
          const c = CARD[k];
          const ok = can(k);
          const center = k === DISTRIBUTION_SITE;
          const waiting = requests.filter(r => r.source === k && r.status === 'pending').length;
          const moving = requests.filter(r => (r.source === k || r.site === k) && r.status === 'approved').length;
          return (
            <button key={k} type="button" className="sf-float" disabled={!ok} aria-disabled={!ok} onClick={() => ok && setOpen(k)}
              title={ok ? undefined : H(k === ANNUAL ? 'annualLocked' : 'locked')}
              style={{ '--c1': c.c1, '--c2': c.c2 } as React.CSSProperties}>
              <span className="sf-float-card">
                <span className="sf-float-art">{c.art}</span>
                <span className="sf-float-name">{k === ANNUAL ? H('annual') : k}</span>
                <span className="sf-float-sub">{k === ANNUAL ? H('annualHint') : center ? H('distribution') : H('site')}</span>
                {(waiting > 0 || moving > 0) && (
                  <span className="sf-float-tags">
                    {waiting > 0 && <span className="wait">{waiting}</span>}
                    {moving > 0 && <span className="move"><Truck className="w-3 h-3" />{moving}</span>}
                  </span>
                )}
                {!ok && <span className="sf-float-lock"><Lock className="w-5 h-5" /></span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SiteFarmsHub;
