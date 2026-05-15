import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Folder, FolderOpen } from "lucide-react";
import type { CanvasSummary } from "@shared/types";
import { navigate } from "@/App";
import { prettyPath } from "@/lib/prettyPath";

type CanvasBreadcrumbProps = {
  cwd: string;
  currentCanvasId: string;
  saving: boolean;
};

export function CanvasBreadcrumb({
  cwd,
  currentCanvasId,
  saving,
}: CanvasBreadcrumbProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void window.api.canvases.list().then((list) => {
      if (!cancelled) setCanvases(list);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const otherCanvases = useMemo(
    () =>
      [...canvases]
        .filter((c) => c.id !== currentCanvasId)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [canvases, currentCanvasId],
  );

  const open = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setIsOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setIsOpen(false), 120);
  };

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={open}
      onMouseLeave={scheduleClose}
    >
      <div className="flex items-center gap-2 rounded-md border border-border bg-card/90 backdrop-blur px-2.5 py-1.5 text-xs shadow-sm cursor-default">
        {cwd && (
          <div className="flex items-center gap-1.5 text-foreground/80">
            <FolderOpen size={12} />
            <span>{prettyPath(cwd)}</span>
          </div>
        )}
        {saving && (
          <>
            {cwd && <span className="text-border">·</span>}
            <span className="text-muted-foreground">saving…</span>
          </>
        )}
        <ChevronDown
          size={11}
          className={`text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 w-[280px] rounded-md border border-border bg-popover shadow-lg overflow-hidden"
          >
            <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
              switch canvas
            </div>
            {otherCanvases.length === 0 ? (
              <div className="px-2.5 py-3 text-xs text-muted-foreground text-center">
                no other canvases
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto py-1">
                {otherCanvases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setIsOpen(false);
                      navigate(`/canvas/${c.id}`);
                    }}
                    className="w-full flex flex-col items-start px-2.5 py-1.5 text-left hover:bg-muted cursor-pointer"
                  >
                    <div className="text-xs font-medium text-foreground truncate w-full">
                      {c.name || "untitled canvas"}
                    </div>
                    <div
                      className="text-[10px] text-muted-foreground truncate w-full flex items-center gap-1"
                      title={c.cwd}
                    >
                      <Folder size={10} className="shrink-0" />
                      <span className="truncate">
                        {c.cwd ? prettyPath(c.cwd) : "no folder"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
