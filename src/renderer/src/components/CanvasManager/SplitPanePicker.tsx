import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Columns2, Search } from "lucide-react";
import type { CanvasSummary } from "@shared/types";
import { prettyPath } from "@/lib/prettyPath";
import { openInSplit } from "@/lib/canvasNavigation";

type SplitPanePickerProps = {
  open: boolean;
  onClose: () => void;
  /** Canvas ids already open in panes — filtered out of the list. */
  excludeIds: string[];
};

/**
 * Arc-style picker: opens via ⌘S (configurable), shows a search input + list
 * of canvases not already open. Enter loads the highlighted canvas into a new
 * pane alongside the active one.
 */
export function SplitPanePicker({
  open,
  onClose,
  excludeIds,
}: SplitPanePickerProps) {
  const [query, setQuery] = useState("");
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    void window.api.canvases.list().then((all) => {
      setCanvases(
        [...all].sort((a, b) => b.updatedAt - a.updatedAt),
      );
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => {
    const excluded = new Set(excludeIds);
    const q = query.trim().toLowerCase();
    return canvases
      .filter((c) => !excluded.has(c.id))
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          (c.cwd ?? "").toLowerCase().includes(q)
        );
      });
  }, [canvases, excludeIds, query]);

  useEffect(() => {
    setActiveIndex((i) => {
      if (filtered.length === 0) return 0;
      return Math.min(i, filtered.length - 1);
    });
  }, [filtered]);

  // Keep the active row in view as the user navigates.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-row-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const commit = (c: CanvasSummary) => {
    openInSplit(c.id);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[activeIndex];
      if (target) commit(target);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="split-pane-picker"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[12vh]"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-xl"
            style={{ fontFamily: "var(--font-geist-sans)" }}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Columns2 className="h-4 w-4 text-muted-foreground" />
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Open canvas in split…"
                className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <div
              ref={listRef}
              className="max-h-[40vh] overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {canvases.length === 0
                    ? "no canvases yet"
                    : "no other canvases match"}
                </div>
              ) : (
                filtered.map((c, i) => (
                  <button
                    key={c.id}
                    data-row-index={i}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => commit(c)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm cursor-pointer ${
                      i === activeIndex ? "bg-secondary" : "hover:bg-secondary/60"
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    {c.cwd && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {prettyPath(c.cwd)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
              <span>↑↓ navigate · enter open · esc close</span>
              <span>opens in new pane</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
