import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useStore } from "zustand";
import {
  CanvasStoreBridge,
  type CanvasStoreApi,
} from "@/hooks/useCanvasStore";
import { useActivePaneStoreApi } from "@/hooks/usePaneRegistry";
import { useActivePaneStore } from "@/hooks/useActivePane";
import { useActiveSelectedNodeId } from "@/hooks/useActiveSelectedNode";
import { getMessageHistoryForNode } from "@shared/history";
import { NodeResponse } from "@/components/Canvas/NodeResponse";
import { NodePanelComposer } from "./NodePanelComposer";

/**
 * Right-side drawer that shows the linear conversation history leading up
 * to the currently-selected node, plus a composer to keep the conversation
 * going. Submitting spawns a child node on the canvas (via the global
 * branch-request store) and selects it, so the drawer follows the chain.
 *
 * Visibility is driven entirely by canvas selection — the drawer mounts when
 * exactly one node is selected in the active pane and unmounts otherwise.
 * CanvasPage uses the same signal to auto-switch between this and the
 * BrowserPanel.
 */
export function NodePanel() {
  const api = useActivePaneStoreApi();
  const selectedId = useActiveSelectedNodeId();
  const activePaneId = useActivePaneStore((s) => s.activePaneId);

  const open = api !== null && selectedId !== null && activePaneId !== null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key={`node-panel-${activePaneId}-${selectedId}`}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="absolute top-0 right-0 h-full w-1/3 min-w-[360px] z-30 bg-background border-l border-border flex flex-col shadow-lg"
        >
          <CanvasStoreBridge api={api!}>
            <NodePanelBody
              api={api!}
              paneId={activePaneId!}
              nodeId={selectedId!}
            />
          </CanvasStoreBridge>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NodePanelBody({
  api,
  paneId,
  nodeId,
}: {
  api: CanvasStoreApi;
  paneId: string;
  nodeId: string;
}) {
  const nodes = useStore(api, (s) => s.nodes);
  const setSelectedNodeId = useStore(api, (s) => s.setSelectedNodeId);

  const messages = useMemo(
    () => getMessageHistoryForNode(nodeId, nodes),
    [nodeId, nodes],
  );

  const node = nodes[nodeId];
  const title = node?.data.title?.trim() || titleFromFirstUserMessage(messages);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSignatureRef = useRef<string>("");

  // Autoscroll to bottom whenever the visible message tail grows or streams.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const tailLen =
      last && last.blocks
        ? last.blocks.reduce((acc, b) => {
            if (b.type === "text") return acc + b.text.length;
            if (b.type === "thinking") return acc + b.text.length;
            return acc + 1;
          }, 0)
        : 0;
    const sig = `${messages.length}:${last?.id ?? ""}:${tailLen}`;
    if (sig === lastSignatureRef.current) return;
    lastSignatureRef.current = sig;
    // Defer one frame so motion's mount transform doesn't clip the scroll.
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  return (
    <>
      <div className="flex h-12 items-center gap-2 px-3 border-b border-border no-drag">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 leading-none mb-0.5"
            style={{ fontFamily: "var(--font-geist-mono)" }}
          >
            node
          </div>
          <div className="truncate text-sm text-foreground/90">
            {title || "untitled"}
          </div>
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          title="Close"
          className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-muted cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground/70">
            no messages yet — type below to start the conversation.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
                  : "max-w-[95%] text-sm"
              }
            >
              <NodeResponse message={m} />
            </div>
          </div>
        ))}
      </div>

      <NodePanelComposer paneId={paneId} parentId={nodeId} />
    </>
  );
}

function titleFromFirstUserMessage(messages: ReturnType<typeof getMessageHistoryForNode>): string {
  for (const m of messages) {
    if (m.role !== "user") continue;
    const text = m.blocks
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (text) return text.length > 60 ? text.slice(0, 60) + "…" : text;
  }
  return "";
}
