import React from 'react';
import { SaharaGasSection } from './SaharaGasSection';
import { EtihadGasSection } from './EtihadGasSection';
import { PetrolStationsSection } from './PetrolStationsSection';
import { FuelMetricsGrid } from './FuelMetricsGrid';
import { BlackOilSection } from './BlackOilSection';
import { CompanyTanksSection } from './CompanyTanksSection';
import { PriceIndexTable } from './PriceIndexTable';

// معرّفات الأقسام (dash-…) يستخدمها بحث الأقسام في الشريط العلوي (navigation/SectionSearch.tsx)
export const MainDashboard: React.FC = () => {
  return (
    <div className="dash-root space-y-12 sm:space-y-[50px] animate-in fade-in duration-300 pb-6">
      {/* Section 1: كاز - صحاري كربلاء 2026 */}
      <div id="dash-sahara-gas" className="scroll-mt-20 rounded-[28px]"><SaharaGasSection /></div>

      {/* Section 2: كاز - شركة الاتحاد */}
      <div id="dash-etihad-gas" className="scroll-mt-20 rounded-[28px]"><EtihadGasSection /></div>

      {/* Section 3: تفاصيل نفط الأسود (الصحاري + الاتحاد + الإجمالي) */}
      <div id="dash-black-oil" className="scroll-mt-20 rounded-[28px]"><BlackOilSection /></div>

      {/* Section 4: منظومة بنزين المحطات (الأرصدة + الوارد والصادر) */}
      <div id="dash-petrol" className="scroll-mt-20 rounded-[28px]"><PetrolStationsSection /></div>

      {/* Section 5: تفاصيل خزانات الشركة (مستطيلات بيانية + أسطوانات ثلاثية الأبعاد) */}
      <div id="dash-tanks" className="scroll-mt-20 rounded-[28px]"><CompanyTanksSection /></div>

      {/* Section 6: قسم مشتريات الوقود والمشتقات (5 بطاقات) */}
      <div id="dash-purchases" className="scroll-mt-20 rounded-[28px]"><FuelMetricsGrid /></div>

      {/* Section 7: مؤشرات أسعار الشركات والموردين */}
      <div id="dash-prices" className="scroll-mt-20 rounded-[28px]"><PriceIndexTable /></div>
    </div>
  );
};
