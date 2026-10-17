import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BookOpenCheck, Building2, Check, Download, Pencil, Plus, Search, Trash2, User, Wand2, X } from 'lucide-react';
import { hasBrokenGlyphs } from '../../lib/inboundImport';
import {
  addAlias, addName, isKnownName, nameKey, removeAlias, removeEntry, renameEntry, suggestNames, useNameIndex, type NameKind,
} from '../../lib/nameIndex';

interface Props {
  onClose: () => void;
  /** أسماء الأرشيف لإضافتها للفهرس دفعة واحدة */
  archiveNames: Record<NameKind, string[]>;
  /** تصحيح اسم واحد من معاينة الاستيراد: يُختار الاسم الصحيح فيُحفظ الاسم المقروء شكلًا خاطئًا له */
  correct?: { kind: NameKind; raw: string } | null;
}

/** نافذة فهرس المجهزين والشركات: الأسماء الصحيحة وأشكالها الخاطئة، وتصحيح اسم مقروء من ملف */
export const NameIndexModal: React.FC<Props> = ({ onClose, archiveNames, correct }) => {
  const { t, i18n } = useTranslation(['deliveries', 'common']);
  const N = (k: string, o?: Record<string, unknown>) => t(`deliveries:nameIndex.${k}`, o);
  const [index, update] = useNameIndex();
  const [kind, setKind] = useState<NameKind>(correct?.kind ?? 'supplier');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(correct?.raw.replace(/[᐀-᣿]/g, '') ?? '');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [aliasFor, setAliasFor] = useState<{ id: string; text: string } | null>(null);

  const entries = index[kind];
  const shown = useMemo(() => {
    const q = nameKey(query);
    return q ? entries.filter(e => nameKey(e.name).includes(q) || e.aliases.some(a => nameKey(a).includes(q))) : entries;
  }, [entries, query]);
  // أسماء الأرشيف غير الموجودة في الفهرس (بلا الأسماء التالفة)
  const fromArchive = useMemo(
    () => [...new Set(archiveNames[kind].map(n => n.replace(/\s+/g, ' ').trim()))].filter(n => n && !hasBrokenGlyphs(n) && !isKnownName(n, entries)),
    [archiveNames, kind, entries]
  );
  const suggestions = useMemo(() => (correct ? suggestNames(correct.raw, index[correct.kind], 6) : []), [correct, index]);

  const pickCorrect = (id: string) => {
    if (!correct) return;
    update(prev => addAlias(prev, correct.kind, id, correct.raw));
    onClose();
  };
  const addNew = () => {
    const name = draft.trim();
    if (!name) return;
    update(prev => {
      let next = addName(prev, kind, name);
      // التصحيح باسم جديد: الاسم المقروء يُربط به أيضًا
      if (correct && nameKey(correct.raw) !== nameKey(name)) {
        const e = next[kind].find(x => nameKey(x.name) === nameKey(name));
        if (e) next = addAlias(next, kind, e.id, correct.raw);
      }
      return next;
    });
    setDraft('');
    if (correct) onClose();
  };
  const importArchive = () => update(prev => fromArchive.reduce((acc, n) => addName(acc, kind, n), prev));

  const tab = (k: NameKind, Icon: React.ElementType, label: string) => (
    <button type="button" onClick={() => setKind(k)} aria-pressed={kind === k} disabled={!!correct && correct.kind !== k}
      className={`flex-1 px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-black transition-all disabled:opacity-40 ${kind === k ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 cursor-pointer'}`}>
      <Icon className="w-4 h-4" />{label}
      <span className="px-1.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-[10px] font-mono">{index[k].length}</span>
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[260] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3" dir={i18n.dir()} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-900">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-500 text-white flex items-center justify-center shrink-0">{correct ? <Wand2 className="w-5 h-5" /> : <BookOpenCheck className="w-5 h-5" />}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">{correct ? N('correctTitle') : N('title')}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{correct ? N('correctHint') : N('hint')}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer" aria-label={t('common:actions.close')}><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-auto">
          {correct && (
            <div className="space-y-2">
              <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs">
                <span className="font-bold text-amber-800 dark:text-amber-200">{N('readAs')}: </span>
                <span className="font-black text-slate-900 dark:text-white" dir="auto">{correct.raw}</span>
              </div>
              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-500">{N('pickCorrect')}</div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map(s => {
                      const e = index[correct.kind].find(x => x.name === s.name)!;
                      return (
                        <button key={e.id} type="button" onClick={() => pickCorrect(e.id)}
                          className="px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-black flex items-center gap-1.5 hover:bg-emerald-100 cursor-pointer">
                          <Check className="w-3.5 h-3.5" />{s.name}<span className="font-mono text-[10px] opacity-60">{Math.round(s.score * 100)}%</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="text-[11px] font-bold text-slate-500">{N('orNew')}</div>
            </div>
          )}

          <div className="flex gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
            {tab('supplier', User, N('suppliers'))}
            {tab('company', Building2, N('companies'))}
          </div>

          {/* إضافة اسم صحيح */}
          <div className="flex gap-2">
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addNew(); }}
              placeholder={N(kind === 'supplier' ? 'addSupplier' : 'addCompany')}
              className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100" />
            <button type="button" onClick={addNew} disabled={!draft.trim()}
              className="px-4 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              <Plus className="w-4 h-4" />{N('add')}
            </button>
          </div>

          {!correct && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={N('search')}
                  className="w-full h-9 ps-9 pe-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold" />
              </div>
              {fromArchive.length > 0 && (
                <button type="button" onClick={importArchive}
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                  <Download className="w-4 h-4" />{N('fromArchive', { n: fromArchive.length })}
                </button>
              )}
            </div>
          )}

          {/* القائمة */}
          {shown.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">{entries.length ? N('noMatch') : N('empty')}</div>
          ) : (
            <ul className="space-y-2">
              {shown.map(e => (
                <li key={e.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {editing?.id === e.id ? (
                      <input autoFocus value={editing.name} onChange={ev => setEditing({ id: e.id, name: ev.target.value })}
                        onKeyDown={ev => { if (ev.key === 'Enter') { update(p => renameEntry(p, kind, e.id, editing.name)); setEditing(null); } if (ev.key === 'Escape') setEditing(null); }}
                        className="flex-1 h-8 px-2 rounded-lg border border-blue-300 bg-white dark:bg-slate-800 text-sm font-black" />
                    ) : (
                      <span className="flex-1 text-sm font-black text-slate-900 dark:text-white">{e.name}</span>
                    )}
                    {correct ? (
                      <button type="button" onClick={() => pickCorrect(e.id)} className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"><Check className="w-3.5 h-3.5" />{N('choose')}</button>
                    ) : editing?.id === e.id ? (
                      <button type="button" onClick={() => { update(p => renameEntry(p, kind, e.id, editing.name)); setEditing(null); }} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 cursor-pointer" aria-label={N('save')}><Check className="w-4 h-4" /></button>
                    ) : (
                      <>
                        <button type="button" onClick={() => setAliasFor({ id: e.id, text: '' })} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer" title={N('addAlias')} aria-label={N('addAlias')}><Plus className="w-4 h-4" /></button>
                        <button type="button" onClick={() => setEditing({ id: e.id, name: e.name })} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title={N('rename')} aria-label={N('rename')}><Pencil className="w-4 h-4" /></button>
                        <button type="button" onClick={() => update(p => removeEntry(p, kind, e.id))} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer" title={N('remove')} aria-label={N('remove')}><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                  {(e.aliases.length > 0 || aliasFor?.id === e.id) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10.5px] font-bold text-slate-400">{N('aliases')}:</span>
                      {e.aliases.map(a => (
                        <span key={a} className="px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1" dir="auto">
                          {a}
                          {!correct && <button type="button" onClick={() => update(p => removeAlias(p, kind, e.id, a))} className="opacity-60 hover:opacity-100 cursor-pointer" aria-label={N('remove')}><X className="w-3 h-3" /></button>}
                        </span>
                      ))}
                      {aliasFor?.id === e.id && (
                        <input autoFocus value={aliasFor.text} onChange={ev => setAliasFor({ id: e.id, text: ev.target.value })} placeholder={N('aliasPlaceholder')}
                          onKeyDown={ev => {
                            if (ev.key === 'Enter' && aliasFor.text.trim()) { update(p => addAlias(p, kind, e.id, aliasFor.text)); setAliasFor(null); }
                            if (ev.key === 'Escape') setAliasFor(null);
                          }}
                          onBlur={() => setAliasFor(null)}
                          className="h-7 px-2 rounded-lg border border-blue-300 bg-white dark:bg-slate-800 text-[11px] font-bold w-44" />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NameIndexModal;
