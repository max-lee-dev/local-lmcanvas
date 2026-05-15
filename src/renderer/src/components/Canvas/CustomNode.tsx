import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Handle,
  NodeResizer,
  Position,
  useReactFlow,
  useStore,
  type NodeProps,
} from "@xyflow/react";
import { motion } from "framer-motion";
import { Check, Copy, Plus } from "lucide-react";
import clsx from "clsx";
import { makeBlankNode, useCanvasStore } from "@/hooks/useCanvasStore";
import { ModelBadge } from "./ModelBadge";
import { useNodeChat } from "@/hooks/useNodeChat";
import type { CanvasNode, ImageBlock } from "@shared/types";
import type { Attachment } from "@shared/ipc";
import { NodeResponse } from "./NodeResponse";
import { NodePromptInput, type NodePromptInputHandle } from "./NodePromptInput";
import { AskUserPrompt } from "./AskUserPrompt";
import { SelectionActionButton } from "./SelectionActionButton";
import { CustomNodeContextBanner } from "./CustomNodeContextBanner";
import { useAskUserStore } from "@/hooks/useAskUserStore";
import { useCenterOnNode } from "@/hooks/useCenterOnNode";
import { useSelection } from "@/hooks/useSelection";
import {
  FALLBACK_NODE_HEIGHT,
  NODE_MIN_HEIGHT,
  NODE_WIDTH,
  RIGHT_LANE_X_OFFSET,
  VERTICAL_CHILD_OFFSET,
} from "@/lib/canvasConstants";
import {
  makeDomHeightMeasurer,
  resolveCollisions,
} from "@/lib/collisionResolution";

type CustomNodeData = CanvasNode["data"];

function measureNodeHeight(nodeId: string, zoom: number): number {
  const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
  if (!el) return FALLBACK_NODE_HEIGHT;
  const rect = (el as HTMLElement).getBoundingClientRect();
  if (!zoom || zoom <= 0) return rect.height || FALLBACK_NODE_HEIGHT;
  return rect.height / zoom;
}

function focusNodeTextarea(nodeId: string): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        `.react-flow__node[data-id="${nodeId}"] textarea`,
      );
      if (textarea) {
        textarea.focus({ preventScroll: true });
      }
    });
  });
}

export { focusNodeTextarea };

