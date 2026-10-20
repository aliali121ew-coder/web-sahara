import React, { useMemo } from 'react';
import { SectionHeader } from './SectionHeader';
import { Waves, Building2, Fuel } from 'lucide-react';
import { formatNumber } from '../../lib/utils';
import { useTranslation } from 'react-i18next';
import { TankGlobalSvgDefs } from '../tanks/TankGlobalSvgDefs';
import { Tank3DCard, type CalculatedTankUnit } from '../tanks/Tank3DCard';
import { OFFICIAL_TABLE_TANK_UNITS, getFillLevelTheme, type TankUnitRow } from '../tanks/TanksOverview';
import {
  useCentralTanks,
  tankLiters,
  resolveGasoilSectionKey,
  resolveSaharaGasoilSectionKey,
  resolveSaharaPetrolSectionKey
} from '../../lib/centralTanks';
import { BLACK_OIL_SECTION_KEYS, useBlackOilLedger } from '../../lib/blackOilLedger';
import { useSaharaLedger } from '../../lib/saharaLedger';
import { usePetrolLedger, PETROL_TOTAL_CAPACITY } from '../../lib/petrolLedger';

/** ارتفاع افتراضي للخزان المجمّع (المنسوب يُحسب منه كنسبة امتلاء) */
const VIRTUAL_HEIGHT = 10;

/** جسم الخزان المعدني (نفس ألوان خزانات المنظومة) */
const steelBody: React.CSSProperties = {
  background: 'linear-gradient(to right, #9aa3ad, #f4f6f8 18%, #dde2e7 45%, #a7b0ba 85%, #7d8791)',
  borderColor: '#5b646d'
};

/** خزان مصغّر بنفس شكل خزان المنظومة (قبة معدنية، جسم أسطواني، سائل بلون حالته): لكارت الهاتف */
const MiniTank: React.FC<{ tank: CalculatedTankUnit; group: string }> = ({ tank, group }) => {
  const { t } = useTranslation(['dashboard', 'common']);
  const pct = Math.min(100, Math.max(0, tank.fillPercent));
  const th = tank.theme;
  return (
    <div className="flex flex-col items-center text-center min-w-0">
      <div className="relative w-14">
        <div className="w-full h-2.5 rounded-t-[100%] border-t border-x" style={steelBody} />
        <div className="w-full h-0.5 border-y" style={steelBody} />
        <div className="relative w-full h-20 border-x border-b overflow-hidden flex flex-col justify-end shadow-md" style={steelBody}>
          <div className="absolute inset-x-0 top-1/2 h-px bg-slate-400/40 z-20" />
          <div className="w-full relative" style={{ height: `${pct}%`, background: `linear-gradient(to top, ${th.gradientFrom}, ${th.gradientVia}, ${th.gradientTo})` }}>
            <div className="absolute top-0 inset-x-0 h-0.5 bg-white/80 shadow-[0_0_6px_#fff]" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
          </div>
          <span className="absolute inset-x-0 top-1 text-[10px] font-black font-mono text-slate-800 z-30 tabular-nums">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="mt-1.5 text-[11px] font-black text-slate-800 dark:text-slate-100 leading-tight truncate max-w-full">{tank.name}</div>
      <div className="text-[9.5px] font-bold text-slate-400 truncate max-w-full">{group}</div>
      <div className="mt-0.5 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums" dir="ltr">{formatNumber(tank.currentStoredLiters)} {t('common:units.liter')}</div>
    </div>
  );
};

/**
 * تفاصيل خزانات الشركة (الشاشة الرئيسية) بتصميم خزانات المنظومة:
 * الكمية من نفس مصادر الكروت العلوية (رصيد الصحاري، السجل اليومي للنفط الأسود، سجل البنزين)،
 * وكاز الاتحاد والسعة والحرارة والضغط من خزانات القسم في منظومة الخزانات،
 * مجمّعة في كروت أم: الاتحاد (كاز + نفط أسود)، الصحاري (كاز + نفط أسود)، والبنزين وحده.
 */
