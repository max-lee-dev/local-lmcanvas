import { useMemo } from "react";
import { Brain, Check, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { PROVIDERS, type CanvasNode, type NodeId, type Provider } from "@shared/types";
import { useProviderInfo } from "@/hooks/useProviderInfo";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { PROVIDER_INFO } from "@/components/Onboarding/providerInfo";
import { ProviderLogo } from "./ProviderLogo";
import { BadgePopover } from "./BadgePopover";

type Props = { nodeId: NodeId };
type ProviderUsageTotals = Record<
  Provider,
  {
    turns: number;
    totalTokens: number;
    totalCostUsd: number;
    hasTokenData: boolean;
    hasCostData: boolean;
  }
>;

export function ModelBadge({ nodeId }: Props) {
  const effectiveProvider = useCanvasStore((s) => s.getEffectiveProvider(nodeId));
  const overrideProvider = useCanvasStore(
    (s) => s.nodes[nodeId]?.data.nodeSettings?.provider,
  );
  const nodes = useCanvasStore((s) => s.nodes);
  const setNodeSettings = useCanvasStore((s) => s.setNodeSettings);
  const { provider, label, labelsByProvider } = useProviderInfo(effectiveProvider);
  const usageByProvider = useMemo(() => aggregateUsage(nodes), [nodes]);

  const overridden = overrideProvider !== undefined;

  return (
    <BadgePopover
      title={`Provider: ${PROVIDER_INFO[provider].name}${overridden ? " (node override)" : " (canvas)"} · click to switch`}
      overridden={overridden}
      ariaHasPopup="listbox"
      label={
        <>
          <ProviderLogo provider={provider} size={10} />
          <span className="tracking-tight text-[8px]">{label}</span>
          {provider === "claude" && (
            <Brain className="w-[10px] h-[10px] text-amber-500 opacity-90" />
          )}
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
            Node model
          </div>
          {PROVIDERS.map((p) => {
            const isActive = p === provider;
            return (
              <button
                key={p}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setNodeSettings(nodeId, { provider: p });
                  close();
                }}
                className={clsx(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors cursor-pointer",
                  isActive
                    ? "bg-accent/15 text-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <ProviderLogo provider={p} size={12} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{labelsByProvider[p]}</span>
                  <span className="block text-[9px] text-muted-foreground">
                    {formatUsage(usageByProvider[p])}
                  </span>
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

function aggregateUsage(nodes: Record<string, CanvasNode>): ProviderUsageTotals {
  const out: ProviderUsageTotals = {
    claude: emptyUsage(),
    codex: emptyUsage(),
    cursor: emptyUsage(),
  };

  for (const node of Object.values(nodes)) {
    for (const message of node.data.chat.messages) {
      if (message.role !== "assistant") continue;
      const p = message.provider;
      if (p !== "claude" && p !== "codex" && p !== "cursor") continue;
      out[p].turns += 1;
      if (message.usage?.totalTokens !== undefined) {
        out[p].totalTokens += message.usage.totalTokens;
        out[p].hasTokenData = true;
      }
      if (message.usage?.totalCostUsd !== undefined) {
        out[p].totalCostUsd += message.usage.totalCostUsd;
        out[p].hasCostData = true;
      }
    }
  }

  return out;
}

function emptyUsage() {
  return {
    turns: 0,
    totalTokens: 0,
    totalCostUsd: 0,
    hasTokenData: false,
    hasCostData: false,
  };
}

function formatUsage(usage: ProviderUsageTotals[Provider]): string {
  const parts: string[] = [`${usage.turns} turn${usage.turns === 1 ? "" : "s"}`];
  if (usage.hasTokenData) parts.push(`${formatNumber(usage.totalTokens)} tok`);
  if (usage.hasCostData) parts.push(`$${usage.totalCostUsd.toFixed(4)}`);
  return parts.join(" · ");
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}
