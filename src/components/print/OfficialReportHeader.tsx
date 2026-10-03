import React from 'react';

interface OfficialReportHeaderRowProps {
  /** الشارة الداكنة فوق العنوان */
  badge: string;
  /** عنوان الكشف الرئيسي */
  title: string;
  /** نسخة مضغوطة للطباعة العمودية (عرض أضيق) */
  compact?: boolean;
}

/** صف الترويسة الرسمية الموحّدة للكشوفات المطبوعة: شعارات المجموعة يمينًا، العنوان وسطًا، شعار الاتحاد يسارًا */
export const OfficialReportHeaderRow: React.FC<OfficialReportHeaderRowProps> = ({ badge, title, compact = false }) => (
  <div className={`flex flex-row items-center justify-between w-full ${compact ? 'gap-2' : 'gap-5'}`}>
    
    {/* Right Section: Group Logos & Agricultural Entity Name */}
    <div className="flex flex-col items-start gap-1 shrink-0">
      <div className={`flex flex-row items-center flex-nowrap ${compact ? 'gap-1.5' : 'gap-2.5'}`}>
        <img
          src="/logos/sahara.png"
          alt="صحاري كربلاء"
          className={`${compact ? 'h-10' : 'h-14'} w-auto object-contain shrink-0`}
        />
        <img
          src="/logos/sama.png"
          alt="سما كربلاء"
          className={`${compact ? 'h-10' : 'h-14'} w-auto object-contain shrink-0`}
        />
        <img
          src="/logos/bawadi.png"
          alt="بوادي كربلاء"
          className={`${compact ? 'h-9' : 'h-12'} w-auto object-contain shrink-0`}
        />
        <img
          src="/logos/kac.png"
          alt="مدينة كربلاء الزراعية"
          className={`${compact ? 'h-9' : 'h-12'} w-auto object-contain shrink-0`}
        />
      </div>
      <div className="mt-0.5">
        <h1 className={`${compact ? 'text-[11px]' : 'text-[13px]'} font-black text-slate-950 leading-tight whitespace-nowrap`}>
          مجموعة شركات كربلاء للإنتاج الزراعي والحيواني
        </h1>
        <p className={`${compact ? 'text-[8.5px]' : 'text-[10px]'} font-bold text-slate-700 whitespace-nowrap`}>
          الإدارة المركزية للوقود والمشتقات النفطية
        </p>
      </div>
    </div>

    {/* Center Section: Official Clean Title */}
    <div className={`text-center flex flex-col items-center justify-center ${compact ? 'min-w-0 px-1' : 'shrink-0 px-4'}`}>
      <div className="inline-block px-5 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-black tracking-wide mb-1">
        {badge}
      </div>
      <h2 className={`${compact ? 'text-[13px]' : 'text-lg'} font-black text-slate-950 tracking-tight leading-snug`}>
        {title}
      </h2>
    </div>

    {/* Left Section: Strategic Partner Logo in Pure Arabic */}
    <div className="flex flex-col items-end gap-1 shrink-0">
      <img
        src="/logos/etihad.png"
        alt="شركة الاتحاد"
        className={`${compact ? 'h-11' : 'h-16'} w-auto object-contain shrink-0`}
      />
      <div className="text-left" dir="rtl">
        <span className={`${compact ? 'text-[10.5px]' : 'text-[12.5px]'} font-black text-slate-950 block leading-tight whitespace-nowrap`}>
          مجموعة الاتحاد للصناعات
        </span>
        <span className="text-[9.5px] font-bold text-blue-900 block whitespace-nowrap">
          الشريك الاستراتيجي المعتمد
        </span>
      </div>
    </div>

  </div>
);
