import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GitMerge, X } from "lucide-react";
import { useCanvasStore, useCanvasStoreApi } from "@/hooks/useCanvasStore";
import { focusNodeTextarea } from "@/lib/nodeDom";
import {
  FALLBACK_NODE_HEIGHT,
  NODE_WIDTH,
} from "@/lib/canvasConstants";
import { useCenterOnNode } from "@/hooks/useCenterOnNode";

export function MergeToolbar() {
  const merging = useCanvasStore((s) => s.merging);
  const mergeIds = useCanvasStore((s) => s.mergeIds);
  const cancelMerge = useCanvasStore((s) => s.cancelMerge);
  const commitMerge = useCanvasStore((s) => s.commitMerge);
  const nodes = useCanvasStore((s) => s.nodes);
  const storeApi = useCanvasStoreApi();
  const centerOnNode = useCenterOnNode();

  useEffect(() => {
    if (!merging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelMerge();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [merging, cancelMerge]);

  const canCommit = mergeIds.length >= 2;

  const handleConfirm = () => {
    const newId = commitMerge();
    if (!newId) return;
    requestAnimationFrame(() => {
      const fresh = storeApi.getState().nodes[newId];
      if (fresh) {
        centerOnNode(
          fresh.position.x,
          fresh.position.y,
          NODE_WIDTH,
          FALLBACK_NODE_HEIGHT,
        );
      }
      focusNodeTextarea(newId);
    });
  };

  // Defensive: if a selected merge id is no longer a node, hide.
  const validCount = mergeIds.filter((id) => Boolean(nodes[id])).length;

  return (
    <AnimatePresence>
      {merging && (
        <motion.div
          key="merge-toolbar"
          className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontFamily: "var(--font-geist-sans)" }}
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
            <GitMerge className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-foreground">
              {validCount < 2
                ? "Click another conversation to merge"
                : `Merging ${validCount} conversations`}
            </span>
            <div className="mx-1 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={cancelMerge}
              className="cursor-pointer rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Cancel merge"
              title="Cancel (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canCommit}
              className="cursor-pointer rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-card transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Merge
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
