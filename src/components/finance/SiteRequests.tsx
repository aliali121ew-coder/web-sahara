import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Check, PackageCheck, Plus, Send, Truck, X } from 'lucide-react';
import type { SiteFarmsRecord } from '../../lib/siteFarms';
import { HUB_SITES, canEditSite } from '../../lib/siteAccess';
import { createSiteRequest, requestsOf, setRequestStatus, useSiteRequests, type SiteRequest } from '../../lib/siteRequests';
import { usePermissions } from '../../lib/usePermission';
import { useSessionProfile } from '../../lib/session';
import { SiteNetworkMap } from './SiteNetworkMap';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const when = (iso?: string) => (iso ? iso.slice(0, 16).replace('T', ' ').replace(/-/g, '/') : '');
/** الطلبات الجارية أولًا (الأحدث)، ثم آخر المنتهية */
const ACTIVE = new Set(['pending', 'approved']);
const sortReqs = (list: SiteRequest[]) => [
  ...list.filter(r => ACTIVE.has(r.status)),
  ...list.filter(r => !ACTIVE.has(r.status)).slice(0, 6),
];

/**
 * طلبات الموقع: طلب كمية من موقع آخر، والطلبات الواردة إليه (موافقة أو رفض)، وطلباته (إلغاء أو تأكيد الاستلام).
 * الموافقة تُطلق شاحنة على خريطة المواقع من الموقع المطلوب منه إلى الطالب. للمتابعة فقط (لا تغيّر الأرصدة).
 */
export const SiteRequests: React.FC<{ site: string; records: SiteFarmsRecord[]; showMap: boolean }> = ({ site, records, showMap }) => {
  const { t } = useTranslation(['finance', 'common']);
  const R = (k: string, o?: Record<string, unknown>) => t(`finance:siteHub.req.${k}`, o);
  const perms = usePermissions();
  const profile = useSessionProfile();
  const by = profile?.name || profile?.username;
  const canAct = canEditSite(perms.canEdit, site);
  const all = useSiteRequests();
  const { incoming, outgoing } = useMemo(() => requestsOf(all, site), [all, site]);
  // خريطة الموقع: طلباته فقط
  const mine = useMemo(() => all.filter(r => r.site === site || r.source === site), [all, site]);

  const others = HUB_SITES.filter(s => s !== site);
  const [form, setForm] = useState<{ source: string; qty: string; note: string } | null>(null);
  const send = () => {
    if (!form) return;
    if (createSiteRequest(site, form.source, Number(form.qty.replace(/,/g, '')), form.note, by)) setForm(null);
  };
  const act = (id: string, status: SiteRequest['status']) => setRequestStatus(id, status, by);
  const pendingIn = incoming.filter(r => r.status === 'pending').length;

  const statusChip = (r: SiteRequest) => <span className={`sf-req-st ${r.status}`}>{R(`status.${r.status}`)}</span>;
  const row = (r: SiteRequest, dir: 'in' | 'out') => (
    <li key={r.id} className={`sf-req-row ${r.status}`}>
      <span className="sf-req-ico">{r.status === 'approved' ? <Truck className="w-4 h-4" /> : dir === 'in' ? <ArrowLeftRight className="w-4 h-4" /> : <Send className="w-4 h-4" />}</span>
      <span className="sf-req-main">
        <b>{dir === 'in' ? R('fromSite', { site: r.site }) : R('toSite', { site: r.source })}</b>
        <small>{fmt(r.qty)} {t('finance:siteFarms.liter')} · {when(r.createdAt)}{r.by ? ` · ${r.by}` : ''}{r.note ? ` · ${r.note}` : ''}</small>
      </span>
      {statusChip(r)}
      {canAct && (
        <span className="sf-req-acts">
          {dir === 'in' && r.status === 'pending' && (
            <>
              <button type="button" className="ok" onClick={() => act(r.id, 'approved')}><Check className="w-3.5 h-3.5" />{R('approve')}</button>
              <button type="button" className="no" onClick={() => act(r.id, 'rejected')}><X className="w-3.5 h-3.5" />{R('reject')}</button>
            </>
          )}
          {dir === 'out' && r.status === 'pending' && (
            <button type="button" className="no" onClick={() => act(r.id, 'cancelled')}><X className="w-3.5 h-3.5" />{R('cancel')}</button>
          )}
          {dir === 'out' && r.status === 'approved' && (
            <button type="button" className="ok" onClick={() => act(r.id, 'delivered')}><PackageCheck className="w-3.5 h-3.5" />{R('received')}</button>
          )}
        </span>
      )}
    </li>
  );

  return (
    <section className="sf-card sf-req">
      <h2 className="sf-h2">
        <span>{R('title')} {pendingIn > 0 && <span className="sf-req-badge">{R('pendingIn', { n: pendingIn })}</span>}</span>
        {canAct && !form && (
          <button type="button" className="sf-req-new" onClick={() => setForm({ source: others[0], qty: '', note: '' })}>
            <Plus className="w-4 h-4" />{R('new')}
          </button>
        )}
      </h2>

      {form && (
        <div className="sf-req-form">
          <label><span>{R('source')}</span>
            <select className="sf-select" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
              {others.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label><span>{R('qty')}</span>
            <input className="sf-select" inputMode="numeric" value={form.qty} placeholder="0"
              onChange={e => { const d = e.target.value.replace(/[^\d]/g, ''); setForm({ ...form, qty: d ? Number(d).toLocaleString('en-US') : '' }); }} />
          </label>
          <label className="wide"><span>{R('note')}</span>
            <input className="sf-select" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </label>
          <div className="sf-req-form-acts">
            <button type="button" className="send" disabled={!(Number(form.qty.replace(/,/g, '')) > 0)} onClick={send}><Send className="w-4 h-4" />{R('send')}</button>
            <button type="button" onClick={() => setForm(null)}>{t('common:actions.cancel')}</button>
          </div>
        </div>
      )}

      {showMap && <SiteNetworkMap records={records} requests={mine} focus={site} height={300} />}

      <div className="sf-req-cols">
        <div>
          <h3>{R('incoming')}</h3>
          {incoming.length ? <ul>{sortReqs(incoming).map(r => row(r, 'in'))}</ul> : <p className="sf-req-none">{R('noIncoming')}</p>}
        </div>
        <div>
          <h3>{R('outgoing')}</h3>
          {outgoing.length ? <ul>{sortReqs(outgoing).map(r => row(r, 'out'))}</ul> : <p className="sf-req-none">{R('noOutgoing')}</p>}
        </div>
      </div>
    </section>
  );
};

export default SiteRequests;
