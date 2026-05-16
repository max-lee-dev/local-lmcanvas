import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useCenterOnNode } from "@/hooks/useCenterOnNode";
import { messageTextForTitle } from "@shared/history";
import {
  FALLBACK_NODE_HEIGHT,
  NODE_WIDTH,
} from "@/lib/canvasConstants";
import type { CanvasNode, NodeId } from "@shared/types";

type InProgressEntry = {
  id: NodeId;
  label: string;
  position: { x: number; y: number };
};

function deriveLabel(node: CanvasNode): string {
  if (node.data.title) return node.data.title;
  const firstUser = node.data.chat.messages.find((m) => m.role === "user");
  if (firstUser) {
    const text = messageTextForTitle(firstUser);
    if (text) return text.length > 60 ? `${text.slice(0, 60)}…` : text;
  }
  return "untitled";
}

export function InProgressNodesIndicator() {
  const nodes = useCanvasStore((s) => s.nodes);
  const centerOnNode = useCenterOnNode();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const entries = useMemo<InProgressEntry[]>(() => {
    const out: InProgressEntry[] = [];
    for (const node of Object.values(nodes)) {
      const streaming = node.data.chat.messages.some(
        (m) => m.status === "streaming",
      );
      if (!streaming) continue;
      out.push({
        id: node.id,
        label: deriveLabel(node),
        position: node.position,
      });
    }
    return out;
  }, [nodes]);

  useEffect(() => {
    if (entries.length === 0) setOpen(false);
  }, [entries.length]);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const root = containerRef.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  if (entries.length === 0) return null;

  const handleJump = (entry: InProgressEntry) => {
    centerOnNode(
      entry.position.x,
      entry.position.y,
      NODE_WIDTH,
      FALLBACK_NODE_HEIGHT,
    );
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`${entries.length} generating`}
        aria-label={`${entries.length} nodes generating`}
        aria-expanded={open}
        className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-card/80 px-2 text-foreground/80 hover:text-foreground hover:bg-card backdrop-blur-sm cursor-pointer transition-colors"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 inline-flex h-full w-full animate-ping rounded-full bg-accent-brand opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-brand" />
        </span>
        <span className="text-[11px] tabular-nums font-medium">
          {entries.length}
        </span>
        <span className="text-[11px] text-muted-foreground">generating</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="in-progress-panel"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-9 z-50 w-72 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          >
            <div className="border-b border-border px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                in progress
              </div>
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => handleJump(entry)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted cursor-pointer transition-colors"
                  >
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                    <span className="line-clamp-1 flex-1 text-xs text-foreground">
                      {entry.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
