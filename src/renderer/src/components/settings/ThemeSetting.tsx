import { Laptop, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { usePreferencesStore, type ThemeMode } from "@/hooks/usePreferencesStore";

const options: Array<{ value: ThemeMode; label: string; icon: ReactNode }> = [
  { value: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" /> },
  { value: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" /> },
  { value: "auto", label: "Auto", icon: <Laptop className="h-3.5 w-3.5" /> },
];

export function ThemeSetting() {
  const theme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);

  return (
    <div className="flex items-center justify-between w-full px-3 py-3 rounded-xl border bg-card border-border">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">
          <Laptop className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">Theme</div>
          <div className="text-xs mt-0.5 text-muted-foreground">
            Light, dark, or match system
          </div>
        </div>
      </div>
      <div className="inline-flex items-center rounded-md border border-border bg-muted/50 p-0.5">
        {options.map((option) => {
          const isActive = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={isActive}
              className={`inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
