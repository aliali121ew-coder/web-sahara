import React from 'react';
import { SaharaGasSection } from './SaharaGasSection';
import { EtihadGasSection } from './EtihadGasSection';
import { PetrolStationsSection } from './PetrolStationsSection';
import { FuelMetricsGrid } from './FuelMetricsGrid';
import { BlackOilSection } from './BlackOilSection';
import { CompanyTanksSection } from './CompanyTanksSection';
import { PriceIndexTable } from './PriceIndexTable';

export const MainDashboard: React.FC = () => {
  return (
    <div className="dash-root space-y-12 sm:space-y-[50px] animate-in fade-in duration-300 pb-6">
      {/* Section 1: كاز - صحاري كربلاء 2026 */}
      <SaharaGasSection />

      {/* Section 2: كاز - شركة الاتحاد */}
      <EtihadGasSection />

      {/* Section 3: تفاصيل نفط الأسود (الصحاري + الاتحاد + الإجمالي) */}
      <BlackOilSection />

      {/* Section 4: منظومة بنزين المحطات (الأرصدة + الوارد والصادر) */}
      <PetrolStationsSection />

      {/* Section 5: تفاصيل خزانات الشركة (مستطيلات بيانية + أسطوانات ثلاثية الأبعاد) */}
      <CompanyTanksSection />

      {/* Section 6: قسم مشتريات الوقود والمشتقات (5 بطاقات) */}
      <FuelMetricsGrid />

      {/* Section 7: مؤشرات أسعار الشركات والموردين */}
      <PriceIndexTable />
    </div>
  );
};
