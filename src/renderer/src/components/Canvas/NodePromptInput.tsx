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
import { useTextareaAutoResize } from "@/hooks/useTextareaAutoResize";
import { forwardWheelAtBoundary } from "@/lib/scrollPan";
import {
  MentionPicker,
  filterEntries,
  getFilesForCwd,
} from "./MentionPicker";
import { MentionHighlight } from "./MentionHighlight";
import type { Attachment, FileEntry } from "@shared/ipc";
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
  const [value, setValue] = useState(initialValue ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>(
    initialAttachments ?? []
  );
  const consumePrefill = useCanvasStore((s) => s.consumePrefill);
  const pending = useCanvasStore((s) => s.pendingPrefills[nodeId]);
  const cwd = useCanvasStore((s) => s.cwd);
  const { textareaRef } = useTextareaAutoResize(value);

  // Mention picker state. mentionStart is the index of '@' in `value`,
  // or null when the picker is closed.
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [allEntries, setAllEntries] = useState<FileEntry[]>([]);
  const filesLoadedForCwdRef = useRef<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const mentionOpen = mentionStart !== null;
  const filteredEntries = useMemo(
    () => (mentionOpen ? filterEntries(allEntries, mentionQuery) : []),
    [mentionOpen, allEntries, mentionQuery]
  );

  useEffect(() => {
    if (highlightIdx >= filteredEntries.length) setHighlightIdx(0);
  }, [filteredEntries.length, highlightIdx]);

  const closeMention = (): void => {
    setMentionStart(null);
    setMentionQuery("");
    setHighlightIdx(0);
  };

  const ensureFilesLoaded = (): void => {
    if (!cwd) return;
    if (filesLoadedForCwdRef.current === cwd) return;
    filesLoadedForCwdRef.current = cwd;
    void getFilesForCwd(cwd)
      .then((entries) => setAllEntries(entries))
      .catch(() => {
        // swallow: picker just shows empty
        filesLoadedForCwdRef.current = null;
      });
  };

  const detectMention = (
    text: string,
    caret: number
  ): { start: number; query: string } | null => {
    // Walk back from caret to find an '@' with no whitespace between.
    for (let i = caret - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === "@") {
        const prev = i === 0 ? " " : text[i - 1];
        // Only trigger if @ is at start or after whitespace
        if (i === 0 || /\s/.test(prev)) {
          return { start: i, query: text.slice(i + 1, caret) };
        }
        return null;
      }
      if (/\s/.test(ch)) return null;
    }
    return null;
  };

  const handleValueChange = (
    next: string,
    caret: number | null
  ): void => {
    setValue(next);
    const pos = caret ?? next.length;
    const detected = detectMention(next, pos);
    if (detected) {
      if (!mentionOpen) ensureFilesLoaded();
      setMentionStart(detected.start);
      setMentionQuery(detected.query);
      setHighlightIdx(0);
    } else if (mentionOpen) {
      closeMention();
    }
  };

  const selectMention = (entry: FileEntry): void => {
    if (mentionStart === null) return;
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(caret);
    // Trailing slash on folders gives both a visual cue and a hint to the
    // model that the mention refers to the whole directory.
    const suffix = entry.type === "dir" ? "/" : "";
    const insert = `@${entry.path}${suffix} `;
    const nextValue = before + insert + after;
    setValue(nextValue);
    closeMention();
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      const newCaret = (before + insert).length;
      node.focus();
      node.setSelectionRange(newCaret, newCaret);
    });
  };

  useEffect(() => {
    if (pending !== undefined) {
      const text = consumePrefill(nodeId) ?? "";
      setValue((prev) => (prev ? prev : text));
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }
  }, [pending, consumePrefill, nodeId, textareaRef]);

  useEffect(() => {
    if (autoFocus) {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [autoFocus, textareaRef]);

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
      focus: () => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      },
    }),
    [],
  );

  const handleSubmit = (e?: React.FormEvent): void => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (streaming) return;
    if (!trimmed && attachments.length === 0) return;
    onSubmit(trimmed, attachments.length > 0 ? attachments : undefined);
    setValue("");
    setAttachments([]);
  };

  const handleMouseEnter = (): void => {
    const el = textareaRef.current;
    if (!el) return;
    el.addEventListener("wheel", stopWheelAtBoundary, { passive: false });
  };
  const handleMouseLeave = (): void => {
    const el = textareaRef.current;
    if (!el) return;
    el.removeEventListener("wheel", stopWheelAtBoundary);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
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

  return (
    <form
      onSubmit={handleSubmit}
      className="relative nodrag min-h-[47px]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
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

      <div className="flex items-center relative group">
        <div className="relative w-full">
          <MentionHighlight value={value} scrollTop={scrollTop} />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) =>
              handleValueChange(e.target.value, e.target.selectionStart)
            }
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            onKeyUp={(e) => {
              // Caret moved via arrows / clicks — re-evaluate mention state
              if (
                e.key === "ArrowLeft" ||
                e.key === "ArrowRight" ||
                e.key === "Home" ||
                e.key === "End"
              ) {
                const el = textareaRef.current;
                if (el) handleValueChange(value, el.selectionStart);
              }
            }}
            onClick={() => {
              const el = textareaRef.current;
              if (el) handleValueChange(value, el.selectionStart);
            }}
            onBlur={() => closeMention()}
            onPaste={handlePaste}
            placeholder="Enter a prompt..."
            style={{
              minHeight: "12px",
              color: "transparent",
              caretColor: "var(--foreground)",
              lineHeight: 1.4,
            }}
            className="relative w-full text-[10px] p-0 nodrag resize-none bg-transparent font-normal focus:outline-none overflow-y-auto cursor-text"
            onKeyDown={(e) => {
              if (mentionOpen && filteredEntries.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightIdx((i) => (i + 1) % filteredEntries.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightIdx(
                    (i) =>
                      (i - 1 + filteredEntries.length) % filteredEntries.length
                  );
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  const pick = filteredEntries[highlightIdx];
                  if (pick) selectMention(pick);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  closeMention();
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                textareaRef.current?.blur();
                handleSubmit(e);
              } else if (e.key === "Escape" && onCancel) {
                e.preventDefault();
                textareaRef.current?.blur();
                onCancel();
              }
            }}
            onWheel={forwardWheelAtBoundary}
            aria-label="Prompt input"
          />
        </div>
        {mentionOpen && (
          <MentionPicker
            query={mentionQuery}
            entries={allEntries}
            highlightIdx={highlightIdx}
            onHoverIndex={setHighlightIdx}
            onSelect={selectMention}
          />
        )}
      </div>

    </form>
  );
});

function ThumbChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const src = `data:${attachment.mediaType};base64,${attachment.base64}`;
  return (
    <div className="relative group/thumb">
      <img
        src={src}
        alt=""
        className="h-10 w-10 rounded-md object-cover border border-border"
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-foreground text-card flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity cursor-pointer"
        aria-label="Remove attachment"
      >
        <X className="h-2 w-2" />
      </button>
    </div>
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

function stopWheelAtBoundary(e: WheelEvent): void {
  const el = e.currentTarget as HTMLTextAreaElement | null;
  if (!el) return;
  const isScrollable = el.scrollHeight > el.clientHeight;
  const isAtTop = el.scrollTop === 0;
  const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
  if (isScrollable && !(isAtTop && e.deltaY < 0) && !(isAtBottom && e.deltaY > 0)) {
    e.stopPropagation();
  }
}
