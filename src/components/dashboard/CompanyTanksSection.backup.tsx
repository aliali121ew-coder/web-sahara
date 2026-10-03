import React, { useState, useEffect, useRef } from 'react';
import {
  Waves,
  Activity,
  Thermometer
} from 'lucide-react';
import { formatNumber } from '../../lib/utils';

interface RealIndustrialTank {
  id: string;
  name: string;
  code: string;
  company: 'sahara' | 'etihad';
  companyLabel: string;
  fuelType: string;
  fillPercent: number;
  volumeLiters: number;
  capacityLiters: number;
  temperature: string;
  pressure: string;
  fluidColor: string;
  gradientFrom: string;
  gradientTo: string;
  status: 'safe' | 'warning' | 'critical';
  statusLabel: string;
}

export const CompanyTanksSection: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'sahara' | 'etihad'>('all');
  const [hoveredTank, setHoveredTank] = useState<string | null>(null);
  const [isSectionVisible, setIsSectionVisible] = useState<boolean>(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Trigger fluid filling animation when section reaches middle of viewport on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsSectionVisible(true);
        }
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const tanks: RealIndustrialTank[] = [
    {
      id: 't-1',
      name: 'خزان النفط الأسود',
      code: 'TK-01',
      company: 'sahara',
      companyLabel: 'صحاري كربلاء',
      fuelType: 'نفط أسود',
      fillPercent: 90,
      volumeLiters: 67191904,
      capacityLiters: 75000000,
      temperature: '48°C',
      pressure: '1.25 Bar',
      fluidColor: '#059669',
      gradientFrom: '#064e3b',
      gradientTo: '#10b981',
      status: 'safe',
      statusLabel: 'فائض استراتيجي',
    },
    {
      id: 't-2',
      name: 'خزان الكاز الرئيسي',
      code: 'TK-02',
      company: 'sahara',
      companyLabel: 'صحاري كربلاء',
      fuelType: 'كاز',
      fillPercent: 95,
      volumeLiters: 12793380,
      capacityLiters: 13500000,
      temperature: '32°C',
      pressure: '1.10 Bar',
      fluidColor: '#0d9488',
      gradientFrom: '#134e4a',
      gradientTo: '#14b8a6',
      status: 'safe',
      statusLabel: 'شبه ممتلئ',
    },
    {
      id: 't-3',
      name: 'خزان كاز الاتحاد',
      code: 'TK-03',
      company: 'etihad',
      companyLabel: 'شركة الاتحاد',
      fuelType: 'كاز',
      fillPercent: 95,
      volumeLiters: 12793380,
      capacityLiters: 13500000,
      temperature: '31°C',
      pressure: '1.42 Bar',
      fluidColor: '#059669',
      gradientFrom: '#065f46',
      gradientTo: '#34d399',
      status: 'safe',
      statusLabel: 'مخزون مؤمن',
    },
    {
      id: 't-4',
      name: 'خزان حجي أبو نور',
      code: 'TK-04',
      company: 'sahara',
      companyLabel: 'صحاري كربلاء',
      fuelType: 'تشغيلي خاص',
      fillPercent: 80,
      volumeLiters: 8000,
      capacityLiters: 10000,
      temperature: '28°C',
      pressure: '1.05 Bar',
      fluidColor: '#2563eb',
      gradientFrom: '#1e3a8a',
      gradientTo: '#3b82f6',
      status: 'safe',
      statusLabel: 'جاهزية تامة',
    },
    {
      id: 't-5',
      name: 'خزان البنزين',
      code: 'TK-05',
      company: 'sahara',
      companyLabel: 'صحاري كربلاء',
      fuelType: 'بنزين',
      fillPercent: 46,
      volumeLiters: 20000,
      capacityLiters: 45000,
      temperature: '35°C',
      pressure: '0.95 Bar',
      fluidColor: '#d97706',
      gradientFrom: '#78350f',
      gradientTo: '#f59e0b',
      status: 'warning',
      statusLabel: 'مستوى متوسط',
    },
    {
      id: 't-6',
      name: 'خزان نفط أسود الاتحاد',
      code: 'TK-06',
      company: 'etihad',
      companyLabel: 'شركة الاتحاد',
      fuelType: 'نفط أسود',
      fillPercent: 25,
      volumeLiters: 12500000,
      capacityLiters: 50000000,
      temperature: '52°C',
      pressure: '0.80 Bar',
      fluidColor: '#dc2626',
      gradientFrom: '#7f1d1d',
      gradientTo: '#ef4444',
      status: 'critical',
      statusLabel: 'بحاجة تعبئة',
    },
  ];

  const filteredTanks = tanks.filter((t) => {
    if (activeFilter === 'all') return true;
    return t.company === activeFilter;
  });

  return (
    <div ref={sectionRef} className="space-y-4">
      
      {/* Section Header with Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-teal-600 text-white shadow-md shadow-blue-500/20">
            <Waves className="w-4 h-4 text-teal-200 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                مراقبة الخزانات الميدانية
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-200/80 dark:border-blue-800/60">
                مستودعات التخزين الهندسية (API-650)
              </span>
            </div>
          </div>
        </div>

        {/* Filter Switcher Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-xs font-bold shadow-2xs self-start sm:self-auto">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-xl transition-all ${
              activeFilter === 'all'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            جميع الخزانات (6)
          </button>
          <button
            onClick={() => setActiveFilter('sahara')}
            className={`px-3 py-1 rounded-xl transition-all ${
              activeFilter === 'sahara'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            الصحاري (4)
          </button>
          <button
            onClick={() => setActiveFilter('etihad')}
            className={`px-3 py-1 rounded-xl transition-all ${
              activeFilter === 'etihad'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            الاتحاد (2)
          </button>
        </div>
      </div>

      {/* Grid of Realistic Industrial Storage Tanks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-stretch">
        {filteredTanks.map((tank) => {
          const isHovered = hoveredTank === tank.id;

          return (
            <div
              key={tank.id}
              onMouseEnter={() => setHoveredTank(tank.id)}
              onMouseLeave={() => setHoveredTank(null)}
              className={`rounded-[28px] bg-white dark:bg-slate-900 border transition-all duration-300 p-4 shadow-soft-card hover:shadow-soft-hover hover:-translate-y-1.5 flex flex-col justify-between space-y-3 relative overflow-hidden group ${
                isHovered
                  ? 'border-blue-400 dark:border-blue-500/80 shadow-lg shadow-blue-500/10'
                  : 'border-slate-200/90 dark:border-slate-800'
              }`}
            >
              {/* Tank Card Header with Prominent Executive Percentage Badge */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {tank.code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Glowing Percentage Pill */}
                    <span
                      className={`text-xs sm:text-sm font-black font-mono px-2.5 py-0.5 rounded-full border shadow-2xs ${
                        tank.status === 'safe'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                          : tank.status === 'warning'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse'
                      }`}
                    >
                      {tank.fillPercent}%
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between">
                  <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">
                    {tank.name}
                  </h4>
                  <span className="text-[9px] font-bold text-slate-400">
                    {tank.statusLabel}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block truncate">
                  {tank.companyLabel}
                </span>
              </div>

              {/* REALISTIC INDUSTRIAL CYLINDRICAL TANK WITH METALLIC DOME & WELD RINGS */}
              <div className="py-2 flex flex-col items-center justify-center relative">
                
                {/* 1. Tank Roof Dome Cap (قبة السقف الفولاذية مع فتحة الصيانة) */}
                <div className="relative w-28 sm:w-32 h-6 flex justify-center items-end">
                  {/* Top Vent Valve Cap */}
                  <div className="absolute -top-1.5 w-3 h-2 bg-slate-400 dark:bg-slate-600 rounded-t border border-slate-500 shadow-xs z-30" />
                  
                  {/* Conical Metallic Roof */}
                  <div className="w-full h-5 rounded-t-[100%] bg-gradient-to-b from-slate-300 via-slate-200 to-slate-400 dark:from-slate-700 dark:via-slate-600 dark:to-slate-800 border-t-2 border-x-2 border-slate-400/80 dark:border-slate-600 shadow-sm relative overflow-hidden">
                    {/* Roof Metallic Sheen Highlight */}
                    <div className="absolute inset-y-0 left-4 w-4 bg-white/40 dark:bg-white/10 blur-[1px] transform -skew-x-12" />
                  </div>
                </div>

                {/* 2. Main Tank Cylindrical Steel Shell (جسم الخزان الأسطواني الفولاذي) */}
                <div className="w-28 sm:w-32 h-40 bg-slate-100 dark:bg-slate-950/90 border-x-2 border-b-2 border-slate-400/90 dark:border-slate-700 relative overflow-hidden flex flex-col justify-end shadow-inner">
                  
                  {/* Horizontal Steel Weld Seam Lines (حلقات اللحام والتدعيم الفولاذية) */}
                  <div className="absolute inset-x-0 top-[25%] h-px bg-slate-300/80 dark:bg-slate-800 z-20 pointer-events-none" />
                  <div className="absolute inset-x-0 top-[50%] h-px bg-slate-300/80 dark:bg-slate-800 z-20 pointer-events-none" />
                  <div className="absolute inset-x-0 top-[75%] h-px bg-slate-300/80 dark:bg-slate-800 z-20 pointer-events-none" />

                  {/* Vertical Access Ladder (سلم الصيانة الجانبي) */}
                  <div className="absolute left-1.5 inset-y-0 w-2 flex flex-col justify-between py-1 z-20 pointer-events-none opacity-40">
                    <div className="w-full h-full border-l border-r border-slate-500/60 flex flex-col justify-between">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="w-full h-px bg-slate-500" />
                      ))}
                    </div>
                  </div>

                  {/* Vertical Percentage Gauge Tape (مسطرة قياس المنسوب مع التدريجات) */}
                  <div className="absolute right-1.5 inset-y-0 flex flex-col justify-between py-1 text-[8px] font-mono font-bold text-slate-400 select-none z-20 pointer-events-none">
                    <span>100</span>
                    <span>75</span>
                    <span>50</span>
                    <span>25</span>
                    <span>0</span>
                  </div>

                  {/* Realistic Fluid Reservoir with Live Scroll-Triggered Fluid Filling Animation */}
                  <div
                    className="w-full relative overflow-hidden transition-all duration-1000 ease-out"
                    style={{
                      height: isSectionVisible ? `${tank.fillPercent}%` : '0%',
                      background: `linear-gradient(to top, ${tank.gradientFrom}, ${tank.gradientTo})`,
                    }}
                  >
                    {/* Animated Surface Fluid Wave */}
                    <div className="absolute -top-2 inset-x-0 h-3 opacity-75">
                      <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-full animate-pulse">
                        <path
                          d="M0.00,49.98 C150.00,140.00 349.20,-40.00 500.00,49.98 L500.00,150.00 L0.00,150.00 Z"
                          fill="currentColor"
                          className="text-white/40"
                        />
                      </svg>
                    </div>

                    {/* Fluid Depth Glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30 pointer-events-none" />
                  </div>

                </div>

                {/* 3. Reinforced Concrete Foundation Base (القاعدة الخرسانية المتينة) */}
                <div className="w-32 sm:w-36 h-2.5 bg-gradient-to-r from-slate-400 via-slate-300 to-slate-500 dark:from-slate-800 dark:via-slate-700 dark:to-slate-900 rounded-b-md border-t border-slate-400 dark:border-slate-600 shadow-md z-10" />

              </div>

              {/* Tank Volume & Telemetry Sensors */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-bold text-slate-400">الكمية المخزونة:</span>
                  <div className="text-xs sm:text-sm font-black font-mono text-slate-900 dark:text-white">
                    {formatNumber(tank.volumeLiters)} <span className="text-[9px] font-normal text-slate-400">لتر</span>
                  </div>
                </div>

                {/* Telemetry Chips (Temp & Pressure) */}
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
                  <span className="flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-amber-500" />
                    {tank.temperature}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-blue-500" />
                    {tank.pressure}
                  </span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
