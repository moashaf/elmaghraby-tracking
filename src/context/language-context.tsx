"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppLanguage } from "@/lib/i18n";
import { DEFAULT_LANGUAGE, languageToDir, t as translate } from "@/lib/i18n";

type LanguageContextValue = {
  lang: AppLanguage;
  dir: "rtl" | "ltr";
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
  tr: (ar: string, en: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): AppLanguage | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("app_lang");
  if (raw === "ar" || raw === "en") return raw;
  return null;
}

function persistLanguage(lang: AppLanguage) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("app_lang", lang);
  document.cookie = `app_lang=${lang}; path=/; max-age=31536000; samesite=lax`;
}

function applyDocumentLanguage(lang: AppLanguage) {
  if (typeof document === "undefined") return;
  const dir = languageToDir(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
}

export function LanguageProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: AppLanguage }) {
  const [lang, setLang] = useState<AppLanguage>(() => readStoredLanguage() ?? initialLanguage ?? DEFAULT_LANGUAGE);

  useEffect(() => {
    applyDocumentLanguage(lang);
    persistLanguage(lang);
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => {
    const dir = languageToDir(lang);
    return {
      lang,
      dir,
      setLanguage: (next) => {
        setLang(next);
        applyDocumentLanguage(next);
        persistLanguage(next);
      },
      toggleLanguage: () => {
        const next = lang === "ar" ? "en" : "ar";
        setLang(next);
        applyDocumentLanguage(next);
        persistLanguage(next);
      },
      t: (key) => translate(key, lang),
      tr: (arText, enText) => (lang === "ar" ? arText : enText),
    };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

