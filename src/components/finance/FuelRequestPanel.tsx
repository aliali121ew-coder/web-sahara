import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, PackageCheck, Send, Truck, X } from 'lucide-react';
import { HUB_SITES, canEditSite } from '../../lib/siteAccess';
import { createSiteRequest, requestsOf, setRequestStatus, useSiteRequests, type SiteRequest } from '../../lib/siteRequests';
import { usePermissions } from '../../lib/usePermission';
import { useSessionProfile } from '../../lib/session';

/** أيقونة صهريج وقود (قاطرة وخزان مقطورة) */
export const TankerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1.5" y="3" width="17" height="10" rx="5" />
    <path d="M6 3v10M14 3v10" opacity=".55" />
    <path d="M18.5 7h5.2l3.3 3.6V15h-8.5z" />
    <path d="M21 7v3.4h4.5" />
    <path d="M1.5 15h29" />
    <circle cx="6" cy="16.5" r="2" fill="currentColor" stroke="none" />
    <circle cx="13" cy="16.5" r="2" fill="currentColor" stroke="none" />
    <circle cx="25" cy="16.5" r="2" fill="currentColor" stroke="none" />
  </svg>
);

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const when = (iso?: string) => (iso ? iso.slice(5, 16).replace('T', ' ').replace(/-/g, '/') : '');
const ACTIVE = new Set(['pending', 'approved']);
/** الجارية أولًا، ثم آخر المنتهية */
const recent = (list: SiteRequest[]) => [...list.filter(r => ACTIVE.has(r.status)), ...list.filter(r => !ACTIVE.has(r.status)).slice(0, 4)];

/**
 * «طلب وقود» داخل خريطة مركز المراقبة: زر تحت «فتح حقل المزارع» يفتح لوحة على الخريطة —
 * طلب جديد (من أي موقع)، والمطلوب من هذا الموقع (موافقة تُطلق الشاحنة على الخريطة، أو رفض)، وطلباته (إلغاء أو تأكيد الاستلام).
 */
export const FuelRequestPanel: React.FC<{ site: string }> = ({ site }) => {
  const { t } = useTranslation(['finance', 'common']);
  const R = (k: string, o?: Record<string, unknown>) => t(`finance:siteHub.req.${k}`, o);
  const perms = usePermissions();
  const profile = useSessionProfile();
  const by = profile?.name || profile?.username;
  const canAct = canEditSite(perms.canEdit, site);
  const all = useSiteRequests();
  const { incoming, outgoing } = useMemo(() => requestsOf(all, site), [all, site]);
  const pendingIn = incoming.filter(r => r.status === 'pending').length;
  const moving = all.filter(r => r.status === 'approved' && (r.site === site || r.source === site)).length;

  const others = HUB_SITES.filter(s => s !== site);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ source: others[0], qty: '', note: '' });
  const qty = Number(form.qty.replace(/,/g, ''));
  const send = () => {
    if (createSiteRequest(site, form.source, qty, form.note, by)) setForm({ source: form.source, qty: '', note: '' });
  };
  const act = (id: string, status: SiteRequest['status']) => setRequestStatus(id, status, by);

  const row = (r: SiteRequest, dir: 'in' | 'out') => (
    <li key={r.id} className={`sf-fr-row ${r.status}`}>
      <span className="sf-fr-ico">{r.status === 'approved' ? <Truck className="w-3.5 h-3.5" /> : <TankerIcon className="sf-tanker-ico sm" />}</span>
      <span className="sf-fr-main">
        <b>{dir === 'in' ? R('fromSite', { site: r.site }) : R('toSite', { site: r.source })} · {fmt(r.qty)} {t('finance:siteFarms.liter')}</b>
        <small>{when(r.createdAt)}{r.by ? ` · ${r.by}` : ''}{r.note ? ` · ${r.note}` : ''}</small>
      </span>
      <span className={`sf-fr-st ${r.status}`}>{R(`status.${r.status}`)}</span>
      {canAct && dir === 'in' && r.status === 'pending' && (
        <span className="sf-fr-acts">
          <button type="button" className="ok" onClick={() => act(r.id, 'approved')} title={R('approve')} aria-label={R('approve')}><Check className="w-3.5 h-3.5" /></button>
          <button type="button" className="no" onClick={() => act(r.id, 'rejected')} title={R('reject')} aria-label={R('reject')}><X className="w-3.5 h-3.5" /></button>
        </span>
      )}
      {canAct && dir === 'out' && r.status === 'pending' && (
        <span className="sf-fr-acts"><button type="button" className="no" onClick={() => act(r.id, 'cancelled')} title={R('cancel')} aria-label={R('cancel')}><X className="w-3.5 h-3.5" /></button></span>
      )}
      {canAct && dir === 'out' && r.status === 'approved' && (
        <span className="sf-fr-acts"><button type="button" className="ok wide" onClick={() => act(r.id, 'delivered')}><PackageCheck className="w-3.5 h-3.5" />{R('received')}</button></span>
      )}
    </li>
  );

  return (
    <>
      <button type="button" className="sf-map-fuel" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <TankerIcon className="sf-tanker-ico" />{R('fuel')}
        {pendingIn > 0 && <span className="n wait">{pendingIn}</span>}
        {moving > 0 && <span className="n move"><Truck className="w-3 h-3" />{moving}</span>}
      </button>
      {open && (
        <div className="sf-map-panel" dir="rtl" role="dialog" aria-label={R('fuel')}>
          <div className="sf-fr-head">
            <b><TankerIcon className="sf-tanker-ico" />{R('fuelTitle', { site })}</b>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('common:actions.close')}><X className="w-4 h-4" /></button>
          </div>
          {canAct && (
            <div className="sf-fr-form">
              <label><span>{R('source')}</span>
                <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                  {others.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label><span>{R('qty')}</span>
                <input inputMode="numeric" value={form.qty} placeholder="0"
                  onChange={e => { const d = e.target.value.replace(/[^\d]/g, ''); setForm({ ...form, qty: d ? Number(d).toLocaleString('en-US') : '' }); }} />
              </label>
              <label className="wide"><span>{R('note')}</span>
                <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
              </label>
              <button type="button" className="send" disabled={!(qty > 0)} onClick={send}><Send className="w-4 h-4" />{R('send')}</button>
            </div>
          )}
          <div className="sf-fr-lists">
            <section>
              <h4>{R('incoming')}{pendingIn > 0 && <span className="n wait">{pendingIn}</span>}</h4>
              {incoming.length ? <ul>{recent(incoming).map(r => row(r, 'in'))}</ul> : <p>{R('noIncoming')}</p>}
            </section>
            <section>
              <h4>{R('outgoing')}</h4>
              {outgoing.length ? <ul>{recent(outgoing).map(r => row(r, 'out'))}</ul> : <p>{R('noOutgoing')}</p>}
            </section>
          </div>
        </div>
      )}
    </>
  );
};

export default FuelRequestPanel;
