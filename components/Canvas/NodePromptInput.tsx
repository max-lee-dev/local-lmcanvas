"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Square } from "lucide-react";
import { useCanvasStore } from "@/hooks/useCanvasStore";

type Props = {
  nodeId: string;
  onSubmit: (text: string) => void;
  onStop?: () => void;
  streaming: boolean;
  autoFocus?: boolean;
};

export function NodePromptInput({ nodeId, onSubmit, onStop, streaming, autoFocus }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const consumePrefill = useCanvasStore((s) => s.consumePrefill);
  const pending = useCanvasStore((s) => s.pendingPrefills[nodeId]);

  // consume prefill on mount or when a new one arrives
  useEffect(() => {
    if (pending !== undefined) {
      const text = consumePrefill(nodeId) ?? "";
      setValue((prev) => (prev ? prev : text));
      requestAnimationFrame(() => {
        const el = ref.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }
  }, [pending, consumePrefill, nodeId]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleSubmit = () => {
    const t = value.trim();
    if (!t || streaming) return;
    onSubmit(t);
    setValue("");
  };

  return (
    <div className="flex items-end gap-2 border-t border-zinc-200 bg-zinc-50 p-2">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={streaming ? "streaming…" : "ask claude (⌘+enter)"}
        className="nodrag nowheel flex-1 resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-400"
        rows={1}
      />
      {streaming ? (
        <button
          onClick={onStop}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500 text-white hover:bg-red-600"
          title="stop"
        >
          <Square size={14} />
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40"
          title="send (⌘+enter)"
        >
          <Send size={14} />
        </button>
      )}
    </div>
  );
}
