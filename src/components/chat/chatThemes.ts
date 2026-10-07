import type React from 'react';

export interface ChatTheme {
  id: string;
  /** الاسم والوصف: chat:theme.<id>.name / .tagline */
  dark: boolean;
  vars: Record<string, string>;
}

/**
 * ثيمات المحادثة. كل ثيم مجموعة متغيّرات CSS تُطبَّق على حاوية المحادثة فقط.
 * --bg: الخلفية، --glow1/2: الإضاءات السديمية، --out: فقاعتي، --in: فقاعة الآخرين.
 */
export const CHAT_THEMES: ChatTheme[] = [
  {
    id: 'nebula', dark: true,
    vars: {
      '--bg': '#07051a', '--glow1': 'rgba(124,58,237,.45)', '--glow2': 'rgba(6,182,212,.30)',
      '--panel': 'rgba(18,14,44,.72)', '--panel-solid': '#120e2c', '--panel2': 'rgba(255,255,255,.05)', '--border': 'rgba(167,139,250,.16)',
      '--text': '#ede9fe', '--muted': '#a5a0c8', '--accent': '#8b5cf6', '--accent2': '#22d3ee', '--accent-text': '#fff',
      '--out': 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 55%,#0891b2 100%)', '--out-text': '#fff', '--out-muted': 'rgba(255,255,255,.72)',
      '--in': 'rgba(255,255,255,.07)', '--in-text': '#ede9fe', '--in-border': 'rgba(167,139,250,.18)',
      '--stars': '1',
    },
  },
  {
    id: 'cyber', dark: true,
    vars: {
      '--bg': '#030306', '--glow1': 'rgba(236,72,153,.38)', '--glow2': 'rgba(34,211,238,.32)',
      '--panel': 'rgba(10,10,18,.8)', '--panel-solid': '#0a0a12', '--panel2': 'rgba(34,211,238,.06)', '--border': 'rgba(34,211,238,.22)',
      '--text': '#e0fbff', '--muted': '#7fa3b0', '--accent': '#ec4899', '--accent2': '#22d3ee', '--accent-text': '#fff',
      '--out': 'linear-gradient(135deg,#db2777 0%,#9333ea 60%,#06b6d4 100%)', '--out-text': '#fff', '--out-muted': 'rgba(255,255,255,.75)',
      '--in': 'rgba(34,211,238,.07)', '--in-text': '#e0fbff', '--in-border': 'rgba(34,211,238,.28)',
      '--stars': '0', '--grid': '1',
    },
  },
  {
    id: 'aurora', dark: true,
    vars: {
      '--bg': '#02121a', '--glow1': 'rgba(16,185,129,.40)', '--glow2': 'rgba(59,130,246,.32)',
      '--panel': 'rgba(4,28,36,.74)', '--panel-solid': '#041c24', '--panel2': 'rgba(255,255,255,.05)', '--border': 'rgba(52,211,153,.18)',
      '--text': '#e6fff7', '--muted': '#8fb9ad', '--accent': '#10b981', '--accent2': '#38bdf8', '--accent-text': '#fff',
      '--out': 'linear-gradient(135deg,#059669 0%,#0d9488 50%,#2563eb 100%)', '--out-text': '#fff', '--out-muted': 'rgba(255,255,255,.75)',
      '--in': 'rgba(255,255,255,.07)', '--in-text': '#e6fff7', '--in-border': 'rgba(52,211,153,.2)',
      '--stars': '1',
    },
  },
  {
    id: 'dunes', dark: true,
    vars: {
      '--bg': '#140b04', '--glow1': 'rgba(245,158,11,.36)', '--glow2': 'rgba(239,68,68,.22)',
      '--panel': 'rgba(34,20,8,.76)', '--panel-solid': '#221408', '--panel2': 'rgba(255,255,255,.05)', '--border': 'rgba(251,191,36,.18)',
      '--text': '#fff7e6', '--muted': '#c7ab86', '--accent': '#f59e0b', '--accent2': '#f97316', '--accent-text': '#1c1003',
      '--out': 'linear-gradient(135deg,#f59e0b 0%,#ea580c 60%,#be123c 100%)', '--out-text': '#fff', '--out-muted': 'rgba(255,255,255,.78)',
      '--in': 'rgba(255,255,255,.07)', '--in-text': '#fff7e6', '--in-border': 'rgba(251,191,36,.2)',
      '--stars': '1',
    },
  },
  {
    id: 'mars', dark: true,
    vars: {
      '--bg': '#12030a', '--glow1': 'rgba(244,63,94,.38)', '--glow2': 'rgba(251,146,60,.26)',
      '--panel': 'rgba(32,8,16,.76)', '--panel-solid': '#200810', '--panel2': 'rgba(255,255,255,.05)', '--border': 'rgba(251,113,133,.18)',
      '--text': '#ffe4e6', '--muted': '#c4959c', '--accent': '#f43f5e', '--accent2': '#fb923c', '--accent-text': '#fff',
      '--out': 'linear-gradient(135deg,#e11d48 0%,#c2410c 100%)', '--out-text': '#fff', '--out-muted': 'rgba(255,255,255,.75)',
      '--in': 'rgba(255,255,255,.07)', '--in-text': '#ffe4e6', '--in-border': 'rgba(251,113,133,.2)',
      '--stars': '1',
    },
  },
  {
    id: 'hologram', dark: false,
    vars: {
      '--bg': '#eef2ff', '--glow1': 'rgba(192,132,252,.45)', '--glow2': 'rgba(103,232,249,.45)',
      '--panel': 'rgba(255,255,255,.66)', '--panel-solid': '#ffffff', '--panel2': 'rgba(99,102,241,.06)', '--border': 'rgba(99,102,241,.16)',
      '--text': '#1e1b4b', '--muted': '#6b6b93', '--accent': '#7c3aed', '--accent2': '#0891b2', '--accent-text': '#fff',
      '--out': 'linear-gradient(135deg,#a855f7 0%,#6366f1 50%,#06b6d4 100%)', '--out-text': '#fff', '--out-muted': 'rgba(255,255,255,.8)',
      '--in': 'rgba(255,255,255,.85)', '--in-text': '#1e1b4b', '--in-border': 'rgba(99,102,241,.14)',
      '--stars': '0',
    },
  },
  {
    id: 'crystal', dark: false,
    vars: {
      '--bg': '#f1f5f9', '--glow1': 'rgba(59,130,246,.22)', '--glow2': 'rgba(14,165,233,.18)',
      '--panel': 'rgba(255,255,255,.82)', '--panel-solid': '#ffffff', '--panel2': 'rgba(15,23,42,.04)', '--border': 'rgba(15,23,42,.09)',
      '--text': '#0f172a', '--muted': '#64748b', '--accent': '#2563eb', '--accent2': '#0ea5e9', '--accent-text': '#fff',
      '--out': 'linear-gradient(135deg,#2563eb 0%,#0ea5e9 100%)', '--out-text': '#fff', '--out-muted': 'rgba(255,255,255,.8)',
      '--in': '#ffffff', '--in-text': '#0f172a', '--in-border': 'rgba(15,23,42,.08)',
      '--stars': '0',
    },
  },
  {
    id: 'mint', dark: false,
    vars: {
      '--bg': '#ecfdf5', '--glow1': 'rgba(52,211,153,.30)', '--glow2': 'rgba(45,212,191,.25)',
      '--panel': 'rgba(255,255,255,.78)', '--panel-solid': '#ffffff', '--panel2': 'rgba(6,78,59,.05)', '--border': 'rgba(6,78,59,.1)',
      '--text': '#052e24', '--muted': '#4d7a6c', '--accent': '#059669', '--accent2': '#0d9488', '--accent-text': '#fff',
      '--out': 'linear-gradient(135deg,#10b981 0%,#0d9488 100%)', '--out-text': '#fff', '--out-muted': 'rgba(255,255,255,.82)',
      '--in': '#ffffff', '--in-text': '#052e24', '--in-border': 'rgba(6,78,59,.09)',
      '--stars': '0',
    },
  },
];

