import { useMemo } from "react";
import { Clock } from "lucide-react";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useTimelinePanelStore } from "@/hooks/useTimelinePanelStore";
import type { CanvasNode } from "@shared/types";

function isGenerating(node: CanvasNode): boolean {
  if (node.type !== "custom") return false;
  return node.data.chat.messages.some((m) => m.status === "streaming");
}

function hasAnyMessages(node: CanvasNode): boolean {
  if (node.type !== "custom") return false;
  return node.data.chat.messages.length > 0;
}

/**
 * Top-toolbar button that toggles the right-side TimelinePanel. Shows an
 * animated "X generating" badge when any node is mid-stream, otherwise a
 * subtle clock icon. The actual list of nodes lives in the panel.
 */
export function InProgressNodesIndicator() {
  const nodes = useCanvasStore((s) => s.nodes);
  const open = useTimelinePanelStore((s) => s.open);
  const toggle = useTimelinePanelStore((s) => s.toggle);

  const { generatingCount, anyNodes } = useMemo(() => {
    let generating = 0;
    let any = false;
    for (const node of Object.values(nodes)) {
      if (!hasAnyMessages(node)) continue;
      any = true;
      if (isGenerating(node)) generating += 1;
    }
    return { generatingCount: generating, anyNodes: any };
  }, [nodes]);

  if (!anyNodes) return null;

  const isStreaming = generatingCount > 0;

  return (
    <div
      className="relative"
      style={{ fontFamily: "var(--font-geist-sans)" }}
    >
      {isStreaming ? (
        <button
          type="button"
          onClick={toggle}
          title={`${generatingCount} generating · open timeline`}
          aria-label={`${generatingCount} nodes generating, open timeline`}
          aria-expanded={open}
          className={`flex h-7 items-center gap-1.5 rounded-md border border-border px-2 backdrop-blur-sm cursor-pointer transition-colors ${
            open
              ? "bg-muted text-foreground"
              : "bg-card/80 text-foreground/80 hover:text-foreground hover:bg-card"
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 inline-flex h-full w-full animate-ping rounded-full bg-accent-brand opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-brand" />
          </span>
          <span className="text-[11px] tabular-nums font-medium">
            {generatingCount}
          </span>
          <span className="text-[11px] text-muted-foreground">generating</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          title={open ? "close timeline" : "open timeline"}
          aria-label={open ? "close timeline" : "open timeline"}
          aria-expanded={open}
          className={`flex h-7 w-7 items-center justify-center rounded-md cursor-pointer ${
            open
              ? "bg-muted text-foreground"
              : "text-foreground/70 hover:text-foreground hover:bg-muted"
          }`}
        >
          <Clock size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
