import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import clsx from "clsx";
import { useBranchRequestStore } from "@/hooks/useBranchRequestStore";

type Props = {
  paneId: string;
  parentId: string;
};

/**
 * Bottom-of-drawer textarea. Submitting publishes a branch request that the
 * owning CanvasPane consumes — that pane handles the actual node creation
 * via `useBranchFromNode` (which needs ReactFlow + per-pane store context).
 */
export function NodePanelComposer({ paneId, parentId }: Props) {
  const [text, setText] = useState("");
  const request = useBranchRequestStore((s) => s.request);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset draft when switching nodes — each node gets its own fresh composer.
  useEffect(() => {
    setText("");
  }, [parentId]);

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
    request({ paneId, parentId, prefill: trimmed });
    setText("");
  };

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 focus-within:border-foreground/40 focus-within:bg-muted/60 transition-colors">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Ignore the Enter that commits an IME composition (CJK input) —
            // isComposing is still true, so submitting would eat the candidate.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="reply…"
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-snug"
          style={{ maxHeight: 200 }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          title="Send (Enter)"
          className={clsx(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            canSend
              ? "bg-foreground text-background hover:opacity-90 cursor-pointer"
              : "bg-muted text-muted-foreground/60 cursor-not-allowed",
          )}
        >
          <ArrowUp size={14} />
        </button>
      </div>
      <div className="mt-1.5 text-[10px] text-muted-foreground/60">
        sending creates a child node on the canvas
      </div>
    </div>
  );
}
