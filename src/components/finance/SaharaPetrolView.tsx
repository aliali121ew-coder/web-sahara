import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Fuel,
  History,
  ArrowDownToLine,
  Flame,
  Wallet,
  Coins,
  MapPin,
  Plus,
  Pencil,
  Save,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Truck,
  CalendarDays,
  Check,
  Eraser,
  PenLine,
  Upload,
  Loader2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatNumber, getBusinessDate } from '../../lib/utils';
import { useTranslation, Trans } from 'react-i18next';
import { fmtList } from '../../i18n/format';
import { usePetrolLedger, petrolPriceStats, PetrolLedgerRecord, PETROL_STATIONS } from '../../lib/petrolLedger';
import { readPetrolReportFile } from '../../lib/petrolReportFile';
import { useCentralTanks, resolveSaharaPetrolSectionKey, tankLiters } from '../../lib/centralTanks';
import { OFFICIAL_TABLE_TANK_UNITS } from '../tanks/TanksOverview';

/** كتابة الأرقام بفوارز أثناء الإدخال */
const withCommas = (v: string) => {
  const clean = v.replace(/[^\d.]/g, '');
  if (!clean) return '';
  const [int, dec] = clean.split('.');
  return (int ? Number(int).toLocaleString('en-US') : '0') + (dec !== undefined ? `.${dec.slice(0, 2)}` : '');
};
const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(/,/g, '')) || 0);
const fmtInput = (n: number | undefined | null) => (n ? withCommas(String(n)) : '');

interface FormState {
  id?: string;
  date: string;
  previous: string;
  /** الرصيد السابق معدّل يدويًا (وإلا = الرصيد الحالي لليوم الذي قبله) */
  editPrevious: boolean;
  /** خانة الرصيد السابق مفتوحة للإدخال */
  prevEditing: boolean;
  inboundQty: string;
  inboundInternal: string;
  inboundPrice: string;
  consumption: Record<string, string>;
  balances: Record<string, string>;
}

const pctLabel = (p: number | null, decimals = 2) =>
  p === null ? '—' : `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p).toFixed(decimals)}%`;

