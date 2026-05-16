import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReactFlow } from "@xyflow/react";
import { AlertCircle, Check, Clock, Loader2 } from "lucide-react";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useCenterOnNode } from "@/hooks/useCenterOnNode";
import { messageTextForTitle } from "@shared/history";
import {
  FALLBACK_NODE_HEIGHT,
  FOCUS_ZOOM,
  NODE_WIDTH,
} from "@/lib/canvasConstants";
import type { CanvasNode, MessageStatus, NodeId } from "@shared/types";

const MAX_RECENT = 5;
const PREVIEW_DURATION_MS = 220;

type EntryStatus = MessageStatus | "idle";

type RecentEntry = {
  id: NodeId;
  label: string;
  position: { x: number; y: number };
  status: EntryStatus;
  lastActivity: number;
};

function deriveLabel(node: CanvasNode): string {
  const firstUser = node.data.chat.messages.find((m) => m.role === "user");
  if (firstUser) {
    const text = messageTextForTitle(firstUser);
    if (text) return text.length > 200 ? `${text.slice(0, 200)}…` : text;
  }
  if (node.data.title) return node.data.title;
  return "untitled";
}

function deriveEntry(node: CanvasNode): RecentEntry | null {
  const messages = node.data.chat.messages;
  if (messages.length === 0) return null;
  let status: EntryStatus = "idle";
  let lastActivity = 0;
  for (const m of messages) {
    if (m.createdAt > lastActivity) lastActivity = m.createdAt;
    if (m.status === "streaming") status = "streaming";
    else if (m.status === "error" && status !== "streaming") status = "error";
    else if (m.status === "complete" && status === "idle") status = "complete";
  }
  return {
    id: node.id,
    label: deriveLabel(node),
    position: node.position,
    status,
    lastActivity,
  };
}

function formatRelative(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function StatusIcon({ status }: { status: EntryStatus }) {
  if (status === "streaming") {
    return (
      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-accent-brand" />
    );
  }
  if (status === "error") {
    return <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />;
  }
  return <Check className="h-3 w-3 shrink-0 text-muted-foreground" />;
}

export function InProgressNodesIndicator() {
  const nodes = useCanvasStore((s) => s.nodes);
  const centerOnNode = useCenterOnNode();
  const { getViewport, setViewport } = useReactFlow();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const savedViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(
    null,
  );
  const committedRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  const previewNode = useCallback(
    (entry: RecentEntry) => {
      const container = document.querySelector(".react-flow") as HTMLElement | null;
      const cw = container?.clientWidth ?? window.innerWidth;
      const ch = container?.clientHeight ?? window.innerHeight;
      const centerX = entry.position.x + NODE_WIDTH / 2;
      const centerY = entry.position.y + FALLBACK_NODE_HEIGHT / 2;
      const vx = cw / 2 - centerX * FOCUS_ZOOM;
      const vy = ch / 2 - centerY * FOCUS_ZOOM;
      void setViewport(
        { x: vx, y: vy, zoom: FOCUS_ZOOM },
        { duration: PREVIEW_DURATION_MS },
      );
    },
    [setViewport],
  );

  const restoreViewport = useCallback(() => {
    const saved = savedViewportRef.current;
    if (!saved) return;
    void setViewport(saved, { duration: PREVIEW_DURATION_MS });
  }, [setViewport]);

  const entries = useMemo<RecentEntry[]>(() => {
    const out: RecentEntry[] = [];
    for (const node of Object.values(nodes)) {
      if (node.type !== "custom") continue;
      const entry = deriveEntry(node);
      if (entry) out.push(entry);
    }
    out.sort((a, b) => b.lastActivity - a.lastActivity);
    return out.slice(0, MAX_RECENT);
  }, [nodes]);

  const generatingCount = useMemo(
    () => entries.filter((e) => e.status === "streaming").length,
    [entries],
  );

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) {
      savedViewportRef.current = null;
      committedRef.current = false;
      return;
    }
    savedViewportRef.current = getViewport();
    committedRef.current = false;
    setNow(Date.now());
    const onDocPointerDown = (e: PointerEvent) => {
      const root = containerRef.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return;
      if (!committedRef.current) restoreViewport();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open, getViewport, restoreViewport]);

  if (entries.length === 0) return null;

  const handleJump = (entry: RecentEntry) => {
    committedRef.current = true;
    centerOnNode(
      entry.position.x,
      entry.position.y,
      NODE_WIDTH,
      FALLBACK_NODE_HEIGHT,
    );
    setOpen(false);
  };

  const isGenerating = generatingCount > 0;

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      {isGenerating ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={`${generatingCount} generating · recent nodes`}
          aria-label={`${generatingCount} nodes generating, recent nodes`}
          aria-expanded={open}
          className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-card/80 px-2 text-foreground/80 hover:text-foreground hover:bg-card backdrop-blur-sm cursor-pointer transition-colors"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 inline-flex h-full w-full animate-ping rounded-full bg-accent-brand opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-brand" />
          </span>
          <span className="text-[11px] tabular-nums font-medium">
            {generatingCount}
          </span>
          <span className="text-[11px] text-muted-foreground">generating</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="recent nodes"
          aria-label="recent nodes"
          aria-expanded={open}
          className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-muted cursor-pointer"
        >
          <Clock size={14} aria-hidden="true" />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            key="recent-panel"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-9 z-50 w-96 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
          >
            <div className="border-b border-border px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                recent nodes
              </div>
            </div>
            <ul
              className="max-h-[28rem] overflow-y-auto py-1"
              onMouseLeave={() => {
                if (!committedRef.current) restoreViewport();
              }}
            >
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => handleJump(entry)}
                    onMouseEnter={() => previewNode(entry)}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted cursor-pointer transition-colors"
                  >
                    <span className="mt-0.5">
                      <StatusIcon status={entry.status} />
                    </span>
                    <span className="line-clamp-4 flex-1 whitespace-pre-wrap break-words text-xs leading-snug text-foreground">
                      {entry.label}
                    </span>
                    <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {entry.status === "streaming"
                        ? "now"
                        : formatRelative(entry.lastActivity, now)}
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
