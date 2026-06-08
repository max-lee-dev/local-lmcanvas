import { memo, useMemo, useRef, useState } from "react";
import { type NodeProps } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { GitMerge, Plus } from "lucide-react";
import clsx from "clsx";
import { MergeButton } from "./MergeButton";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { ModelBadge } from "./ModelBadge";
import { FolderBadge } from "./FolderBadge";
import { OnboardingTitle } from "./OnboardingTitle";
import { useNodeChat } from "@/hooks/useNodeChat";
import type { CanvasNode, ImageBlock } from "@shared/types";
import type { Attachment } from "@shared/ipc";
import { NodeResponse } from "./NodeResponse";
import { NodePromptInput, type NodePromptInputHandle } from "./NodePromptInput";
import { AskUserPrompt } from "./AskUserPrompt";
import { SelectionActionButton } from "./SelectionActionButton";
import { CustomNodeContextBanner } from "./CustomNodeContextBanner";
import { TemporaryBadge } from "./TemporaryBadge";
import { NodeCopyButton } from "./NodeCopyButton";
import { NodeSourceHandles, NodeTargetHandles } from "./NodeHandles";
import { ResizeHandle } from "./ResizeHandle";
import { useAskUserStore } from "@/hooks/useAskUserStore";
import { useSelection } from "@/hooks/useSelection";
import { NODE_WIDTH } from "@/lib/canvasConstants";
import { useBranchFromNode } from "@/hooks/useBranchFromNode";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { useNodeFileDrop } from "@/hooks/useNodeFileDrop";
import { useNodeFinishSound } from "@/hooks/useNodeFinishSound";
import { usePromptEdit } from "@/hooks/usePromptEdit";
import { useSelectionBranchOnEnter } from "@/hooks/useSelectionBranchOnEnter";
import { useTemporaryNodeAutodelete } from "@/hooks/useTemporaryNodeAutodelete";

type CustomNodeData = CanvasNode["data"];

