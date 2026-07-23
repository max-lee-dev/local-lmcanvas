import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Plus, Square, X } from "lucide-react";
import clsx from "clsx";
import { useBranchRequestStore } from "@/hooks/useBranchRequestStore";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useProviderInfo } from "@/hooks/useProviderInfo";
import type { Attachment, FileEntry, SlashItem } from "@shared/ipc";
import { FastBadge } from "@/components/Canvas/FastBadge";
import { FolderBadge } from "@/components/Canvas/FolderBadge";
import { ImagePreviewModal } from "@/components/Canvas/ImagePreviewModal";
import {
  MentionEditor,
  segmentsAreEmpty,
  segmentsToText,
  type EditorTrigger,
  type MentionEditorHandle,
  type Segment,
} from "@/components/Canvas/MentionEditor";
import {
  MentionPicker,
  filterEntries,
  getFilesForCwd,
  invalidateFilesCache,
} from "@/components/Canvas/MentionPicker";
import {
  SlashPicker,
  filterSlashItems,
  getSlashItemsForCwd,
} from "@/components/Canvas/SlashPicker";
import { ModelBadge } from "@/components/Canvas/ModelBadge";
import { PowerBadge } from "@/components/Canvas/PowerBadge";
import {
  filesToImageAttachments,
  imageFilesFromClipboard,
  IMAGE_ATTACHMENT_ACCEPT,
} from "@/lib/imageAttachments";

type Props = {
  paneId: string;
  parentId: string;
  streaming: boolean;
  onStop: () => void;
  onSubmitCurrentNode?: (text: string, attachments?: Attachment[]) => void;
};

/**
 * Bottom-of-drawer textarea. Submitting publishes a branch request that the
 * owning CanvasPane consumes — that pane handles the actual node creation
 * via `useBranchFromNode` (which needs ReactFlow + per-pane store context).
 */
