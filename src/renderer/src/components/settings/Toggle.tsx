import { useCallback, type ReactNode } from "react";

type ToggleProps = {
  enabled: boolean;
  onToggle: () => void;
  label: string;
  description: string;
  icon: ReactNode;
  disabled?: boolean;
};

export function Toggle({
  enabled,
  onToggle,
  label,
  description,
  icon,
  disabled = false,
}: ToggleProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!disabled) onToggle();
      }
    },
    [onToggle, disabled],
  );

  return (
    <div className="flex items-center justify-between w-full px-3 py-3 rounded-xl border bg-card border-border">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-xs mt-0.5 text-muted-foreground">{description}</div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={label}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors duration-200 focus:outline-none ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        } ${enabled ? "bg-green-400 border-green-400" : "bg-muted border-border"}`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition duration-200 bg-card ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
