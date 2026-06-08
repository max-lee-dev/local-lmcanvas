import { useState, type MouseEvent } from "react";
import { Timer, X } from "lucide-react";

type TemporaryBadgeProps = {
  /** Seconds remaining before auto-delete, or null when the countdown isn't running yet
   *  (still streaming, no completed assistant message, or paused by hover). */
  remaining: number | null;
  /** Called when the user clicks the X — should clear the `isTemporary` flag so
   *  the node persists like a regular one. */
  onConvertToPersistent: () => void;
};

export function TemporaryBadge({
  remaining,
  onConvertToPersistent,
}: TemporaryBadgeProps) {
  const [open, setOpen] = useState(false);

  const handleConvert = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    onConvertToPersistent();
    setOpen(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className="flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
        aria-label="Temporary node"
      >
        <Timer className="h-2.5 w-2.5" />
        {remaining != null && <span>{remaining}s</span>}
      </div>

      <button
        type="button"
        onClick={handleConvert}
        aria-label="Keep as persistent node"
        title="Keep as persistent node"
        className={`nodrag absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-500/60 bg-card text-amber-600 dark:text-amber-400 shadow-sm transition-opacity duration-100 hover:bg-amber-500/15 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <X className="h-2 w-2" />
      </button>

      {open && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-56 rounded-md border border-border bg-card px-2.5 py-2 text-[10px] leading-snug text-foreground shadow-lg"
        >
          <div className="mb-1 font-semibold text-amber-600 dark:text-amber-400">
            Temporary node
          </div>
          <div className="text-muted-foreground">
            Auto-deletes 10 seconds after the response finishes. Hover the node
            to pause and reset the countdown — move away to resume. Click the ×
            to keep this node permanently.
          </div>
        </div>
      )}
    </div>
  );
}
