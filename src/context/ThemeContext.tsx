import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeMode, SidebarStyle } from '../types';

interface ThemeContextType {
  themeMode: ThemeMode;
  sidebarStyle: SidebarStyle;
  toggleThemeMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setSidebarStyle: (style: SidebarStyle) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('sahara_theme_mode');
    return (saved as ThemeMode) || 'light';
  });

  const [sidebarStyle, setSidebarStyleState] = useState<SidebarStyle>(() => {
    const saved = localStorage.getItem('sahara_sidebar_style');
    return (saved as SidebarStyle) || 'navy';
  });

  const applyThemeMode = (mode: ThemeMode) => {
    const root = document.documentElement;
    // Temporarily disable transitions during theme swap to eliminate white/dark flash/lag
    root.classList.add('disable-transitions');

    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Force style recalculation then remove helper class
    window.getComputedStyle(root).opacity;
    requestAnimationFrame(() => {
      root.classList.remove('disable-transitions');
    });
  };

  useEffect(() => {
    localStorage.setItem('sahara_theme_mode', themeMode);
    applyThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('sahara_sidebar_style', sidebarStyle);
  }, [sidebarStyle]);

  const toggleThemeMode = () => {
    setThemeModeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const setSidebarStyle = (style: SidebarStyle) => {
    setSidebarStyleState(style);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        sidebarStyle,
        toggleThemeMode,
        setThemeMode,
        setSidebarStyle,
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
