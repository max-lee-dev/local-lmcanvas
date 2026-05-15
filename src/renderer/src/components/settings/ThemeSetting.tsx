import { Palette } from "lucide-react";
import { usePreferencesStore } from "@/hooks/usePreferencesStore";
import { ThemeDropdown } from "./ThemeDropdown";

export function ThemeSetting() {
  const theme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);

  return (
    <div className="flex items-center justify-between w-full px-3 py-3 rounded-xl border bg-card border-border">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">
          <Palette className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">Theme</div>
          <div className="text-xs mt-0.5 text-muted-foreground">
            Pick a palette or match system
          </div>
        </div>
      </div>
      <ThemeDropdown value={theme} onChange={setTheme} />
    </div>
  );
}
