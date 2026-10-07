import { BgGradientTheme, GradientIntensity, ThemeMode } from '../types';

const THEME_HEX_PALETTES: Record<
  BgGradientTheme,
  { light: string[]; dark: string[] }
> = {
  'frost-snow': {
    light: [
      '#ffffff', '#f8fafc', '#f1f5f9', '#e8eff7', '#e0f2fe',
      '#d7e7f8', '#c7ddf5', '#b6d2f1', '#a5c7ed', '#93bae8'
    ],
    dark: [
      '#060a10', '#0a101a', '#0f1725', '#141f32', '#192840',
      '#1f314f', '#253b5e', '#2c4670', '#345281', '#3d5f94'
    ]
  },
  'titanium-slate': {
    light: [
      '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#b0bec5',
      '#94a3b8', '#78909c', '#64748b', '#546e7a', '#475569'
    ],
    dark: [
      '#0b0f19', '#0f172a', '#141e33', '#19253d', '#1e2c47',
      '#243352', '#2a3b5c', '#314366', '#374b70', '#3e547a'
    ]
  },
  'petrol-blue': {
    light: [
      '#f0f7ff', '#e0f2fe', '#bae6fd', '#93c5fd', '#60a5fa',
      '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'
    ],
    dark: [
      '#081020', '#0b162c', '#0f1d38', '#142445', '#192c53',
      '#1e3461', '#233d6f', '#29477e', '#2f518e', '#355c9e'
    ]
  },
  'sahara-amber': {
    light: [
      '#fffbeb', '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24',
      '#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'
    ],
    dark: [
      '#180e05', '#241407', '#301b0a', '#3d220d', '#4a2a10',
      '#593213', '#683b17', '#78441a', '#884e1e', '#995822'
    ]
  },
  'emerald-flow': {
    light: [
      '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80',
      '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'
    ],
    dark: [
      '#041611', '#07211a', '#0a2d24', '#0e3a2e', '#124739',
      '#175544', '#1c6350', '#22715c', '#288068', '#2f9075'
    ]
  },
  'ocean-cyan': {
    light: [
      '#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee',
      '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63'
    ],
    dark: [
      '#05151e', '#081f2b', '#0b2938', '#0f3446', '#134055',
      '#184c64', '#1d5873', '#236583', '#297293', '#3080a4'
    ]
  },
  'royal-violet': {
    light: [
      '#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc',
      '#a855f7', '#9333ea', '#7e22ce', '#6b21a8', '#581c87'
    ],
    dark: [
      '#12091e', '#1a0d2b', '#231239', '#2d1748', '#371d57',
      '#422367', '#4e2978', '#5a3089', '#67379a', '#743eac'
    ]
  },
  'desert-bronze': {
    light: [
      '#faf7f5', '#f5eee8', '#ebdcd0', '#dec8b7', '#ceb29c',
      '#bd9a80', '#ab8164', '#966848', '#7f502d', '#673d1c'
    ],
    dark: [
      '#150f0b', '#1e1510', '#281c16', '#33241c', '#3e2c22',
      '#4a3429', '#563d30', '#634638', '#715040', '#805a48'
    ]
  },
  'glacier-blue': {
    light: [
      '#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8',
      '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e'
    ],
    dark: [
      '#071521', '#0b1e2e', '#0f283c', '#14334b', '#193e5b',
      '#1f4a6b', '#25577b', '#2c648d', '#33729e', '#3b80b0'
    ]
  },
  'none': {
    light: [
      '#fcfcfd', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1',
      '#b0bec5', '#94a3b8', '#78909c', '#64748b', '#475569'
    ],
    dark: [
      '#080c14', '#0d131f', '#111827', '#141e33', '#19253d',
      '#1e2c47', '#243352', '#2a3b5c', '#314366', '#374b70'
    ]
  }
};

/**
 * دالة حساب لون الخلفية الأساسي بالاعتماد على درجة الطبقة (1 إلى 10)
 */
export const getAmbientBgColor = (
  gradient: BgGradientTheme,
  mode: ThemeMode,
  shadeLevel: number = 2
): string => {
  const isDark = mode === 'dark';
  const level = Math.min(5, Math.max(0, Math.round(shadeLevel)));

  if (gradient === 'none') {
    return isDark ? '#090E17' : '#F8FAFC';
  }

  // التدرج في اللون الأساسي من الفاتح إلى الأغمق قليلاً كخلفية تحتية شفافة
  if (!isDark) {
    // نهاري: يبدأ من 250 (ناصع جداً) إلى 232 (رصاصي فاتح مريح)
    const factor = Math.round(250 - level * 3.6);
    if (gradient === 'titanium-slate') {
      return `rgb(${factor}, ${factor + 2}, ${factor + 5})`;
    }
    if (gradient === 'frost-snow') {
      return `rgb(${Math.min(255, factor + 3)}, ${Math.min(255, factor + 4)}, ${Math.min(255, factor + 5)})`;
    }
    return `rgb(${factor}, ${factor + 1}, ${factor + 3})`;
  } else {
    // ليلي: يبدأ من درجة كحلية/رمادية داكنة مريحة
    const base = Math.max(4, Math.round(14 - level * 1.6));
    if (gradient === 'frost-snow') {
      return `rgb(${Math.max(2, base - 2)}, ${base + 1}, ${base + 5})`;
    }
    return `rgb(${base}, ${base + 3}, ${base + 8})`;
  }
};

