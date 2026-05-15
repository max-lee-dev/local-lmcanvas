import { useEffect } from "react";
import { usePreferencesStore } from "./usePreferencesStore";

const mediaQuery = (): MediaQueryList | null =>
  typeof window === "undefined" ? null : window.matchMedia("(prefers-color-scheme: dark)");

function apply(isDark: boolean): void {
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
}

export function useApplyTheme(): void {
  const theme = usePreferencesStore((s) => s.theme);

  useEffect(() => {
    const mq = mediaQuery();
    const resolved = theme === "auto" ? (mq?.matches ?? false) : theme === "dark";
    apply(resolved);

    if (theme !== "auto" || !mq) return;
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
}
