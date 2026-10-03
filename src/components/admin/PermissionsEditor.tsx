import React, { useState } from 'react';
import { EyeOff, Eye, PencilLine, ChevronDown, LayoutGrid, Building2, Factory, Sparkles } from 'lucide-react';
import { PERM_GROUPS, ALL_SECTIONS, type Level, type Perms } from '../../lib/permCatalog';

const LEVELS: { v: Level; label: string; short: string; icon: React.ComponentType<{ className?: string }>; on: string }[] = [
  { v: 0, label: 'لا يوجد', short: 'لا', icon: EyeOff, on: 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 shadow-sm' },
  { v: 1, label: 'عرض', short: 'عرض', icon: Eye, on: 'bg-sky-600 text-white shadow-sm shadow-sky-600/30' },
  { v: 2, label: 'عرض وتعديل', short: 'تعديل', icon: PencilLine, on: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30' },
];
const GROUP_ICON: Record<string, React.ComponentType<{ className?: string }>> = { pages: LayoutGrid, etihad: Building2, sahara: Factory };

/** أداة اختيار درجة (لا يوجد / عرض / تعديل) */
const Segmented: React.FC<{ value: Level | -1; onChange: (v: Level) => void; label: string; compact?: boolean }> = ({ value, onChange, label, compact }) => (
  <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 shrink-0">
    {LEVELS.map(l => {
      const Icon = l.icon;
      const on = value === l.v;
      return (
        <button key={l.v} type="button" role="radio" aria-checked={on} title={l.label} onClick={() => onChange(l.v)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-[11px] font-bold transition-all ${on ? l.on : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
          <Icon className="w-3.5 h-3.5" />
          {!compact && <span className="hidden sm:inline">{l.short}</span>}
        </button>
      );
    })}
  </div>
);

/** محرر صلاحيات الأقسام: مجموعة لكل جزء، مع ضبط المجموعة كاملة بنقرة وقوالب جاهزة */
export const PermissionsEditor: React.FC<{ value: Perms; onChange: (p: Perms) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState<Record<string, boolean>>({ pages: true, etihad: true, sahara: true });

  const setOne = (id: string, v: Level) => {
    const next = { ...value };
    if (v) next[id] = v; else delete next[id];
    onChange(next);
  };
  const setIds = (ids: string[], v: Level, base: Perms = value) => {
    const next = { ...base };
    for (const id of ids) { if (v) next[id] = v; else delete next[id]; }
    onChange(next);
  };
  const groupIds = (gid: string) => PERM_GROUPS.find(g => g.id === gid)!.sections.map(s => s.id);

  const presets: { label: string; run: () => void }[] = [
    { label: 'صحاري كامل', run: () => setIds([...groupIds('sahara'), 'deliveries-sahara', 'chat'], 2, {}) },
    { label: 'اتحاد كامل', run: () => setIds([...groupIds('etihad'), 'deliveries-etihad', 'chat'], 2, {}) },
    { label: 'مراقب (عرض الكل)', run: () => setIds(ALL_SECTIONS, 1, {}) },
    { label: 'تعديل الكل', run: () => setIds(ALL_SECTIONS, 2, {}) },
    { label: 'مسح الكل', run: () => onChange({}) },
  ];

  const total = Object.keys(value).length;
  const edits = Object.values(value).filter(v => v === 2).length;

  return (
    <div className={`space-y-3 ${disabled ? 'opacity-50 pointer-events-none select-none' : ''}`} aria-disabled={disabled}>
      {/* ملخص + قوالب */}
      <div className="rounded-2xl bg-gradient-to-l from-slate-50 to-white dark:from-slate-800/60 dark:to-slate-900 border border-slate-200/70 dark:border-slate-800 p-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> عرض {total - edits}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> تعديل {edits}</span>
          <span className="text-slate-400">من {ALL_SECTIONS.length} قسم</span>
        </div>
        <div className="flex flex-wrap gap-1.5 lg:mr-auto">
          <Sparkles className="w-4 h-4 text-violet-500 self-center" />
          {presets.map(p => (
            <button key={p.label} type="button" onClick={p.run}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-violet-300 hover:text-violet-700 dark:hover:text-violet-300 transition">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {PERM_GROUPS.map(g => {
        const Icon = GROUP_ICON[g.id] || LayoutGrid;
        const ids = g.sections.map(s => s.id);
        const levels = ids.map(id => value[id] || 0);
        const uniform = levels.every(l => l === levels[0]) ? levels[0] : -1;
        const granted = levels.filter(Boolean).length;
        const isOpen = open[g.id] ?? true;
        return (
          <div key={g.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3 px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-800/50">
              <button type="button" onClick={() => setOpen(o => ({ ...o, [g.id]: !isOpen }))} aria-expanded={isOpen} className="flex items-center gap-2.5 flex-1 min-w-0 text-right">
                <span className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center"><Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-slate-900 dark:text-white">{g.label}</span>
                  <span className="block text-[11px] text-slate-500">{granted ? `${granted} من ${ids.length} مفعّل` : 'غير مفعّل'}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              <div className="flex items-center gap-2">
                <span className="hidden md:inline text-[10px] font-bold text-slate-400">المجموعة كاملة</span>
                <Segmented value={uniform as Level | -1} onChange={v => setIds(ids, v)} label={`${g.label}: كل الأقسام`} compact />
              </div>
            </div>
            {isOpen && (
              <ul className={`divide-y divide-slate-100 dark:divide-slate-800 ${g.sections.length > 6 ? 'md:grid md:grid-cols-2 md:divide-y-0 md:gap-x-6' : ''}`}>
                {g.sections.map(s => {
                  const cur = value[s.id] || 0;
                  return (
                    <li key={s.id} className={`flex items-center gap-3 px-3.5 py-2 ${g.sections.length > 6 ? 'md:border-b md:border-slate-100 md:dark:border-slate-800' : ''}`}>
                      <span className={`w-1.5 h-6 rounded-full ${cur === 2 ? 'bg-emerald-500' : cur === 1 ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                      <span className="flex-1 min-w-0 text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{s.label}</span>
                      <Segmented value={cur} onChange={v => setOne(s.id, v)} label={s.label} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
};
