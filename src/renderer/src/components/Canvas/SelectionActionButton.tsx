import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Timer } from "lucide-react";

type SelectionActionButtonProps = {
  relativeTop: number;
  isVisible: boolean;
  onClick: (event?: MouseEvent<HTMLButtonElement>) => void;
  /** Optional second action — when provided, the button renders as a split
   *  control: left half runs `onClick` (persistent follow-up), right half
   *  runs `onTemporaryClick` (temporary follow-up that auto-deletes). */
  onTemporaryClick?: (event?: MouseEvent<HTMLButtonElement>) => void;
  absolutePosition?: { x: number; y: number };
};

export function SelectionActionButton({
  relativeTop,
  isVisible,
  onClick,
  onTemporaryClick,
  absolutePosition,
}: SelectionActionButtonProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const button = useMemo(() => {
    if (!isVisible) return null;

    const isSplit = Boolean(onTemporaryClick);
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

    const baseHalfClass =
      "cursor-pointer pointer-events-auto flex h-8 w-8 items-center justify-center bg-[var(--accent-brand)] text-[var(--background)] transition-opacity hover:opacity-90";

    if (!isSplit) {
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
          className={`${baseHalfClass} z-50 rounded-lg border border-[var(--accent-brand)] shadow-lg animate-in fade-in zoom-in-95 duration-200 nodrag`}
          style={{ position: positionClass as "fixed" | "absolute", ...style }}
          title="Create follow-up from selection"
        >
          <Plus className="h-4 w-4" />
        </button>
      );
    }

    return (
      <div
        className="pointer-events-auto z-50 flex h-8 w-16 overflow-hidden rounded-lg border border-[var(--accent-brand)] shadow-lg animate-in fade-in zoom-in-95 duration-200 nodrag"
        style={{ position: positionClass as "fixed" | "absolute", ...style }}
      >
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
          className={baseHalfClass}
          title="Create follow-up from selection"
        >
          <Plus className="h-4 w-4" />
        </button>
        <div
          aria-hidden
          className="w-px self-stretch bg-[var(--background)] opacity-30"
        />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onTemporaryClick?.(event);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onTemporaryClick?.();
            }
          }}
          aria-label="Create temporary follow-up from selection"
          tabIndex={0}
          className={baseHalfClass}
          title="Create temporary follow-up (auto-deletes 10s after it completes)"
        >
          <Timer className="h-4 w-4" />
        </button>
      </div>
    );
  }, [absolutePosition, isVisible, onClick, onTemporaryClick, relativeTop]);

  if (!button) return null;

  if (absolutePosition && mounted && typeof document !== "undefined") {
    return createPortal(button, document.body);
  }

  return button;
}
