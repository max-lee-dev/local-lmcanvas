import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { useConfirmDeleteStore } from "@/hooks/useConfirmDeleteStore";
import { useCanvasStore } from "@/hooks/useCanvasStore";

export function DeleteNodeModal() {
  const pendingIds = useConfirmDeleteStore((s) => s.pendingIds);
  const clear = useConfirmDeleteStore((s) => s.clear);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const isOpen = pendingIds.length > 0;
  const count = pendingIds.length;

  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => confirmButtonRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        clear();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, clear]);

  const onConfirm = () => {
    for (const id of pendingIds) removeNode(id);
    clear();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-50"
            onClick={clear}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -16 }}
            transition={{ duration: 0.18 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              className="rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl border border-white/10 bg-popover/70 backdrop-saturate-150"
            >
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground tracking-tight">
                  {count > 1 ? `Delete ${count} nodes` : "Delete node"}
                </h2>
                <button
                  type="button"
                  onClick={clear}
                  className="cursor-pointer inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    destructive action
                  </span>
                </p>
                <p className="text-sm text-foreground">
                  {count > 1
                    ? `delete these ${count} nodes? this cannot be undone.`
                    : "delete this node? this cannot be undone."}
                </p>
              </div>

              <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={clear}
                  className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  cancel
                </button>
                <button
                  ref={confirmButtonRef}
                  type="submit"
                  className="cursor-pointer rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:opacity-90 transition-opacity"
                >
                  delete
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