function CustomNodeImpl(props: NodeProps) {
  const { id, data, selected } = props;
  const nodeData = data as CustomNodeData;
  const { submit, stop, streaming } = useNodeChat(id);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const patchNode = useCanvasStore((s) => s.patchNode);
  const merging = useCanvasStore((s) => s.merging);
  const mergeIds = useCanvasStore((s) => s.mergeIds);
  const startMerge = useCanvasStore((s) => s.startMerge);
  const toggleMergeNode = useCanvasStore((s) => s.toggleMergeNode);
  const askUserRequest = useAskUserStore((s) => s.byNode[id]);
  const totalNodeCount = useCanvasStore((s) => Object.keys(s.nodes).length);

  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const promptInputRef = useRef<NodePromptInputHandle | null>(null);
  const selection = useSelection(rootRef);

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

  const branch = useBranchFromNode(id);
  useSelectionBranchOnEnter(selection, branch);

  const promptEdit = usePromptEdit({
    nodeId: id,
    canEdit: canEditPrompt,
    rootRef,
    submit,
    stop,
  });

  const promptInputMounted = !hasSubmitted || promptEdit.isEditing;

  const fileDrop = useNodeFileDrop({
    promptInputRef,
    promptInputMounted,
    canEnterEdit: canEditPrompt,
    enterEdit: () => promptEdit.setIsEditing(true),
  });

  const deleteConfirm = useDeleteConfirm({
    // Idle nodes (nothing submitted yet) delete immediately; otherwise confirm.
    requireConfirm: hasSubmitted,
    onDelete: () => removeNode(id),
  });

  const justFinished = useNodeFinishSound({ nodeId: id, streaming, hovered });

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const isTemporary = Boolean(nodeData.chat.isTemporary);
  const temporaryRemaining = useTemporaryNodeAutodelete({
    nodeId: id,
    isTemporary,
    streaming,
    hovered,
    hasCompletedAssistant: lastAssistant?.status === "complete",
  });
  const assistantText = lastAssistant
    ? lastAssistant.blocks
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("\n\n")
    : "";

  const showFollowUp = (hovered || selected) && hasSubmitted;
  const showOnboarding = totalNodeCount === 1 && messages.length === 0 && !streaming;
  const isMergeSource = merging && mergeIds[0] === id;
  const isMergeSelected = merging && mergeIds.includes(id);
  const isMergeNode = nodeData.chat.parentIds.length > 1;
  const mergedConversationCount = nodeData.chat.parentIds.length;
  const nodeWidth = nodeData.width ?? NODE_WIDTH;

  return (
    <motion.div
      ref={rootRef}
      className="relative"
      style={{ width: nodeWidth }}
      data-node-id={id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      <AnimatePresence>{showOnboarding && <OnboardingTitle />}</AnimatePresence>

      <NodeTargetHandles />

      <div
        aria-hidden
        className={clsx(
          "pointer-events-none absolute inset-0 rounded-[10px] transition-opacity",
          justFinished && !hovered && !selected ? "opacity-100 duration-700" : "opacity-0 duration-300",
        )}
        style={{
          boxShadow:
            "0 0 22px 0 color-mix(in oklab, var(--accent-brand) 28%, transparent)",
        }}
      />

      <div
        className={clsx(
          "relative border rounded-[10px] transition-colors duration-300 px-5 pb-4 pt-12 shadow-sm bg-card",
          nodeData.chat.addedContext && "rounded-t-none border-t-0",
          isTemporary && "border-dashed border-amber-500/60",
          isMergeSource
            ? "border-accent ring-2 ring-accent ring-offset-2 ring-offset-background"
            : isMergeSelected
            ? "border-accent ring-2 ring-accent/70 ring-offset-2 ring-offset-background"
            : merging
            ? "border-border hover:border-accent/60 cursor-pointer"
            : askUserRequest
            ? "border-yellow-400/60"
            : fileDrop.dragOver
            ? "border-accent bg-muted"
            : selected
            ? "border-accent bg-accent/10"
            : isTemporary
            ? "border-amber-500/60"
            : "border-border",
        )}
        style={
          isTemporary
            ? {
                boxShadow:
                  "0 0 22px 0 color-mix(in oklab, rgb(245 158 11) 35%, transparent), 0 1px 2px 0 rgb(0 0 0 / 0.05)",
              }
            : undefined
        }
        onDragOver={fileDrop.onDragOver}
        onDragLeave={fileDrop.onDragLeave}
        onDrop={fileDrop.onDrop}
        onClickCapture={(e) => {
          if (!merging) return;
          // Don't toggle when clicking inside interactive sub-elements
          // (textarea, buttons). Only top-level card clicks toggle selection.
          const target = e.target as HTMLElement;
          if (target.closest("button, textarea, input, a, [contenteditable]")) return;
          e.preventDefault();
          e.stopPropagation();
          toggleMergeNode(id);
        }}
      >
        {askUserRequest && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[10px] bg-yellow-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.05, 0.18, 0.05] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <ResizeHandle nodeId={id} width={nodeWidth} isVisible={hovered || selected} />

        <CustomNodeContextBanner
          addedContext={nodeData.chat.addedContext}
          isTemporary={isTemporary}
        />

        <div className="absolute left-4 right-4 top-3 flex items-center gap-2 min-w-0">
          <ModelBadge nodeId={id} />
          <FolderBadge nodeId={id} />
          {isMergeNode && (
            <span
              className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              title={`${mergedConversationCount} conversations merged`}
            >
              <GitMerge className="h-2.5 w-2.5" />
              {mergedConversationCount}
            </span>
          )}
          {isTemporary && (
            <TemporaryBadge
              remaining={temporaryRemaining}
              onConvertToPersistent={() =>
                patchNode(id, {
                  chat: { ...nodeData.chat, isTemporary: false },
                })
              }
            />
          )}
        </div>

        <button
          type="button"
          onClick={(e) => deleteConfirm.trigger(e)}
          className={clsx(
            "nodrag z-50 -right-2.5 p-1.5 rounded-lg absolute cursor-pointer text-muted-foreground flex items-center justify-center transition-opacity duration-75",
            nodeData.chat.addedContext ? "-top-13" : "-top-2.5",
            deleteConfirm.isConfirming ? "hover:bg-muted/50" : "hover:bg-muted",
            "hover:text-foreground",
            hovered || selected ? "opacity-60 hover:opacity-100" : "opacity-0 pointer-events-none",
          )}
          title={deleteConfirm.isConfirming ? "Click again to delete" : "Delete node"}
          aria-label="Delete node"
        >
          {deleteConfirm.isConfirming ? (
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
          {userMessage && !promptEdit.isEditing && (
            <div
              onClick={promptEdit.begin}
              className={clsx(canEditPrompt ? "cursor-text" : "cursor-default")}
              title={canEditPrompt ? "Click to edit prompt" : undefined}
            >
              <NodeResponse message={userMessage} nodeId={id} />
            </div>
          )}
          {userMessage && promptEdit.isEditing && (
            <div className="-mx-1 -my-0.5 rounded-md bg-accent/10 px-1 py-0.5 ring-1 ring-accent/30">
              <NodePromptInput
                ref={promptInputRef}
                nodeId={id}
                initialValue={userText}
                initialAttachments={userAttachments}
                onSubmit={promptEdit.commit}
                onCancel={promptEdit.cancel}
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
            <NodeResponse
              message={assistantMessage}
              onStop={stop}
              nodeId={id}
              onSuggestionClick={(prompt) =>
                branch({
                  prefill: prompt,
                  autoSubmit: true,
                  placeBelow: true,
                  focusViewport: false,
                })
              }
            />
          )}
          {askUserRequest && <AskUserPrompt request={askUserRequest} />}
        </div>

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
            onTemporaryClick={() => {
              branch({
                addedContext: selection.text,
                selectionViewportY: selection.position.y,
                isTemporary: true,
              });
              selection.clear({ removeRange: true });
            }}
          />
        )}

        {assistantText && (
          <div
            className={clsx(
              "absolute bottom-2 right-2 nodrag transition-opacity duration-150",
              hovered || selected ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            <NodeCopyButton text={assistantText} />
          </div>
        )}

        <div
          className={clsx(
            "nodrag absolute -bottom-4 left-0 right-0 flex justify-center gap-1 transition-opacity duration-150",
            showFollowUp ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          {!merging && (
            <MergeButton
              disabled={!showFollowUp}
              id={id}
              onClick={startMerge}
            />
          )}
          <button
            type="button"
            onClick={() => branch()}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={!showFollowUp}
            className={clsx(
              "flex h-7 min-w-[50px] items-center justify-center gap-2 rounded-xl bg-foreground text-card px-2 text-xs font-semibold shadow-lg transition hover:opacity-90",
              showFollowUp ? "cursor-pointer" : "cursor-default",
            )}
            title="Follow up · or begin typing"
            aria-label="Create follow-up"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <NodeSourceHandles />
    </motion.div>
  );
}

export const CustomNode = memo(CustomNodeImpl);
