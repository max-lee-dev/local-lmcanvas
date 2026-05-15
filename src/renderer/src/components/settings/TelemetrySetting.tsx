import { BarChart3 } from "lucide-react";
import { Toggle } from "./Toggle";

type Props = {
  enabled: boolean;
  onChange: (next: boolean) => void;
};

export function TelemetrySetting({ enabled, onChange }: Props) {
  return (
    <Toggle
      enabled={enabled}
      onToggle={() => onChange(!enabled)}
      label="Anonymous usage"
      description="Send an install count ping on launch. No prompts or content."
      icon={<BarChart3 className="w-4 h-4" />}
    />
  );
}
