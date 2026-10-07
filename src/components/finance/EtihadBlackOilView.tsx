import React from 'react';
import { Droplets, Calendar, ShieldCheck } from 'lucide-react';
import { formatNumber, getBusinessDate } from '../../lib/utils';
import { useBlackOilLedger, BLACK_OIL_SECTION_KEYS, type BlackOilCompany } from '../../lib/blackOilLedger';
import { useCentralTanks } from '../../lib/centralTanks';
import { OFFICIAL_TABLE_TANK_UNITS } from '../tanks/TanksOverview';
import { useTranslation } from 'react-i18next';
import { BlackOilDailyLedger } from './BlackOilDailyLedger';


/** صفحة النفط الأسود (الاتحاد أو الصحاري): نفس التصميم، ولكل شركة سجلها وخزاناتها */
export const EtihadBlackOilView: React.FC<{ company?: BlackOilCompany }> = ({ company = 'etihad' }) => {
  const { t } = useTranslation(['finance', 'common']);

  // البطاقات تقرأ من السجل اليومي (المصدر المركزي للنفط الأسود)
  const { balance, avgDaily, coverageDays, latest } = useBlackOilLedger(company);
  // السعة الاستيعابية = مجموع سعات خزانات قسم النفط الأسود في منظومة الخزانات
  const [centralTanks] = useCentralTanks(OFFICIAL_TABLE_TANK_UNITS);
  const etihadCapacity = centralTanks.filter(t => t.sectionKey === BLACK_OIL_SECTION_KEYS[company]).reduce((a, t) => a + t.capacityLiters, 0);
  const etihadTotalBalance = balance;
  const etihadRemainingCapacity = Math.max(0, etihadCapacity - balance);
  const etihadCoverageDays = coverageDays;
  const etihadCoverageDate = (() => {
    const d = latest ? new Date(latest.date.replace(/\//g, '-') + 'T12:00:00') : new Date();
    d.setDate(d.getDate() + coverageDays);
    return getBusinessDate(d);
  })();
  const etihadFill = etihadCapacity ? Math.round((balance / etihadCapacity) * 100) : 0;
  const safe = coverageDays >= 30;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* 1. Main Strategic Black Oil KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Card 1: Total Balance */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white border border-purple-900/50 shadow-soft-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-purple-200">{t('finance:hub.bo.total')}</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
              <Droplets className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
              {formatNumber(etihadTotalBalance)}
            </span>
            <span className="text-xs font-bold text-purple-300">{t('common:units.liter')}</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-purple-800/40 flex items-center justify-between text-[11px] text-purple-300">
            <span>{t('finance:hub.bo.strategic')}</span>
            <span className="font-mono font-bold text-emerald-400">{latest ? latest.date : t('finance:hub.bo.noRecord')}</span>
          </div>
        </div>

        {/* Card 2: Total Capacity & Remaining */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('finance:hub.bo.capacity')}</span>
            <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">{etihadFill}%</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              {formatNumber(etihadCapacity)}
            </span>
            <span className="text-xs font-bold text-slate-400">{t('common:units.liter')}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full rounded-full" style={{ width: `${etihadFill}%` }} />
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">
            {t('finance:hub.bo.remaining')}: {formatNumber(etihadRemainingCapacity)} {t('common:units.liter')}
          </span>
        </div>

        {/* Card 3: Coverage Days */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('finance:hub.bo.coverage')}</span>
            <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-purple-600 dark:text-purple-400">
              {etihadCoverageDays}
            </span>
            <span className="text-xs font-bold text-slate-400">{t('finance:blackOil.form.daysUnit')}</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{t('finance:hub.bo.runOut')}</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{etihadCoverageDate}</span>
          </div>
        </div>

        {/* Card 4: Operating Status */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-soft-card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{t('finance:hub.bo.safety')}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-black ${safe ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {safe ? t('finance:hub.bo.safe') : t('finance:hub.bo.needsTopUp')}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>{t('finance:blackOil.approvedAvg')}</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatNumber(avgDaily)} {t('common:units.liter')}</span>
          </div>
        </div>

      </div>

      {/* 2. السجل اليومي للنفط الأسود */}
      <BlackOilDailyLedger company={company} />

    </div>
  );
};
