import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";

type SelectionActionButtonProps = {
  relativeTop: number;
  isVisible: boolean;
  onClick: (event?: MouseEvent<HTMLButtonElement>) => void;
  absolutePosition?: { x: number; y: number };
};

export function SelectionActionButton({
  relativeTop,
  isVisible,
  onClick,
  absolutePosition,
}: SelectionActionButtonProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const button = useMemo(() => {
    if (!isVisible) return null;

    const positionClass = absolutePosition ? "fixed" : "absolute";
    const style = absolutePosition
      ? {
          top: absolutePosition.y,
          left: absolutePosition.x,
          transform: "translateY(-50%)",
          transition:
            "top 0.15s ease-out, left 0.15s ease-out, opacity 0.1s ease-out, transform 0.1s ease-out",
        }
      : {
          top: relativeTop,
          right: 8,
          transform: "translateY(-50%)",
          transition:
            "top 0.15s ease-out, right 0.15s ease-out, opacity 0.1s ease-out, transform 0.1s ease-out",
        };

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onClick();
          }
        }}
        aria-label="Create follow-up from selection"
        tabIndex={0}
        className="cursor-pointer pointer-events-auto z-50 flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--accent-brand)] bg-[var(--accent-brand)] text-white shadow-lg hover:opacity-90 animate-in fade-in zoom-in-95 duration-200 nodrag"
        style={{ position: positionClass as "fixed" | "absolute", ...style }}
      >
        <Plus className="h-4 w-4" />
      </button>
    );
  }, [absolutePosition, isVisible, onClick, relativeTop]);

  if (!button) return null;

  if (absolutePosition && mounted && typeof document !== "undefined") {
    return createPortal(button, document.body);
  }

  return button;
}
