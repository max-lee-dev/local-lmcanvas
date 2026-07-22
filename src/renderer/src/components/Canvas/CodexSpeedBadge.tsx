import { Check, ChevronDown, Zap } from "lucide-react";
import clsx from "clsx";
import type { CodexServiceTier, NodeId } from "@shared/types";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { BadgePopover } from "./BadgePopover";

type Props = { nodeId: NodeId };

const TIERS: readonly CodexServiceTier[] = ["standard", "fast"];

export function CodexSpeedBadge({ nodeId }: Props) {
  const provider = useCanvasStore((s) => s.getEffectiveProvider(nodeId));
  const override = useCanvasStore(
    (s) => s.nodes[nodeId]?.data.nodeSettings?.serviceTier,
  );
  const defaultTier = useCanvasStore(
    (s) => s.providerConfigs?.codex?.serviceTier ?? "standard",
  );
  const setNodeSettings = useCanvasStore((s) => s.setNodeSettings);
  const tier = override ?? defaultTier;

  if (provider !== "codex") return null;

  return (
    <BadgePopover
      title={`Codex speed: ${tier}${override ? " (node override)" : " (default)"}`}
      overridden={override !== undefined}
      ariaHasPopup="listbox"
      label={
        <>
          <Zap className={clsx("h-[10px] w-[10px]", tier === "fast" ? "text-accent" : "text-muted-foreground")} />
          <span className="tracking-tight text-[8px] uppercase">{tier}</span>
          <ChevronDown className="h-[8px] w-[8px] text-muted-foreground" />
        </>
      }
    >
      {({ close }) => (
        <div role="listbox">
          <div
            className="px-2.5 pb-1 pt-2 text-[8px] uppercase tracking-[0.14em] text-muted-foreground"
            style={{ fontFamily: "var(--font-geist-mono)" }}
          >
            Codex speed
          </div>
          {TIERS.map((next) => (
            <button
              key={next}
              type="button"
              role="option"
              aria-selected={next === tier}
              onClick={() => {
                setNodeSettings(nodeId, {
                  serviceTier: next === defaultTier ? undefined : next,
                });
                close();
              }}
              className={clsx(
                "flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors",
                next === tier
                  ? "bg-accent/15 text-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <Zap className="h-3 w-3 text-muted-foreground" />
              <span className="flex-1 capitalize">{next}</span>
              {next === tier && <Check className="h-3 w-3 text-foreground/70" />}
            </button>
          ))}
        </div>
      )}
    </BadgePopover>
  );
}
