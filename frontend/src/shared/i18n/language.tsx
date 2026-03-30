"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "zh-TW" | "en";

type LanguageContextValue = {
  language: AppLanguage;
  toggleLanguage: () => void;
  setLanguage: (lang: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("zh-TW");

  useEffect(() => {
    const saved = window.localStorage.getItem("dcim-language");
    if (saved === "en" || saved === "zh-TW") {
      setLanguageState(saved);
      document.documentElement.lang = saved === "en" ? "en" : "zh-Hant";
    } else {
      document.documentElement.lang = "zh-Hant";
    }
  }, []);

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    window.localStorage.setItem("dcim-language", lang);
    document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
  };

  const toggleLanguage = () => {
    setLanguage(language === "zh-TW" ? "en" : "zh-TW");
  };

  const value = useMemo(
    () => ({ language, toggleLanguage, setLanguage }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
