import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useTextareaAutoResize } from "@/hooks/useTextareaAutoResize";
import { forwardWheelAtBoundary } from "@/lib/scrollPan";
import type { Attachment } from "@shared/ipc";
import type { ImageMediaType } from "@shared/types";

type Props = {
  nodeId: string;
  onSubmit: (text: string, attachments?: Attachment[]) => void;
  onStop?: () => void;
  streaming: boolean;
  autoFocus?: boolean;
  initialValue?: string;
  onCancel?: () => void;
};

const ALLOWED_TYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export function NodePromptInput({
  nodeId,
  onSubmit,
  streaming,
  autoFocus,
  initialValue,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const consumePrefill = useCanvasStore((s) => s.consumePrefill);
  const pending = useCanvasStore((s) => s.pendingPrefills[nodeId]);
  const { textareaRef } = useTextareaAutoResize(value);

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

  const handleDragOver: React.DragEventHandler<HTMLFormElement> = (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const handleDragLeave: React.DragEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const handleDrop: React.DragEventHandler<HTMLFormElement> = (e) => {
    if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    void addFiles(e.dataTransfer.files);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative nodrag min-h-[47px]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={handlePaste}
          placeholder="Enter a prompt..."
          style={{ minHeight: "12px", color: "var(--foreground)" }}
          className="w-full text-[10px] p-0 nodrag resize-none bg-transparent font-normal focus:outline-none overflow-y-auto cursor-text"
          onKeyDown={(e) => {
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

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 -m-2 rounded-md border border-dashed border-foreground/40 bg-foreground/[0.04] flex items-center justify-center text-[10px] text-muted-foreground">
          Drop image to attach
        </div>
      )}
    </form>
  );
}

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
        className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-foreground text-card flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
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
