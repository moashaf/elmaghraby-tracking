"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyTheme, DEFAULT_THEME, loadTheme, saveTheme, type ThemeSettings } from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemeSettings;
  setTheme: (next: ThemeSettings) => void;
  patchTheme: (patch: Partial<ThemeSettings>) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeSettings>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadTheme();
    setThemeState(stored);
    applyTheme(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyTheme(theme);
    saveTheme(theme);
  }, [theme, ready]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: setThemeState,
      patchTheme: (patch: Partial<ThemeSettings>) => setThemeState((current) => ({ ...current, ...patch })),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
