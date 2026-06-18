import clsx from "clsx";
import { Zap } from "lucide-react";
import type { NodeId } from "@shared/types";
import { useCanvasStore } from "@/hooks/useCanvasStore";

type Props = { nodeId: NodeId };

/**
 * Toggle badge for per-node fast chat mode. Drops the claude_code preset and
 * agent tools so the model replies with chat-grade latency. Claude-only.
 */
export function FastBadge({ nodeId }: Props) {
  const provider = useCanvasStore((s) => s.getEffectiveProvider(nodeId));
  const chatOnly = useCanvasStore(
    (s) => s.nodes[nodeId]?.data.nodeSettings?.chatOnly ?? false,
  );
  const setNodeSettings = useCanvasStore((s) => s.setNodeSettings);

  if (provider !== "claude") return null;

  return (
    <div className="nodrag relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setNodeSettings(nodeId, { chatOnly: chatOnly ? undefined : true });
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          "flex items-center gap-1 rounded-sm border bg-card text-foreground px-1.5 py-[5px] text-xs font-medium cursor-pointer transition-colors",
          "hover:bg-muted",
          chatOnly
            ? "border-accent/60 bg-accent/15 ring-1 ring-accent/30 hover:bg-accent/25"
            : "border-border",
        )}
        style={{ fontFamily: "var(--font-geist-pixel-square)" }}
        title={
          chatOnly
            ? "Fast chat mode ON — no agent tools, lower latency · click to disable"
            : "Fast chat mode OFF · click to enable (or type /chat for one-shot)"
        }
        aria-pressed={chatOnly}
      >
        <Zap
          className={clsx(
            "w-[10px] h-[10px]",
            chatOnly ? "text-accent" : "text-muted-foreground",
          )}
        />
        <span className="tracking-tight text-[8px] uppercase">fast</span>
      </button>
    </div>
  );
}
