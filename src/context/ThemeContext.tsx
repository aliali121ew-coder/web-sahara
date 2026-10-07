import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ThemeMode,
  SidebarStyle,
  BgGradientTheme,
  BgType,
  GradientIntensity,
  UiDensity,
} from '../types';
import { useSessionProfile } from '../lib/session';
import { levelOf } from '../lib/permCatalog';

/** المظهر الافتراضي: خلفية تلقائية تتبع الوضع الفاتح/الليلي. يُطبَّق على من لا يملك صلاحية ضبط المظهر */
const DEFAULTS = { sidebarStyle: 'match-bg' as SidebarStyle, bgGradient: 'none' as BgGradientTheme, bgType: 'gradient' as BgType, gradientIntensity: 'subtle' as GradientIntensity, shadeLevel: 4, glassmorphism: true, uiDensity: 'standard' as UiDensity };

interface ThemeContextType {
  themeMode: ThemeMode;
  sidebarStyle: SidebarStyle;
  bgGradient: BgGradientTheme;
  bgType: BgType;
  gradientIntensity: GradientIntensity;
  shadeLevel: number;
  glassmorphism: boolean;
  uiDensity: UiDensity;
  toggleThemeMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setSidebarStyle: (style: SidebarStyle) => void;
  setBgGradient: (gradient: BgGradientTheme) => void;
  setBgType: (type: BgType) => void;
  setGradientIntensity: (intensity: GradientIntensity) => void;
  setShadeLevel: (level: number) => void;
  setGlassmorphism: (enabled: boolean) => void;
  setUiDensity: (density: UiDensity) => void;
  resetAllAppearance: () => void;
  /** هل يملك الحساب صلاحية تخصيص المظهر */
  canCustomize: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('sahara_theme_mode');
    return (saved as ThemeMode) || 'light';
  });

  const [sidebarStyle, setSidebarStyleState] = useState<SidebarStyle>(() => {
    const saved = localStorage.getItem('sahara_sidebar_style');
    return (saved as SidebarStyle) || DEFAULTS.sidebarStyle;
  });

  const [bgGradient, setBgGradientState] = useState<BgGradientTheme>(() => {
    const saved = localStorage.getItem('sahara_bg_gradient');
    return (saved as BgGradientTheme) || DEFAULTS.bgGradient;
  });

  const [bgType, setBgTypeState] = useState<BgType>(() => {
    const saved = localStorage.getItem('sahara_bg_type');
    return (saved as BgType) || 'gradient';
  });

  const [gradientIntensity, setGradientIntensityState] = useState<GradientIntensity>(() => {
    const saved = localStorage.getItem('sahara_gradient_intensity');
    return (saved as GradientIntensity) || 'subtle';
  });

  const [shadeLevel, setShadeLevelState] = useState<number>(() => {
    const saved = localStorage.getItem('sahara_shade_level');
    return saved ? Math.min(10, Math.max(1, Number(saved))) : 4;
  });

  const [glassmorphism, setGlassmorphismState] = useState<boolean>(() => {
    const saved = localStorage.getItem('sahara_glassmorphism');
    return saved !== null ? saved === 'true' : true;
  });

  const [uiDensity, setUiDensityState] = useState<UiDensity>(() => {
    const saved = localStorage.getItem('sahara_ui_density');
    return (saved as UiDensity) || 'standard';
  });

  // بدون صلاحية «ضبط المظهر»: تُعرض القيم الافتراضية دون مسح اختيارات الجهاز (تعود إن مُنحت الصلاحية)
  const profile = useSessionProfile();
  const canCustomize = !profile || levelOf(profile.perms || {}, !!profile.is_admin, 'appearance') >= 2;
  const eff = canCustomize
    ? { sidebarStyle, bgGradient, bgType, gradientIntensity, shadeLevel, glassmorphism, uiDensity }
    : DEFAULTS;

  const applyThemeMode = (mode: ThemeMode) => {
    const root = document.documentElement;
    root.classList.add('disable-transitions');

    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    window.getComputedStyle(root).opacity;
    requestAnimationFrame(() => {
      root.classList.remove('disable-transitions');
    });
  };

  const applyAttributes = (
    gradient: BgGradientTheme,
    bgTypeVal: BgType,
    intensity: GradientIntensity,
    shade: number,
    glass: boolean,
    density: UiDensity
  ) => {
    const root = document.documentElement;
    const body = document.body;

    root.dataset.bgGradient = gradient;
    body.dataset.bgGradient = gradient;

    root.dataset.bgType = bgTypeVal;
    body.dataset.bgType = bgTypeVal;

    root.dataset.gradientIntensity = intensity;
    body.dataset.gradientIntensity = intensity;

    root.dataset.shadeLevel = String(shade);
    body.dataset.shadeLevel = String(shade);

    root.dataset.glassmorphism = String(glass);
    body.dataset.glassmorphism = String(glass);

    root.dataset.uiDensity = density;
    body.dataset.uiDensity = density;
  };

  useEffect(() => {
    localStorage.setItem('sahara_theme_mode', themeMode);
    applyThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('sahara_sidebar_style', sidebarStyle);
  }, [sidebarStyle]);

  useEffect(() => {
    localStorage.setItem('sahara_bg_gradient', bgGradient);
    localStorage.setItem('sahara_bg_type', bgType);
    localStorage.setItem('sahara_gradient_intensity', gradientIntensity);
    localStorage.setItem('sahara_shade_level', String(shadeLevel));
    localStorage.setItem('sahara_glassmorphism', String(glassmorphism));
    localStorage.setItem('sahara_ui_density', uiDensity);

    applyAttributes(eff.bgGradient, eff.bgType, eff.gradientIntensity, eff.shadeLevel, eff.glassmorphism, eff.uiDensity);
  }, [bgGradient, bgType, gradientIntensity, shadeLevel, glassmorphism, uiDensity, canCustomize]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleThemeMode = () => {
    setThemeModeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const setSidebarStyle = (style: SidebarStyle) => {
    setSidebarStyleState(style);
  };

  const setBgGradient = (gradient: BgGradientTheme) => {
    setBgGradientState(gradient);
  };

  const setBgType = (type: BgType) => {
    setBgTypeState(type);
  };

  const setGradientIntensity = (intensity: GradientIntensity) => {
    setGradientIntensityState(intensity);
  };

  const setShadeLevel = (level: number) => {
    setShadeLevelState(Math.min(10, Math.max(1, Math.round(level))));
  };

  const setGlassmorphism = (enabled: boolean) => {
    setGlassmorphismState(enabled);
  };

  const setUiDensity = (density: UiDensity) => {
    setUiDensityState(density);
  };

  const resetAllAppearance = () => {
    setThemeModeState('light');
    setSidebarStyleState(DEFAULTS.sidebarStyle);
    setBgGradientState(DEFAULTS.bgGradient);
    setBgTypeState('gradient');
    setGradientIntensityState('subtle');
    setShadeLevelState(4);
    setGlassmorphismState(true);
    setUiDensityState('standard');
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        ...eff,
        canCustomize,
        toggleThemeMode,
        setThemeMode,
        setSidebarStyle,
        setBgGradient,
        setBgType,
        setGradientIntensity,
        setShadeLevel,
        setGlassmorphism,
        setUiDensity,
        resetAllAppearance,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

