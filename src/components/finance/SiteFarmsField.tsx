import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { BALANCE_CRIT, BALANCE_TARGET, BALANCE_WARN, type CoverStatus, type FarmCover, type SiteCover } from '../../lib/siteFarmsMap';

/**
 * حقل المزارع: طبقة فوق الصفحة تُفتح من الخريطة. كل مزرعة قطعة بحلقة أيام التغطية،
 * والضغط على قطعة يفتح درج تفاصيلها مع التوصية بالكمية.
 */
interface Props {
  site: string;
  cover: SiteCover;
  /** مزرعة تُفتح تفاصيلها مباشرة (من الخريطة) */
  initialFarm: string | null;
  onClose: () => void;
}

const COLOR: Record<CoverStatus, string> = { crit: 'var(--sf-neg)', warn: '#eab308', ok: '#10b981', idle: 'var(--sf-spark)' };
/** الحلقة ممتلئة عند هذا الرصيد */
const SCALE_BALANCE = 100000;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const Ring: React.FC<{ f: FarmCover; r: number; w: number }> = ({ f, r, w }) => {
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(f.balance / SCALE_BALANCE, 1));
  return (
    <svg viewBox={`0 0 ${2 * r + w * 2} ${2 * r + w * 2}`} aria-hidden="true">
      <circle cx={r + w} cy={r + w} r={r} fill="none" stroke="var(--sf-panel2)" strokeWidth={w} />
      <circle cx={r + w} cy={r + w} r={r} fill="none" stroke={COLOR[f.status]} strokeWidth={w} strokeLinecap="round" strokeDasharray={`${(c * p).toFixed(1)} ${c.toFixed(1)}`} className="sf-ring-arc" />
    </svg>
  );
};

const SiteFarmsField: React.FC<Props> = ({ site, cover, initialFarm, onClose }) => {
  const { t, i18n } = useTranslation(['finance']);
  const [filter, setFilter] = useState<CoverStatus | 'all'>('all');
  const [open, setOpen] = useState<string | null>(initialFarm);
  const closeRef = useRef<HTMLButtonElement>(null);
  const farm = open ? cover.farms.find(f => f.name === open) ?? null : null;

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (open) setOpen(null); else onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const daysText = (f: FarmCover) => f.balance <= 0 ? t('finance:siteFarms.map.empty') : f.rate <= 0 ? t('finance:siteFarms.map.noUse') : t('finance:siteFarms.field.days', { n: f.days.toFixed(1) });
  const groups: { k: CoverStatus; hint: string }[] = [
    { k: 'crit', hint: t('finance:siteFarms.field.critHint', { n: fmt(BALANCE_CRIT) }) },
    { k: 'warn', hint: t('finance:siteFarms.field.warnHint', { n: fmt(BALANCE_WARN) }) },
    { k: 'ok', hint: t('finance:siteFarms.field.okHint', { n: fmt(BALANCE_TARGET) }) },
  ];
  const reco = (f: FarmCover) => f.need > 0 ? t('finance:siteFarms.field.recoSend', { n: fmt(f.need), target: fmt(BALANCE_TARGET) }) : t('finance:siteFarms.field.recoOk', { target: fmt(BALANCE_TARGET) });

  // الدرج خارج طبقة الحقل (لا بداخلها): تأثير الضبابية يجعل الطبقة حاوية للعناصر الثابتة،
  // فكان الدرج المخفي على الجانب يوسّع الطبقة ويسمح بسحبها أفقيًا
  return createPortal(
    <>
    <div className="sf-root sf-field-ov" dir={i18n.dir()} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sf-field" role="dialog" aria-modal="true" aria-labelledby="sf-field-title">
        <div className="sf-field-head">
          <div>
            <h2 id="sf-field-title">{t('finance:siteFarms.field.title', { site })}</h2>
            <small>{t('finance:siteFarms.field.hint', { n: cover.reports, date: cover.date ?? '—' })}</small>
          </div>
          <button type="button" ref={closeRef} className="sf-field-x" onClick={onClose} aria-label={t('finance:siteFarms.field.close')}><X className="w-4 h-4" /></button>
        </div>
        <div className="sf-field-sum">
          {groups.map(g => {
            const list = cover.farms.filter(f => f.status === g.k);
            return (
              <button key={g.k} type="button" className="sf-field-st" aria-pressed={filter === g.k} style={{ '--c': COLOR[g.k] } as React.CSSProperties}
                onClick={() => setFilter(filter === g.k ? 'all' : g.k)}>
                <span className="h">{t(`finance:siteFarms.map.${g.k}`)}<i /></span>
                <span className="v">{list.length}</span>
                <span className="s">{g.hint} · {fmt(list.reduce((a, f) => a + f.balance, 0))} {t('finance:siteFarms.liter')}</span>
              </button>
            );
          })}
        </div>
        <div className="sf-field-grid">
          {cover.farms.filter(f => filter === 'all' || f.status === filter).map((f, k) => (
            <button key={f.name} type="button" className={`sf-field-tile ${f.status}${open === f.name ? ' sel' : ''}`} style={{ '--c': COLOR[f.status], '--i': k } as React.CSSProperties}
              onClick={() => setOpen(f.name)} aria-label={`${f.name} · ${t(`finance:siteFarms.map.${f.status}`)} · ${daysText(f)}`}>
              {f.inbound > 0 && <span className="inb">+{fmt(f.inbound)}</span>}
              <span className="sf-field-ring"><Ring f={f} r={28} w={6} /><span className="n"><b>{f.label}</b></span></span>
              <span className="d">{fmt(f.balance)} {t('finance:siteFarms.liter')}</span>
              <span className="bal">{daysText(f)}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
      <aside className={`sf-root sf-field-drawer${farm ? ' on' : ''}`} dir={i18n.dir()} aria-hidden={!farm}>
        {farm && (
          <>
            <div className="sf-field-head">
              <div><small>{site} · {cover.date}</small><h3>{farm.name}</h3></div>
              <button type="button" className="sf-field-x" onClick={() => setOpen(null)} aria-label={t('finance:siteFarms.field.close')}><X className="w-4 h-4" /></button>
            </div>
            <div className="sf-field-big" style={{ '--c': COLOR[farm.status] } as React.CSSProperties}>
              <span className="sf-field-ring big"><Ring f={farm} r={40} w={8} /><span className="n"><b>{fmt(farm.balance / 1000)}k</b><span>{t('finance:siteFarms.liter')}</span></span></span>
              <div>
                <b style={{ color: COLOR[farm.status] }}>{t(`finance:siteFarms.map.${farm.status}`)}</b>
                <span>{t('finance:siteFarms.field.balance', { n: fmt(farm.balance) })} · {daysText(farm)}</span>
                <span>{t('finance:siteFarms.field.rate', { n: farm.rate > 0 ? fmt(farm.rate) : '—', reports: cover.reports })}</span>
              </div>
            </div>
            <div className="sf-field-reco" style={{ '--c': COLOR[farm.status] } as React.CSSProperties}>{reco(farm)}</div>
            <div className="sf-field-kv">
              <div><span>{t('finance:siteFarms.colPrevious')}</span><b>{fmt(farm.previous)}</b></div>
              <div><span>{t('finance:siteFarms.colInbound')}</span><b>{fmt(farm.inbound)}</b></div>
              <div><span>{t('finance:siteFarms.colConsumption')}</span><b>{fmt(farm.consumption)}</b></div>
              <div><span>{t('finance:siteFarms.colBalance')}</span><b>{fmt(farm.balance)}</b></div>
            </div>
          </>
        )}
      </aside>
    </>,
    document.body
  );
};

export default SiteFarmsField;
