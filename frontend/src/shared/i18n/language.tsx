"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useDcimStore } from "@/store/useDcimStore";

export type AppLanguage = "zh-TW" | "en";

type LanguageContextValue = {
  language: AppLanguage;
  toggleLanguage: () => void;
  setLanguage: (lang: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useDcimStore((s) => s.uiLanguage);
  const setUiLanguage = useDcimStore((s) => s.setUiLanguage);

  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "zh-Hant";
  }, [language]);

  const setLanguage = (lang: AppLanguage) => {
    setUiLanguage(lang);
  };

  const toggleLanguage = () => {
    setUiLanguage(language === "zh-TW" ? "en" : "zh-TW");
  };

  const value = useMemo(
    () => ({ language, toggleLanguage, setLanguage }),
    [language, setUiLanguage],
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
