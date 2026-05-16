import { Brain, Check, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { PROVIDERS, type NodeId, type Provider } from "@shared/types";
import { useProviderInfo } from "@/hooks/useProviderInfo";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { PROVIDER_INFO } from "@/components/Onboarding/providerInfo";
import { ProviderLogo } from "./ProviderLogo";
import { BadgePopover } from "./BadgePopover";

type Props = { nodeId: NodeId };

export function ModelBadge({ nodeId }: Props) {
  const effectiveProvider = useCanvasStore((s) => s.getEffectiveProvider(nodeId));
  const overrideProvider = useCanvasStore(
    (s) => s.nodes[nodeId]?.data.nodeSettings?.provider,
  );
  const setNodeSettings = useCanvasStore((s) => s.setNodeSettings);
  const { provider, label, labelsByProvider } = useProviderInfo(effectiveProvider);

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
                <span className="flex-1">{labelsByProvider[p]}</span>
                {isActive && <Check className="h-3 w-3 text-foreground/70" />}
              </button>
            );
          })}
        </div>
      )}
    </BadgePopover>
  );
}
