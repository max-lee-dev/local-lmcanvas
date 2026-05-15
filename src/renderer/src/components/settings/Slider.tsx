import type { ReactNode } from "react";

type SliderProps = {
  value: number;
  onChange: (value: number) => void;
  onMouseUp?: (value: number) => void;
  label: string;
  description: string;
  icon: ReactNode;
  min: number;
  max: number;
  step: number;
};

export function Slider({
  value,
  onChange,
  onMouseUp,
  label,
  description,
  icon,
  min,
  max,
  step,
}: SliderProps) {
  return (
    <div className="flex flex-col gap-2 w-full px-3 py-3 rounded-xl border bg-card border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-muted-foreground">{icon}</div>
          <div>
            <div className="text-sm font-medium text-foreground">{label}</div>
            <div className="text-xs mt-0.5 text-muted-foreground">{description}</div>
          </div>
        </div>
        <div className="text-xs font-mono tabular-nums text-muted-foreground pt-0.5">
          {value.toFixed(1)}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onMouseUp={(e) =>
          onMouseUp?.(parseFloat((e.target as HTMLInputElement).value))
        }
        onTouchEnd={(e) =>
          onMouseUp?.(parseFloat((e.target as HTMLInputElement).value))
        }
        aria-label={label}
        className="w-full cursor-pointer accent-foreground"
      />
    </div>
  );
}
