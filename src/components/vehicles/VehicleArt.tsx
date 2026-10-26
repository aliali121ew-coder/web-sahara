import React, { useEffect, useRef, useState } from 'react';
import { vehicleCategory } from '../../lib/vehicleFuel';

/**
 * صورة فئة العربة ورقمها مطبوع على بابها كلوحة.
 * الصورة بنمط object-contain، فيُحسب مستطيلها الفعلي داخل الإطار لوضع الرقم على الباب بدقة.
 */
export const VehicleArt: React.FC<{
  code: string;
  /** صورة خاصة بالعربة (ملفها) — تُعرض كما هي بلا رقم */
  photo?: string;
  className?: string;
  imgClassName?: string;
  /** حجم خط الرقم نسبةً لعرض الصورة */
  scale?: number;
}> = ({ code, photo, className = '', imgClassName = '', scale = 0.034 }) => {
  const cat = photo ? null : vehicleCategory(code);
  const box = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const img = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    // صورة من الذاكرة المؤقتة قد تكتمل قبل ربط onLoad
    if (img.current?.complete && img.current.naturalWidth) setNatural({ w: img.current.naturalWidth, h: img.current.naturalHeight });
    return () => ro.disconnect();
  }, []);

  const src = photo || cat?.image || '/trucks/semi_truck.jpg';
  // مستطيل الصورة المعروض داخل الإطار (object-contain يتوسّطه)
  const k = natural.w && boxSize.w ? Math.min(boxSize.w / natural.w, boxSize.h / natural.h) : 0;
  const iw = natural.w * k;
  const ih = natural.h * k;
  const left = (boxSize.w - iw) / 2;
  const top = (boxSize.h - ih) / 2;

  return (
    <div ref={box} className={`relative ${className}`}>
      <img
        ref={img}
        src={src}
        alt=""
        loading="lazy"
        onLoad={e => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        className={`absolute inset-0 w-full h-full object-contain ${imgClassName}`}
      />
      {cat && k > 0 && (
        <span
          dir="ltr"
          className="absolute whitespace-nowrap font-mono font-black leading-none text-white bg-[#111] rounded-[2px] pointer-events-none select-none"
          style={{
            left: left + iw * cat.door[0],
            top: top + ih * cat.door[1],
            fontSize: Math.max(6, iw * scale),
            padding: '0.2em 0.35em 0.16em',
            letterSpacing: '0.02em',
            // ملصق مطبوع على الباب: يتبع ميل جانب العربة، بلا ظل ولا بروز
            transform: `translate(-50%, -50%) skewY(${cat.tilt}deg) scaleX(0.92)`,
            boxShadow: `inset 0 0 0 ${Math.max(0.6, iw * scale * 0.07)}px rgba(255,255,255,0.85)`,
            opacity: 0.93,
          }}
        >
          {code}
        </span>
      )}
    </div>
  );
};
