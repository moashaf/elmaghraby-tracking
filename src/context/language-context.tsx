"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppLanguage } from "@/lib/i18n";
import {
  DEFAULT_LANGUAGE,
  isAppLanguage,
  languageToDir,
  resolveInline,
  t as translate,
  translateColumn,
} from "@/lib/i18n";

type LanguageContextValue = {
  lang: AppLanguage;
  dir: "rtl" | "ltr";
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string) => string;
  tr: (ar: string, en?: string, zh?: string) => string;
  ui: (ar: string) => string;
  tc: (columnKey: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): AppLanguage | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("app_lang");
  return isAppLanguage(raw) ? raw : null;
}

function persistLanguage(lang: AppLanguage) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("app_lang", lang);
  document.cookie = `app_lang=${lang}; path=/; max-age=31536000; samesite=lax`;
}

function applyDocumentLanguage(lang: AppLanguage) {
  if (typeof document === "undefined") return;
  const dir = languageToDir(lang);
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  document.documentElement.dir = dir;
  document.documentElement.dataset.lang = lang;
}

export function LanguageProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: AppLanguage }) {
  const [lang, setLang] = useState<AppLanguage>(() => readStoredLanguage() ?? initialLanguage ?? DEFAULT_LANGUAGE);

  useEffect(() => {
    applyDocumentLanguage(lang);
    persistLanguage(lang);
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => {
    const dir = languageToDir(lang);
    const tr = (arText: string, enText?: string, zhText?: string) =>
      resolveInline(arText, lang, { en: enText, zh: zhText });
    return {
      lang,
      dir,
      setLanguage: (next) => {
        setLang(next);
        applyDocumentLanguage(next);
        persistLanguage(next);
      },
      t: (key) => translate(key, lang),
      tr,
      ui: (arText) => tr(arText),
      tc: (columnKey) => translateColumn(columnKey, lang),
    };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
