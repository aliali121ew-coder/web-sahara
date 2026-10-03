import React, { useMemo } from 'react';
import { Waves, Building2, Fuel } from 'lucide-react';
import { formatNumber } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';
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

/**
 * تفاصيل خزانات الشركة (الشاشة الرئيسية) بتصميم خزانات المنظومة:
 * الكمية من نفس مصادر الكروت العلوية (رصيد الصحاري، السجل اليومي للنفط الأسود، سجل البنزين)،
 * وكاز الاتحاد والسعة والحرارة والضغط من خزانات القسم في منظومة الخزانات،
 * مجمّعة في كروت أم: الاتحاد (كاز + نفط أسود)، الصحاري (كاز + نفط أسود)، والبنزين وحده.
 */
export const CompanyTanksSection: React.FC = () => {
  const { tr } = useLanguage();
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
        title: 'شركة الاتحاد',
        icon: Building2,
        accent: 'from-emerald-500 to-teal-600',
        tanks: keep([
          aggregate('agg-etihad-gas', 'كاز الاتحاد', 'ET-KZ', 'شركة الاتحاد', resolveGasoilSectionKey(centralTanks)),
          aggregate('agg-etihad-black', 'النفط الأسود', 'ET-BO', 'شركة الاتحاد', BLACK_OIL_SECTION_KEYS.etihad, { stored: etihadBlackOil.latest ? etihadBlackOil.balance : null })
        ])
      },
      {
        key: 'sahara',
        title: 'شركة الصحاري',
        icon: Building2,
        accent: 'from-blue-600 to-indigo-600',
        tanks: keep([
          aggregate('agg-sahara-gas', 'كاز الصحاري', 'SH-KZ', 'صحاري كربلاء', resolveSaharaGasoilSectionKey(centralTanks), { stored: saharaDays[saharaDays.length - 1]?.current ?? null }),
          aggregate('agg-sahara-black', 'النفط الأسود', 'SH-BO', 'صحاري كربلاء', BLACK_OIL_SECTION_KEYS.sahara, { stored: saharaBlackOil.latest ? saharaBlackOil.balance : null })
        ])
      },
      {
        key: 'petrol',
        title: 'البنزين',
        icon: Fuel,
        accent: 'from-amber-400 to-orange-500',
        tanks: keep([aggregate('agg-sahara-petrol', 'البنزين', 'SH-BN', 'صحاري كربلاء', resolveSaharaPetrolSectionKey(centralTanks), { stored: petrolDays[petrolDays.length - 1]?.current ?? null, capacity: PETROL_TOTAL_CAPACITY })])
      }
    ].filter(g => g.tanks.length);
  }, [centralTanks, saharaDays, petrolDays, saharaBlackOil.latest, saharaBlackOil.balance, etihadBlackOil.latest, etihadBlackOil.balance]);

  // الخزانات المجمّعة للعرض فقط (تعديل المنسوب من منظومة الخزانات)
  const noop = () => {};

  return (
    <div className="space-y-4">
      <TankGlobalSvgDefs />

      {/* ترويسة القسم */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-teal-600 text-white shadow-md shadow-blue-500/20">
            <Waves className="w-4 h-4 text-teal-200 animate-pulse" />
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{tr('تفاصيل خزانات الشركة')}</h2>
        </div>
      </div>

      {/* الكروت الأم: الاتحاد (خزانان)، الصحاري (خزانان)، البنزين (خزان) */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_2fr_1fr] gap-4 items-stretch">
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
                    <div className="font-black text-slate-900 dark:text-white truncate">{tr(g.title)}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {g.tanks.length} {tr(g.tanks.length === 1 ? 'قسم' : 'أقسام')} · {tr('السعة')} <span className="font-mono">{formatNumber(cap)}</span> {tr('لتر')}
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
