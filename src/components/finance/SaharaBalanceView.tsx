import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DateRangeCalendar } from '../ui/DateRangeCalendar';
import {
  History,
  ArrowDownToLine,
  Flame,
  Wallet,
  Tractor,
  MapPin,
  Truck,
  Building2,
  Globe,
  Store,
  Repeat,
  Plus,
  Pencil,
  Save,
  X,
  Eraser,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Check,
  CheckCircle2,
  Coins,
  ImagePlus,
  Loader2,
  PenLine,
  Upload,
  Sparkles,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';
import { computeDailyBuys, ownSaharaDeliveries } from '../../lib/inboundPrice';
import { isSpreadsheetOrPdf, readSaharaReportFile, matchStation } from '../../lib/saharaReportFile';
import { formatNumber, getBusinessDate } from '../../lib/utils';
import { useTranslation, Trans } from 'react-i18next';
import { fmtList } from '../../i18n/format';
import {
  useSaharaLedger,
  computeSahara,
  SAHARA_EXTERNAL_SOURCES,
  SaharaExternalSource,
  SaharaLedgerRecord
} from '../../lib/saharaLedger';
import { useCentralTanks, resolveSaharaGasoilSectionKey, tankLiters } from '../../lib/centralTanks';
import { OFFICIAL_TABLE_TANK_UNITS } from '../tanks/TanksOverview';

/** كتابة الأرقام بفوارز أثناء الإدخال */
const withCommas = (v: string) => {
  const digits = v.replace(/[^\d]/g, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
};
const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(/,/g, '')));

/**
 * خانة رقم بفوارز تحافظ على موضع المؤشر: بعد إعادة التنسيق يعود المؤشر بعد نفس عدد الأرقام،
 * والحذف بجانب الفاصلة يحذف الرقم المجاور بدل الفاصلة (بدل أن يقفز المؤشر لآخر الرقم).
 */
type NumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onValue: (v: string) => void;
};
const NumberInput: React.FC<NumberInputProps> = ({ value, onValue, onKeyDown, ...rest }) => {
  const ref = React.useRef<HTMLInputElement>(null);
  const digitsBeforeCaret = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    const target = digitsBeforeCaret.current;
    if (!el || target === null || document.activeElement !== el) return;
    let pos = 0;
    for (let seen = 0; pos < el.value.length && seen < target; pos++) if (/\d/.test(el.value[pos])) seen++;
    el.setSelectionRange(pos, pos);
    digitsBeforeCaret.current = null;
  });

  const apply = (raw: string, caret: number) => {
    digitsBeforeCaret.current = raw.slice(0, caret).replace(/\D/g, '').length;
    onValue(withCommas(raw));
  };

  return (
    <input
      {...rest}
      ref={ref}
      inputMode="numeric"
      dir="ltr"
      value={value}
      onChange={e => apply(e.target.value, e.target.selectionStart ?? e.target.value.length)}
      onKeyDown={e => {
        const el = e.currentTarget;
        const s = el.selectionStart ?? 0;
        if (s === el.selectionEnd) {
          if (e.key === 'Backspace' && el.value[s - 1] === ',') {
            e.preventDefault();
            apply(el.value.slice(0, s - 2) + el.value.slice(s), s - 2);
          } else if (e.key === 'Delete' && el.value[s] === ',') {
            e.preventDefault();
            apply(el.value.slice(0, s + 1) + el.value.slice(s + 2), s + 1);
          }
        }
        onKeyDown?.(e);
      }}
    />
  );
};

/** أيقونات مخصصة بنفس نمط lucide: دجاجة للمزارع ومولدة ديزل للمولدات */
const iconProps = { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const ChickenIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...iconProps} className={className}>
    {/* العُرف والمنقار والدلّاية مملوءة حتى يبقى الرأس واضحًا بالحجم الصغير */}
    <path d="M8.6 9.6C7.7 7.8 8.6 6.2 10.3 6.5c.3-2 2.6-2.6 3.6-1 1.2-1.2 3.4-.4 3 1.8l-.8 2" fill="currentColor" />
    <path d="M7 22v-8.5a5.5 5.5 0 0 1 11 0V15a3 3 0 0 1-3 3v4" />
    <path d="M18 12l4 1.6-4 1.5z" fill="currentColor" />
    <path d="M16.3 18c.2 1.6.8 2.6 1.6 2.4.8-.2.9-1.7.2-3.3" fill="currentColor" />
    <circle cx="14.2" cy="12.2" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const DieselGeneratorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg {...iconProps} className={className}>
    <rect x="3" y="8" width="18" height="11" rx="1.5" />
    <path d="M17 8V4h2.5" />
    <rect x="5.5" y="11" width="5" height="5" rx=".5" />
    <path d="m16 11-2 3h3l-2 3" />
    <path d="M2 21h20" />
  </svg>
);

