"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translations } from "./translations";

export type Language = "id" | "en";

const STORAGE_KEY = "pengiriman-lang";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "id",
  setLanguage: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("id");

  useEffect(() => {
    // Mirrors the theme's own pre-hydration <head> script + post-mount readback pattern (see
    // AppShell's AccountMenu theme effect) - defaulting to "id" for SSR/first paint avoids a text
    // hydration mismatch, then this syncs from what the blocking script already stamped onto
    // <html> before React mounted.
    const attr = document.documentElement.getAttribute("data-lang");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLanguageState(attr === "en" ? "en" : "id");
  }, []);

  function setLanguage(lang: Language) {
    document.documentElement.setAttribute("data-lang", lang);
    document.documentElement.lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    setLanguageState(lang);
  }

  function t(key: string): string {
    return translations[language]?.[key] ?? translations.id[key] ?? key;
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
