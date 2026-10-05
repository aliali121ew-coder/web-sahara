import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS, TranslationDict, trText, translateDomTree } from '../lib/translations';

export type SupportedLanguage = 'ar' | 'en' | 'tr' | 'zh' | 'ur' | 'hi' | 'ru' | 'ja' | 'ko';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'rtl' | 'ltr';
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'ar', name: 'العربية', nativeName: 'العربية', flag: '🇮🇶', dir: 'rtl' },
  { code: 'en', name: 'English', nativeName: 'English (US)', flag: '🇺🇸', dir: 'ltr' },
  { code: 'tr', name: 'التركية', nativeName: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
  { code: 'zh', name: 'الصينية', nativeName: '中文 (简体)', flag: '🇨🇳', dir: 'ltr' },
  { code: 'ur', name: 'الأردية', nativeName: 'اردو', flag: '🇵🇰', dir: 'rtl' },
  { code: 'hi', name: 'الهندية', nativeName: 'हिन्दी', flag: '🇮🇳', dir: 'ltr' },
  { code: 'ru', name: 'الروسية', nativeName: 'Русский', flag: '🇷🇺', dir: 'ltr' },
  { code: 'ja', name: 'اليابانية', nativeName: '日本語', flag: '🇯🇵', dir: 'ltr' },
  { code: 'ko', name: 'الكورية', nativeName: '한국어', flag: '🇰🇷', dir: 'ltr' },
];

/** اللغات المفعّلة حاليًا في القائمة؛ البقية مخفية وترجماتها محفوظة لتُفعَّل لاحقًا */
const ENABLED: SupportedLanguage[] = ['ar', 'en'];
export const ACTIVE_LANGUAGES = LANGUAGES.filter(l => ENABLED.includes(l.code));

interface LanguageContextType {
  currentLanguage: SupportedLanguage;
  language: SupportedLanguage;
  currentLangInfo: LanguageOption;
  setLanguage: (lang: SupportedLanguage) => void;
  direction: 'rtl' | 'ltr';
  isRTL: boolean;
  t: (key: keyof TranslationDict) => string;
  tr: (text: string) => string;
  translations: TranslationDict;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguageState] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem('sahara_language');
    // لغة محفوظة غير مفعّلة الآن تعود للعربية
    return saved && ENABLED.includes(saved as SupportedLanguage) ? (saved as SupportedLanguage) : 'ar';
  });

  const currentLangInfo = LANGUAGES.find((l) => l.code === currentLanguage) || LANGUAGES[0];
  const direction = currentLangInfo.dir;
  const isRTL = direction === 'rtl';
  const translations = TRANSLATIONS[currentLanguage] || TRANSLATIONS.ar;

  useEffect(() => {
    localStorage.setItem('sahara_language', currentLanguage);
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = direction;

    if (currentLanguage !== 'ar') {
      // Immediate sweep
      translateDomTree(document.body, currentLanguage);
      const timer = setTimeout(() => {
        translateDomTree(document.body, currentLanguage);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentLanguage, direction]);

  const setLanguage = (lang: SupportedLanguage) => {
    setCurrentLanguageState(lang);
  };

  const t = (key: keyof TranslationDict): string => {
    return translations[key] || TRANSLATIONS.ar[key] || key;
  };

  const tr = (text: string): string => {
    return trText(text, currentLanguage);
  };

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        language: currentLanguage,
        currentLangInfo,
        setLanguage,
        direction,
        isRTL,
        t,
        tr,
        translations,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};


export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
