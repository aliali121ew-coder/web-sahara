import { useCallback, useEffect, useState } from 'react';
import { CLOUD_APPLIED_EVENT } from './cloudSync';
import { keepIfSame } from './keepIfSame';

/**
 * فهرس المجهزين والشركات: الأسماء الصحيحة، ولكل اسم أشكاله الخاطئة المعروفة (أحرف مقلوبة أو تالفة من ملفات PDF).
 * عند استيراد ملف الوارد يُطابَق كل اسم مع الفهرس فيُستبدل بالاسم الصحيح:
 * مطابقة تامة بعد التطبيع، أو شكل خاطئ محفوظ، أو تشابه عالٍ مع اسم واحد فقط (بلا التباس).
 * قائمة مرجعية مشتركة تُزامَن مع الخادم مثل قائمة الشركات المجهزة.
 */
export const NAME_INDEX_KEY = 'sahara_name_index_v1';
const SYNC_EVENT = 'sahara-name-index-updated';

export type NameKind = 'supplier' | 'company';
export interface NameEntry {
  id: string;
  name: string;
  /** أشكال خاطئة تُصحَّح إلى name */
  aliases: string[];
}
export type NameIndex = Record<NameKind, NameEntry[]>;

const EMPTY: NameIndex = { supplier: [], company: [] };