export const CompanyTanksSection: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common']);
  const [centralTanks] = useCentralTanks(OFFICIAL_TABLE_TANK_UNITS);
  // نفس مصادر الكروت العلوية في الشاشة الرئيسية
  const { publishedComputed: saharaDays } = useSaharaLedger();
  const { publishedComputed: petrolDays } = usePetrolLedger();
  const saharaBlackOil = useBlackOilLedger('sahara');
  const etihadBlackOil = useBlackOilLedger('etihad');

  const groups = useMemo(() => {
    const visible = centralTanks.filter(t => !t.hidden);
    /** override: الكمية (والسعة) من كارت الشاشة الرئيسية بدل مناسيب الخزانات */
    const aggregate = (
      id: string, name: string, code: string, company: TankUnitRow['company'], key: string | null,
      override?: { stored?: number | null; capacity?: number }
    ): CalculatedTankUnit | null => {
      const rows = key ? visible.filter(t => t.sectionKey === key) : [];
      const capacityLiters = override?.capacity ?? rows.reduce((a, t) => a + t.capacityLiters, 0);
      if (!capacityLiters || !rows.length) return null;
      const stored = override?.stored ?? rows.reduce((a, t) => a + tankLiters(t), 0);
      const fillPercent = Number(Math.min(100, (stored / capacityLiters) * 100).toFixed(1));
      const avg = (f: (t: TankUnitRow) => number) => rows.reduce((a, t) => a + f(t), 0) / rows.length;
      return {
        id,
        code,
        name,
        sectionKey: key!,
        sectionName: rows[0].sectionName,
        company,
        levelMeters: Number(((fillPercent / 100) * VIRTUAL_HEIGHT).toFixed(2)),
        maxLevelMeters: VIRTUAL_HEIGHT,
        capacityLiters,
        temperatureC: Number(avg(t => t.temperatureC || 0).toFixed(1)),
        pressureBar: Number(avg(t => t.pressureBar || 0).toFixed(2)),
        fillPercent,
        currentStoredLiters: Math.round(stored),
        theme: getFillLevelTheme(fillPercent)
      } as CalculatedTankUnit;
    };
    const keep = (list: (CalculatedTankUnit | null)[]) => list.filter((t): t is CalculatedTankUnit => !!t);
    return [
      {
        key: 'etihad',
        title: t('dashboard:companyTanks.groups.etihad'),
        icon: Building2,
        accent: 'from-emerald-500 to-teal-600',
        tanks: keep([
          aggregate('agg-etihad-gas', t('dashboard:companyTanks.names.etihadGas'), 'ET-KZ', 'شركة الاتحاد', resolveGasoilSectionKey(centralTanks)),
          aggregate('agg-etihad-black', t('dashboard:companyTanks.names.blackOil'), 'ET-BO', 'شركة الاتحاد', BLACK_OIL_SECTION_KEYS.etihad, { stored: etihadBlackOil.latest ? etihadBlackOil.balance : null })
        ])
      },
      {
        key: 'sahara',
        title: t('dashboard:companyTanks.groups.sahara'),
        icon: Building2,
        accent: 'from-blue-600 to-indigo-600',
        tanks: keep([
          aggregate('agg-sahara-gas', t('dashboard:companyTanks.names.saharaGas'), 'SH-KZ', 'صحاري كربلاء', resolveSaharaGasoilSectionKey(centralTanks), { stored: saharaDays[saharaDays.length - 1]?.current ?? null }),
          aggregate('agg-sahara-black', t('dashboard:companyTanks.names.blackOil'), 'SH-BO', 'صحاري كربلاء', BLACK_OIL_SECTION_KEYS.sahara, { stored: saharaBlackOil.latest ? saharaBlackOil.balance : null })
        ])
      },
      {
        key: 'petrol',
        title: t('dashboard:companyTanks.groups.petrol'),
        icon: Fuel,
        accent: 'from-amber-400 to-orange-500',
        tanks: keep([aggregate('agg-sahara-petrol', t('dashboard:companyTanks.names.petrol'), 'SH-BN', 'صحاري كربلاء', resolveSaharaPetrolSectionKey(centralTanks), { stored: petrolDays[petrolDays.length - 1]?.current ?? null, capacity: PETROL_TOTAL_CAPACITY })])
      }
    ].filter(g => g.tanks.length);
  }, [centralTanks, saharaDays, petrolDays, saharaBlackOil.latest, saharaBlackOil.balance, etihadBlackOil.latest, etihadBlackOil.balance, t]);

  // الخزانات المجمّعة للعرض فقط (تعديل المنسوب من منظومة الخزانات)
  const noop = () => {};

  return (
    <div className="space-y-4">
      <TankGlobalSvgDefs />

      {/* ترويسة القسم */}
      <SectionHeader title={t('dashboard:companyTanks.details')} icon={
        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-teal-600 text-white shadow-md shadow-blue-500/20">
          <Waves className="w-4 h-4 text-teal-200 animate-pulse" />
        </div>
      } />

      {/* الهاتف: كل الخزانات في كارت واحد بخزانات مصغّرة بنفس الشكل */}
      <div className="sm:hidden rounded-[26px] bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-soft-card p-3.5">
        <div className="grid grid-cols-3 gap-x-2 gap-y-4">
          {groups.flatMap(g => g.tanks.map(tk => <MiniTank key={tk.id} tank={tk} group={g.title} />))}
        </div>
      </div>

      {/* الكروت الأم: الاتحاد (خزانان)، الصحاري (خزانان)، البنزين (خزان) — من التابلت وأكبر */}
      <div className="hidden sm:grid grid-cols-1 xl:grid-cols-[2fr_2fr_1fr] gap-4 items-stretch">
        {groups.map(g => {
          const Icon = g.icon;
          const cap = g.tanks.reduce((a, t) => a + t.capacityLiters, 0);
          return (
            <div
              key={g.key}
              className="rounded-[26px] bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-[0_12px_32px_rgba(15,23,42,0.06)] p-3 sm:p-4 flex flex-col gap-3 min-w-0"
            >
              {/* رأس الكارت الأم */}
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${g.accent} text-white flex items-center justify-center shadow-sm shrink-0`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-slate-900 dark:text-white truncate">{g.title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t('dashboard:companyTanks.sections', { count: g.tanks.length })} · {t('dashboard:capacity.label')} <span className="font-mono">{formatNumber(cap)}</span> {t('common:units.liter')}
                    </div>
                  </div>
                </div>

              </div>

              {/* الخزانات بتصميم المنظومة */}
              <div className={`grid gap-3 ${g.tanks.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                {g.tanks.map(t => (
                  <Tank3DCard key={t.id} tank={t} onLevelChange={noop} isEditable={false} summary />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CompanyTanksSection;