/**
 * دالة توليد تدرجات ألوان الخلفية المتعددة التدريجية الاحترافية
 * تدعم 10 طبقات تدريجية من الفاتح الهادئ إلى الأغمق قليلاً
 */
export const getAmbientGradientStyle = (
  gradient: BgGradientTheme,
  intensity: GradientIntensity,
  mode: ThemeMode,
  shadeLevel: number = 2
): string => {
  if (gradient === 'none') return 'none';

  const isDark = mode === 'dark';
  const isVibrant = intensity === 'vibrant';
  const level = Math.min(5, Math.max(0, Math.round(shadeLevel)));

  // معامل التدرج الطبقي من 0 (هادئ وفاتح جداً) إلى 5 (أغمق قليلاً وأكثر عمقاً)
  // النطاق: 0.35 إلى 1.45
  const scale = (0.35 + level * 0.22) * (isVibrant ? 1.25 : 1.0);

  // حساب الشفافية المعتمدة لكل نقطة
  const calcOp = (baseOp: number) => {
    const val = baseOp * scale;
    return Math.min(0.75, Math.max(0.04, Number(val.toFixed(3))));
  };

  switch (gradient) {
    case 'titanium-slate': {
      // 1. رمادي التيتانيوم الهادئ (الرصاصي الهندسي المريح للعين)
      const op1 = calcOp(isDark ? 0.30 : 0.22);
      const op2 = calcOp(isDark ? 0.25 : 0.18);
      const op3 = calcOp(isDark ? 0.18 : 0.12);
      return [
        `radial-gradient(circle at 12% 15%, rgba(148, 163, 184, ${op1}) 0%, transparent 60%)`,
        `radial-gradient(circle at 88% 85%, rgba(100, 116, 139, ${op2}) 0%, transparent 60%)`,
        `radial-gradient(circle at 50% 40%, rgba(203, 213, 225, ${op3}) 0%, transparent 65%)`,
      ].join(', ');
    }

    case 'petrol-blue': {
      // 2. أزرق النفط الملكي (أزرق ملكي، كحلي عميق، ونيلي)
      const op1 = calcOp(isDark ? 0.34 : 0.24);
      const op2 = calcOp(isDark ? 0.28 : 0.18);
      const op3 = calcOp(isDark ? 0.20 : 0.12);
      return [
        `radial-gradient(circle at 10% 15%, rgba(37, 99, 235, ${op1}) 0%, transparent 60%)`,
        `radial-gradient(circle at 90% 85%, rgba(14, 165, 233, ${op2}) 0%, transparent 60%)`,
        `radial-gradient(circle at 50% 40%, rgba(99, 102, 241, ${op3}) 0%, transparent 65%)`,
      ].join(', ');
    }

    case 'sahara-amber': {
      // 3. شفق صحاري كربلاء (درجات ذهبي وكهرمان وبرتقالي وشمس الغروب)
      const op1 = calcOp(isDark ? 0.32 : 0.23);
      const op2 = calcOp(isDark ? 0.26 : 0.17);
      const op3 = calcOp(isDark ? 0.18 : 0.11);
      return [
        `radial-gradient(circle at 10% 15%, rgba(245, 158, 11, ${op1}) 0%, transparent 60%)`,
        `radial-gradient(circle at 90% 85%, rgba(234, 88, 12, ${op2}) 0%, transparent 60%)`,
        `radial-gradient(circle at 50% 40%, rgba(251, 191, 36, ${op3}) 0%, transparent 65%)`,
      ].join(', ');
    }

    case 'emerald-flow': {
      // 4. زمرد الطاقة والنعناع (أخضر زمردي، تيل بحري، ونعناعي)
      const op1 = calcOp(isDark ? 0.32 : 0.22);
      const op2 = calcOp(isDark ? 0.25 : 0.16);
      const op3 = calcOp(isDark ? 0.18 : 0.11);
      return [
        `radial-gradient(circle at 12% 15%, rgba(16, 185, 129, ${op1}) 0%, transparent 60%)`,
        `radial-gradient(circle at 88% 85%, rgba(13, 148, 136, ${op2}) 0%, transparent 60%)`,
        `radial-gradient(circle at 50% 40%, rgba(6, 182, 212, ${op3}) 0%, transparent 65%)`,
      ].join(', ');
    }

    case 'ocean-cyan': {
      // 5. أمواج السيان الهندسية (سيان، أزرق سماوي، وأزرق ملكي)
      const op1 = calcOp(isDark ? 0.32 : 0.23);
      const op2 = calcOp(isDark ? 0.26 : 0.17);
      const op3 = calcOp(isDark ? 0.19 : 0.11);
      return [
        `radial-gradient(circle at 12% 15%, rgba(6, 182, 212, ${op1}) 0%, transparent 60%)`,
        `radial-gradient(circle at 88% 85%, rgba(2, 132, 199, ${op2}) 0%, transparent 60%)`,
        `radial-gradient(circle at 50% 40%, rgba(59, 130, 246, ${op3}) 0%, transparent 65%)`,
      ].join(', ');
    }

    case 'royal-violet': {
      // 6. الشفق الأرجواني واللافندر (بنفسجي، نيلي، ولافندر مهدئ)
      const op1 = calcOp(isDark ? 0.32 : 0.23);
      const op2 = calcOp(isDark ? 0.26 : 0.17);
      const op3 = calcOp(isDark ? 0.18 : 0.11);
      return [
        `radial-gradient(circle at 10% 15%, rgba(147, 51, 234, ${op1}) 0%, transparent 60%)`,
        `radial-gradient(circle at 90% 85%, rgba(79, 70, 229, ${op2}) 0%, transparent 60%)`,
        `radial-gradient(circle at 50% 40%, rgba(219, 39, 119, ${op3}) 0%, transparent 65%)`,
      ].join(', ');
    }

    case 'desert-bronze': {
      // 7. برونزي الصحراء الدافئ واللاتيه (درجات ترابية برونزية هادئة جداً)
      const op1 = calcOp(isDark ? 0.30 : 0.21);
      const op2 = calcOp(isDark ? 0.24 : 0.16);
      const op3 = calcOp(isDark ? 0.17 : 0.10);
      return [
        `radial-gradient(circle at 12% 15%, rgba(180, 83, 9, ${op1}) 0%, transparent 60%)`,
        `radial-gradient(circle at 88% 85%, rgba(217, 119, 6, ${op2}) 0%, transparent 60%)`,
        `radial-gradient(circle at 50% 40%, rgba(146, 64, 14, ${op3}) 0%, transparent 65%)`,
      ].join(', ');
    }

    case 'glacier-blue': {
      // 8. الأزرق الجليدي البارد (جليدي ناعم مهدئ للأعصاب ومريح للقراءة)
      const op1 = calcOp(isDark ? 0.28 : 0.20);
      const op2 = calcOp(isDark ? 0.22 : 0.15);
      const op3 = calcOp(isDark ? 0.16 : 0.10);
      return [
        `radial-gradient(circle at 10% 15%, rgba(56, 189, 248, ${op1}) 0%, transparent 60%)`,
        `radial-gradient(circle at 90% 85%, rgba(147, 197, 253, ${op2}) 0%, transparent 60%)`,
        `radial-gradient(circle at 50% 40%, rgba(186, 230, 253, ${op3}) 0%, transparent 65%)`,
      ].join(', ');
    }

    case 'frost-snow': {
      // الأبيض والجليد الثلجي الناصع الهادئ (Arctic Snow Frost)
      const op1 = calcOp(isDark ? 0.26 : 0.18);
      const op2 = calcOp(isDark ? 0.20 : 0.14);
      const op3 = calcOp(isDark ? 0.14 : 0.08);
      return [
        `radial-gradient(circle at 12% 14%, rgba(240, 249, 255, ${op1}) 0%, transparent 60%)`,
        `radial-gradient(circle at 88% 86%, rgba(224, 242, 254, ${op2}) 0%, transparent 60%)`,
        `radial-gradient(circle at 50% 45%, rgba(241, 245, 249, ${op3}) 0%, transparent 65%)`,
      ].join(', ');
    }

    default:
      return 'none';
  }
};

