import React from 'react';
import { vehicleImage } from '../../lib/vehicleFuel';

/** صورة العربة: صورتها الخاصة إن وُجدت، وإلا صورة فئتها (شفافة بلا خلفية) */
export const VehicleArt: React.FC<{
  code: string;
  /** صورة خاصة بالعربة (ملفها) */
  photo?: string;
  className?: string;
  imgClassName?: string;
}> = ({ code, photo, className = '', imgClassName = '' }) => (
  // «relative» افتراضيًا فقط: مع absolute يتغلّب relative فينهار ارتفاع الإطار وتختفي الصورة
  <div className={`${/(^|\s)(absolute|fixed)(\s|$)/.test(className) ? '' : 'relative '}${className}`}>
    <img src={vehicleImage(code, photo)} alt="" loading="lazy" className={`absolute inset-0 w-full h-full object-contain ${imgClassName}`} />
  </div>
);
