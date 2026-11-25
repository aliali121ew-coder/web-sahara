import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, PowerOff, Power, RotateCcw, Save } from 'lucide-react';
import { PERM_GROUPS, UNSTOPPABLE_SECTIONS } from '../../lib/permCatalog';
import { setDisabledPages } from '../../lib/disabledPages';
import { systemApi } from './systemApi';
import { btnCls, cardCls, Skeleton } from '../admin/adminUi';

/** أقسام صلاحيات لا تمثل صفحة مستقلة في القائمة (لا تُعرض هنا) */
const NOT_PAGES = new Set(['appearance', ...UNSTOPPABLE_SECTIONS]);

/** صف واحد: صفحة عامة، أو شركة كاملة (كل أقسامها معًا) */
interface Row { id: string; label: string; sections: string[] }

/**
 * إيقاف الصفحات غير المستخدمة: الصفحة الموقوفة تختفي من القائمة عند كل الحسابات (ومنها مدير النظام)،
 * ولا تُحمَّل بياناتها عند فتح التطبيق، فلا تستهلك قراءات من قاعدة البيانات. البيانات لا تُحذف وتعود عند التشغيل.
 */
export const PagesPanel: React.FC = () => {
  const { t } = useTranslation(['system', 'admin']);
  const [saved, setSaved] = useState<string[] | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    systemApi.pages()
      .then(r => { setSaved(r.disabled); setDraft(new Set(r.disabled)); })
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const rows: Row[] = useMemo(() => {
    const pages = PERM_GROUPS.find(g => g.id === 'pages')!.sections
      .filter(s => !NOT_PAGES.has(s.id))
      .map(s => ({ id: s.id, label: t(`admin:perm.sections.${s.id}`, { defaultValue: s.label }), sections: [s.id] }));
    const companies = PERM_GROUPS.filter(g => g.id !== 'pages')
      .map(g => ({ id: g.id, label: t(`admin:perm.groups.${g.id}`, { defaultValue: g.label }), sections: g.sections.map(s => s.id) }));
    return [...companies, ...pages];
  }, [t]);

  const isOff = (r: Row) => r.sections.every(s => draft.has(s));
  const toggle = (r: Row) => {
    const next = new Set(draft);
    if (isOff(r)) r.sections.forEach(s => next.delete(s));
    else r.sections.forEach(s => next.add(s));
    setDraft(next);
    setDone(false);
  };

  const list = [...draft].sort();
  const dirty = !!saved && list.join(',') !== [...saved].sort().join(',');
  const offCount = rows.filter(isOff).length;
  const dashboardOn = !draft.has('dashboard');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await systemApi.setPages(list);
      setSaved(r.disabled);
      setDraft(new Set(r.disabled));
      // هذا الجهاز يطبّقها فورًا، والأجهزة الأخرى تصلها مع النسخة الجديدة
      setDisabledPages(r.disabled);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${cardCls} p-4 sm:p-5 space-y-4`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300"><PowerOff className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-base text-slate-900 dark:text-white">{t('system:pages.title')}</h3>
          <p className="text-[13px] leading-6 text-slate-500 dark:text-slate-400 mt-0.5">{t('system:pages.hint')}</p>
        </div>
        <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {t('system:pages.offCount', { count: offCount })}
        </span>
      </div>

      {dashboardOn && offCount > 0 && (
        <p className="flex gap-2 text-[12.5px] leading-6 rounded-2xl px-3 py-2 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-200/70 dark:border-amber-900/50">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-1" />{t('system:pages.dashboardNote')}
        </p>
      )}
      {error && <p className="text-sm text-rose-500">{error}</p>}

      {!saved ? <Skeleton /> : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rows.map(r => {
            const off = isOff(r);
            return (
              <li key={r.id}>
                <button type="button" role="switch" aria-checked={!off} onClick={() => toggle(r)}
                  className={`w-full flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-start transition-colors cursor-pointer ${off
                    ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-500/5'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                  <span className={`flex-1 min-w-0 text-sm font-bold truncate ${off ? 'text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-100'}`}>
                    {r.label}
                    {r.sections.length > 1 && <span className="ms-1.5 text-[11px] font-semibold text-slate-400">{t('system:pages.wholeCompany')}</span>}
                  </span>
                  <span className={`text-[11px] font-bold ${off ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {off ? t('system:pages.off') : t('system:pages.on')}
                  </span>
                  <span aria-hidden className={`relative w-10 h-6 rounded-full transition-colors ${off ? 'bg-slate-300 dark:bg-slate-700' : 'bg-emerald-500'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${off ? 'start-0.5' : 'start-[18px]'}`} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" disabled={!dirty || busy} onClick={save} className={`${btnCls} bg-slate-900 text-white dark:bg-white dark:text-slate-900`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{t('system:pages.save')}
        </button>
        {dirty && (
          <button type="button" disabled={busy} onClick={() => setDraft(new Set(saved || []))} className={`${btnCls} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>
            <RotateCcw className="w-4 h-4" />{t('system:pages.undo')}
          </button>
        )}
        {done && !dirty && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400"><Power className="w-4 h-4" />{t('system:pages.saved')}</span>}
      </div>
    </div>
  );
};
