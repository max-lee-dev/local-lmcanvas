import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useProviderInfo } from "@/hooks/useProviderInfo";
import { forwardWheelAtBoundary } from "@/lib/scrollPan";
import {
  MentionPicker,
  filterEntries,
  getFilesForCwd,
} from "./MentionPicker";
import {
  SlashPicker,
  filterSlashItems,
  getSlashItemsForCwd,
} from "./SlashPicker";
import {
  MentionEditor,
  segmentsAreEmpty,
  segmentsToText,
  textToSegments,
  type MentionEditorHandle,
  type EditorTrigger,
  type Segment,
} from "./MentionEditor";
import { ImagePreviewModal } from "./ImagePreviewModal";
import type { Attachment, FileEntry, SlashItem } from "@shared/ipc";
import type { ImageMediaType } from "@shared/types";

type Props = {
  nodeId: string;
  onSubmit: (text: string, attachments?: Attachment[]) => void;
  onStop?: () => void;
  streaming: boolean;
  autoFocus?: boolean;
  initialValue?: string;
  initialAttachments?: Attachment[];
  onCancel?: () => void;
};

const ALLOWED_TYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export type NodePromptInputHandle = {
  addFiles: (files: FileList | File[]) => Promise<void>;
  focus: () => void;
};

export const NodePromptInput = forwardRef<NodePromptInputHandle, Props>(function NodePromptInput(
  {
    nodeId,
    onSubmit,
    streaming,
    autoFocus,
    initialValue,
    initialAttachments,
    onCancel,
  },
  ref,
) {
  const initialSegments = useMemo(
    () => textToSegments(initialValue ?? ""),
    [initialValue],
  );
  // Mirror of the editor's segments. Updated via the editor's onChange so the
  // parent has fresh state for the submit / empty checks without needing to
  // imperatively poll.
  const [segments, setSegments] = useState<Segment[]>(initialSegments);
  const [attachments, setAttachments] = useState<Attachment[]>(
    initialAttachments ?? [],
  );
  const consumePrefill = useCanvasStore((s) => s.consumePrefill);
  const pending = useCanvasStore((s) => s.pendingPrefills[nodeId]);
  const cwd = useCanvasStore((s) => s.getEffectiveCwd(nodeId));
  const effectiveProvider = useCanvasStore((s) => s.getEffectiveProvider(nodeId));
  const { provider } = useProviderInfo(effectiveProvider);
  const slashEnabled = provider === "claude";
  const editorRef = useRef<MentionEditorHandle | null>(null);

  const [trigger, setTrigger] = useState<EditorTrigger | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [allEntries, setAllEntries] = useState<FileEntry[]>([]);
  const [allSlashItems, setAllSlashItems] = useState<SlashItem[]>([]);
  const filesLoadedForCwdRef = useRef<string | null>(null);
  const slashLoadedForCwdRef = useRef<string | null>(null);

  const mentionOpen = trigger?.kind === "mention";
  const slashOpen = trigger?.kind === "slash";
  const filteredEntries = useMemo(
    () =>
      trigger?.kind === "mention" ? filterEntries(allEntries, trigger.query) : [],
    [trigger, allEntries],
  );
  const filteredSlashItems = useMemo(
    () =>
      trigger?.kind === "slash"
        ? filterSlashItems(allSlashItems, trigger.query)
        : [],
    [trigger, allSlashItems],
  );
  const activeResultsLength =
    trigger?.kind === "slash" ? filteredSlashItems.length : filteredEntries.length;

  useEffect(() => {
    if (highlightIdx >= activeResultsLength) setHighlightIdx(0);
  }, [activeResultsLength, highlightIdx]);

  const ensureFilesLoaded = (): void => {
    if (!cwd) return;
    if (filesLoadedForCwdRef.current === cwd) return;
    filesLoadedForCwdRef.current = cwd;
    void getFilesForCwd(cwd)
      .then((entries) => setAllEntries(entries))
      .catch(() => {
        filesLoadedForCwdRef.current = null;
      });
  };

  const ensureSlashItemsLoaded = (): void => {
    const key = cwd ?? "";
    if (slashLoadedForCwdRef.current === key) return;
    slashLoadedForCwdRef.current = key;
    void getSlashItemsForCwd(key)
      .then((items) => setAllSlashItems(items))
      .catch(() => {
        slashLoadedForCwdRef.current = null;
      });
  };

  const handleTriggerChange = (next: EditorTrigger | null): void => {
    // Slash commands and skills are a Claude-only feature: they're loaded from
    // ~/.claude/{commands,skills} and expanded by the agent SDK. For codex /
    // cursor, swallow the trigger so the menu never opens.
    const effective = next && next.kind === "slash" && !slashEnabled ? null : next;
    if (effective && effective.kind === "mention" && trigger?.kind !== "mention") {
      ensureFilesLoaded();
    }
    if (effective && effective.kind === "slash" && trigger?.kind !== "slash") {
      ensureSlashItemsLoaded();
    }
    setTrigger(effective);
    if (!effective) setHighlightIdx(0);
  };

  const selectMention = (entry: FileEntry): void => {
    editorRef.current?.insertMentionAtTrigger(entry);
  };

  const selectSlashItem = (item: SlashItem): void => {
    editorRef.current?.insertSlashAtTrigger(item);
  };

  useEffect(() => {
    if (pending !== undefined) {
      const prefill = consumePrefill(nodeId);
      if (!prefill) return;
      const { text, autoSubmit } = prefill;
      if (segmentsAreEmpty(segments) && text) {
        if (autoSubmit) {
          // Skip populating the editor — fire the prompt directly. The parent
          // chat hook handles message append + streaming exactly as if the
          // user had typed and hit enter.
          onSubmit(text);
          editorRef.current?.clear();
          setSegments([]);
        } else {
          const next = textToSegments(text);
          editorRef.current?.setSegments(next);
          editorRef.current?.focus(true);
        }
      }
    }
    // segments intentionally excluded — only react to a new pending prefill
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, consumePrefill, nodeId]);

  const addFiles = async (files: FileList | File[]): Promise<void> => {
    const list = Array.from(files).filter((f) => ALLOWED_TYPES.has(f.type));
    if (list.length === 0) return;
    const next = await Promise.all(list.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...next]);
  };

  useImperativeHandle(
    ref,
    () => ({
      addFiles,
      focus: () => editorRef.current?.focus(true),
    }),
    [],
  );

  const handleSubmit = (): void => {
    if (streaming) return;
    const current = editorRef.current?.getSegments() ?? segments;
    const text = segmentsToText(current).trim();
    if (!text && attachments.length === 0) return;
    onSubmit(text, attachments.length > 0 ? attachments : undefined);
    editorRef.current?.clear();
    setSegments([]);
    setAttachments([]);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>): void => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f && ALLOWED_TYPES.has(f.type)) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      void addFiles(files);
    }
  };

  // Intercept arrow / Enter / Escape while a picker is open so they drive
  // it instead of the editor's default behavior. Returning true tells the
  // editor to skip its own keydown handling.
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): boolean => {
    const pickerLen =
      trigger?.kind === "slash" ? filteredSlashItems.length : filteredEntries.length;
    if (trigger && pickerLen > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => (i + 1) % pickerLen);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => (i - 1 + pickerLen) % pickerLen);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (trigger.kind === "slash") {
          const pick = filteredSlashItems[highlightIdx];
          if (pick) selectSlashItem(pick);
        } else {
          const pick = filteredEntries[highlightIdx];
          if (pick) selectMention(pick);
        }
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setTrigger(null);
        return true;
      }
    }
    return false;
  };

  const handleCancel = (): void => {
    if (onCancel) onCancel();
  };

  return (
    <div className="relative nodrag min-h-[47px]">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-1.5">
          {attachments.map((a, i) => (
            <ThumbChip
              key={i}
              attachment={a}
              onRemove={() =>
                setAttachments((prev) => prev.filter((_, j) => j !== i))
              }
            />
          ))}
        </div>
      )}

      <div className="flex items-stretch relative group">
        <div className="relative w-full flex">
          <MentionEditor
            ref={editorRef}
            initialSegments={initialSegments}
            placeholder="Enter a prompt..."
            autoFocus={autoFocus}
            className="relative w-full text-[10px] p-0 nodrag bg-transparent font-normal cursor-text"
            style={{
              minHeight: "47px",
              maxHeight: "112px",
              overflowY: "auto",
              lineHeight: 1.4,
            }}
            onChange={setSegments}
            onTriggerChange={handleTriggerChange}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onPaste={handlePaste}
            onWheel={forwardWheelAtBoundary}
            onKeyDownExtra={handleEditorKeyDown}
          />
        </div>
        {mentionOpen && (
          <MentionPicker
            query={trigger.query}
            entries={allEntries}
            highlightIdx={highlightIdx}
            onHoverIndex={setHighlightIdx}
            onSelect={selectMention}
          />
        )}
        {slashOpen && (
          <SlashPicker
            query={trigger.query}
            items={allSlashItems}
            highlightIdx={highlightIdx}
            onHoverIndex={setHighlightIdx}
            onSelect={selectSlashItem}
          />
        )}
      </div>
    </div>
  );
});

function ThumbChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const src = `data:${attachment.mediaType};base64,${attachment.base64}`;
  return (
    <>
      <div className="relative group/thumb">
        <img
          src={src}
          alt=""
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPreviewOpen(true);
          }}
          className="h-10 w-10 rounded-md object-cover border border-border cursor-zoom-in hover:opacity-90 transition-opacity"
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-foreground text-card flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity cursor-pointer z-10"
          aria-label="Remove attachment"
        >
          <X className="h-2 w-2" />
        </button>
      </div>
      <ImagePreviewModal
        src={previewOpen ? src : null}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}

async function fileToAttachment(file: File): Promise<Attachment> {
  const buf = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buf);
  return {
    mediaType: file.type as ImageMediaType,
    base64,
  };
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(""));
}
