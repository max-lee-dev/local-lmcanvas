import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";

type BadgePopoverProps = {
  /** Pill button content. */
  label: ReactNode;
  /** Popover body. Receives `close` to dismiss programmatically (e.g. after picking). */
  children: (ctx: { close: () => void }) => ReactNode;
  /** Optional title tooltip on the trigger. */
  title?: string;
  /** Visual override-vs-inherited hint applied to the pill. */
  overridden?: boolean;
  /** Extra class for the popover panel (e.g. min-width). */
  panelClassName?: string;
  /** Optional inline style for the trigger pill. */
  triggerStyle?: CSSProperties;
  /** ARIA props for the trigger button. */
  ariaHasPopup?: "listbox" | "dialog" | "menu";
  side?: "top" | "bottom";
};

export function BadgePopover({
  label,
  children,
  title,
  overridden,
  panelClassName,
  triggerStyle,
  ariaHasPopup = "dialog",
  side = "bottom",
}: BadgePopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent): void => {
      const root = wrapperRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="nodrag relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          "flex items-center gap-1 rounded-sm border bg-card text-foreground px-1.5 py-[5px] text-xs font-medium cursor-pointer outline-none transition-colors focus-visible:ring-1 focus-visible:ring-foreground/30",
          "hover:bg-muted",
          open && "bg-muted",
          overridden
            ? "border-accent/60 ring-1 ring-accent/30"
            : "border-border",
        )}
        style={{
          fontFamily: "var(--font-geist-pixel-square)",
          ...triggerStyle,
        }}
        title={title}
        aria-haspopup={ariaHasPopup}
        aria-expanded={open}
      >
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className={clsx(
              "absolute left-0 z-50 rounded-md border border-border bg-card shadow-lg overflow-hidden",
              side === "top" ? "bottom-full mb-1" : "top-full mt-1",
              panelClassName ?? "min-w-[180px]",
            )}
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {children({ close: () => setOpen(false) })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
