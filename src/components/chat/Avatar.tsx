import React from 'react';
import { Users } from 'lucide-react';
import { colorFor, initials } from './chatUtils';

interface Props {
  id: string;
  name: string;
  src?: string;
  color?: string;
  size?: number;
  online?: boolean;
  group?: boolean;
  ring?: boolean;
  className?: string;
}

export const Avatar: React.FC<Props> = ({ id, name, src, color, size = 44, online, group, ring, className = '' }) => {
  const bg = color || colorFor(id || name);
  const radius = group ? size * 0.32 : size / 2;
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div className={ring ? 'cx-ring w-full h-full' : 'w-full h-full'} style={{ borderRadius: radius }}>
        {src ? (
          <img src={src} alt={name} draggable={false} className="w-full h-full object-cover select-none" style={{ borderRadius: radius }} />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-black text-white select-none"
            style={{
              borderRadius: radius,
              fontSize: size * 0.36,
              background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,.35), transparent 55%), linear-gradient(135deg, ${bg}, color-mix(in srgb, ${bg} 55%, #000))`,
            }}
          >
            {group && !name ? <Users style={{ width: size * 0.45, height: size * 0.45 }} /> : initials(name)}
          </div>
        )}
      </div>
      {online !== undefined && (
        <span
          className="absolute rounded-full border-2"
          style={{
            width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26),
            bottom: 0, left: 0,
            borderColor: 'var(--panel-solid)',
            background: online ? '#22c55e' : '#94a3b8',
            boxShadow: online ? '0 0 10px #22c55e' : 'none',
          }}
        />
      )}
    </div>
  );
};
