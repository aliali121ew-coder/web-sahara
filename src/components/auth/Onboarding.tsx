import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * شرائح التقديم قبل شاشة الترحيب (الهاتف فقط) — تنتقل تلقائيًا كل 5 ثوانٍ،
 * وتُسحب بالإصبع أو بزر «التالي».
 * الصورة تملأ الشاشة وتتحرك ببطء داخلها من from إلى to مع تقريب خفيف، فيظهر الجزء المقصوص منها.
 */
type Slide = { img: string; tag: string; title: string; text: string; from: string; to: string };
const SLIDE_MS = 5000;
const SLIDES: Slide[] = [
  {
    img: '/onboarding/lpg.jpg',
    tag: 'الغاز المسال LPG',
    title: 'خزانات غاز مسال\nبأعلى معايير الأمان',
    text: 'تخزين آمن ومراقبة دقيقة لمستويات الغاز المسال على مدار الساعة.',
    from: 'center 48%',
    to: 'center 60%',
  },
  {
    img: '/onboarding/fuel-tanks.jpg',
    tag: 'كاز · نفط أسود · بنزين',
    title: 'خزانات الوقود\nتحت سيطرتك',
    text: 'أرصدة كل مشتق وحركة الوارد والصرف في مكان واحد وبتحديث لحظي.',
    from: '38% center',
    to: '58% center',
  },
  {
    img: '/onboarding/port.jpg',
    tag: 'ميناء أم قصر',
    title: 'متابعة تحميل وتفريغ\nالوقود في الميناء',
    text: 'حركة البواخر والشحنات والكميات المحمّلة والمفرّغة لحظة بلحظة حتى وصولها للخزانات.',
    from: '35% center',
    to: '55% center',
  },
  {
    img: '/onboarding/operations.jpg',
    tag: 'إمداد المزارع',
    title: 'أفضل وقود للمزارع\nلزيادة الإنتاجية',
    text: 'إمداد منتظم وموثوق لمزارع الدواجن يضمن استمرار التشغيل دون انقطاع.',
    from: '40% center',
    to: '60% center',
  },
];

export const Onboarding: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const last = index === SLIDES.length - 1;
  const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // الشريحة الحالية من موضع التمرير (scrollLeft سالب في الاتجاه من اليمين لليسار)
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    if (i !== index) setIndex(Math.min(SLIDES.length - 1, i));
  };
  const goTo = (i: number) => {
    const slide = track.current?.children[i] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  // الانتقال التلقائي كل 5 ثوانٍ (ويعود للأولى بعد الأخيرة)، ويتوقف أثناء لمس الشاشة
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => goTo((index + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, paused]);

  return (
    <div dir="rtl" className="fixed inset-0 bg-black text-white" role="region" aria-roledescription="شرائح تعريفية" aria-label="التعريف بالمنظومة">
      {/* الشرائح */}
      <div ref={track} onScroll={onScroll} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerCancel={() => setPaused(false)}
        className="auth-onb-track h-full flex overflow-x-auto snap-x snap-mandatory">
        {SLIDES.map((s, i) => (
          <section key={s.img} className="relative shrink-0 w-full h-full snap-start overflow-hidden" aria-label={`${i + 1} من ${SLIDES.length}`} aria-hidden={i !== index}>
            <img key={`img${index === i}`} src={s.img} alt="" decoding="async" draggable={false}
              className={`absolute inset-0 w-full h-full object-cover ${i === index && motion ? 'auth-onb-pan' : ''}`}
              style={{ objectPosition: s.from, ['--from' as string]: s.from, ['--to' as string]: s.to, animationPlayState: paused ? 'paused' : 'running' }} />
            {/* سواد متدرج من الأسفل */}
            <div className="auth-onb-shade absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 px-7 pb-[calc(9.5rem+env(safe-area-inset-bottom))]">
              <span key={`t${index === i}`} className={`inline-block text-[12px] font-bold px-3 py-1 rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur ${i === index ? 'auth-rise' : ''}`}>{s.tag}</span>
              <h2 key={`h${index === i}`} className={`mt-3 text-[clamp(22px,7vw,28px)] font-black leading-[1.35] whitespace-pre-line ${i === index ? 'auth-rise d1' : ''}`}>{s.title}</h2>
              <p key={`p${index === i}`} className={`mt-2.5 text-[15px] leading-7 text-white/80 ${i === index ? 'auth-rise d2' : ''}`}>{s.text}</p>
            </div>
          </section>
        ))}
      </div>


      {/* المؤشرات + الزر */}
      <div className="absolute inset-x-0 bottom-0 px-7 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-center gap-2 mb-5" role="tablist" aria-label="اختيار الشريحة">
          {SLIDES.map((_, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === index} aria-label={`الشريحة ${i + 1}`} onClick={() => goTo(i)}
              className="h-11 flex items-center">
              <span className={`relative block h-2 rounded-full overflow-hidden transition-all duration-300 ${i === index ? 'w-9 bg-white/30' : 'w-2 bg-white/45'}`}>
                {/* شريط تقدّم المؤقت داخل النقطة النشطة */}
                {i === index && <span key={index} className="auth-onb-progress absolute inset-y-0 right-0 bg-teal-300 rounded-full" style={{ animationPlayState: paused ? 'paused' : 'running' }} />}
              </span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => (last ? onDone() : goTo(index + 1))}
          className="auth-btn auth-focus w-full h-14 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2">
          التالي <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
