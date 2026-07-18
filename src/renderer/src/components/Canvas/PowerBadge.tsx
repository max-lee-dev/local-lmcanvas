import { Check, ChevronDown, Gauge } from "lucide-react";
import clsx from "clsx";
import type { NodeId, ReasoningEffort } from "@shared/types";
import { REASONING_EFFORTS } from "@shared/types";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { BadgePopover } from "./BadgePopover";

type Props = { nodeId: NodeId };

const DEFAULT_CODEX_REASONING_EFFORT: ReasoningEffort = "high";

const LABEL_BY_EFFORT: Record<ReasoningEffort, string> = {
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "extra high",
  max: "max",
  ultra: "ultra",
};

const SHORT_LABEL_BY_EFFORT: Record<ReasoningEffort, string> = {
  low: "low",
  medium: "med",
  high: "high",
  xhigh: "xhigh",
  max: "max",
  ultra: "ultra",
};

export function PowerBadge({ nodeId }: Props) {
  const provider = useCanvasStore((s) => s.getEffectiveProvider(nodeId));
  const overrideEffort = useCanvasStore(
    (s) => s.nodes[nodeId]?.data.nodeSettings?.reasoningEffort,
  );
  const setNodeSettings = useCanvasStore((s) => s.setNodeSettings);

  if (provider !== "codex") return null;

  const effort = overrideEffort ?? DEFAULT_CODEX_REASONING_EFFORT;
  const overridden = overrideEffort !== undefined;

  return (
    <BadgePopover
      title={`Codex power: ${LABEL_BY_EFFORT[effort]}${overridden ? " (node override)" : " (default)"} · click to change`}
      overridden={overridden}
      ariaHasPopup="listbox"
      label={
        <>
          <Gauge className="w-[10px] h-[10px] text-muted-foreground" />
          <span className="tracking-tight text-[8px] uppercase">
            {SHORT_LABEL_BY_EFFORT[effort]}
          </span>
          <ChevronDown className="w-[8px] h-[8px] text-muted-foreground" />
        </>
      }
    >
      {({ close }) => (
        <div role="listbox">
          <div
            className="px-2.5 pt-2 pb-1 text-[8px] uppercase tracking-[0.14em] text-muted-foreground"
            style={{ fontFamily: "var(--font-geist-mono)" }}
          >
            Codex power
          </div>
          {REASONING_EFFORTS.map((next) => {
            const isActive = next === effort;
            return (
              <button
                key={next}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setNodeSettings(nodeId, {
                    reasoningEffort:
                      next === DEFAULT_CODEX_REASONING_EFFORT ? undefined : next,
                  });
                  close();
                }}
                className={clsx(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors cursor-pointer",
                  isActive
                    ? "bg-accent/15 text-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Gauge className="h-3 w-3 text-muted-foreground" />
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{LABEL_BY_EFFORT[next]}</span>
                  {next === DEFAULT_CODEX_REASONING_EFFORT && (
                    <span className="block text-[9px] text-muted-foreground">
                      default
                    </span>
                  )}
                </span>
                {isActive && <Check className="h-3 w-3 text-foreground/70" />}
              </button>
            );
          })}
        </div>
      )}
    </BadgePopover>
  );
}
