import { Map } from "lucide-react";
import { usePreferencesStore } from "@/hooks/usePreferencesStore";
import { Toggle } from "./Toggle";

export function MinimapSetting() {
  const showMinimap = usePreferencesStore((s) => s.showMinimap);
  const setShowMinimap = usePreferencesStore((s) => s.setShowMinimap);

  return (
    <Toggle
      enabled={showMinimap}
      onToggle={() => setShowMinimap(!showMinimap)}
      label="Show minimap"
      description="Auto-hides after 3s of inactivity"
      icon={<Map className="w-4 h-4" />}
    />
  );
}