function CustomNodeImpl(props: NodeProps) {
  const { id, data, selected } = props;
  const nodeData = data as CustomNodeData;
  const { submit, stop, streaming } = useNodeChat(id);
  const addNode = useCanvasStore((s) => s.addNode);
  const connectEdge = useCanvasStore((s) => s.connectEdge);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const movePosition = useCanvasStore((s) => s.movePosition);
  const getNode = useCanvasStore((s) => s.nodes[id]);
  const setPrefill = useCanvasStore((s) => s.setPrefill);
  const clearMessages = useCanvasStore((s) => s.clearMessages);
  const zoom = useStore((s) => s.transform[2]);
  const { screenToFlowPosition } = useReactFlow();
  const centerOnNode = useCenterOnNode();

  const [hovered, setHovered] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const askUserRequest = useAskUserStore((s) => s.byNode[id]);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const promptInputRef = useRef<NodePromptInputHandle | null>(null);
  const selection = useSelection(rootRef);

  const branch = useCallback(
    (opts?: {
      prefill?: string;
      addedContext?: string;
      selectionViewportY?: number;
    }) => {
      const prefill = opts?.prefill;
      const addedContext = opts?.addedContext;
      const selectionViewportY = opts?.selectionViewportY;
      const parentPos = getNode?.position ?? { x: 0, y: 0 };
      const isRightLane = Boolean(prefill) || Boolean(addedContext);
      let position: { x: number; y: number };
      let sourceYOffset: number | undefined;
      if (isRightLane) {
        const x = parentPos.x + RIGHT_LANE_X_OFFSET;
        if (selectionViewportY != null) {
          // Project the selection's viewport Y into flow coords so the new
          // node sits at the same vertical level as where the user selected,
          // not pinned to the top of the parent.
          const projected = screenToFlowPosition({ x: 0, y: selectionViewportY });
          position = { x, y: projected.y - FALLBACK_NODE_HEIGHT / 2 };
          // Attach the parent end of the edge at the selection Y so the
          // connector emerges from the selected text instead of a fixed handle.
          sourceYOffset = projected.y - parentPos.y;
        } else {
          position = { x, y: parentPos.y + 30 };
        }
      } else {
        position = {
          x: parentPos.x,
          y:
            parentPos.y +
            measureNodeHeight(id, zoom) +
            VERTICAL_CHILD_OFFSET,
        };
      }
      const child = makeBlankNode(position, id, addedContext);
      if (prefill) setPrefill(child.id, prefill);
      addNode(child);
      connectEdge(id, child.id, sourceYOffset != null ? { sourceYOffset } : undefined);

      // Match the avera branch flow: wait one rAF for the DOM to mount, then
      // resolve horizontal collisions, animate the camera to center on the
      // child at zoom 1.5, and focus its textarea.
      requestAnimationFrame(() => {
        const state = useCanvasStore.getState();
        const measure = makeDomHeightMeasurer(zoom);
        const moves = resolveCollisions(child.id, state.nodes, measure, {
          fixedWidth: NODE_WIDTH,
          excludeIds: [id],
        });
        for (const movedId of Object.keys(moves)) {
          movePosition(movedId, moves[movedId]);
        }

        const fresh = useCanvasStore.getState().nodes[child.id];
        if (fresh) {
          const h = measure(child.id);
          centerOnNode(
            fresh.position.x,
            fresh.position.y,
            NODE_WIDTH,
            h || FALLBACK_NODE_HEIGHT,
          );
        }

        focusNodeTextarea(child.id);
      });
    },
    [id, getNode, addNode, connectEdge, setPrefill, zoom, movePosition, centerOnNode, screenToFlowPosition]
  );

  const messages = nodeData.chat.messages;
  const userMessage = messages.find((m) => m.role === "user");
  const assistantMessage = messages.find((m) => m.role === "assistant");
  const hasSubmitted = Boolean(userMessage);
  const canEditPrompt = hasSubmitted;

  const userText = userMessage
    ? userMessage.blocks
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("")
    : "";

  const userAttachments = useMemo<Attachment[]>(() => {
    if (!userMessage) return [];
    return userMessage.blocks
      .filter((b): b is ImageBlock => b.type === "image")
      .map((b) => ({ mediaType: b.mediaType, base64: b.base64 }));
  }, [userMessage]);

  const beginEdit = useCallback(() => {
    if (!canEditPrompt) return;
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
    setIsEditingPrompt(true);
  }, [canEditPrompt]);

  const commitEdit = useCallback(
    (text: string, attachments?: Attachment[]) => {
      stop();
      clearMessages(id);
      setIsEditingPrompt(false);
      void submit(text, attachments);
    },
    [id, stop, clearMessages, submit]
  );

  useEffect(() => {
    if (!isEditingPrompt) return;
    const onPointerDown = (e: PointerEvent): void => {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      setIsEditingPrompt(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isEditingPrompt]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const assistantText = lastAssistant
    ? lastAssistant.blocks
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("\n\n")
    : "";

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent): void => {
      e.stopPropagation();
      // Avera: on idle (nothing submitted yet) delete immediately; otherwise require confirm.
      if (!hasSubmitted) {
        removeNode(id);
        return;
      }
      if (isConfirmingDelete) {
        removeNode(id);
        setIsConfirmingDelete(false);
        if (deleteTimeoutRef.current) {
          clearTimeout(deleteTimeoutRef.current);
          deleteTimeoutRef.current = null;
        }
      } else {
        setIsConfirmingDelete(true);
      }
    },
    [hasSubmitted, isConfirmingDelete, id, removeNode]
  );

  useEffect(() => {
    if (!isConfirmingDelete) {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }
      return;
    }
    deleteTimeoutRef.current = setTimeout(() => {
      setIsConfirmingDelete(false);
      deleteTimeoutRef.current = null;
    }, 10000);
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }
    };
  }, [isConfirmingDelete]);

  const showFollowUp = (hovered || selected) && hasSubmitted;

  const pendingDropFilesRef = useRef<File[] | null>(null);

  // Drain queued files into the prompt input once it mounts after an edit-mode
  // trigger. The ref is wired up by React on the next render.
  useEffect(() => {
    if (!isEditingPrompt) return;
    const pending = pendingDropFilesRef.current;
    if (!pending) return;
    pendingDropFilesRef.current = null;
    requestAnimationFrame(() => {
      void promptInputRef.current?.addFiles(pending);
    });
  }, [isEditingPrompt]);

  const promptInputMounted = !hasSubmitted || isEditingPrompt;

  const handleNodeDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const handleNodeDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    // Ignore leaves into descendants — only react when leaving the card.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  };
  const handleNodeDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (promptInputMounted) {
      void promptInputRef.current?.addFiles(files);
    } else if (canEditPrompt) {
      // Submitted node: enter edit mode and queue the files for the soon-to-mount input.
      pendingDropFilesRef.current = files;
      setIsEditingPrompt(true);
    }
  };

  useEffect(() => {
    if (!selection) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== "Enter") return;
      if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      const text = selection.text;
      const viewportY = selection.position.y;
      selection.clear({ removeRange: true });
      branch({ addedContext: text, selectionViewportY: viewportY });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selection, branch]);

  return (
    <motion.div
      ref={rootRef}
      className="relative"
      style={{ width: NODE_WIDTH }}
      data-node-id={id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      <NodeResizer
        isVisible={selected || hovered}
        minWidth={NODE_WIDTH}
        maxWidth={1100}
        minHeight={NODE_MIN_HEIGHT}
        lineClassName="!border-transparent"
        handleClassName="!h-3 !w-3 !border-0 !bg-transparent !shadow-none"
      />

      <Handle isConnectable={false} type="target" position={Position.Top} id="target-top" className="!opacity-0 !pointer-events-none" />
      <Handle isConnectable={false} type="target" position={Position.Right} id="target-right" className="!opacity-0 !pointer-events-none" />
      <Handle isConnectable={false} type="target" position={Position.Bottom} id="target-bottom" className="!opacity-0 !pointer-events-none" />
      <Handle isConnectable={false} type="target" position={Position.Left} id="target-left" className="!opacity-0 !pointer-events-none" />

      <div
        className={clsx(
          "relative border rounded-[10px] transition-colors duration-300 px-5 pb-4 pt-12 shadow-sm bg-card",
          nodeData.chat.addedContext && "rounded-t-none border-t-0",
          askUserRequest
            ? "border-yellow-400/60"
            : dragOver
            ? "border-accent bg-muted"
            : selected
            ? "border-accent bg-accent/10"
            : "border-border"
        )}
        onDragOver={handleNodeDragOver}
        onDragLeave={handleNodeDragLeave}
        onDrop={handleNodeDrop}
      >
        {askUserRequest && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[10px] bg-yellow-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.05, 0.18, 0.05] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <CustomNodeContextBanner addedContext={nodeData.chat.addedContext} />

        <div className="absolute left-4 top-3">
          <ModelBadge />
        </div>

        {/* Delete button — avera-style: top-right, opacity 0.6 idle, 1.0 on hover */}
        <button
          type="button"
          onClick={handleDeleteClick}
          className={clsx(
            "nodrag z-50 -right-2.5 p-1.5 rounded-lg absolute cursor-pointer text-muted-foreground flex items-center justify-center transition-opacity duration-75",
            nodeData.chat.addedContext ? "-top-13" : "-top-2.5",
            isConfirmingDelete ? "hover:bg-muted/50" : "hover:bg-muted",
            "hover:text-foreground",
            hovered || selected ? "opacity-60 hover:opacity-100" : "opacity-0 pointer-events-none"
          )}
          title={isConfirmingDelete ? "Click again to delete" : "Delete node"}
          aria-label="Delete node"
        >
          {isConfirmingDelete ? (
            <span className="text-[10px] leading-none text-destructive whitespace-nowrap">
              Confirm Delete
            </span>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </button>

        <div className="select-text nodrag -ml-[5px] pl-[5px]">
          {!hasSubmitted && (
            <NodePromptInput
              ref={promptInputRef}
              nodeId={id}
              onSubmit={submit}
              onStop={stop}
              streaming={streaming}
              autoFocus
            />
          )}
          {userMessage && !isEditingPrompt && (
            <div
              onClick={beginEdit}
              className={clsx(
                canEditPrompt ? "cursor-text" : "cursor-default"
              )}
              title={canEditPrompt ? "Click to edit prompt" : undefined}
            >
              <NodeResponse message={userMessage} nodeId={id} />
            </div>
          )}
          {userMessage && isEditingPrompt && (
            <div className="-mx-1 -my-0.5 rounded-md bg-accent/10 px-1 py-0.5 ring-1 ring-accent/30">
              <NodePromptInput
                ref={promptInputRef}
                nodeId={id}
                initialValue={userText}
                initialAttachments={userAttachments}
                onSubmit={commitEdit}
                onCancel={() => setIsEditingPrompt(false)}
                onStop={stop}
                streaming={streaming}
                autoFocus
              />
              <div className="pt-1 text-[9px] leading-none text-muted-foreground">
                Editing — Enter to resend, Esc to cancel
              </div>
            </div>
          )}
          {userMessage && assistantMessage && (
            <div className="my-4">
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          {assistantMessage && (
            <NodeResponse message={assistantMessage} onStop={stop} nodeId={id} />
          )}
          {askUserRequest && <AskUserPrompt request={askUserRequest} />}
        </div>

        {/* Selection action — follows the Y of the selection (avera-style) */}
        {selection && (
          <SelectionActionButton
            isVisible
            relativeTop={selection.relativeTop}
            absolutePosition={selection.position}
            onClick={() => {
              branch({
                addedContext: selection.text,
                selectionViewportY: selection.position.y,
              });
              selection.clear({ removeRange: true });
            }}
          />
        )}

        {/* Bottom-right copy button — avera: bg-card, h-5 w-5 rounded-md text-muted-foreground */}
        {assistantText && (
          <div
            className={clsx(
              "absolute bottom-2 right-2 nodrag transition-opacity duration-150",
              hovered || selected ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <CopyButton text={assistantText} />
          </div>
        )}

        {/* Footer follow-up button — avera-exact: rounded-xl, bg-foreground text-card, h-7 min-w-[50px] */}
        <div
          className={clsx(
            "nodrag absolute -bottom-4 left-0 right-0 flex justify-center gap-1 transition-opacity duration-150",
            showFollowUp ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <button
            type="button"
            onClick={() => branch()}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={!showFollowUp}
            className={clsx(
              "flex h-7 min-w-[50px] items-center justify-center gap-2 rounded-xl bg-foreground text-card px-2 text-xs font-semibold shadow-lg transition hover:opacity-90",
              showFollowUp ? "cursor-pointer" : "cursor-default"
            )}
            title="Follow up · or begin typing"
            aria-label="Create follow-up"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>

      <Handle isConnectable={false} type="source" position={Position.Top} id="source-top" className="!opacity-0 !pointer-events-none" />
      <Handle isConnectable={false} type="source" position={Position.Right} id="source-right" className="!opacity-0 !pointer-events-none" />
      <Handle isConnectable={false} type="source" position={Position.Bottom} id="source-bottom" className="!opacity-0 !pointer-events-none" />
      <Handle isConnectable={false} type="source" position={Position.Left} id="source-left" className="!opacity-0 !pointer-events-none" />
    </motion.div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // noop
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={clsx(
        "flex h-5 w-5 items-center justify-center rounded-md transition-all duration-200 cursor-pointer bg-card hover:bg-muted hover:text-foreground",
        copied ? "text-foreground" : "text-muted-foreground"
      )}
      aria-label="Copy assistant response"
      title={copied ? "Copied" : "Copy response"}
    >
      {copied ? <Check className="h-[7px] w-[7px]" /> : <Copy className="h-[7px] w-[7px]" />}
    </button>
  );
}

export const CustomNode = memo(CustomNodeImpl);
