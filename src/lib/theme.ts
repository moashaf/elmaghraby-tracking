export type ThemeSettings = {
  primary: string;
  navy: string;
  background: string;
  foreground: string;
  fontColor: string;
  darkMode: boolean;
};

export const DEFAULT_THEME: ThemeSettings = {
  primary: "#0f766e",
  navy: "#123c5a",
  background: "#f8fafc",
  foreground: "#0f172a",
  fontColor: "#0f172a",
  darkMode: false,
};

const STORAGE_KEY = "elmaghraby-theme";

export function loadTheme(): ThemeSettings {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: ThemeSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
}

export function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement;
  const dark = theme.darkMode;

  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--navy", theme.navy);
  root.style.setProperty("--background", dark ? "#0f172a" : theme.background);
  root.style.setProperty("--foreground", dark ? "#e2e8f0" : theme.fontColor || theme.foreground);
  root.style.setProperty("--surface", dark ? "#1e293b" : "#ffffff");
  root.style.setProperty("--muted", dark ? "#94a3b8" : "#64748b");
  root.style.setProperty("--border", dark ? "#334155" : "#cbd5e1");
  root.classList.toggle("dark", dark);
}