export const SaharaPetrolView: React.FC = () => {
  const { t } = useTranslation(['finance', 'common']);
  const { records, computed, latest, update, hasPending, publish, discard } = usePetrolLedger();

  // محطات البنزين (ثابتة، بهذا الترتيب) — الاستهلاك والأرصدة لهذه المحطات فقط.
  // إن وُجد لمحطة خزان بنزين بنفس الاسم في قسم "بنزين - صحاري كربلاء" تُؤخذ سعته ويُحدَّث عند "تأكيد البيانات".
  const [centralTanks, updateTanks] = useCentralTanks(OFFICIAL_TABLE_TANK_UNITS);
  const stations = useMemo(() => {
    const clean = (n: string) => n.replace(/^موقع\s+/, '').trim();
    const petrolKey = resolveSaharaPetrolSectionKey(centralTanks);
    const petrolTanks = petrolKey ? centralTanks.filter(t => t.sectionKey === petrolKey) : [];
    // السعة من قائمة المحطات المعتمدة (أو من خزان البنزين المطابق إن وُجد في المنظومة)
    return PETROL_STATIONS.map(({ name, capacity }) => {
      const pt = petrolTanks.find(p => clean(p.name) === name);
      return pt
        ? { id: pt.id, name, balance: tankLiters(pt), capacity: pt.capacityLiters || capacity }
        : { id: `st:${name}`, name, balance: 0, capacity };
    });
  }, [centralTanks]);

  // اليوم المعروض: آخر يوم افتراضيًا، أو يوم سابق بالتنقل
  const [viewId, setViewId] = useState<string | null>(null);
  const viewIndex = viewId ? computed.findIndex(r => r.id === viewId) : computed.length - 1;
  const view = viewIndex >= 0 ? computed[viewIndex] : null;
  const isLatestView = !!view && view.id === latest?.id;

  // يوم مُختار من جدول الرصيد الأسبوعي: النقر خارج الجدول يعيد العرض لآخر يوم
  const weeklyTableRef = useRef<HTMLDivElement>(null);
  const [pickedFromTable, setPickedFromTable] = useState(false);
  useEffect(() => {
    if (!pickedFromTable || !viewId) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || weeklyTableRef.current?.contains(t)) return;
      if (t.closest('button, a, input, select, textarea, [role="dialog"]')) return;
      setViewId(null);
      setPickedFromTable(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [pickedFromTable, viewId]);

  // أرصدة المحطات: آخر يوم بعد التأكيد = الخزانات الحية؛ يوم سابق أو غير مؤكد = المحفوظة مع اليوم
  const stationRows = stations.map(s => ({
    ...s,
    // محطة بلا خزان بنزين في المنظومة: رصيدها من السجل دائمًا
    balance: view && (!isLatestView || hasPending || s.id.startsWith('st:')) ? view.stationBalances?.[s.id] ?? s.balance : s.balance,
    consumption: view?.consumption?.[s.id] ?? 0
  }));

  // الرسم البياني: الوارد (خارجي) والاستهلاك لآخر 7 أيام حتى اليوم المعروض
  const recentDays = computed.slice(Math.max(0, viewIndex - 6), viewIndex + 1);
  const chartData = recentDays.map(r => ({ date: r.date, label: r.date.slice(5), inbound: r.inboundQty, consumption: r.totalConsumption }));

  // ── مؤشرات ذكية ──
  // متوسط استهلاك كل محطة لآخر 7 أيام (الأيام التي فيها استهلاك فقط) — لأيام التغطية في خانات المحطات
  const consumingDays = recentDays.filter(r => r.totalConsumption > 0);
  const stationAvg = (id: string) =>
    consumingDays.length ? consumingDays.reduce((a, r) => a + (r.consumption?.[id] ?? 0), 0) / consumingDays.length : 0;
  // يؤمن لغاية = الرصيد الحالي ÷ متوسط الاستهلاك اليومي، وتاريخ النفاد = تاريخ اليوم المعروض + عدد الأيام
  const avgConsumption = consumingDays.length ? consumingDays.reduce((a, r) => a + r.totalConsumption, 0) / consumingDays.length : 0;
  const coverageDays = view && avgConsumption > 0 ? Math.floor(Math.max(0, view.current) / avgConsumption) : null;
  const coverageDate = view && coverageDays !== null
    ? (() => {
        const d = new Date(view.date.replace(/\//g, '-') + 'T12:00:00');
        d.setDate(d.getDate() + coverageDays);
        return d.toISOString().slice(0, 10).replace(/-/g, '/');
      })()
    : null;
  // محطة حرجة: فيها رصيد لكنه تحت 10% من سعة خزانها
  const CRITICAL_PCT = 10;
  const stationFill = (s: { balance: number; capacity: number }) => (s.capacity > 0 ? (s.balance / s.capacity) * 100 : null);

  const price = useMemo(() => petrolPriceStats(computed.slice(0, viewIndex + 1)), [computed, viewIndex]);

  // ── النموذج ──
  const [form, setForm] = useState<FormState | null>(null);
  const openNew = () => {
    const today = getBusinessDate();
    setEntryMode('manual');
    setUpload({ status: 'idle' });
    setForm({
      date: computed.some(r => r.date === today) ? '' : today,
      previous: '',
      editPrevious: false,
      prevEditing: computed.length === 0,
      inboundQty: '',
      inboundInternal: '',
      // الكشف لا يحتوي السعر: يُقترح آخر سعر شراء مسجّل
      inboundPrice: fmtInput([...computed].reverse().find(r => r.inboundPrice > 0)?.inboundPrice),
      consumption: Object.fromEntries(stations.map(s => [s.id, ''])),
      balances: Object.fromEntries(stations.map(s => [s.id, fmtInput(s.balance)]))
    });
  };
  const openEdit = (r: PetrolLedgerRecord) =>
    setForm({
      id: r.id,
      date: r.date,
      previous: r.previousOverride != null ? fmtInput(r.previousOverride) : '',
      editPrevious: r.previousOverride != null,
      prevEditing: false,
      inboundQty: fmtInput(r.inboundQty),
      inboundInternal: fmtInput(r.inboundInternal),
      inboundPrice: fmtInput(r.inboundPrice),
      consumption: Object.fromEntries(stations.map(s => [s.id, fmtInput(r.consumption?.[s.id])])),
      balances: Object.fromEntries(stations.map(s => [s.id, fmtInput(r.stationBalances?.[s.id] ?? s.balance)]))
    });

  const [entryMode, setEntryMode] = useState<'manual' | 'upload'>('manual');
  // الرصيد السابق التلقائي = الرصيد الحالي لآخر يوم قبل تاريخ النموذج
  const prevRecord = form ? [...computed].filter(r => r.date < form.date && r.id !== form.id).pop() ?? null : null;
  const autoPrevious = prevRecord ? prevRecord.current : null;
  const dateTaken = !!form && computed.some(r => r.date === form.date && r.id !== form.id);
  const formConsumption = form ? Object.values(form.consumption).reduce((a, v) => a + num(v), 0) : 0;
  const formPrevious = form ? (form.editPrevious || autoPrevious === null ? num(form.previous) : autoPrevious) : 0;
  // الرصيد الحالي يشمل الوارد الداخلي (لكنه لا يظهر ضمن كارت الوارد)
  const formCurrent = formPrevious + (form ? num(form.inboundQty) + num(form.inboundInternal) : 0) - formConsumption;
  const formEmpty = !!form && !num(form.inboundQty) && !num(form.inboundInternal) && !formConsumption;
  const overCapacity = form ? stations.filter(s => s.capacity > 0 && num(form.balances[s.id] || '') > s.capacity) : [];
  const canSave = !!form && /^\d{4}\/\d{2}\/\d{2}$/.test(form.date) && !dateTaken
    && (form.editPrevious || autoPrevious !== null || form.previous.trim() !== '') && overCapacity.length === 0;
  const startEditPrevious = () => form && setForm({ ...form, prevEditing: true, previous: form.previous || fmtInput(autoPrevious ?? 0) });
  const commitPrevious = () => form && setForm({ ...form, prevEditing: false, editPrevious: form.previous.trim() !== '' });
  // مسح البيانات: يفرّغ الخانات فقط ولا يحذف اليوم
  const clearData = () => form && setForm({
    ...form,
    inboundQty: '',
    inboundInternal: '',
    inboundPrice: '',
    consumption: Object.fromEntries(stations.map(s => [s.id, ''])),
    balances: Object.fromEntries(stations.map(s => [s.id, '']))
  });
  // رفع ملف كشف البنزين: يعبّئ خانات النموذج (المطابقة حسب اسم المحطة) ثم تُراجع وتُحفظ
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<
    | { status: 'idle' }
    | { status: 'loading'; fileName: string }
    | { status: 'error'; message: string }
    | { status: 'done'; filled: number; unmatched: string[]; notes: string }
  >({ status: 'idle' });
  const handleUpload = async (file?: File) => {
    if (!file || !form) return;
    setUpload({ status: 'loading', fileName: file.name });
    try {
      const data = await readPetrolReportFile(file, stations.map(s => s.name));
      const byName = new Map(stations.map(s => [s.name, s.id]));
      const consumption = { ...form.consumption };
      const balances = { ...form.balances };
      let filled = 0;
      const unmatched: string[] = [];
      data.stations.forEach(st => {
        const id = st.matched ? byName.get(st.matched) : undefined;
        if (!id) { unmatched.push(st.nameInFile); return; }
        if (st.consumption !== undefined) { consumption[id] = fmtInput(st.consumption) || '0'; filled++; }
        if (st.balance !== undefined) { balances[id] = fmtInput(st.balance) || '0'; filled++; }
      });
      const next = { ...form, consumption, balances };
      if (data.inboundQty !== undefined) { next.inboundQty = fmtInput(data.inboundQty); filled++; }
      if (data.inboundInternal !== undefined) { next.inboundInternal = fmtInput(data.inboundInternal); filled++; }
      if (data.inboundPrice !== undefined) { next.inboundPrice = fmtInput(data.inboundPrice); filled++; }
      // الرصيد السابق من الملف يُستعمل فقط إن لم يوجد يوم قبله في النظام
      if (data.previous !== undefined && autoPrevious === null) { next.previous = fmtInput(data.previous); next.editPrevious = true; filled++; }
      setForm(next);
      setUpload({ status: 'done', filled, unmatched, notes: data.notes });
    } catch (e) {
      setUpload({ status: 'error', message: e instanceof Error ? e.message : t('finance:saharaPetrol.readFailed') });
    }
  };

  const toInputDate = (d: string) => d.replace(/\//g, '-');
  const fromInputDate = (d: string) => d.replace(/-/g, '/');

  const save = () => {
    if (!form || !canSave) return;
    const record: PetrolLedgerRecord = {
      id: form.id || `pet-${Date.now()}`,
      date: form.date,
      inboundQty: num(form.inboundQty),
      inboundInternal: num(form.inboundInternal),
      inboundPrice: num(form.inboundPrice),
      consumption: Object.fromEntries(Object.entries(form.consumption).map(([k, v]) => [k, num(v)])),
      stationBalances: Object.fromEntries(Object.entries(form.balances).map(([k, v]) => [k, num(v)])),
      // يُحفظ الرصيد السابق فقط إذا عُدّل يدويًا أو لم يوجد يوم قبله (الرصيد الافتتاحي)
      previousOverride: form.editPrevious || autoPrevious === null ? num(form.previous) : null,
      savedAt: new Date().toISOString()
    };
    // الحفظ يحدّث هذه الصفحة فقط؛ الواجهة الرئيسية والخزانات تنتظر "تأكيد البيانات"
    update(prev => (form.id ? prev.map(r => (r.id === form.id ? record : r)) : [...prev, record]));
    setViewId(null);
    setForm(null);
  };

  // ── التأكيد والإلغاء ──
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const confirmPublish = () => {
    const balances = latest?.stationBalances;
    if (balances) {
      updateTanks(prev => prev.map(t => {
        const liters = balances[t.id];
        if (liters === undefined || !t.capacityLiters) return t;
        return { ...t, levelMeters: Math.min(t.maxLevelMeters || 1, (liters / t.capacityLiters) * (t.maxLevelMeters || 1)) };
      }));
    }
    publish();
    setConfirmOpen(false);
  };


  const card = 'rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card';

  // أنماط الأقسام (نفس رصيد الكاز)
  const sectionBox = 'rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_18px_-6px_rgba(15,23,42,0.08)] p-4 flex flex-col min-h-0';
  const sectionHeader = (Icon: React.ElementType, iconColor: string, title: string, subtitle: string) => (
    <div className="flex items-center justify-between gap-3 mb-3.5 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm ${iconColor} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-black text-slate-900 dark:text-white truncate">{title}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
        </div>
      </div>
    </div>
  );
  const shareBar = (p: number, color: string) => (
    <div className="h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.min(100, p)}%` }} />
    </div>
  );
  const pct = (v: number, total: number) => (total > 0 ? (v / total) * 100 : 0);
  const pctText = (p: number) => `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
  const stationTone = (p: number) =>
    p >= 50 ? { bar: 'bg-emerald-600 dark:bg-emerald-700/80', text: 'text-emerald-700 dark:text-emerald-300' }
      : p >= 25 ? { bar: 'bg-amber-400 dark:bg-amber-500/80', text: 'text-amber-600 dark:text-amber-300' }
        : { bar: 'bg-rose-400 dark:bg-rose-500/80', text: 'text-rose-600 dark:text-rose-300' };

  // أنماط نافذة الإدخال (نفس تسجيل يوم الكاز)
  const field =
    'w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all text-left';
  const fieldLabel = 'text-xs font-bold text-slate-700 dark:text-slate-200';
  const cardTitle = 'flex items-center gap-1.5 text-xs font-black text-emerald-800 dark:text-emerald-600 mb-2.5 pb-1.5 border-b border-slate-100 dark:border-slate-700';
  const cardNum = 'w-4 h-4 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-sans font-bold';

  // ── الكارتات: نفس ترتيب رصيد الكاز (السابق، الوارد، الاستهلاك، ثم الرصيد الحالي كارت رئيسي) ──
  const prevView = viewIndex > 0 ? computed[viewIndex - 1] : null;
  const neutralTone = 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  const goodTone = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
  const badTone = 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
  const compareChip = (today: number, yesterday: number | undefined, increaseIsGood: boolean) => {
    if (yesterday === undefined) return { chip: t('finance:ledger.noYesterday'), chipTone: neutralTone, chipTitle: undefined as string | undefined };
    const diff = today - yesterday;
    const chipTitle = t('finance:ledger.compareTitle', { yesterday: formatNumber(yesterday), today: formatNumber(today) });
    if (diff === 0) return { chip: `= ${t('finance:ledger.noChange')}`, chipTone: neutralTone, chipTitle };
    return { chip: `${diff > 0 ? '▲ +' : '▼ −'}${formatNumber(Math.abs(diff))}`, chipTone: (diff > 0) === increaseIsGood ? goodTone : badTone, chipTitle };
  };
  const kpis = view
    ? [
        {
          label: t('finance:ledger.previousBalance'), value: view.previous, icon: History,
          iconBg: 'text-slate-600 dark:text-slate-300', accent: 'from-slate-300 to-slate-500',
          note: t('finance:ledger.previousBalanceNote'), chip: view.date,
          chipTone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', chipTitle: undefined as string | undefined
        },
        {
          label: t('finance:ledger.inbound'), value: view.inboundQty, icon: ArrowDownToLine,
          iconBg: 'text-emerald-700 dark:text-emerald-400', accent: 'from-emerald-500 to-green-700',
          note: t('finance:saharaPetrol.inboundNote'),
          ...compareChip(view.inboundQty, prevView?.inboundQty, true)
        },
        {
          label: t('finance:ledger.dailyConsumption'), value: view.totalConsumption, icon: Flame,
          iconBg: 'text-rose-600 dark:text-rose-400', accent: 'from-rose-400 to-red-500',
          note: t('finance:saharaPetrol.consumptionNote'),
          ...compareChip(view.totalConsumption, prevView?.totalConsumption, false)
        }
      ]
    : [];

  return (
    <div className="space-y-4" dir="rtl">
      {/* ── شريط اليوم المعروض والأزرار (بدون كارت، نفس تصميم رصيد الكاز) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button type="button" disabled={viewIndex <= 0} onClick={() => { setViewId(computed[viewIndex - 1]?.id ?? null); setPickedFromTable(false); }} title={t('finance:ledger.prevDay')} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            <ChevronRight className="w-4 h-4 ltr:rotate-180" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <CalendarDays className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span className="font-mono font-black text-sm text-slate-900 dark:text-white">{view?.date ?? '—'}</span>
            {view && isLatestView && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">{t('finance:ledger.latestDay')}</span>
            )}
          </div>
          <button type="button" disabled={viewIndex >= computed.length - 1} onClick={() => { setViewId(viewIndex + 1 >= computed.length - 1 ? null : computed[viewIndex + 1].id); setPickedFromTable(false); }} title={t('finance:ledger.nextDay')} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
            <ChevronLeft className="w-4 h-4 ltr:rotate-180" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasPending && (
            <>
              <button type="button" onClick={() => setConfirmOpen(true)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-700/25 cursor-pointer active:scale-95 transition-all animate-pulse">
                <CheckCircle2 className="w-4 h-4" />
                {t('finance:ledger.confirmData')}
              </button>
              <button type="button" onClick={() => setDiscardOpen(true)} className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all">
                <XCircle className="w-4 h-4" />
                {t('finance:ledger.discard')}
              </button>
            </>
          )}
          {/* متوسط السعر (للعرض فقط) ونسبة التغير — مكانه في الرأس كما في رصيد الكاز */}
          {view && (() => {
            const p = price.pct !== null && Math.abs(price.pct) < 0.005 ? 0 : price.pct;
            const tone = p === null || p === 0 ? 'text-slate-400' : p > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400';
            return (
              <div
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5"
                title={price.twoDayAvg !== null ? `${t('finance:ledger.twoDayAvg')}: ${price.twoDayAvg.toFixed(1)} ${t('common:units.iqd')}` : t('finance:saharaPetrol.avgPrice')}
              >
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                {t('finance:ledger.price')}
                <span className="font-mono font-black text-emerald-800 dark:text-emerald-300">{price.avgPrice > 0 ? price.avgPrice.toFixed(1) : '—'}</span>
                <span className="text-[10px] text-slate-400">{t('common:units.iqd')}</span>
                {p !== null && (
                  <span dir="ltr" className={`ms-1 flex items-center gap-0.5 font-mono font-black text-[10.5px] ${tone}`}>
                    {p < 0 && <TrendingDown className="w-3 h-3" />}
                    {p > 0 && <TrendingUp className="w-3 h-3" />}
                    {pctLabel(p)}
                  </span>
                )}
              </div>
            );
          })()}
          {view && (
            <button type="button" onClick={() => openEdit(view)} className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <Pencil className="w-3.5 h-3.5" />
              {t('finance:ledger.editDay')}
            </button>
          )}
          <button type="button" onClick={openNew} className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-700/25 cursor-pointer active:scale-95 transition-all">
            <Plus className="w-4 h-4" />
            {t('finance:ledger.newDay')}
          </button>
        </div>
      </div>

      {!view ? (
        <div className={`${card} p-10 text-center`}>
          <Fuel className="w-10 h-10 mx-auto text-emerald-600 mb-3" />
          <div className="font-black text-slate-800 dark:text-slate-100">{t('finance:saharaPetrol.empty')}</div>
          <div className="text-xs text-slate-500 mt-1">{t('finance:saharaPetrol.emptyHint')}</div>
        </div>
      ) : (
        <>
          {/* ── الكارتات الأربعة (نفس ترتيب رصيد الكاز) ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {kpis.map(k => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-4 py-5 shadow-[0_4px_18px_-6px_rgba(15,23,42,0.08)]">
                  <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-l ${k.accent}`} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">{k.label}</span>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-2xl sm:text-[28px] leading-none font-black font-mono tracking-tight tabular-nums text-slate-900 dark:text-white">
                          {formatNumber(k.value)}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">{t('common:units.liter')}</span>
                      </div>
                    </div>
                    <div className={`w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm ${k.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{k.note}</span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10.5px] font-black font-mono ${k.chipTone}`} dir="ltr" title={k.chipTitle}>{k.chip}</span>
                  </div>
                </div>
              );
            })}

            {/* الرصيد الحالي: الكارت الرئيسي */}
            <div className={`relative overflow-hidden rounded-2xl px-4 py-5 text-white shadow-lg ${view.current < 0 ? 'bg-gradient-to-br from-red-600 to-rose-700 shadow-red-900/20' : 'bg-gradient-to-br from-emerald-700 via-emerald-800 to-green-900 shadow-emerald-900/25'}`}>
              <div className="absolute -top-14 -left-14 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white/75 block">{t('finance:ledger.currentBalance')}</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl sm:text-[28px] leading-none font-black font-mono tracking-tight tabular-nums">{formatNumber(view.current)}</span>
                    <span className="text-[11px] font-bold text-white/70">{t('common:units.liter')}</span>
                  </div>
                </div>
                <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <div className="relative mt-5 pt-3 border-t border-white/15 flex items-center justify-between gap-2">
                {/* يؤمن لغاية: الرصيد ÷ متوسط الاستهلاك اليومي (آخر 7 أيام)، وتاريخ النفاد المتوقع */}
                <span className="text-[11px] text-white/80 truncate" title={t('finance:saharaPetrol.avgConsumptionTitle', { value: formatNumber(Math.round(avgConsumption)) })}>
                  {coverageDays === null ? (
                    <>{t('finance:saharaPetrol.coversUntil')} <span className="font-mono font-black text-white">—</span></>
                  ) : (
                    <Trans t={t} i18nKey="finance:saharaPetrol.coversDays" count={coverageDays} values={{ days: formatNumber(coverageDays) }} components={{ 1: <span className="font-mono font-black text-white" /> }} />
                  )}
                </span>
                {coverageDate && (
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-white/15 text-[10.5px] font-black font-mono" title={t('finance:saharaPetrol.runOutDate')}>
                    {coverageDate}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── قسما الحركة اليومية وأرصدة المحطات ── */}
          <div className="flex-1 flex flex-col rounded-3xl bg-gradient-to-b from-slate-50 to-slate-100/70 dark:from-slate-900/80 dark:to-slate-950 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 lg:min-h-[320px]">
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

              {/* القسم 1: الاستهلاك اليومي — مصروف كل محطة */}
              <div className={sectionBox}>
                {sectionHeader(Flame, 'text-emerald-700 dark:text-emerald-600', t('finance:saharaPetrol.dailyMovement'), t('finance:saharaPetrol.dailyMovementHint'))}
                {stationRows.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-4">{t('finance:saharaPetrol.noTanks')}</div>
                ) : (
                  // الاستهلاك: رسم بياني فني للوارد والاستهلاك في الأعلى، ثم كمية كل محطة (لونها يتدرج من الأخضر للأحمر مع الحصة)، والمجموع
                  (() => {
                    const sorted = [...stationRows].sort((a, b) => b.consumption - a.consumption);
                    const heat = (p: number, l = 45) => `hsl(${Math.round(140 - 140 * Math.min(1, p / 100))} 65% ${l}%)`;
                    return (
                      <div className="flex-1 flex flex-col gap-3">
                        {/* ── الرسم البياني: كارت احترافي وهادئ للوارد والاستهلاك ── */}
                        <div className="relative flex-1 flex flex-col overflow-hidden rounded-2xl p-3.5 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800 shadow-sm">
                          {/* زخرفة شبكة نقاط خفيفة ومريحة للعين */}
                          <div className="absolute inset-0 opacity-[0.4] dark:opacity-[0.05] pointer-events-none [background-image:radial-gradient(#e2e8f0_1px,transparent_1px)] dark:[background-image:radial-gradient(white_1px,transparent_1px)] [background-size:16px_16px]" />

                          <div className="relative flex items-start justify-between gap-3">
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-bold text-slate-500 dark:text-emerald-100/70 tracking-wide">{t('finance:saharaPetrol.chartTitle')}</div>
                              <div className="flex items-center gap-4">
                                <div>
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#34d399]" />{t('finance:ledger.inbound')}</div>
                                  <div className="font-mono font-black text-lg leading-tight tabular-nums">{formatNumber(view.inboundQty)}</div>
                                </div>
                                <div className="w-px h-8 bg-slate-200 dark:bg-white/10" />
                                <div>
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500 dark:text-rose-300"><span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#fb7185]" />{t('finance:saharaPetrol.consumption')}</div>
                                  <div className="font-mono font-black text-lg leading-tight tabular-nums">{formatNumber(view.totalConsumption)}</div>
                                </div>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900">{t('finance:saharaPetrol.last7Days')}</span>
                          </div>

                          <div className="relative flex-1 min-h-40 mt-2" dir="ltr">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="petrolInGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.32} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                  </linearGradient>
                                  <linearGradient id="petrolOutGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.22} />
                                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.25)" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9.5, fontWeight: 700 }} axisLine={false} tickLine={false} reversed />
                                <YAxis orientation="right" tick={{ fill: '#94a3b8', fontSize: 9.5 }} axisLine={false} tickLine={false} width={36} tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                                <Tooltip
                                  cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
                                  content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const d = payload[0].payload as { date: string; inbound: number; consumption: number };
                                    return (
                                      <div dir="rtl" className="rounded-xl px-3 py-2 text-[11px] bg-white/95 dark:bg-slate-900/90 backdrop-blur-md ring-1 ring-slate-200 dark:ring-white/15 shadow-xl space-y-1 min-w-[140px]">
                                        <div className="font-mono font-bold text-slate-500 dark:text-white/70">{d.date}</div>
                                        <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-300 font-bold"><span>{t('finance:ledger.inbound')}</span><span className="font-mono font-black">{formatNumber(d.inbound)}</span></div>
                                        <div className="flex items-center justify-between gap-3 text-rose-500 dark:text-rose-300 font-bold"><span>{t('finance:saharaPetrol.consumption')}</span><span className="font-mono font-black">{formatNumber(d.consumption)}</span></div>
                                      </div>
                                    );
                                  }}
                                />
                                <Area type="monotone" dataKey="inbound" stroke="#10b981" strokeWidth={2.75} fill="url(#petrolInGrad)" style={{ filter: "drop-shadow(0 3px 5px rgba(16,185,129,0.35))" }}
                                  dot={chartData.length <= 3 ? { r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 } : false}
                                  activeDot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }} />
                                <Area type="monotone" dataKey="consumption" stroke="#f43f5e" strokeWidth={2.75} fill="url(#petrolOutGrad)" style={{ filter: "drop-shadow(0 3px 5px rgba(244,63,94,0.3))" }}
                                  dot={chartData.length <= 3 ? { r: 4, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 2 } : false}
                                  activeDot={{ r: 5, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 2 }} />
                              </AreaChart>
                            </ResponsiveContainer>
                            {chartData.length < 2 && (
                              <div className="absolute inset-x-0 top-2 text-center text-[10px] font-bold text-slate-400 pointer-events-none">{t('finance:saharaPetrol.chartFills')}</div>
                            )}
                          </div>
                        </div>

                        {/* ── كمية الاستهلاك لكل محطة ── */}
                        <div className="grid grid-cols-3 gap-2">
                          {sorted.map(st => {
                            const p = pct(st.consumption, view.totalConsumption);
                            const used = st.consumption > 0;
                            return (
                              <div
                                key={st.id}
                                className={`rounded-xl border px-2.5 py-2 bg-white dark:bg-slate-900/40 transition-colors ${used ? '' : 'opacity-55'}`}
                                style={{ borderColor: used ? heat(p, 80) : undefined }}
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: used ? heat(p) : '#cbd5e1' }} />
                                    <span className="text-[11.5px] font-extrabold text-slate-700 dark:text-slate-200 truncate">{st.name}</span>
                                  </span>
                                  <span className="text-[9.5px] font-black font-mono px-1 rounded" style={used ? { color: heat(p, 32), background: heat(p, 94) } : { color: '#94a3b8' }}>{pctText(p)}</span>
                                </div>
                                <div className="mt-1 font-mono font-black text-[15px] text-slate-900 dark:text-white tabular-nums">
                                  {formatNumber(st.consumption)} <span className="text-[9.5px] font-bold text-slate-400">{t('common:units.liter')}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-auto pt-2 flex items-center justify-between text-xs border-t border-dashed border-slate-200 dark:border-slate-700 shrink-0">
                          <span className="font-bold text-slate-500 dark:text-slate-400">{t('finance:saharaPetrol.totalConsumption')}</span>
                          <span className="font-mono font-black text-slate-900 dark:text-white">{formatNumber(view.totalConsumption)} <span className="text-[10px] text-slate-400">{t('common:units.liter')}</span></span>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* القسم 2: أرصدة المحطات */}
              <div className={sectionBox}>
                {sectionHeader(MapPin, 'text-blue-600 dark:text-blue-400', t('finance:ledger.stationBalances'), t('finance:ledger.stationBalancesHint'))}
                {stationRows.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-4">{t('finance:saharaPetrol.addTanksHint')}</div>
                ) : (
                  (() => {
                    // المحطة التي لها خزان بنزين: نسبة الامتلاء من السعة؛ وإلا حصتها من إجمالي الأرصدة
                    const totalBalance = stationRows.reduce((a, s) => a + s.balance, 0);
                    return (
                      <div className="flex flex-col gap-2.5">
                        <div className="grid grid-cols-3 gap-2">
                          {/* الأقل امتلاءً أولًا (المحطات التي فيها رصيد)، ثم الفارغة */}
                          {[...stationRows]
                            .sort((a, b) => (a.balance <= 0 ? 1 : 0) - (b.balance <= 0 ? 1 : 0) || (stationFill(a) ?? 100) - (stationFill(b) ?? 100))
                            .slice(0, 9).map(st => {
                            const byCapacity = st.capacity > 0;
                            const p = byCapacity ? pct(st.balance, st.capacity) : pct(st.balance, totalBalance);
                            const tone = byCapacity
                              ? stationTone(p)
                              : st.balance > 0
                                ? { bar: 'bg-gradient-to-l from-sky-400 to-blue-600', text: 'text-blue-600 dark:text-blue-400' }
                                : { bar: 'bg-slate-300 dark:bg-slate-600', text: 'text-slate-400' };
                            const empty = st.balance <= 0;
                            const critical = byCapacity && !empty && p < CRITICAL_PCT;
                            // أيام التغطية للمحطة = رصيدها ÷ متوسط استهلاكها اليومي
                            const avg = stationAvg(st.id);
                            const days = !empty && avg > 0 ? Math.floor(st.balance / avg) : null;
                            // لون خط الإبراز العلوي حسب الامتلاء (أحمر تحت 10%)
                            const accent = empty ? 'from-slate-200 to-slate-300' : critical ? 'from-rose-400 to-red-500' : p < 25 ? 'from-amber-300 to-amber-500' : p < 50 ? 'from-amber-400 to-yellow-500' : 'from-emerald-400 to-teal-500';
                            return (
                              <div
                                key={st.id}
                                title={byCapacity ? `${st.name}: ${formatNumber(st.balance)} / ${formatNumber(st.capacity)} ${t('common:units.liter')}` : `${st.name}: ${formatNumber(st.balance)} ${t('common:units.liter')}`}
                                className={`group relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 px-3 pt-3 pb-2.5 flex flex-col justify-between gap-2 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.12)] hover:shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)] hover:-translate-y-0.5 transition-all duration-200 ${empty ? 'opacity-60' : ''}`}
                              >
                                {/* خط إبراز علوي */}
                                <div className={`absolute top-0 inset-x-0 h-[3px] bg-gradient-to-l ${accent}`} />
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${empty ? 'bg-slate-100 text-slate-400 dark:bg-slate-800' : 'bg-slate-50 text-[#1d576a] ring-1 ring-slate-200 dark:bg-slate-800 dark:text-sky-300 dark:ring-slate-700'}`}>
                                      <MapPin className="w-3.5 h-3.5" />
                                    </span>
                                    <span className="text-[12px] font-extrabold text-slate-800 dark:text-slate-100 truncate">{st.name}</span>
                                  </div>
                                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono ${empty ? 'bg-slate-100 text-slate-400 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800 ' + tone.text}`}>{pctText(p)}</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                  {/* الرقم بالأحمر فقط إذا نزل الامتلاء تحت 10% */}
                                  <span className={`font-mono font-black text-lg sm:text-xl tabular-nums tracking-tight ${empty ? 'text-slate-400' : critical ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{formatNumber(st.balance)}</span>
                                  <span className="text-[10px] font-bold text-slate-400">{t('common:units.liter')}</span>
                                </div>
                                <div className="space-y-1">
                                  {shareBar(p, tone.bar)}
                                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                    <span className="truncate">
                                      {empty ? t('finance:saharaPetrol.noBalance') : days !== null ? t('finance:saharaPetrol.enoughFor', { count: days, days: formatNumber(days) }) : byCapacity ? t('finance:saharaPetrol.ofCapacity') : t('finance:saharaPetrol.ofTotal')}
                                    </span>
                                    {byCapacity && <span className="font-mono shrink-0">{formatNumber(st.capacity)}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* ── عازل فاصل بين قسم أرصدة المحطات وقسم الرصيد الأسبوعي ── */}
                <div className="my-4 border-t border-slate-200 dark:border-slate-700/60 shrink-0" />

                {/* ── عنوان الرصيد الأسبوعي ── */}
                <div className="mb-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-2.5 flex items-center justify-between shrink-0">
                  <span className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200">
                    <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    {t('finance:saharaPetrol.weeklyBalance')}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">{t('finance:saharaPetrol.last7Days')}</span>
                </div>

                <div className="shrink-0" ref={weeklyTableRef}>
                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-700 overflow-hidden">
                    <div className="max-h-[172px] overflow-y-auto">
                      <table className="w-full text-[11px]">
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            {[t('finance:ledger.form.date'), t('finance:ledger.previousBalance'), t('finance:ledger.inbound'), t('finance:saharaPetrol.consumption'), t('finance:ledger.currentBalance')].map(h => (
                              <th key={h} className="px-2 py-2 font-bold text-start whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...computed].slice(-7).reverse().map((r, idx) => {
                            const selected = r.id === view.id;
                            const isGray = idx % 2 === 1;
                            return (
                              <tr
                                key={r.id}
                                onClick={() => { const isLatest = r.id === latest?.id; setViewId(isLatest ? null : r.id); setPickedFromTable(!isLatest); }}
                                title={t('finance:saharaPetrol.viewDay')}
                                className={`border-t border-slate-100 dark:border-slate-800 cursor-pointer transition-colors ${
                                  isGray
                                    ? 'bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
                                    : 'bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/60'
                                }`}
                              >
                                <td className={`px-2 py-2 font-mono font-black whitespace-nowrap ${selected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                  {selected && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 me-1 align-middle" />}
                                  {r.date}
                                </td>
                                <td className="px-2 py-2 font-mono tabular-nums text-slate-600 dark:text-slate-300">{formatNumber(r.previous)}</td>
                                <td className="px-2 py-2 font-mono tabular-nums text-start text-emerald-700 dark:text-emerald-400"><span dir="ltr">{r.inboundQty ? `+${formatNumber(r.inboundQty)}` : '0'}</span></td>
                                <td className="px-2 py-2 font-mono tabular-nums text-start text-rose-600 dark:text-rose-400"><span dir="ltr">{r.totalConsumption ? `−${formatNumber(r.totalConsumption)}` : '0'}</span></td>
                                <td className="px-2 py-2 font-mono font-black tabular-nums text-slate-900 dark:text-white">{formatNumber(r.current)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* ── نموذج إضافة / تعديل يوم (نفس تبويب تسجيل يوم الكاز) ── */}
      {form && createPortal(
        <div className="no-print fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-150" dir="rtl" onClick={() => setForm(null)}>
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-[min(880px,94vw)] max-h-[96vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden font-cairo animate-in zoom-in-95 duration-150"
          >
            <div className="px-5 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-600 flex items-center justify-center shrink-0">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                    {form.id ? t('finance:saharaPetrol.form.editTitle') : t('finance:saharaPetrol.form.newTitle')}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('finance:saharaPetrol.form.formula')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className={`flex items-center gap-1.5 h-9 pe-1 ps-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 ${dateTaken ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}>
                  <CalendarDays className="w-4 h-4 text-emerald-700 shrink-0" />
                  <input
                    type="date"
                    aria-label={t('finance:ledger.form.date')}
                    className="bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white outline-none w-[118px]"
                    value={toInputDate(form.date)}
                    onChange={e => setForm({ ...form, date: fromInputDate(e.target.value) })}
                  />
                </label>
                <button type="button" onClick={() => setForm(null)} aria-label={t('common:actions.close')} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 cursor-pointer">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-50/40 dark:bg-slate-900/40">
              {/* 1. الرصيد السابق والرصيد الحالي المحسوب */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5">
                <div className={cardTitle}><span className={cardNum}>1</span><Wallet className="w-3.5 h-3.5" /><span>{t('finance:ledger.form.balance')}</span></div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-stretch">
                  {/* الرصيد السابق: تلقائي من اليوم الذي قبله، ويصبح قابلًا للإدخال عند التصحيح */}
                  <div className="sm:col-span-4 relative overflow-hidden rounded-2xl p-4 bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-900/50 flex flex-col">
                    <div className="relative flex items-center justify-center min-h-[28px]">
                      <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-600">{t('finance:ledger.previousBalance')}</div>
                      <button
                        type="button"
                        onClick={() => (form.prevEditing ? commitPrevious() : startEditPrevious())}
                        title={form.prevEditing ? t('common:actions.save') : t('common:actions.edit')}
                        aria-label={form.prevEditing ? t('common:actions.save') : t('common:actions.edit')}
                        className={`absolute end-0 top-0 w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${form.prevEditing ? 'bg-emerald-700 hover:bg-emerald-800 border-emerald-700 text-white shadow-sm' : 'bg-white/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'}`}
                      >
                        {form.prevEditing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="relative flex-1 flex items-center justify-center mt-1">
                      {form.prevEditing ? (
                        <input
                          autoFocus
                          inputMode="numeric"
                          dir="ltr"
                          className="w-full h-11 px-3 rounded-xl text-center bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 focus:ring-2 focus:ring-emerald-300/60 outline-none text-xl font-black font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 placeholder:text-sm placeholder:font-bold"
                          value={form.previous}
                          placeholder={t('finance:ledger.form.openingBalance')}
                          onChange={e => setForm({ ...form, previous: withCommas(e.target.value) })}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitPrevious(); } }}
                        />
                      ) : (
                        <div className="flex items-baseline justify-center gap-1.5">
                          <span className="text-3xl font-black font-mono tracking-tight tabular-nums text-slate-800 dark:text-slate-100" dir="ltr">
                            {formatNumber(formPrevious)}
                          </span>
                          <span className="text-xs font-bold text-emerald-700/70 dark:text-emerald-600/70">{t('common:units.liter')}</span>
                        </div>
                      )}
                    </div>
                    <div className="relative mt-3 pt-2.5 border-t border-emerald-100 dark:border-emerald-900/40 text-[10.5px] font-bold text-emerald-800/80 dark:text-emerald-600/80 text-center">
                      {form.prevEditing
                        ? t('finance:ledger.form.enterThenSave')
                        : form.editPrevious || autoPrevious === null
                          ? autoPrevious === null ? t('finance:ledger.form.openingBalance') : t('finance:ledger.form.manuallyEdited')
                          : t('finance:ledger.form.fromCurrentOf', { date: prevRecord?.date ?? '' })}
                    </div>
                  </div>

                  {/* الرصيد الحالي */}
                  <div className={`sm:col-span-6 relative overflow-hidden rounded-2xl p-4 text-white shadow-lg flex flex-col ${formCurrent < 0 ? 'bg-gradient-to-br from-red-600 to-rose-700 shadow-red-900/20' : 'bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-700 shadow-emerald-900/20'}`}>
                    <div className="absolute inset-0 opacity-[0.12] pointer-events-none [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:14px_14px]" />
                    <div className="absolute -top-16 -left-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-20 -right-10 w-48 h-48 rounded-full border-[18px] border-white/[0.06] pointer-events-none" />
                    <div className="absolute top-0 inset-x-6 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />
                    <div className="relative flex-1 min-h-[118px] flex flex-col items-center justify-center text-center gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-white/80">
                        <span className="w-6 h-6 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center">
                          <Wallet className="w-3.5 h-3.5" />
                        </span>
                        {t('finance:ledger.currentBalance')}
                      </div>
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-[40px] font-black font-mono tracking-tight tabular-nums leading-none [text-shadow:0_2px_12px_rgba(0,0,0,0.18)]" dir="ltr">{formatNumber(formEmpty ? 0 : formCurrent)}</span>
                        <span className="text-sm font-bold text-white/70">{t('common:units.liter')}</span>
                      </div>
                      {!formEmpty && (() => {
                        const change = formCurrent - formPrevious;
                        return (
                          <div className="flex items-center gap-2 text-[10.5px]">
                            <span className={`px-2 py-0.5 rounded-full font-black font-mono border ${change > 0 ? 'bg-emerald-400/20 border-emerald-200/30 text-emerald-50' : change < 0 ? 'bg-rose-400/25 border-rose-200/30 text-rose-50' : 'bg-white/10 border-white/20 text-white/80'}`} dir="ltr">
                              {change > 0 ? '▲ +' : change < 0 ? '▼ ' : ''}{formatNumber(change)}
                            </span>
                            <span className="text-white/65 font-bold">{t('finance:ledger.form.vsPrevious')}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* طريقة الإدخال: يدوي أو رفع ملف */}
                  <div className="sm:col-span-2 rounded-2xl p-2 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 flex sm:flex-col gap-2">
                    {([
                      ['manual', t('finance:ledger.form.manual'), PenLine],
                      ['upload', t('finance:ledger.form.upload'), Upload]
                    ] as const).map(([k, label, Icon]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setEntryMode(k)}
                        title={k === 'manual' ? t('finance:ledger.form.manualHint') : t('finance:ledger.form.uploadHint')}
                        className={`flex-1 min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-1 text-[10.5px] font-bold cursor-pointer transition-all ${entryMode === k ? 'bg-emerald-700 text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-slate-700'}`}
                      >
                        <Icon className="w-5 h-5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {entryMode === 'upload' && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5 space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xlsm,.xls,.pdf"
                    className="hidden"
                    onChange={e => { handleUpload(e.target.files?.[0]); e.target.value = ''; }}
                  />
                  <button
                    type="button"
                    disabled={upload.status === 'loading'}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files?.[0]); }}
                    className="w-full rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 px-4 py-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer disabled:cursor-wait transition-colors"
                  >
                    {upload.status === 'loading' ? (
                      <>
                        <Loader2 className="w-7 h-7 text-emerald-700 animate-spin" />
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('finance:ledger.upload.reading')}</span>
                        <span className="text-[11px] text-slate-500">{upload.fileName}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-7 h-7 text-emerald-700" />
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('finance:saharaPetrol.upload.choose')}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('finance:saharaPetrol.upload.chooseHint')}</span>
                      </>
                    )}
                  </button>
                  {upload.status === 'error' && (
                    <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      {upload.message}
                    </div>
                  )}
                  {upload.status === 'done' && (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 px-3 py-2 space-y-1 text-xs">
                      <div className="flex items-center gap-2 font-black text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />
                        {t('finance:ledger.upload.filled', { count: upload.filled })}
                      </div>
                      {upload.unmatched.length > 0 && (
                        <div className="font-bold text-amber-700 dark:text-amber-300">
                          {t('finance:saharaPetrol.upload.unmatched', { list: fmtList(upload.unmatched) })}
                        </div>
                      )}
                      {upload.notes && <div className="text-slate-600 dark:text-slate-300">{upload.notes}</div>}
                    </div>
                  )}
                </div>
              )}

              {/* 2. الاستهلاك اليومي */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5">
                <div className={cardTitle}>
                  <span className={cardNum}>2</span><Flame className="w-3.5 h-3.5" /><span>{t('finance:ledger.dailyConsumption')}</span>
                  <span className="ms-auto font-mono text-[10.5px] text-emerald-700">{t('finance:saharaPetrol.total')}: {formatNumber(formConsumption)}</span>
                </div>
                {stations.length === 0 ? (
                  <p className="text-xs text-slate-400">{t('finance:saharaPetrol.noTanks')}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {stations.map((st, i) => (
                      <label key={st.id} className="space-y-1">
                        <div className="h-5 flex items-center"><span className={`${fieldLabel} truncate`}>{t('finance:ledger.form.withLiters', { label: st.name })}</span></div>
                        <input
                          autoFocus={i === 0 && !form.prevEditing}
                          inputMode="numeric"
                          dir="ltr"
                          className={field}
                          value={form.consumption[st.id] ?? ''}
                          placeholder="0"
                          onChange={e => setForm({ ...form, consumption: { ...form.consumption, [st.id]: withCommas(e.target.value) } })}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. أرصدة المحطات */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5">
                <div className={cardTitle}>
                  <span className={cardNum}>3</span><MapPin className="w-3.5 h-3.5" /><span>{t('finance:ledger.stationBalances')}</span>
                  <span className="ms-auto font-normal text-[10.5px] text-slate-500 dark:text-slate-400">
                    {!prevRecord || !computed.some(r => r.date > form.date && r.id !== form.id) ? t('finance:ledger.form.stationsLatest') : t('finance:ledger.form.stationsPast')}
                  </span>
                </div>
                {stations.length === 0 ? (
                  <p className="text-xs text-slate-400">{t('finance:ledger.noStations')}</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {stations.map(st => {
                      const over = st.capacity > 0 && num(form.balances[st.id] || '') > st.capacity;
                      return (
                        <label key={st.id} className="space-y-1">
                          <div className="h-5 flex items-center"><span className={`${fieldLabel} truncate`}>{st.name}</span></div>
                          <input
                            inputMode="numeric"
                            dir="ltr"
                            className={`${field} ${over ? '!border-red-500 !ring-red-500' : ''}`}
                            value={form.balances[st.id] ?? ''}
                            placeholder="0"
                            title={`${t('finance:ledger.form.capacity')}: ${formatNumber(st.capacity)} ${t('common:units.liter')}`}
                            onChange={e => setForm({ ...form, balances: { ...form.balances, [st.id]: withCommas(e.target.value) } })}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
                {overCapacity.length > 0 && (
                  <p className="mt-2 text-xs font-bold text-red-600">
                    {t('finance:ledger.form.overCapacityList', { list: fmtList(overCapacity.map(s => `${s.name} (${formatNumber(s.capacity)})`)) })}
                  </p>
                )}
              </div>

              {/* 4. الوارد */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5">
                <div className={cardTitle}><span className={cardNum}>4</span><Truck className="w-3.5 h-3.5" /><span>{t('finance:ledger.inbound')}</span></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <label className="space-y-1">
                    <div className="h-5 flex items-center"><span className={fieldLabel}>{t('finance:saharaPetrol.form.externalL')}</span></div>
                    <input inputMode="numeric" dir="ltr" className={field} value={form.inboundQty} placeholder="0" onChange={e => setForm({ ...form, inboundQty: withCommas(e.target.value) })} />
                  </label>
                  <label className="space-y-1">
                    <div className="h-5 flex items-center gap-1.5">
                      <span className={fieldLabel}>{t('finance:saharaPetrol.form.internalL')}</span>
                      <span className="text-[9.5px] font-bold text-slate-400">{t('finance:saharaPetrol.form.balanceOnly')}</span>
                    </div>
                    <input
                      inputMode="numeric"
                      dir="ltr"
                      className={field}
                      value={form.inboundInternal}
                      placeholder="0"
                      title={t('finance:saharaPetrol.form.internalHint')}
                      onChange={e => setForm({ ...form, inboundInternal: withCommas(e.target.value) })}
                    />
                  </label>
                  <label className="space-y-1">
                    <div className="h-5 flex items-center"><span className={fieldLabel}>{t('finance:saharaPetrol.form.pricePerLiter')}</span></div>
                    <input inputMode="decimal" dir="ltr" className={field} value={form.inboundPrice} placeholder="0" onChange={e => setForm({ ...form, inboundPrice: withCommas(e.target.value) })} />
                  </label>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button type="button" onClick={clearData} title={t('finance:saharaPetrol.form.clearHint')} className="px-3.5 py-2.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
                  <Eraser className="w-4 h-4" />
                  {t('finance:ledger.form.clear')}
                </button>
                {dateTaken ? (
                  <p className="text-xs font-bold text-red-600">{t('finance:ledger.form.duplicate')}</p>
                ) : !form.editPrevious && autoPrevious === null && !form.previous.trim() ? (
                  <p className="text-xs font-bold text-amber-600">{t('finance:ledger.form.noPrevious')}</p>
                ) : overCapacity.length > 0 ? (
                  <p className="text-xs font-bold text-red-600">{t('finance:ledger.form.overCapacity')}</p>
                ) : num(form.inboundQty) > 0 && !num(form.inboundPrice) ? (
                  <p className="text-xs font-bold text-amber-600">{t('finance:saharaPetrol.form.missingPrice')}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2.5">
                <button type="button" onClick={() => setForm(null)} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer">
                  {t('common:actions.cancel')}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!canSave}
                  className="px-6 sm:px-8 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-900/20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" />
                  {form.id ? t('common:actions.saveChanges') : t('finance:ledger.form.saveDay')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── نافذة تأكيد البيانات ── */}
      {confirmOpen && latest && createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-150" dir="rtl" onClick={() => setConfirmOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5.5 h-5.5" />
              </div>
              <div className="space-y-1">
                <div className="font-black text-slate-900 dark:text-white">{t('finance:ledger.confirm.title')}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <Trans t={t} i18nKey="finance:saharaPetrol.confirmText" values={{ date: latest.date }} components={{ 1: <span className="font-mono font-black text-slate-800 dark:text-slate-100" /> }} />
                </p>
              </div>
            </div>
            <div className="mx-5 mb-4 grid grid-cols-3 gap-2 text-center">
              {[
                { label: t('finance:ledger.currentBalance'), value: latest.current },
                { label: t('finance:ledger.dailyConsumption'), value: latest.totalConsumption },
                { label: t('finance:ledger.inbound'), value: latest.inboundQty }
              ].map(c => (
                <div key={c.label} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 px-2 py-2">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{c.label}</div>
                  <div className="font-mono font-black text-sm text-slate-900 dark:text-white tabular-nums">{formatNumber(c.value)}</div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button type="button" onClick={() => setConfirmOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer">
                {t('finance:ledger.back')}
              </button>
              <button type="button" onClick={confirmPublish} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-900/20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all">
                <CheckCircle2 className="w-4 h-4" />
                {t('finance:ledger.confirm.yes')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── نافذة إلغاء العملية ── */}
      {discardOpen && createPortal(
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-150" dir="rtl" onClick={() => setDiscardOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <XCircle className="w-5.5 h-5.5" />
              </div>
              <div className="space-y-1">
                <div className="font-black text-slate-900 dark:text-white">{t('finance:ledger.discardDialog.title')}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t('finance:saharaPetrol.discardText')}
                </p>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button type="button" onClick={() => setDiscardOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer">
                {t('finance:ledger.back')}
              </button>
              <button type="button" onClick={() => { discard(); setViewId(null); setDiscardOpen(false); }} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-black shadow-lg shadow-rose-900/20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all">
                <XCircle className="w-4 h-4" />
                {t('finance:ledger.discardDialog.yes')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* عدد الأيام المسجّلة */}
      {records.length > 0 && <div className="text-[11px] text-slate-400 text-center">{t('finance:saharaPetrol.recordedDays')}: <span className="font-mono font-bold">{records.length}</span></div>}
    </div>
  );
};

export default SaharaPetrolView;
