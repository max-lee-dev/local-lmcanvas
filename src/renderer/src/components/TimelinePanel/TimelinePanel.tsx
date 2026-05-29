import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Clock, Loader2, X } from "lucide-react";
import { useStore } from "zustand";
import {
  TIMELINE_PANEL_WIDTH,
  useTimelinePanelStore,
} from "@/hooks/useTimelinePanelStore";
import { useActivePaneStoreApi } from "@/hooks/usePaneRegistry";
import { useActivePaneStore } from "@/hooks/useActivePane";
import { useFocusRequestStore } from "@/hooks/useFocusRequestStore";
import { messageTextForTitle } from "@shared/history";
import type { CanvasNode, MessageStatus, NodeId } from "@shared/types";

type EntryStatus = MessageStatus | "idle";

type TimelineEntry = {
  id: NodeId;
  label: string;
  status: EntryStatus;
  lastActivity: number;
  messageCount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function deriveLabel(node: CanvasNode): string {
  const firstUser = node.data.chat.messages.find((m) => m.role === "user");
  if (firstUser) {
    const text = messageTextForTitle(firstUser);
    if (text) return text.length > 240 ? `${text.slice(0, 240)}…` : text;
  }
  if (node.data.title) return node.data.title;
  return "untitled";
}

function deriveEntry(node: CanvasNode): TimelineEntry | null {
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
    status,
    lastActivity,
    messageCount: messages.length,
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
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

type Bucket = { key: string; label: string; entries: TimelineEntry[] };

function bucketize(entries: TimelineEntry[], now: number): Bucket[] {
  const today = startOfDay(now);
  const yesterday = today - DAY_MS;
  const weekAgo = today - 6 * DAY_MS;
  const monthAgo = today - 30 * DAY_MS;

  const buckets: Bucket[] = [
    { key: "today", label: "today", entries: [] },
    { key: "yesterday", label: "yesterday", entries: [] },
    { key: "week", label: "earlier this week", entries: [] },
    { key: "month", label: "earlier this month", entries: [] },
    { key: "older", label: "older", entries: [] },
  ];

  for (const e of entries) {
    if (e.lastActivity >= today) buckets[0].entries.push(e);
    else if (e.lastActivity >= yesterday) buckets[1].entries.push(e);
    else if (e.lastActivity >= weekAgo) buckets[2].entries.push(e);
    else if (e.lastActivity >= monthAgo) buckets[3].entries.push(e);
    else buckets[4].entries.push(e);
  }

  return buckets.filter((b) => b.entries.length > 0);
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
  return <Check className="h-3 w-3 shrink-0 text-muted-foreground/70" />;
}

export function TimelinePanel() {
  const open = useTimelinePanelStore((s) => s.open);
  const setOpen = useTimelinePanelStore((s) => s.setOpen);
  const api = useActivePaneStoreApi();
  const activePaneId = useActivePaneStore((s) => s.activePaneId);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="timeline-panel"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          style={{ width: TIMELINE_PANEL_WIDTH }}
          className="absolute top-0 right-0 h-full z-40 bg-background border-l border-border flex flex-col shadow-lg"
        >
          <TimelinePanelHeader onClose={() => setOpen(false)} />
          {api && activePaneId ? (
            <TimelinePanelBody paneId={activePaneId} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground/70 px-4 text-center">
              focus a canvas to view its timeline
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TimelinePanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-12 items-center gap-2 px-3 border-b border-border no-drag">
      <Clock size={14} className="text-foreground/70" />
      <div className="flex-1 min-w-0">
        <div
          className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 leading-none"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          timeline
        </div>
      </div>
      <button
        onClick={onClose}
        title="Close timeline"
        className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-muted cursor-pointer"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function TimelinePanelBody({ paneId }: { paneId: string }) {
  const api = useActivePaneStoreApi();
  if (!api) return null;
  return <TimelinePanelBodyInner api={api} paneId={paneId} />;
}

function TimelinePanelBodyInner({
  api,
  paneId,
}: {
  api: NonNullable<ReturnType<typeof useActivePaneStoreApi>>;
  paneId: string;
}) {
  const nodes = useStore(api, (s) => s.nodes);
  const canvasId = useStore(api, (s) => s.canvasId);
  const setSelectedNodeId = useStore(api, (s) => s.setSelectedNodeId);
  const requestFocus = useFocusRequestStore((s) => s.requestFocus);

  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const entries = useMemo<TimelineEntry[]>(() => {
    const out: TimelineEntry[] = [];
    for (const node of Object.values(nodes)) {
      if (node.type !== "custom") continue;
      const entry = deriveEntry(node);
      if (entry) out.push(entry);
    }
    out.sort((a, b) => b.lastActivity - a.lastActivity);
    return out;
  }, [nodes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(q));
  }, [entries, query]);

  const buckets = useMemo(() => bucketize(filtered, now), [filtered, now]);

  const generatingCount = useMemo(
    () => entries.filter((e) => e.status === "streaming").length,
    [entries],
  );
  const errorCount = useMemo(
    () => entries.filter((e) => e.status === "error").length,
    [entries],
  );

  const handleJump = (entry: TimelineEntry) => {
    setSelectedNodeId(entry.id);
    if (canvasId) requestFocus(canvasId, entry.id);
  };

  void paneId;

  return (
    <>
      <div className="px-3 pt-2 pb-2 border-b border-border space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
          <span>
            <span className="text-foreground/80 font-medium">
              {entries.length}
            </span>{" "}
            node{entries.length === 1 ? "" : "s"}
          </span>
          {generatingCount > 0 && (
            <span className="flex items-center gap-1 text-accent-brand">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 inline-flex h-full w-full animate-ping rounded-full bg-accent-brand opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-brand" />
              </span>
              <span>{generatingCount} generating</span>
            </span>
          )}
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>{errorCount}</span>
            </span>
          )}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter nodes…"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className="w-full h-7 rounded-md border border-border bg-muted px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground/70">
            no nodes yet — start a conversation to see it appear here.
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground/70">
            no nodes match "{query}".
          </div>
        ) : (
          buckets.map((bucket) => (
            <TimelineBucket
              key={bucket.key}
              bucket={bucket}
              now={now}
              onJump={handleJump}
            />
          ))
        )}
      </div>
    </>
  );
}

function TimelineBucket({
  bucket,
  now,
  onJump,
}: {
  bucket: Bucket;
  now: number;
  onJump: (entry: TimelineEntry) => void;
}) {
  return (
    <div className="py-1">
      <div
        className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60"
        style={{ fontFamily: "var(--font-geist-mono)" }}
      >
        {bucket.label}
        <span className="ml-1.5 text-muted-foreground/60 normal-case font-normal tracking-normal">
          ({bucket.entries.length})
        </span>
      </div>
      <ul>
        {bucket.entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onJump(entry)}
              className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted cursor-pointer transition-colors border-b border-border/30"
            >
              <span className="mt-0.5">
                <StatusIcon status={entry.status} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block line-clamp-2 whitespace-pre-wrap break-words text-xs leading-snug text-foreground">
                  {entry.label}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground/70 tabular-nums">
                  <span>
                    {entry.status === "streaming"
                      ? "now"
                      : formatRelative(entry.lastActivity, now)}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>
                    {entry.messageCount} msg{entry.messageCount === 1 ? "" : "s"}
                  </span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
