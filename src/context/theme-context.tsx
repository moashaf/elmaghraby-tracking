"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyTheme, loadTheme, saveTheme, type ThemeSettings } from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemeSettings;
  setTheme: (next: ThemeSettings) => void;
  patchTheme: (patch: Partial<ThemeSettings>) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeSettings>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

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
