import { useEffect } from "react";
import { usePreferencesStore, type ThemeMode } from "./usePreferencesStore";

type ResolvedTheme = Exclude<ThemeMode, "auto">;

const THEME_DEFS: Record<ResolvedTheme, { className: string | null; isDark: boolean }> = {
  light: { className: null, isDark: false },
  dark: { className: null, isDark: true },
  "solarized-light": { className: "theme-solarized-light", isDark: false },
  "solarized-dark": { className: "theme-solarized-dark", isDark: true },
  nord: { className: "theme-nord", isDark: true },
  dracula: { className: "theme-dracula", isDark: true },
  sepia: { className: "theme-sepia", isDark: false },
};

const ALL_THEME_CLASSES = Object.values(THEME_DEFS)
  .map((d) => d.className)
  .filter((c): c is string => c !== null);

const mediaQuery = (): MediaQueryList | null =>
  typeof window === "undefined" ? null : window.matchMedia("(prefers-color-scheme: dark)");

function apply(theme: ResolvedTheme): void {
  const root = document.documentElement;
  const def = THEME_DEFS[theme];
  root.classList.remove("dark", ...ALL_THEME_CLASSES);
  if (def.isDark) root.classList.add("dark");
  if (def.className) root.classList.add(def.className);
  root.style.colorScheme = def.isDark ? "dark" : "light";
}

function resolve(theme: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (theme === "auto") return systemDark ? "dark" : "light";
  return theme;
}

export function useApplyTheme(): void {
  const theme = usePreferencesStore((s) => s.theme);

  useEffect(() => {
    const mq = mediaQuery();
    apply(resolve(theme, mq?.matches ?? false));

    if (theme !== "auto" || !mq) return;
    const onChange = (e: MediaQueryListEvent) => apply(resolve(theme, e.matches));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
}
