import { useEffect, useRef, useState } from "react";
import { ArrowUp, X } from "lucide-react";
import clsx from "clsx";
import { useBranchRequestStore } from "@/hooks/useBranchRequestStore";

type Props = {
  paneId: string;
  parentId: string;
  selectedContext?: string;
  onClearSelectedContext?: () => void;
};

/**
 * Bottom-of-drawer textarea. Submitting publishes a branch request that the
 * owning CanvasPane consumes — that pane handles the actual node creation
 * via `useBranchFromNode` (which needs ReactFlow + per-pane store context).
 */
export function NodePanelComposer({
  paneId,
  parentId,
  selectedContext,
  onClearSelectedContext,
}: Props) {
  const [text, setText] = useState("");
  const request = useBranchRequestStore((s) => s.request);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (selectedContext) textareaRef.current?.focus();
  }, [selectedContext]);

  // Autosize textarea up to a cap.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [text]);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0;

  const submit = () => {
    if (!canSend) return;
    request({
      paneId,
      parentId,
      prefill: trimmed,
      ...(selectedContext ? { addedContext: selectedContext } : {}),
    });
    setText("");
    onClearSelectedContext?.();
  };

  return (
    <div className="border-t border-border px-5 py-3">
      {selectedContext && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-foreground/80">
          <div className="max-h-20 flex-1 overflow-y-auto whitespace-pre-wrap break-words">
            {selectedContext}
          </div>
          <button
            type="button"
            onClick={onClearSelectedContext}
            className="mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Remove selected context"
            aria-label="Remove selected context"
          >
            <X size={13} />
          </button>
        </div>
      )}
      <div className="flex min-h-9 items-center gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={selectedContext ? "Follow up on this…" : "Enter a prompt…"}
          rows={1}
          className="block min-h-5 flex-1 resize-none bg-transparent text-sm leading-5 text-foreground placeholder:text-muted-foreground focus:outline-none"
          style={{ maxHeight: 200 }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          title="Send (Enter)"
          className={clsx(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
            canSend
              ? "bg-foreground text-background hover:opacity-90 cursor-pointer"
              : "bg-muted text-muted-foreground/60 cursor-not-allowed",
          )}
        >
          <ArrowUp size={14} />
        </button>
      </div>
    </div>
  );
}
