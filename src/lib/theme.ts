export type ThemeSettings = {
  primary: string;
  navy: string;
  background: string;
  foreground: string;
  fontColor: string;
  darkMode: boolean;
};

export const DEFAULT_THEME: ThemeSettings = {
  primary: "#c41e3a",
  navy: "#1c1917",
  background: "#f6f6f7",
  foreground: "#1c1917",
  fontColor: "#1c1917",
  darkMode: false,
};

const STORAGE_KEY = "elmaghraby-theme";

export function loadTheme(): ThemeSettings {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = { ...DEFAULT_THEME, ...JSON.parse(raw) } as ThemeSettings;
    if (parsed.primary === "#0f766e" || parsed.navy === "#0a2740") {
      return {
        ...parsed,
        primary: DEFAULT_THEME.primary,
        navy: DEFAULT_THEME.navy,
        background: parsed.background === "#e9eef5" ? DEFAULT_THEME.background : parsed.background,
        foreground: parsed.foreground === "#0b1f33" ? DEFAULT_THEME.foreground : parsed.foreground,
        fontColor: parsed.fontColor === "#0b1f33" ? DEFAULT_THEME.fontColor : parsed.fontColor,
      };
    }
    return parsed;
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
  root.style.setProperty("--border", dark ? "#334155" : "rgb(28 25 23 / 10%)");
  root.style.setProperty("--amber", "#d97706");
  root.classList.toggle("dark", dark);
}
