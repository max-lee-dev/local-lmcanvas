import { Merge } from "lucide-react";
import { ButtonTooltip } from "./ButtonTooltip";

type MergeButtonProps = {
  disabled: boolean;
  id: string;
  onClick: (source: string) => void;
};

export function MergeButton({ disabled, id, onClick }: MergeButtonProps) {
  return (
    <ButtonTooltip label="Merge">
      <button
        disabled={disabled}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick(id);
        }}
        onMouseDown={(event) => event.stopPropagation()}
        className={`flex h-7 min-w-[36px] ${disabled ? "cursor-default" : "cursor-pointer"} items-center justify-center gap-2 rounded-xl bg-foreground text-card px-2 text-xs font-semibold shadow-lg transition hover:opacity-90`}
        aria-label="Merge"
      >
        <Merge className="h-3 w-3" />
      </button>
    </ButtonTooltip>
  );
}
