import { useCallback, useState } from "react";
import { Move } from "lucide-react";
import { usePreferencesStore } from "@/hooks/usePreferencesStore";
import { Slider } from "./Slider";

export function PanSpeedSetting() {
  const panOnScrollSpeed = usePreferencesStore((s) => s.panOnScrollSpeed);
  const setPanOnScrollSpeed = usePreferencesStore((s) => s.setPanOnScrollSpeed);
  const [tempValue, setTempValue] = useState<number | null>(null);

  const handleChange = useCallback((value: number) => {
    setTempValue(value);
  }, []);

  const handleCommit = useCallback(
    (value: number) => {
      setPanOnScrollSpeed(value);
      setTempValue(null);
    },
    [setPanOnScrollSpeed],
  );

  return (
    <Slider
      value={tempValue ?? panOnScrollSpeed}
      onChange={handleChange}
      onMouseUp={handleCommit}
      label="Panning speed"
      description="Scroll panning sensitivity on the canvas"
      icon={<Move className="w-4 h-4" />}
      min={0.1}
      max={3}
      step={0.1}
    />
  );
}