const toInputDate = (d: string) => d.replace(/\//g, '-');
const fromInputDate = (d: string) => d.replace(/-/g, '/');

const EXTERNAL_ICONS: Record<SaharaExternalSource, React.ComponentType<{ className?: string }>> = {
  government: Globe,
  etihad: Building2,
  commercial: Store
};

interface FormState {
  id: string | null;
  date: string;
  previous: string;
  editPrevious: boolean; // false = الرصيد السابق تلقائي من اليوم الذي قبله
  prevEditing: boolean; // خانة الرصيد السابق مفتوحة للإدخال (قبل الضغط على حفظ)
  vehicles: string;
  farms: string;
  generators: string;
  external: Partial<Record<SaharaExternalSource, string>>; // المصادر المختارة فقط
  sales: string;
  stations: Record<string, string>; // { tankId: لتر }
  currentOverride: string; // الرصيد الحالي من ملف الكشف ('' = يُحسب تلقائيًا)
  /** مجاميع الحقول لحظة تحميل رصيد الكشف: أي زيادة أو نقص بعدها ينعكس على الرصيد الحالي */
  overrideBase: { stations: number; inbound: number; consumption: number } | null;
}

/** مجاميع حقول النموذج المرتبطة بالرصيد الحالي */
const formStationsSum = (f: Pick<FormState, 'stations'>) => Object.values(f.stations).reduce((a, v) => a + num(v || ''), 0);
const formInbound = (f: Pick<FormState, 'external'>) =>
  Object.values(f.external).reduce((a, v) => a + num(v || ''), 0);
const formConsumption = (f: Pick<FormState, 'vehicles' | 'farms' | 'generators' | 'sales'>) =>
  num(f.vehicles) + num(f.farms) + num(f.generators) + num(f.sales);

const MAX_STATION_SLOTS = 8;

export const SaharaBalanceView: React.FC = () => {
  const { t } = useTranslation(['finance', 'common']);
  const { records, computed, latest, update, hasPending, publish, discard } = useSaharaLedger();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  // السعر: للعرض فقط، يتحدث تلقائيًا من سعر شراء اليوم (آخر يوم في وارد الصحاري)،
  // ونسبة التغير = معدل اليومين مقارنة بسعر اليوم السابق (نفس كارت "شراء اليوم" في الرئيسية)
  const { saharaDeliveries } = useFuelData();
  const buys = useMemo(() => computeDailyBuys(ownSaharaDeliveries(saharaDeliveries)), [saharaDeliveries]);
  const [priceOpen, setPriceOpen] = useState(false);

  // اليوم المعروض (افتراضيًا آخر يوم مسجّل)
  const [viewId, setViewId] = useState<string | null>(null);
  const viewIndex = viewId ? computed.findIndex(r => r.id === viewId) : computed.length - 1;
  const view = viewIndex >= 0 ? computed[viewIndex] : latest;
  // تقويم اختيار اليوم (الأيام المسجّلة عليها علامة)
  const [datePop, setDatePop] = useState<{ top: number; left: number } | null>(null);
  const recordedDates = useMemo(() => new Set(computed.map(r => r.date)), [computed]);

  // أرصدة المحطات: مباشرة من منظومة الخزانات (قسم كاز شركة صحاري كربلاء)
  const [centralTanks, updateTanks] = useCentralTanks(OFFICIAL_TABLE_TANK_UNITS);
  const liveStations = useMemo(() => {
    const key = resolveSaharaGasoilSectionKey(centralTanks);
    if (!key) return [];
    return centralTanks
      .filter(t => t.sectionKey === key)
      .map(t => ({ id: t.id, name: t.name.replace(/^موقع\s+/, ''), balance: tankLiters(t), capacity: t.capacityLiters }));
  }, [centralTanks]);
  // آخر يوم: الأرصدة الحية من الخزانات؛ يوم سابق: الأرصدة المحفوظة معه
  const isLatestView = !!view && view.id === latest?.id;
  // قبل التأكيد لم تُنقل أرصدة آخر يوم للخزانات بعد، فتُعرض المحفوظة معه
  const stations = (!isLatestView || hasPending) && view?.stationBalances
    ? liveStations.map(s => ({ ...s, balance: view.stationBalances![s.id] ?? s.balance }))
    : liveStations;
  const stationSlots = stations.length > MAX_STATION_SLOTS
    ? [...stations].sort((a, b) => b.balance - a.balance).slice(0, MAX_STATION_SLOTS)
    : stations;

  const [form, setForm] = useState<FormState | null>(null);

  // طريقة الإدخال: يدوي أو رفع صورة الكشف (الرفع يعبّئ الخانات ثم تُراجع وتُحفظ)
  const [entryMode, setEntryMode] = useState<'manual' | 'upload'>('manual');
  const [upload, setUpload] = useState<
    | { status: 'idle' }
    | { status: 'loading'; fileName: string }
    | { status: 'error'; message: string }
    | { status: 'done'; fileName: string; filled: number; unmatched: string[]; notes: string }
  >({ status: 'idle' });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File | undefined) => {
    if (!file || !form) return;
    setUpload({ status: 'loading', fileName: file.name });
    try {
      // Excel و PDF يُقرآن داخل المتصفح مباشرة (الصور غير مدعومة حاليًا)
      if (!isSpreadsheetOrPdf(file)) {
        setUpload({ status: 'error', message: t('finance:saharaBalance.upload.imagesUnsupported') });
        return;
      }
      const names = liveStations.map(s => s.name);
      const r = await readSaharaReportFile(file, names);
      const val = (n: number) => (n > 0 ? withCommas(String(Math.round(n))) : '');
      const stations = { ...form.stations };
      const unmatched: string[] = [];
      let filled = 0;
      for (const st of r.stations) {
        const matched = (st.matchedStation && matchStation(st.matchedStation, names)) || matchStation(st.nameInImage, names);
        const target = liveStations.find(ls => ls.name === matched);
        if (target) {
          stations[target.id] = withCommas(String(Math.round(st.balance)));
          filled++;
        } else {
          unmatched.push(`${st.nameInImage} (${formatNumber(Math.round(st.balance))})`);
        }
      }
      const external: FormState['external'] = {};
      if (r.inboundExternal > 0) external.government = val(r.inboundExternal);
      if (r.inboundEtihad > 0) external.etihad = val(r.inboundEtihad);
      const fields = [r.vehicles, r.farms, r.generators, r.sentToFarms, r.inboundExternal, r.inboundEtihad];
      filled += fields.filter(n => n > 0).length;
      // الرصيد السابق = "المدوّر السابق" في الكشف (مجموع الرصيد السابق لكل المواقع)؛ إن طابق التلقائي يبقى تلقائيًا
      const carried = r.previousCarried;
      const prevPatch: Partial<FormState> = carried !== undefined
        ? (autoPrevious !== null && Math.round(carried) === Math.round(autoPrevious)
          ? { editPrevious: false, prevEditing: false, previous: '' }
          : { editPrevious: true, prevEditing: false, previous: withCommas(String(Math.round(carried))) })
        : {};
      if (carried !== undefined) filled++;
      setForm(f => f && {
        ...f,
        ...prevPatch,
        currentOverride: (r.tableTotal ?? r.currentInFile) !== undefined ? withCommas(String(Math.round((r.tableTotal ?? r.currentInFile)!))) : f.currentOverride,
        overrideBase: (r.tableTotal ?? r.currentInFile) !== undefined
          ? {
              stations: Object.values(stations).reduce((a, v) => a + num(v || ''), 0),
              inbound: r.inboundExternal + r.inboundEtihad,
              consumption: r.vehicles + r.farms + r.generators + r.sentToFarms
            }
          : f.overrideBase,
        vehicles: val(r.vehicles),
        farms: val(r.farms),
        generators: val(r.generators),
        sales: val(r.sentToFarms),
        external,
        stations
      });

      // التحقق: السابق + الوارد − الاستهلاك يجب أن يساوي "الرصيد الحالي" في الكشف
      let check = '';
      if (r.currentInFile !== undefined) {
        const previous = carried ?? autoPrevious ?? 0;
        const inbound = r.inboundExternal + r.inboundEtihad;
        const consumption = r.vehicles + r.farms + r.generators + r.sentToFarms;
        const diff = Math.round(previous + inbound - consumption - r.currentInFile);
        check = diff === 0
          ? `✓ ${t('finance:saharaBalance.upload.checkMatch', { value: formatNumber(Math.round(r.currentInFile)) })}`
          : `⚠ ${t('finance:saharaBalance.upload.checkMismatch', { value: formatNumber(Math.round(r.currentInFile)), diff: formatNumber(diff) })}`;
      }
      setUpload({ status: 'done', fileName: file.name, filled, unmatched, notes: [check, r.notes].filter(Boolean).join(' — ') });
    } catch (e) {
      setUpload({ status: 'error', message: e instanceof Error ? e.message : t('finance:ledger.upload.parseFailed') });
    }
  };

  const openNew = () => {
    setEntryMode('manual');
    setUpload({ status: 'idle' });
    // اليوم الجديد: تاريخ اليوم، أو اليوم التالي لآخر يوم مسجّل إن كان اليوم مسجّلًا
    const today = getBusinessDate();
    let date = today;
    if (latest && latest.date >= today) {
      const d = new Date(toInputDate(latest.date) + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      date = fromInputDate(d.toISOString().slice(0, 10));
    }
    setForm({
      id: null,
      date,
      previous: '',
      editPrevious: !latest,
      prevEditing: !latest,
      vehicles: '',
      farms: '',
      generators: '',
      external: {},
      sales: '',
      stations: Object.fromEntries(liveStations.map(s => [s.id, ''])), // اليوم الجديد يبدأ بخانات فارغة
      currentOverride: '',
      overrideBase: null
    });
  };

  const openEdit = (r: SaharaLedgerRecord) => {
    setEntryMode('manual');
    setUpload({ status: 'idle' });
    const external: FormState['external'] = {};
    (Object.keys(r.inboundExternal || {}) as SaharaExternalSource[]).forEach(k => {
      external[k] = withCommas(String(r.inboundExternal[k] || ''));
    });
    const s = (v: number) => (v ? withCommas(String(v)) : '');
    setForm({
      id: r.id,
      date: r.date,
      previous: r.previousOverride != null ? withCommas(String(r.previousOverride)) : '',
      editPrevious: r.previousOverride != null,
      prevEditing: false,
      vehicles: s(r.vehicles),
      farms: s(r.farms),
      generators: s(r.generators),
      external,
      sales: s(r.sales),
      stations: Object.fromEntries(liveStations.map(st => [st.id, withCommas(String(r.stationBalances?.[st.id] ?? st.balance))])),
      currentOverride: r.currentOverride != null ? withCommas(String(r.currentOverride)) : '',
      overrideBase: null
    });
    // الأساس يُحسب من قيم النموذج بعد تعبئتها
    setForm(f => f && (f.currentOverride.trim() !== ''
      ? { ...f, overrideBase: { stations: formStationsSum(f), inbound: formInbound(f), consumption: formConsumption(f) } }
      : f));
  };

  // السجل الناتج عن النموذج ومعاينته محسوبًا ضمن كل السجلات
  const draft: SaharaLedgerRecord | null = form && {
    id: form.id || 'draft',
    date: form.date,
    vehicles: num(form.vehicles),
    farms: num(form.farms),
    generators: num(form.generators),
    inboundExternal: Object.fromEntries(
      Object.entries(form.external).map(([k, v]) => [k, num(v || '')])
    ) as SaharaLedgerRecord['inboundExternal'],
    sales: num(form.sales),
    stationBalances: Object.fromEntries(Object.entries(form.stations).map(([id, val]) => [id, num(val)])),
    currentOverride: form.currentOverride.trim() !== ''
      ? num(form.currentOverride)
        + (form.overrideBase
          ? (formStationsSum(form) - form.overrideBase.stations)
            + (formInbound(form) - form.overrideBase.inbound)
            - (formConsumption(form) - form.overrideBase.consumption)
          : 0)
      : null,
    previousOverride: (form.editPrevious || form.prevEditing) && form.previous.trim() !== '' ? num(form.previous) : null
  };
  const preview = draft
    ? computeSahara([...records.filter(r => r.id !== form!.id), draft]).find(r => r.id === draft.id) ?? null
    : null;
  // لا بيانات مُدخلة بعد (يوم جديد أو بعد مسح البيانات): الرصيد الحالي يظهر صفرًا حتى يبدأ الإدخال
  const formEmpty = !!form
    && form.currentOverride.trim() === ''
    && formConsumption(form) === 0
    && formInbound(form) === 0
    && formStationsSum(form) === 0;
  // الرصيد السابق التلقائي = الرصيد الحالي لآخر يوم قبل تاريخ النموذج
  const prevSource = form ? computed.filter(r => r.id !== form.id && r.date < form.date).pop() : undefined;
  const autoPrevious = prevSource?.current ?? null;
  const prevSourceDate = prevSource?.date ?? null;
  const dateTaken = !!form && records.some(r => r.date === form.date && r.id !== form.id);
  // محطات تجاوز رصيدها سعة خزانها
  const overCapacity = form ? liveStations.filter(s => num(form.stations[s.id] || '') > s.capacity) : [];
  const canSave = !!form && !dateTaken && !!form.date && (autoPrevious !== null || form.editPrevious || form.prevEditing) && overCapacity.length === 0;

  // الرصيد السابق: تعديل ← إدخال، حفظ ← تثبيت (القيمة الفارغة أو المطابقة للتلقائي ترجع تلقائية)
  const startEditPrevious = () => {
    if (!form) return;
    const current = form.editPrevious ? form.previous : autoPrevious !== null ? withCommas(String(autoPrevious)) : '';
    setForm({ ...form, prevEditing: true, previous: current });
  };
  const commitPrevious = () => {
    if (!form) return;
    const empty = form.previous.trim() === '';
    const sameAsAuto = autoPrevious !== null && !empty && num(form.previous) === autoPrevious;
    if (autoPrevious !== null && (empty || sameAsAuto)) {
      setForm({ ...form, prevEditing: false, editPrevious: false, previous: '' });
    } else {
      setForm({ ...form, prevEditing: false, editPrevious: true });
    }
  };
  // الأرصدة تُنقل لمنظومة الخزانات (والشاشة الرئيسية) فقط عند حفظ أحدث يوم
  const isLatestDate = !!form && !records.some(r => r.id !== form.id && r.date > form.date);

  const save = () => {
    if (!draft || !form || !canSave) return;
    const record: SaharaLedgerRecord = {
      ...draft,
      id: form.id || `sah-${Date.now()}`,
      savedAt: new Date().toISOString()
    };
    // الحفظ يحدّث هذه الصفحة فقط؛ الواجهة الرئيسية والخزانات تنتظر "تأكيد البيانات"
    update(prev => (form.id ? prev.map(r => (r.id === form.id ? record : r)) : [...prev, record]));
    setViewId(null);
    setForm(null);
  };

  // تأكيد البيانات: ينقل أرصدة محطات آخر يوم للخزانات ويعتمد السجل للواجهة الرئيسية
  const confirmPublish = () => {
    const balances = latest?.stationBalances;
    if (balances) {
      updateTanks(prev => prev.map(t => {
        const liters = balances[t.id];
        if (liters === undefined || !t.capacityLiters) return t;
        return { ...t, levelMeters: (liters / t.capacityLiters) * (t.maxLevelMeters || 1) };
      }));
    }
    publish();
    setConfirmOpen(false);
  };

  // مسح البيانات: يفرّغ خانات النموذج (اليدوية أو القادمة من ملف الكشف) لإعادة إدخالها، ولا يحذف اليوم
  // لا يُحفظ شيء حتى يُضغط حفظ
  const clearData = () => {
    if (!form) return;
    setUpload({ status: 'idle' });
    setForm({
      ...form,
      previous: '',
      editPrevious: autoPrevious === null,
      prevEditing: autoPrevious === null,
      vehicles: '',
      farms: '',
      generators: '',
      external: {},
      sales: '',
      stations: Object.fromEntries(liveStations.map(s => [s.id, ''])),
      currentOverride: '',
      overrideBase: null
    });
  };

  const v = view;
  const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
  const pctLabel = (p: number) => `${p.toFixed(p > 0 && p < 10 ? 1 : 0)}%`;
  const delta = v ? v.current - v.previous : 0;

  // مقارنة بالأمس (اليوم الذي قبل المعروض): الفرق وسهم زيادة/نقصان بدل تكرار الرقم
  const prevView = viewIndex > 0 ? computed[viewIndex - 1] : null;
  const neutralTone = 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  const goodTone = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
  const badTone = 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
  const compareChip = (today: number, yesterday: number | undefined, increaseIsGood: boolean) => {
    if (yesterday === undefined) return { chip: t('finance:ledger.noYesterday'), chipTone: neutralTone, chipTitle: undefined };
    const diff = today - yesterday;
    const chipTitle = t('finance:ledger.compareTitle', { yesterday: formatNumber(yesterday), today: formatNumber(today) });
    if (diff === 0) return { chip: `= ${t('finance:ledger.noChange')}`, chipTone: neutralTone, chipTitle };
    return {
      chip: `${diff > 0 ? '▲ +' : '▼ −'}${formatNumber(Math.abs(diff))}`,
      chipTone: (diff > 0) === increaseIsGood ? goodTone : badTone,
      chipTitle
    };
  };

  const kpis = [
    {
      label: t('finance:ledger.previousBalance'),
      value: v?.previous ?? 0,
      icon: History,
      iconBg: 'text-slate-600 dark:text-slate-300',
      accent: 'from-slate-300 to-slate-500',
      note: t('finance:ledger.previousBalanceNote'),
      chip: v ? v.date : '—',
      chipTone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
      chipTitle: undefined as string | undefined
    },
    {
      label: t('finance:ledger.inbound'),
      value: v?.inbound ?? 0,
      icon: ArrowDownToLine,
      iconBg: 'text-emerald-600 dark:text-emerald-400',
      accent: 'from-emerald-400 to-teal-500',
      note: t('finance:saharaBalance.inboundNote'),
      // زيادة الوارد عن أمس = أخضر
      ...compareChip(v?.inbound ?? 0, prevView?.inbound, true)
    },
    {
      label: t('finance:saharaBalance.actualConsumption'),
      value: v?.actualConsumption ?? 0,
      icon: Flame,
      iconBg: 'text-rose-600 dark:text-rose-400',
      accent: 'from-rose-400 to-red-500',
      note: t('finance:saharaBalance.actualConsumptionNote'),
      // زيادة الاستهلاك عن أمس = أحمر
      ...compareChip(v?.actualConsumption ?? 0, prevView?.actualConsumption, false)
    }
  ];

  const actual = v?.actualConsumption ?? 0;
  const consumptionItems = [
    { label: t('finance:saharaBalance.vehicles'), value: v?.vehicles ?? 0, icon: Tractor, tile: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400', bar: 'bg-blue-500' },
    { label: t('finance:saharaBalance.farms'), value: v?.farms ?? 0, icon: ChickenIcon, tile: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400', bar: 'bg-emerald-500' },
    { label: t('finance:saharaBalance.generators'), value: v?.generators ?? 0, icon: DieselGeneratorIcon, tile: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400', bar: 'bg-violet-500' }
  ];

  const EXTERNAL_TONES: Record<SaharaExternalSource, { tile: string; bar: string }> = {
    government: { tile: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400', bar: 'bg-sky-500' },
    etihad: { tile: 'bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400', bar: 'bg-teal-500' },
    commercial: { tile: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400', bar: 'bg-amber-500' }
  };

  const stationTone = (p: number) =>
    p >= 50 ? { bar: 'bg-teal-400 dark:bg-teal-500/80', text: 'text-teal-600 dark:text-teal-300' }
      : p >= 25 ? { bar: 'bg-amber-400 dark:bg-amber-500/80', text: 'text-amber-600 dark:text-amber-300' }
        : { bar: 'bg-rose-400 dark:bg-rose-500/80', text: 'text-rose-600 dark:text-rose-300' };

  const sectionBox = 'rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_18px_-6px_rgba(15,23,42,0.08)] p-4 flex flex-col min-h-0';
  const tileCard = 'rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 p-3 flex flex-col';

  /** ترويسة القسم: أيقونة ملونة + عنوان ووصف */
  const sectionHeader = (
    Icon: React.ComponentType<{ className?: string }>,
    iconColor: string,
    title: string,
    subtitle: string
  ) => (
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

  // أنماط نافذة الإدخال
  const field =
    'w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all disabled:bg-slate-100 dark:disabled:bg-slate-900/60 disabled:text-slate-500';
  const fieldLabel = 'text-xs font-bold text-slate-700 dark:text-slate-200';
  const cardTitle = 'flex items-center gap-1.5 text-xs font-black text-teal-800 dark:text-teal-400 mb-2.5 pb-1.5 border-b border-slate-100 dark:border-slate-700';
  const cardNum = 'w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-sans font-bold';

  const numInput = (key: 'vehicles' | 'farms' | 'generators' | 'sales', label: string, autoFocus = false) => (
    <label className="space-y-1">
      <div className="h-5 flex items-center"><span className={fieldLabel}>{label}</span></div>
      <NumberInput

        autoFocus={autoFocus}
        className={field}
        value={form![key]}
        placeholder="0"
onValue={v => setForm({ ...form!, [key]: v })}
      />
    </label>
  );

  return (
    <div className="flex-1 flex flex-col gap-3 pb-3">
      {/* شريط اليوم المعروض والأزرار */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={viewIndex <= 0}
            onClick={() => setViewId(computed[viewIndex - 1]?.id ?? null)}
            title={t('finance:ledger.prevDay')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 ltr:rotate-180" />
          </button>
          {/* التاريخ: يفتح تقويمًا للانتقال لأي يوم مسجّل (نفس تقويم الأرشيف) */}
          <button
            type="button"
            disabled={!computed.length}
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect();
              setDatePop(p => (p ? null : { top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - 308)) }));
            }}
            title={t('finance:saharaBalance.pickDay')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-700 transition-colors cursor-pointer disabled:cursor-default"
          >
            <CalendarDays className="w-4 h-4 text-teal-600" />
            <span className="font-mono font-black text-sm text-slate-900 dark:text-white">{v?.date ?? '—'}</span>
            {v && viewIndex === computed.length - 1 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">{t('finance:ledger.latestDay')}</span>
            )}
          </button>
          {datePop && createPortal(
            <>
              <div className="fixed inset-0 z-[150]" onClick={() => setDatePop(null)} />
              <div className="fixed z-[151]" style={{ top: datePop.top, left: datePop.left }}>
                <DateRangeCalendar
                  single
                  marked={recordedDates}
                  from={v?.date ?? ''}
                  to={v?.date ?? ''}
                  onApply={date => {
                    const target = computed.find(r => r.date === date);
                    if (target) setViewId(target.id === latest?.id ? null : target.id);
                    setDatePop(null);
                  }}
                  onClear={() => setDatePop(null)}
                />
              </div>
            </>,
            document.body
          )}
          <button
            type="button"
            disabled={viewIndex < 0 || viewIndex >= computed.length - 1}
            onClick={() => setViewId(viewIndex + 1 >= computed.length - 1 ? null : computed[viewIndex + 1].id)}
            title={t('finance:ledger.nextDay')}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 ltr:rotate-180" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* يظهر بعد حفظ بيانات جديدة، ويختفي بعد تأكيدها ونقلها للواجهة الرئيسية */}
          {hasPending && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-600/25 cursor-pointer active:scale-95 transition-all animate-pulse"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('finance:ledger.confirmData')}
            </button>
          )}
          {/* إلغاء العملية: رفض البيانات المحفوظة غير المؤكدة والعودة لآخر نسخة معتمدة */}
          {hasPending && (
            <button
              type="button"
              onClick={() => setDiscardOpen(true)}
              className="px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <XCircle className="w-4 h-4" />
              {t('finance:ledger.discard')}
            </button>
          )}
          {/* السعر: سعر شراء اليوم (تلقائي من وارد الصحاري) — للعرض فقط */}
          <div>
            <button
              type="button"
              onClick={() => setPriceOpen(true)}
              title={t('finance:saharaBalance.todayBuyPrice')}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              {t('finance:ledger.price')}
              <span className="font-mono font-black text-blue-700 dark:text-blue-300">{buys.today ? buys.today.price.toFixed(1) : '—'}</span>
              <span className="text-[10px] text-slate-400">{t('common:units.iqd')}</span>
            </button>
            {/* نافذة السعر في وسط الشاشة: الأعلى السعر المعتمد (للقراءة فقط)، والأسفل السعر الجديد */}
            {priceOpen && createPortal(
              <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-150" dir="rtl" onClick={() => setPriceOpen(false)}>
                <div onClick={e => e.stopPropagation()} className="w-full max-w-[400px] rounded-[28px] bg-white dark:bg-slate-900 ring-1 ring-slate-200/80 dark:ring-white/10 shadow-[0_30px_80px_-20px_rgba(2,6,23,0.45)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
                  {/* الأعلى: سعر شراء اليوم (تلقائي من وارد الصحاري) */}
                  <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-700 px-6 pt-5 pb-6 text-white">
                    <div className="absolute inset-0 opacity-[0.12] pointer-events-none [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:14px_14px]" />
                    <div className="absolute -top-20 -left-12 w-52 h-52 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-24 -right-12 w-56 h-56 rounded-full border-[20px] border-white/[0.06] pointer-events-none" />

                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center backdrop-blur-sm">
                          <Coins className="w-4 h-4" />
                        </span>
                        <span className="text-sm font-black tracking-wide">{t('finance:saharaBalance.todayBuyPrice')}</span>
                      </div>
                      <button type="button" onClick={() => setPriceOpen(false)} aria-label={t('common:actions.close')} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/20 flex items-center justify-center cursor-pointer transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="relative mt-5 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 ring-1 ring-white/20 text-[10.5px] font-bold text-white/90">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                        {t('finance:saharaBalance.priceAuto')}{buys.today && <span className="font-mono"> · {buys.today.day}</span>}
                      </div>
                      <div className="mt-2 flex items-baseline justify-center gap-2">
                        <span className="text-[52px] leading-none font-black font-mono tracking-tight tabular-nums [text-shadow:0_2px_14px_rgba(0,0,0,0.2)]" dir="ltr">{buys.today ? buys.today.price.toFixed(1) : '—'}</span>
                        <span className="text-sm font-bold text-white/70">{t('common:units.iqd')}</span>
                      </div>
                    </div>
                  </div>

                  {/* الأسفل: السعر السابق ونسبة التغير (للعرض فقط) */}
                  <div className="px-6 py-5 grid grid-cols-2 gap-2.5">
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 ring-1 ring-slate-200 dark:ring-slate-700 px-3 py-3 text-center">
                      <div className="text-[10.5px] font-bold text-slate-400">{t('finance:saharaBalance.previousPrice')}{buys.previous && <span className="font-mono"> · {buys.previous.day}</span>}</div>
                      <div className="mt-1 font-mono font-black text-xl text-slate-800 dark:text-slate-100 tabular-nums">
                        {buys.previous ? buys.previous.price.toFixed(1) : '—'} <span className="text-[10px] font-bold text-slate-400">{t('common:units.iqd')}</span>
                      </div>
                    </div>
                    {(() => {
                      const pct = buys.pct !== null && Math.abs(buys.pct) < 0.005 ? 0 : buys.pct;
                      const tone = pct === null || pct === 0 ? 'text-slate-500' : pct > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';
                      return (
                        <div
                          className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 ring-1 ring-slate-200 dark:ring-slate-700 px-3 py-3 text-center"
                          title={buys.twoDayAvg !== null ? `${t('finance:ledger.twoDayAvg')}: ${buys.twoDayAvg.toFixed(1)} ${t('common:units.iqd')}` : undefined}
                        >
                          <div className="text-[10.5px] font-bold text-slate-400">{t('finance:saharaBalance.changeRate')}</div>
                          <div className={`mt-1 flex items-center justify-center gap-1 font-mono font-black text-xl tabular-nums ${tone}`}>
                            {pct !== null && pct < 0 && <TrendingDown className="w-4 h-4 shrink-0" />}
                            {pct !== null && pct > 0 && <TrendingUp className="w-4 h-4 shrink-0" />}
                            <span dir="ltr">{pct === null ? '—' : `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${Math.abs(pct).toFixed(2)}%`}</span>
                          </div>
                        </div>
                      );
                    })()}
                    <p className="col-span-2 text-[10.5px] text-slate-400 dark:text-slate-500 text-center">{t('finance:saharaBalance.priceReadOnly')}</p>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
          {v && (
            <button
              type="button"
              onClick={() => openEdit(v)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t('finance:ledger.editDay')}
            </button>
          )}
          <button
            type="button"
            onClick={openNew}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-teal-600/20 cursor-pointer active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            {t('finance:ledger.newDay')}
          </button>
        </div>
      </div>

      {/* 1. الكارتات الأربعة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 shadow-[0_4px_18px_-6px_rgba(15,23,42,0.08)]">
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
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{k.note}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10.5px] font-black font-mono ${k.chipTone}`} dir="ltr" title={k.chipTitle}>{k.chip}</span>
              </div>
            </div>
          );
        })}

        {/* الرصيد الحالي: الكارت الرئيسي */}
        <div className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-lg ${(v?.current ?? 0) < 0 ? 'bg-gradient-to-br from-red-600 to-rose-700 shadow-red-900/20' : 'bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-700 shadow-teal-900/25'}`}>
          <div className="absolute -top-14 -left-14 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-bold text-white/75 block">{t('finance:ledger.currentBalance')}</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl sm:text-[28px] leading-none font-black font-mono tracking-tight tabular-nums">{formatNumber(v?.current ?? 0)}</span>
                <span className="text-[11px] font-bold text-white/70">{t('common:units.liter')}</span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="relative mt-3.5 pt-2.5 border-t border-white/15 flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/75 truncate">{t('finance:saharaBalance.currentFormula')}</span>
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-white/15 text-[10.5px] font-black font-mono" dir="ltr">
              {delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : ''}{formatNumber(delta)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. الكارت الكبير: 4 أقسام — يمتد لملء المساحة المتبقية مع هامش سفلي */}
      <div className="flex-1 flex flex-col rounded-3xl bg-gradient-to-b from-slate-50 to-slate-100/70 dark:from-slate-900/80 dark:to-slate-950 border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 lg:min-h-[480px]">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-3 sm:gap-4">

          {/* القسم 1: الاستهلاك اليومي */}
          <div className={sectionBox}>
            {sectionHeader(Flame, 'text-rose-600 dark:text-rose-400', t('finance:ledger.dailyConsumption'), t('finance:saharaBalance.dailyConsumptionHint'))}
            <div className="grid grid-cols-3 gap-2.5 flex-1">
              {consumptionItems.map(c => {
                const Icon = c.icon;
                const p = pct(c.value, actual);
                return (
                  <div key={c.label} className={`${tileCard} justify-between gap-2`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.tile}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{c.label}</span>
                    </div>
                    <div className="font-mono font-black text-lg sm:text-xl text-slate-900 dark:text-white tabular-nums">{formatNumber(c.value)}</div>
                    <div className="space-y-1">
                      {shareBar(p, c.bar)}
                      <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">{pctLabel(p)} {t('finance:saharaBalance.ofActual')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* القسم 2: أرصدة المحطات */}
          <div className={sectionBox}>
            {sectionHeader(MapPin, 'text-blue-600 dark:text-blue-400', t('finance:ledger.stationBalances'), t('finance:ledger.stationBalancesHint'))}
            {stationSlots.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-4">{t('finance:ledger.noStations')}</div>
            ) : (
              <div className="grid grid-cols-4 grid-rows-2 gap-2.5 flex-1">
                {stationSlots.map(st => {
                  const p = pct(st.balance, st.capacity);
                  const tone = stationTone(p);
                  return (
                    <div
                      key={st.id}
                      title={`${st.name}: ${formatNumber(st.balance)} / ${formatNumber(st.capacity)} ${t('common:units.liter')}`}
                      className={`${tileCard} justify-between gap-1.5 !p-2.5`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-extrabold text-[#1d576a] dark:text-sky-300 truncate">{st.name}</span>
                        <span className={`text-[10px] font-black font-mono ${tone.text}`}>{pctLabel(p)}</span>
                      </div>
                      <div className="font-mono font-black text-sm sm:text-[15px] text-slate-900 dark:text-white tabular-nums">{formatNumber(st.balance)}</div>
                      {shareBar(p, tone.bar)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* القسم 3: الوارد */}
          <div className={sectionBox}>
            {sectionHeader(Truck, 'text-emerald-600 dark:text-emerald-400', t('finance:ledger.inbound'), t('finance:saharaBalance.inboundHint'))}
            <div className="grid grid-cols-2 gap-2.5 flex-1">
              {[
                ...SAHARA_EXTERNAL_SOURCES.map(s => ({
                  key: s.key,
                  label: t(`finance:saharaBalance.source.${s.key}`),
                  // الخارجي يشمل أي وارد "تجاري" قديم محفوظ قبل دمج المصادر
                  value: (v?.inboundExternal?.[s.key] ?? 0) + (s.key === 'government' ? v?.inboundExternal?.commercial ?? 0 : 0),
                  icon: EXTERNAL_ICONS[s.key],
                  tile: EXTERNAL_TONES[s.key].tile,
                  bar: EXTERNAL_TONES[s.key].bar
                }))
              ].map(c => {
                const Icon = c.icon;
                const p = pct(c.value, v?.inbound ?? 0);
                return (
                  <div key={c.key} className={`${tileCard} justify-between gap-2`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.tile}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{c.label}</span>
                    </div>
                    <div className="font-mono font-black text-lg sm:text-xl text-slate-900 dark:text-white tabular-nums">{formatNumber(c.value)}</div>
                    <div className="space-y-1">
                      {shareBar(p, c.bar)}
                      <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">{pctLabel(p)} {t('finance:saharaBalance.ofInbound')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* القسم 4: المرسل إلى المزارع (من ملف الكشف) — الاستهلاك الكلي = الفعلي + المرسل إلى المزارع */}
          <div className={sectionBox}>
            {sectionHeader(Repeat, 'text-amber-600 dark:text-amber-400', t('finance:saharaBalance.sentToFarms'), t('finance:saharaBalance.sentToFarmsHint'))}
            <div className="flex-1 flex items-stretch gap-2.5">
              <div className={`${tileCard} flex-1 justify-center gap-1`}>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('finance:saharaBalance.sentToFarms')}</span>
                <span className="font-mono font-black text-lg sm:text-xl text-slate-900 dark:text-white tabular-nums">{formatNumber(v?.sales ?? 0)}</span>
              </div>
              <div className={`${tileCard} flex-1 justify-center gap-1`}>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('finance:saharaBalance.totalConsumption')}</span>
                <span className="font-mono font-black text-lg sm:text-xl text-slate-900 dark:text-white tabular-nums">{formatNumber(v?.totalConsumption ?? 0)}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 shrink-0">
              <div className="h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden flex">
                <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${pct(v?.sales ?? 0, v?.totalConsumption ?? 0)}%` }} />
                <div className="h-full bg-slate-500 transition-all duration-500" style={{ width: `${pct(actual, v?.totalConsumption ?? 0)}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />{t('finance:saharaBalance.sentToFarms')} {pctLabel(pct(v?.sales ?? 0, v?.totalConsumption ?? 0))}</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500" />{t('finance:saharaBalance.actual')} {pctLabel(pct(actual, v?.totalConsumption ?? 0))}</span>
              </div>
            </div>
          </div>
        </div>

        {!v && (
          <p className="mt-3 text-center text-xs font-bold text-slate-500">
            {t('finance:saharaBalance.empty')}
          </p>
        )}
      </div>

      {/* نافذة التسجيل / التعديل */}
      {form && preview && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-3 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setForm(null)}>
          <div
            dir="rtl"
            onClick={e => e.stopPropagation()}
            className="relative w-[min(880px,94vw)] max-h-[96vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden font-cairo animate-in zoom-in-95 duration-150"
          >
            <div className="px-5 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                    {form.id ? t('finance:saharaBalance.form.editTitle') : t('finance:saharaBalance.form.newTitle')}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('finance:saharaBalance.form.formula')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className={`flex items-center gap-1.5 h-9 pe-1 ps-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 ${dateTaken ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}>
                  <CalendarDays className="w-4 h-4 text-teal-600 shrink-0" />
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
                  {/* الرصيد السابق: كارت بنفس نمط الرصيد الحالي (فيروزي فاتح)، ويصبح قابلًا للإدخال عند التصحيح */}
                  <div className="sm:col-span-4 relative overflow-hidden rounded-2xl p-4 bg-teal-50/70 dark:bg-teal-950/25 border border-teal-200/80 dark:border-teal-900/50 flex flex-col">
                    <div className="relative flex items-center justify-center min-h-[28px]">
                      <div className="text-[11px] font-bold text-teal-700 dark:text-teal-400">{t('finance:ledger.previousBalance')}</div>
                      {/* تعديل ← يفتح الإدخال، وحفظ ← يثبّت القيمة */}
                      <button
                        type="button"
                        onClick={() => (form.prevEditing ? commitPrevious() : startEditPrevious())}
                        title={form.prevEditing ? t('common:actions.save') : t('common:actions.edit')}
                        aria-label={form.prevEditing ? t('common:actions.save') : t('common:actions.edit')}
                        className={`absolute end-0 top-0 w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${form.prevEditing ? 'bg-teal-600 hover:bg-teal-700 border-teal-600 text-white shadow-sm' : 'bg-white/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300'}`}
                      >
                        {form.prevEditing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="relative flex-1 flex items-center justify-center mt-1">
                      {form.prevEditing ? (
                        <NumberInput

                          autoFocus
                          className="w-full h-11 px-3 rounded-xl text-center bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 focus:ring-2 focus:ring-teal-300/60 outline-none text-xl font-black font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 placeholder:text-sm placeholder:font-bold"
                          value={form.previous}
                          placeholder={t('finance:ledger.form.openingBalance')}
onValue={v => setForm({ ...form, previous: v })}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitPrevious(); } }}
                        />
                      ) : (
                        <div className="flex items-baseline justify-center gap-1.5">
                          <span className="text-3xl font-black font-mono tracking-tight tabular-nums text-slate-800 dark:text-slate-100" dir="ltr">
                            {formatNumber(form.editPrevious ? num(form.previous) : autoPrevious ?? 0)}
                          </span>
                          <span className="text-xs font-bold text-teal-600/70 dark:text-teal-400/70">{t('common:units.liter')}</span>
                        </div>
                      )}
                    </div>
                    <div className="relative mt-3 pt-2.5 border-t border-teal-100 dark:border-teal-900/40 text-[10.5px] font-bold text-teal-700/80 dark:text-teal-400/80 flex flex-wrap items-center justify-center text-center gap-x-2 gap-y-0.5">
                      <span>
                        {form.prevEditing
                          ? t('finance:ledger.form.enterThenSave')
                          : form.editPrevious
                            ? autoPrevious === null ? t('finance:ledger.form.openingBalance') : t('finance:ledger.form.manuallyEdited')
                            : t('finance:ledger.form.fromCurrentOf', { date: prevSourceDate ?? '' })}
                      </span>
                    </div>
                  </div>

                  {/* الرصيد الحالي */}
                  <div className={`sm:col-span-6 relative overflow-hidden rounded-2xl p-4 text-white shadow-lg flex flex-col ${preview.current < 0 ? 'bg-gradient-to-br from-red-600 to-rose-700 shadow-red-900/20' : 'bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-700 shadow-teal-900/20'}`}>
                    {/* زخرفة هادئة: شبكة نقاط + دوائر ضوئية + لمعة علوية */}
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
                        <span className="text-[40px] font-black font-mono tracking-tight tabular-nums leading-none [text-shadow:0_2px_12px_rgba(0,0,0,0.18)]" dir="ltr">{formatNumber(formEmpty ? 0 : preview.current)}</span>
                        <span className="text-sm font-bold text-white/70">{t('common:units.liter')}</span>
                      </div>
                      {form.currentOverride.trim() !== '' && (
                        <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-white/85">
                          <span className="px-2 py-0.5 rounded-full bg-white/15 border border-white/20">{t('finance:saharaBalance.form.fromFile')}</span>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, currentOverride: '', overrideBase: null })}
                            title={t('finance:saharaBalance.form.resetAuto')}
                            className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {/* التغيّر عن الرصيد السابق */}
                      {!formEmpty && (() => {
                        const change = preview.current - preview.previous;
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

                  {/* طريقة الإدخال: قلم (يدوي) أو رفع ملف الكشف */}
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
                        className={`flex-1 min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-1 text-[10.5px] font-bold cursor-pointer transition-all ${entryMode === k ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-slate-700'}`}
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
                    className="w-full rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20 hover:bg-teal-50 dark:hover:bg-teal-950/40 px-4 py-6 flex flex-col items-center justify-center gap-2 text-center cursor-pointer disabled:cursor-wait transition-colors"
                  >
                    {upload.status === 'loading' ? (
                      <>
                        <Loader2 className="w-7 h-7 text-teal-600 animate-spin" />
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('finance:ledger.upload.reading')}</span>
                        <span className="text-[11px] text-slate-500">{upload.fileName}</span>
                      </>
                    ) : (
                      <>
                        <ImagePlus className="w-7 h-7 text-teal-600" />
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t('finance:saharaBalance.upload.choose')}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('finance:saharaBalance.upload.chooseHint')}</span>
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
                    <div className="rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 px-3 py-2 space-y-1 text-xs">
                      <div className="flex items-center gap-2 font-black text-teal-800 dark:text-teal-300">
                        <Sparkles className="w-4 h-4" />
                        {t('finance:ledger.upload.filled', { count: upload.filled })}
                      </div>
                      {upload.unmatched.length > 0 && (
                        <div className="font-bold text-amber-700 dark:text-amber-300">
                          {t('finance:saharaBalance.upload.unmatched', { list: fmtList(upload.unmatched) })}
                        </div>
                      )}
                      {upload.notes && <div className="text-slate-600 dark:text-slate-300">{upload.notes}</div>}
                    </div>
                  )}
                </div>
              )}

              {/* 2. الاستهلاك اليومي */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5">
                <div className={cardTitle}><span className={cardNum}>2</span><Flame className="w-3.5 h-3.5" /><span>{t('finance:ledger.dailyConsumption')}</span></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {numInput('vehicles', t('finance:saharaBalance.form.vehiclesL'), true)}
                  {numInput('farms', t('finance:saharaBalance.form.farmsL'))}
                  {numInput('generators', t('finance:saharaBalance.form.generatorsL'))}
                </div>
              </div>

              {/* 3. أرصدة المحطات (تُنقل لمنظومة الخزانات والشاشة الرئيسية) */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-3.5">
                <div className={cardTitle}>
                  <span className={cardNum}>3</span><MapPin className="w-3.5 h-3.5" /><span>{t('finance:ledger.stationBalances')}</span>
                  <span className="ms-auto font-normal text-[10.5px] text-slate-500 dark:text-slate-400">
                    {isLatestDate ? t('finance:ledger.form.stationsLatest') : t('finance:ledger.form.stationsPast')}
                  </span>
                </div>
                {liveStations.length === 0 ? (
                  <p className="text-xs text-slate-400">{t('finance:ledger.noStations')}</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {liveStations.map(st => {
                      const over = num(form.stations[st.id] || '') > st.capacity;
                      return (
                        <label key={st.id} className="space-y-1">
                          <div className="h-5 flex items-center"><span className={`${fieldLabel} truncate`}>{st.name}</span></div>
                          <NumberInput

                            className={`${field} ${over ? '!border-red-500 !ring-red-500' : ''}`}
                            value={form.stations[st.id] ?? ''}
                            placeholder="0"
                            title={`${t('finance:ledger.form.capacity')}: ${formatNumber(st.capacity)} ${t('common:units.liter')}`}
onValue={v => setForm({ ...form, stations: { ...form.stations, [st.id]: v } })}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {SAHARA_EXTERNAL_SOURCES.map(s => (
                    <label key={s.key} className="space-y-1">
                      <div className="h-5 flex items-center"><span className={fieldLabel}>{t('finance:ledger.form.withLiters', { label: t(`finance:saharaBalance.source.${s.key}`) })}</span></div>
                      <NumberInput

                        className={field}
                        value={form.external[s.key] ?? ''}
                        placeholder="0"
onValue={v => setForm({ ...form, external: { ...form.external, [s.key]: v } })}
                      />
                    </label>
                  ))}
                </div>
              </div>

            </div>

            <div className="px-5 py-3 border-t border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button type="button" onClick={clearData} title={t('finance:saharaBalance.form.clearHint')} className="px-3.5 py-2.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
                  <Eraser className="w-4 h-4" />
                  {t('finance:ledger.form.clear')}
                </button>
                {/* سبب تعطّل الحفظ بجانب الزر */}
                {dateTaken ? (
                  <p className="text-xs font-bold text-red-600">{t('finance:ledger.form.duplicate')}</p>
                ) : !form.editPrevious && autoPrevious === null ? (
                  <p className="text-xs font-bold text-amber-600">{t('finance:ledger.form.noPrevious')}</p>
                ) : overCapacity.length > 0 ? (
                  <p className="text-xs font-bold text-red-600">{t('finance:ledger.form.overCapacity')}</p>
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
                  className="px-6 sm:px-8 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-black shadow-lg shadow-teal-900/20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
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

      {/* نافذة تأكيد البيانات قبل تحديث الواجهة الرئيسية */}
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
                  <Trans t={t} i18nKey="finance:saharaBalance.confirm.text" values={{ date: latest.date }} components={{ 1: <span className="font-mono font-black text-slate-800 dark:text-slate-100" /> }} />
                </p>
              </div>
            </div>
            <div className="mx-5 mb-4 grid grid-cols-3 gap-2 text-center">
              {[
                { label: t('finance:ledger.currentBalance'), value: latest.current },
                { label: t('finance:saharaBalance.actualConsumption'), value: latest.actualConsumption },
                { label: t('finance:ledger.inbound'), value: latest.inbound }
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
              <button type="button" onClick={confirmPublish} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-black shadow-lg shadow-teal-900/20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all">
                <CheckCircle2 className="w-4 h-4" />
                {t('finance:ledger.confirm.yes')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* نافذة إلغاء العملية: رفض البيانات غير المؤكدة */}
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
                  {t('finance:saharaBalance.discardDialog.text')}
                </p>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button type="button" onClick={() => setDiscardOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer">
                {t('finance:ledger.back')}
              </button>
              <button
                type="button"
                onClick={() => { discard(); setViewId(null); setForm(null); setDiscardOpen(false); }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-black shadow-lg shadow-rose-900/20 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <XCircle className="w-4 h-4" />
                {t('finance:ledger.discardDialog.yes')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
