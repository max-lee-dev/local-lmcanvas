import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { SelectionActionButton } from "@/components/Canvas/SelectionActionButton";
import { useBranchRequestStore } from "@/hooks/useBranchRequestStore";
import { useSelection } from "@/hooks/useSelection";
import { NodePanelComposer } from "./NodePanelComposer";

const MIN_PANEL_WIDTH = 360;
const MIN_VISIBLE_CANVAS_WIDTH = 280;

type NodePanelProps = {
  rightOffset?: number;
  width?: number | null;
  onWidthChange?: (width: number | null) => void;
};

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
export function NodePanel({
  rightOffset = 0,
  width = null,
  onWidthChange,
}: NodePanelProps = {}) {
  const api = useActivePaneStoreApi();
  const selectedId = useActiveSelectedNodeId();
  const activePaneId = useActivePaneStore((s) => s.activePaneId);
  const panelRef = useRef<HTMLDivElement>(null);
  const [resizeStart, setResizeStart] = useState<{
    pointerX: number;
    width: number;
  } | null>(null);

  const open = api !== null && selectedId !== null && activePaneId !== null;

  useEffect(() => {
    if (!resizeStart || !onWidthChange) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (event: MouseEvent) => {
      const availableWidth = window.innerWidth - rightOffset;
      const maxWidth = Math.max(
        MIN_PANEL_WIDTH,
        availableWidth - MIN_VISIBLE_CANVAS_WIDTH,
      );
      const nextWidth = resizeStart.width + resizeStart.pointerX - event.clientX;
      onWidthChange(Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, nextWidth)));
    };
    const onMouseUp = () => setResizeStart(null);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [onWidthChange, resizeStart, rightOffset]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          key={`node-panel-${activePaneId}`}
          data-node-panel
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          style={{ right: rightOffset, width: width ?? undefined }}
          className={`absolute top-0 h-full min-w-[360px] z-30 bg-background border-l border-border flex flex-col shadow-lg ${width === null ? "w-1/2" : ""}`}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize linear chat"
            title="Drag to resize · double-click to reset"
            onMouseDown={(event) => {
              if (!onWidthChange || !panelRef.current) return;
              event.preventDefault();
              event.stopPropagation();
              setResizeStart({
                pointerX: event.clientX,
                width: panelRef.current.getBoundingClientRect().width,
              });
            }}
            onDoubleClick={() => onWidthChange?.(null)}
            className="group absolute inset-y-0 -left-1 z-50 w-2 cursor-col-resize no-drag"
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-accent" />
          </div>
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
  const setPrefill = useStore(api, (s) => s.setPrefill);
  const requestBranch = useBranchRequestStore((s) => s.request);

  const messages = useMemo(
    () => getMessageHistoryForNode(nodeId, nodes),
    [nodeId, nodes],
  );
  const messageOwnerIds = useMemo(() => {
    const owners = new Map<string, string>();
    for (const historyNode of Object.values(nodes)) {
      for (const message of historyNode.data.chat.messages) {
        owners.set(message.id, historyNode.id);
      }
    }
    return owners;
  }, [nodes]);

  const node = nodes[nodeId];
  const streaming = Boolean(
    node?.data.chat.messages.some((message) => message.status === "streaming"),
  );
  const title = node?.data.title?.trim() || titleFromFirstUserMessage(messages);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSignatureRef = useRef<string>("");
  const selection = useSelection(scrollRef, { placement: "inside-right" });

  const createSelectionBranch = useCallback(() => {
    if (!selection) return;
    const historyMessage = selection.sourceElement?.closest<HTMLElement>(
      "[data-history-node-id]",
    );
    const addedContext = selection.text.trim();
    if (!addedContext) return;

    requestBranch({
      paneId,
      parentId: historyMessage?.dataset.historyNodeId ?? nodeId,
      addedContext,
      selectionMessageId: historyMessage?.dataset.historyMessageId,
    });
    selection.clear({ removeRange: true });
  }, [nodeId, paneId, requestBranch, selection]);

  useEffect(() => {
    if (!selection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      createSelectionBranch();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [createSelectionBranch, selection]);

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
      <div className="flex min-h-14 items-start gap-2 border-b border-border px-5 pb-3 pt-6 no-drag">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 leading-none mb-0.5"
            style={{ fontFamily: "var(--font-geist-mono)" }}
          >
            node
          </div>
          <div className="truncate text-base text-foreground/90">
            {title || "untitled"}
          </div>
        </div>
        <button
          onClick={() => setSelectedNodeId(null)}
          title="Close"
          className="-mt-0.5 flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-muted cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="node-panel-messages flex-1 overflow-y-auto px-5 py-5 space-y-5"
      >
        {messages.length === 0 && (
          <div className="text-sm text-muted-foreground/70">
            no messages yet — type below to start the conversation.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            data-history-node-id={messageOwnerIds.get(m.id) ?? nodeId}
            data-history-message-id={m.id}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "node-panel-message max-w-[85%] rounded-lg bg-muted px-3.5 py-2.5"
                  : "node-panel-message max-w-[95%]"
              }
            >
              <NodeResponse message={m} imageDisplay="preview" />
            </div>
          </div>
        ))}
      </div>

      {selection && (
        <SelectionActionButton
          isVisible
          relativeTop={selection.relativeTop}
          absolutePosition={selection.position}
          onClick={createSelectionBranch}
        />
      )}

      <NodePanelComposer
        paneId={paneId}
        parentId={nodeId}
        streaming={streaming}
        onStop={() => void window.api.chat.cancelForNode(nodeId)}
        onSubmitCurrentNode={
          node?.data.chat.messages.length === 0
            ? (text, attachments) =>
                setPrefill(nodeId, text, { autoSubmit: true, attachments })
            : undefined
        }
      />
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
