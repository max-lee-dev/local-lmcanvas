import clsx from "clsx";
import { Lightbulb } from "lucide-react";
import type { NodeId } from "@shared/types";
import { useCanvasStore } from "@/hooks/useCanvasStore";

type Props = { nodeId: NodeId };

/**
 * Toggle badge for per-node plan mode. Claude-only — codex/cursor runners
 * ignore the flag, so we hide the badge when those providers are active.
 */
export function PlanBadge({ nodeId }: Props) {
  const provider = useCanvasStore((s) => s.getEffectiveProvider(nodeId));
  const planMode = useCanvasStore(
    (s) => s.nodes[nodeId]?.data.nodeSettings?.planMode ?? false,
  );
  const setNodeSettings = useCanvasStore((s) => s.setNodeSettings);

  if (provider !== "claude") return null;

  return (
    <div className="nodrag relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setNodeSettings(nodeId, { planMode: planMode ? undefined : true });
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          "flex items-center gap-1 rounded-sm border px-1.5 py-[5px] text-xs font-medium cursor-pointer transition-colors",
          planMode
            ? "border-accent/60 bg-accent/15 text-foreground ring-1 ring-accent/30 hover:bg-accent/25"
            : "border-border bg-card text-muted-foreground hover:bg-muted",
        )}
        style={{ fontFamily: "var(--font-geist-pixel-square)" }}
        title={
          planMode
            ? "Plan mode ON for every message in this node · click to disable"
            : "Plan mode OFF · click to enable (or type /plan for one-shot)"
        }
        aria-pressed={planMode}
      >
        <Lightbulb
          className={clsx(
            "w-[10px] h-[10px]",
            planMode ? "text-accent" : "text-muted-foreground",
          )}
        />
        <span className="tracking-tight text-[8px] uppercase">plan</span>
      </button>
    </div>
  );
}