export function NodePanelComposer({
  paneId,
  parentId,
  streaming,
  onStop,
  onSubmitCurrentNode,
}: Props) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [trigger, setTrigger] = useState<EditorTrigger | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [allEntries, setAllEntries] = useState<FileEntry[]>([]);
  const [allSlashItems, setAllSlashItems] = useState<SlashItem[]>([]);
  const request = useBranchRequestStore((s) => s.request);
  const cwd = useCanvasStore((s) => s.getEffectiveCwd(parentId));
  const effectiveProvider = useCanvasStore((s) => s.getEffectiveProvider(parentId));
  const { provider } = useProviderInfo(effectiveProvider);
  const editorRef = useRef<MentionEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => editorRef.current?.focus(true));
  }, [parentId]);

  const filteredEntries = useMemo(
    () => trigger?.kind === "mention" ? filterEntries(allEntries, trigger.query) : [],
    [allEntries, trigger],
  );
  const filteredSlashItems = useMemo(
    () => trigger?.kind === "slash" ? filterSlashItems(allSlashItems, trigger.query) : [],
    [allSlashItems, trigger],
  );
  const resultCount = trigger?.kind === "slash"
    ? filteredSlashItems.length
    : filteredEntries.length;
  const canSend = !segmentsAreEmpty(segments) || attachments.length > 0;

  useEffect(() => {
    if (highlightIdx >= resultCount) setHighlightIdx(0);
  }, [highlightIdx, resultCount]);

  const handleTriggerChange = (next: EditorTrigger | null) => {
    const effective = next?.kind === "slash" && provider !== "claude" ? null : next;
    if (effective?.kind === "mention" && trigger?.kind !== "mention" && cwd) {
      invalidateFilesCache(cwd);
      void getFilesForCwd(cwd).then(setAllEntries).catch(() => setAllEntries([]));
    }
    if (effective?.kind === "slash" && trigger?.kind !== "slash") {
      void getSlashItemsForCwd(cwd ?? "")
        .then(setAllSlashItems)
        .catch(() => setAllSlashItems([]));
    }
    setTrigger(effective);
    if (!effective) setHighlightIdx(0);
  };

  const selectMention = (entry: FileEntry) => {
    editorRef.current?.insertMentionAtTrigger(entry);
  };

  const selectSlashItem = (item: SlashItem) => {
    editorRef.current?.insertSlashAtTrigger(item);
  };

  const addFiles = async (files: FileList | File[]) => {
    const next = await filesToImageAttachments(files);
    if (next.length === 0) return;
    setAttachments((current) => [...current, ...next]);
  };

  const submit = () => {
    if (streaming || !canSend) return;
    const current = editorRef.current?.getSegments() ?? segments;
    const trimmed = segmentsToText(current).trim();
    if (onSubmitCurrentNode) {
      onSubmitCurrentNode(
        trimmed,
        attachments.length > 0 ? attachments : undefined,
      );
    } else {
      request({
        paneId,
        parentId,
        prefill: trimmed,
        ...(attachments.length > 0 ? { attachments } : {}),
      });
    }
    editorRef.current?.clear();
    setSegments([]);
    setAttachments([]);
    setPreviewIndex(null);
    requestAnimationFrame(() => editorRef.current?.focus(true));
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!trigger || resultCount === 0) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setHighlightIdx((index) => (index + delta + resultCount) % resultCount);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      if (trigger.kind === "slash") {
        const item = filteredSlashItems[highlightIdx];
        if (item) selectSlashItem(item);
      } else {
        const entry = filteredEntries[highlightIdx];
        if (entry) selectMention(entry);
      }
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setTrigger(null);
      return true;
    }
    return false;
  };

  const previewAttachment =
    previewIndex === null ? undefined : attachments[previewIndex];

  return (
    <>
      <div className="border-t border-border px-5 py-3">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((attachment, index) => {
              const src = `data:${attachment.mediaType};base64,${attachment.base64}`;
              return (
                <div
                  key={`${attachment.mediaType}-${index}`}
                  className="group relative"
                >
                  <img
                    src={src}
                    alt=""
                    onClick={() => setPreviewIndex(index)}
                    className="h-9 w-9 cursor-zoom-in rounded-md border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAttachments((current) =>
                        current.filter((_, candidate) => candidate !== index),
                      );
                      setPreviewIndex(null);
                    }}
                    className="absolute -right-1 -top-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-foreground text-background opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove image"
                  >
                    <X size={9} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="relative flex min-h-9 items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ATTACHMENT_ACCEPT}
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.currentTarget.files) {
                void addFiles(event.currentTarget.files);
              }
              event.currentTarget.value = "";
            }}
          />
          <MentionEditor
            ref={editorRef}
            initialSegments={[]}
            onChange={setSegments}
            onTriggerChange={handleTriggerChange}
            onSubmit={submit}
            onKeyDownExtra={handleEditorKeyDown}
            onPaste={(event) => {
              const files = imageFilesFromClipboard(event.clipboardData.items);
              if (files.length === 0) return;
              event.preventDefault();
              void addFiles(files);
            }}
            placeholder="Enter a prompt…"
            className="block min-h-5 max-h-[200px] flex-1 overflow-y-auto bg-transparent text-sm leading-5 text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {trigger?.kind === "mention" && (
            <MentionPicker
              query={trigger.query}
              entries={allEntries}
              highlightIdx={highlightIdx}
              onHoverIndex={setHighlightIdx}
              onSelect={selectMention}
            />
          )}
          {trigger?.kind === "slash" && (
            <SlashPicker
              query={trigger.query}
              items={allSlashItems}
              highlightIdx={highlightIdx}
              onHoverIndex={setHighlightIdx}
              onSelect={selectSlashItem}
            />
          )}
          <button
            type="button"
            onClick={streaming ? onStop : submit}
            disabled={!streaming && !canSend}
            title={streaming ? "Stop generating" : "Send (Enter)"}
            aria-label={streaming ? "Stop generating" : "Send message"}
            className={clsx(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
              streaming || canSend
                ? "bg-foreground text-background hover:opacity-90 cursor-pointer"
                : "bg-muted text-muted-foreground/60 cursor-not-allowed",
            )}
          >
            {streaming ? <Square size={11} fill="currentColor" /> : <ArrowUp size={14} />}
          </button>
        </div>
        <div
          className="mt-1.5 flex items-center gap-1 opacity-65 transition-opacity hover:opacity-100 focus-within:opacity-100"
          aria-label="Node settings"
        >
          <ModelBadge nodeId={parentId} popoverSide="top" />
          <PowerBadge nodeId={parentId} popoverSide="top" />
          <FolderBadge nodeId={parentId} popoverSide="top" />
          <FastBadge nodeId={parentId} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="ml-auto flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Add images"
            aria-label="Add images"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <ImagePreviewModal
        src={
          previewAttachment
            ? `data:${previewAttachment.mediaType};base64,${previewAttachment.base64}`
            : null
        }
        onClose={() => setPreviewIndex(null)}
      />
    </>
  );
}