export interface ShadeItem {
  level: number;
  label: string;
  sublabel: string;
  bgHex: string;
  textLight: boolean;
}

const SHADE_LABELS: { label: string; sublabel: string }[] = [
  { label: 'الطبقة 0', sublabel: 'فائق الفاتح' },
  { label: 'الطبقة 1', sublabel: 'ناصع هادئ' },
  { label: 'الطبقة 2', sublabel: 'فاتح ناعم' },
  { label: 'الطبقة 3', sublabel: 'هادئ متوازن' },
  { label: 'الطبقة 4', sublabel: 'غني هادئ' },
  { label: 'الطبقة 5', sublabel: 'أغمق تباين' },
];



export const getShadePalette = (
  gradient: BgGradientTheme,
  mode: ThemeMode
): ShadeItem[] => {
  const isDark = mode === 'dark';
  const palette = THEME_HEX_PALETTES[gradient] || THEME_HEX_PALETTES['titanium-slate'];
  const fullColors = isDark ? palette.dark : palette.light;
  const colors = [fullColors[0], fullColors[2], fullColors[4], fullColors[6], fullColors[8], fullColors[9]];

  return colors.map((bgHex, idx) => {
    const level = idx;
    const meta = SHADE_LABELS[idx];
    // في الوضع الفاتح، الطبقات من 3 فما فوق يكون النص أبيض
    const textLight = isDark ? true : level >= 3;
    return {
      level,
      label: meta.label,
      sublabel: meta.sublabel,
      bgHex,
      textLight,
    };
  });
};

