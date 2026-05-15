import { useCallback, useEffect, useRef } from "react";

type SplitDividerProps = {
  /** Current left-pane width as a fraction in [0,1]. */
  fraction: number;
  /** Called with the new fraction during a drag. */
  onFractionChange: (next: number) => void;
  /** Width in px of the parent flex container; used to map mouse-x → fraction. */
  containerRef: React.RefObject<HTMLElement | null>;
};

const MIN_FRACTION = 0.2;
const MAX_FRACTION = 0.8;

/**
 * Vertical drag handle that resizes the left/right panes of a split view.
 * The handle is a thin column with a wider invisible grab strip for ergonomics.
 */
export function SplitDivider({
  fraction,
  onFractionChange,
  containerRef,
}: SplitDividerProps) {
  const draggingRef = useRef(false);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const raw = (e.clientX - rect.left) / rect.width;
      const clamped = Math.min(MAX_FRACTION, Math.max(MIN_FRACTION, raw));
      onFractionChange(clamped);
    },
    [containerRef, onFractionChange],
  );

  const onMouseUp = useCallback(() => {
    draggingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      onMouseDown={onMouseDown}
      className="relative h-full w-px shrink-0 cursor-col-resize bg-border/60 hover:bg-primary/40 transition-colors"
      style={{ touchAction: "none" }}
      title={`${Math.round(fraction * 100)}%`}
    >
      {/* Wider invisible grab strip on top of the visible 1px line */}
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  );
}