export const themeById = (id: string) => CHAT_THEMES.find(t => t.id === id) || CHAT_THEMES[0];

export const themeStyle = (t: ChatTheme) => t.vars as unknown as React.CSSProperties;

/**
 * مظهر النص والفقاعات داخل محادثة معيّنة (مستقل عن ثيم الصفحة).
 * القيم الفارغة تعني: استخدم ألوان ثيم الصفحة.
 */
export interface BubbleStyle {
  id: string;
  /** الاسم: chat:bubble.<id> */
  out?: string;
  outText?: string;
  in?: string;
  inText?: string;
  inBorder?: string;
}

export const BUBBLE_STYLES: BubbleStyle[] = [
  { id: 'auto' },
  { id: 'whatsapp', out: 'linear-gradient(135deg,#128c7e,#075e54)', outText: '#fff', in: '#ffffff', inText: '#111b21', inBorder: 'rgba(0,0,0,.06)' },
  { id: 'messenger', out: 'linear-gradient(160deg,#00b2ff 0%,#a033ff 60%,#ff5c87 100%)', outText: '#fff', in: '#e4e6eb', inText: '#050505', inBorder: 'transparent' },
  { id: 'telegram', out: 'linear-gradient(135deg,#3390ec,#2a7bd1)', outText: '#fff', in: 'rgba(255,255,255,.95)', inText: '#0f1419', inBorder: 'rgba(0,0,0,.05)' },
  { id: 'gold', out: 'linear-gradient(135deg,#fbbf24,#d97706)', outText: '#1c1003', in: 'rgba(251,191,36,.12)', inText: 'var(--text)', inBorder: 'rgba(251,191,36,.35)' },
  { id: 'rose', out: 'linear-gradient(135deg,#f472b6,#db2777)', outText: '#fff', in: 'rgba(244,114,182,.12)', inText: 'var(--text)', inBorder: 'rgba(244,114,182,.3)' },
  { id: 'mono', out: '#1f2937', outText: '#f9fafb', in: 'rgba(148,163,184,.16)', inText: 'var(--text)', inBorder: 'rgba(148,163,184,.3)' },
  { id: 'glass', out: 'rgba(255,255,255,.18)', outText: 'var(--text)', in: 'rgba(255,255,255,.06)', inText: 'var(--text)', inBorder: 'rgba(255,255,255,.14)' },
];

export const TEXT_SIZES = [
  { id: 'sm', px: 13 },
  { id: 'md', px: 14.5 },
  { id: 'lg', px: 16.5 },
  { id: 'xl', px: 19 },
];

export interface RoomLook { bubble: string; size: string }
export const DEFAULT_LOOK: RoomLook = { bubble: 'auto', size: 'md' };

/** متغيّرات CSS التي تطبّق مظهر الفقاعات وحجم النص على منطقة الرسائل */
export const lookStyle = (look: RoomLook) => {
  const b = BUBBLE_STYLES.find(x => x.id === look.bubble) || BUBBLE_STYLES[0];
  const size = TEXT_SIZES.find(x => x.id === look.size) || TEXT_SIZES[1];
  const v: Record<string, string> = { '--msg-size': `${size.px}px` };
  if (b.out) v['--out'] = b.out;
  if (b.outText) { v['--out-text'] = b.outText; v['--out-muted'] = `color-mix(in srgb, ${b.outText} 72%, transparent)`; }
  if (b.in) v['--in'] = b.in;
  if (b.inText) v['--in-text'] = b.inText;
  if (b.inBorder) v['--in-border'] = b.inBorder;
  return v as unknown as React.CSSProperties;
};