/** تطبيع للمطابقة: أشكال العرض (ﻻ)، الهمزات، التاء المربوطة، الياء، التشكيل والتطويل، الرموز التالفة، وكل المسافات والرموز */
export const nameKey = (s = '') =>
  s.normalize('NFKC')
    .replace(/[᐀-᣿]/g, '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}]/gu, '');

/** نفس الكلمات بترتيب مختلف (PDF قد يقلب ترتيب الكلمات) */
const wordsKey = (s = '') => s.split(/\s+/).map(nameKey).filter(Boolean).sort().join(' ');

const levenshtein = (a: string, b: string) => {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
};

/** التشابه 0..1 بين اسمين بعد التطبيع (مع تجاهل ترتيب الكلمات) */
export const nameSimilarity = (a: string, b: string) => {
  const x = nameKey(a), y = nameKey(b);
  if (!x || !y) return 0;
  if (x === y || wordsKey(a) === wordsKey(b)) return 1;
  const d = Math.min(levenshtein(x, y), levenshtein(wordsKey(a).replace(/ /g, ''), wordsKey(b).replace(/ /g, '')));
  return 1 - d / Math.max(x.length, y.length);
};

/** أقل تشابه للتصحيح التلقائي، والفرق المطلوب عن ثاني أقرب اسم حتى لا يُختار اسم ملتبس */
const AUTO_MIN = 0.8;
const AUTO_GAP = 0.08;

export type MatchHow = 'exact' | 'alias' | 'similar';
export interface NameMatch { name: string; how: MatchHow; score: number }

/** الاسم الصحيح من الفهرس لاسم مقروء (null = لا تطابق مؤكد) */
export const matchName = (raw: string, entries: NameEntry[]): NameMatch | null => {
  const k = nameKey(raw);
  if (!k || !entries.length) return null;
  const wk = wordsKey(raw);
  for (const e of entries) {
    if (nameKey(e.name) === k || wordsKey(e.name) === wk) return { name: e.name, how: 'exact', score: 1 };
  }
  for (const e of entries) {
    if (e.aliases.some(a => nameKey(a) === k)) return { name: e.name, how: 'alias', score: 1 };
  }
  const ranked = suggestNames(raw, entries, 2);
  const [best, second] = ranked;
  if (best && best.score >= AUTO_MIN && (!second || best.score - second.score >= AUTO_GAP)) return { name: best.name, how: 'similar', score: best.score };
  return null;
};

/** أقرب أسماء الفهرس لاسم (للاقتراح عند التصحيح اليدوي) */
export const suggestNames = (raw: string, entries: NameEntry[], limit = 5) =>
  entries
    .map(e => ({ name: e.name, score: Math.max(nameSimilarity(raw, e.name), ...e.aliases.map(a => nameSimilarity(raw, a))) }))
    .filter(x => x.score > 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

export interface NameFix { field: 'supplierName' | 'supplierCompany'; from: string; to: string; how: MatchHow }

/** تصحيح اسم المجهز والشركة المجهزة في صفوف الاستيراد من الفهرس */
export const applyNameIndex = <T extends { supplierName: string; supplierCompany: string }>(rows: T[], index: NameIndex) => {
  const fixes: (NameFix[])[] = [];
  let changed = 0;
  const out = rows.map(r => {
    const rowFixes: NameFix[] = [];
    const next = { ...r };
    const fields = [['supplierName', index.supplier], ['supplierCompany', index.company]] as const;
    for (const [field, entries] of fields) {
      const raw = (r[field] || '').trim();
      if (!raw) continue;
      const m = matchName(raw, entries);
      if (m && m.name !== raw) {
        next[field] = m.name as T[typeof field];
        rowFixes.push({ field, from: raw, to: m.name, how: m.how });
        changed++;
      }
    }
    fixes.push(rowFixes);
    return next;
  });
  return { rows: out, fixes, changed };
};

/** اسم في الفهرس؟ (تام أو شكل خاطئ محفوظ) */
export const isKnownName = (raw: string, entries: NameEntry[]) => {
  const k = nameKey(raw);
  return !!k && entries.some(e => nameKey(e.name) === k || e.aliases.some(a => nameKey(a) === k));
};

// ── التخزين ──
const clean = (list: unknown): NameEntry[] =>
  Array.isArray(list)
    ? list.filter((e): e is NameEntry => !!e && typeof e.id === 'string' && typeof e.name === 'string')
        .map(e => ({ id: e.id, name: e.name.trim(), aliases: Array.isArray(e.aliases) ? e.aliases.filter(a => typeof a === 'string' && a.trim()) : [] }))
    : [];

export const readNameIndex = (): NameIndex => {
  try {
    const saved = JSON.parse(localStorage.getItem(NAME_INDEX_KEY) || 'null');
    return saved && typeof saved === 'object' ? { supplier: clean(saved.supplier), company: clean(saved.company) } : EMPTY;
  } catch {
    return EMPTY;
  }
};

export const writeNameIndex = (next: NameIndex) => {
  localStorage.setItem(NAME_INDEX_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(SYNC_EVENT));
};

const newId = () => `nm-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** إضافة اسم صحيح (لا يُكرَّر اسم موجود بعد التطبيع) */
export const addName = (index: NameIndex, kind: NameKind, name: string): NameIndex => {
  const n = name.replace(/\s+/g, ' ').trim();
  if (!n || index[kind].some(e => nameKey(e.name) === nameKey(n))) return index;
  return { ...index, [kind]: [...index[kind], { id: newId(), name: n, aliases: [] }] };
};

/** ربط شكل خاطئ باسم صحيح (ويُزال من أي اسم آخر كان مربوطًا به) */
export const addAlias = (index: NameIndex, kind: NameKind, id: string, alias: string): NameIndex => {
  const a = alias.replace(/\s+/g, ' ').trim();
  const k = nameKey(a);
  if (!k) return index;
  return {
    ...index,
    [kind]: index[kind].map(e => {
      const rest = e.aliases.filter(x => nameKey(x) !== k);
      return e.id === id && nameKey(e.name) !== k ? { ...e, aliases: [...rest, a] } : { ...e, aliases: rest };
    }),
  };
};

export const removeAlias = (index: NameIndex, kind: NameKind, id: string, alias: string): NameIndex => ({
  ...index,
  [kind]: index[kind].map(e => (e.id === id ? { ...e, aliases: e.aliases.filter(a => a !== alias) } : e)),
});

export const renameEntry = (index: NameIndex, kind: NameKind, id: string, name: string): NameIndex => {
  const n = name.replace(/\s+/g, ' ').trim();
  if (!n) return index;
  return { ...index, [kind]: index[kind].map(e => (e.id === id ? { ...e, name: n } : e)) };
};

export const removeEntry = (index: NameIndex, kind: NameKind, id: string): NameIndex => ({
  ...index,
  [kind]: index[kind].filter(e => e.id !== id),
});

/** مزامنة حية بين التبويبات والأجهزة */
export const useNameIndex = (): [NameIndex, (update: (prev: NameIndex) => NameIndex) => void] => {
  const [index, setIndex] = useState<NameIndex>(readNameIndex);
  const refresh = useCallback(() => setIndex(keepIfSame(readNameIndex())), []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === NAME_INDEX_KEY) refresh(); };
    const onCloud = (e: Event) => { if (((e as CustomEvent<string[]>).detail ?? []).includes(NAME_INDEX_KEY)) refresh(); };
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener(CLOUD_APPLIED_EVENT, onCloud);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CLOUD_APPLIED_EVENT, onCloud);
    };
  }, [refresh]);
  const update = useCallback((fn: (prev: NameIndex) => NameIndex) => writeNameIndex(fn(readNameIndex())), []);
  return [index, update];
};
