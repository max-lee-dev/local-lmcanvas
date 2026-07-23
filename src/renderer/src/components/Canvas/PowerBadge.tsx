import { useEffect, useState } from "react";
import { ChevronDown, Gauge, Zap } from "lucide-react";
import clsx from "clsx";
import type {
  CodexModelInfo,
  CodexServiceTier,
  NodeId,
  ReasoningEffort,
} from "@shared/types";
import { REASONING_EFFORTS } from "@shared/types";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { BadgePopover } from "./BadgePopover";

type Props = { nodeId: NodeId; popoverSide?: "top" | "bottom" };

const FALLBACK_CODEX_REASONING_EFFORT: ReasoningEffort = "low";

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
  medium: "medium",
  high: "high",
  xhigh: "x-high",
  max: "max",
  ultra: "ultra",
};

export function PowerBadge({ nodeId, popoverSide }: Props) {
  const provider = useCanvasStore((s) => s.getEffectiveProvider(nodeId));
  const overrideEffort = useCanvasStore(
    (s) => s.nodes[nodeId]?.data.nodeSettings?.reasoningEffort,
  );
  const overrideTier = useCanvasStore(
    (s) => s.nodes[nodeId]?.data.nodeSettings?.serviceTier,
  );
  const defaultTier = useCanvasStore(
    (s) => s.providerConfigs?.codex?.serviceTier ?? "standard",
  );
  const configuredModel = useCanvasStore(
    (s) => s.providerConfigs?.codex?.model,
  );
  const configuredEffort = useCanvasStore(
    (s) => s.providerConfigs?.codex?.reasoningEffort,
  );
  const setNodeSettings = useCanvasStore((s) => s.setNodeSettings);
  const [runtimeModel, setRuntimeModel] = useState<CodexModelInfo | undefined>();

  useEffect(() => {
    if (provider !== "codex") return;
    let cancelled = false;
    void window.api.providers
      .codexRuntime()
      .then((runtime) => {
        if (cancelled) return;
        const modelId = configuredModel ?? runtime.defaultModelId;
        setRuntimeModel(runtime.models.find((model) => model.id === modelId));
      })
      .catch(() => {
        if (!cancelled) setRuntimeModel(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [configuredModel, provider]);

  if (provider !== "codex") return null;

  const defaultEffort =
    configuredEffort ??
    runtimeModel?.defaultReasoningEffort ??
    FALLBACK_CODEX_REASONING_EFFORT;
  const effort = overrideEffort ?? defaultEffort;
  const supportedEfforts = runtimeModel?.supportedReasoningEfforts ?? REASONING_EFFORTS;
  const fastAvailable =
    !runtimeModel ||
    runtimeModel.serviceTiers.some(
      (candidate) => candidate.id === "priority" || candidate.id === "fast",
    );
  const configuredTier = overrideTier ?? defaultTier;
  const tier = configuredTier === "fast" && !fastAvailable ? "standard" : configuredTier;
  const overridden = overrideEffort !== undefined || overrideTier !== undefined;

  const setTier = (next: CodexServiceTier): void => {
    setNodeSettings(nodeId, {
      serviceTier: next === defaultTier ? undefined : next,
    });
  };

  return (
    <BadgePopover
      side={popoverSide}
      title={`Thinking: ${LABEL_BY_EFFORT[effort]} · speed: ${tier}${overridden ? " (node override)" : ""}`}
      panelClassName="w-[216px]"
      label={
        <>
          <Gauge className="w-[10px] h-[10px] text-muted-foreground" />
          <span className="text-[8px] tracking-tight capitalize">
            {SHORT_LABEL_BY_EFFORT[effort]}
          </span>
          {tier === "fast" && (
            <Zap className="h-[9px] w-[9px] text-accent-brand" />
          )}
          <ChevronDown className="w-[8px] h-[8px] text-muted-foreground" />
        </>
      }
    >
      {() => (
        <div className="p-2" style={{ fontFamily: "var(--font-geist-sans)" }}>
          <div className="px-0.5 pb-1.5">
            <div className="text-[10px] font-medium text-foreground">
              Thinking effort
            </div>
            <div className="mt-0.5 text-[8px] text-muted-foreground">
              Choose how deeply Codex reasons
            </div>
          </div>

          <div
            role="listbox"
            aria-label="Thinking effort"
            className="grid grid-cols-3 gap-1"
          >
            {supportedEfforts.map((next) => {
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
                        next === defaultEffort
                          ? undefined
                          : next,
                    });
                  }}
                  className={clsx(
                    "flex h-7 cursor-pointer items-center justify-center rounded-md px-1 text-[9px] font-medium capitalize transition-colors",
                    isActive
                      ? "bg-foreground text-background"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {LABEL_BY_EFFORT[next]}
                </button>
              );
            })}
          </div>

          <div className="my-2 h-px bg-border" />

          <button
            type="button"
            aria-pressed={tier === "fast"}
            disabled={!fastAvailable}
            onClick={() => setTier(tier === "fast" ? "standard" : "fast")}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
              <Zap
                className={clsx(
                  "h-3 w-3",
                  tier === "fast" ? "text-accent-brand" : "text-muted-foreground",
                )}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[9px] font-medium text-foreground">
                Fast responses
              </span>
              <span className="block text-[8px] text-muted-foreground">
                {fastAvailable
                  ? "Prioritize response speed"
                  : "Unavailable for this model"}
              </span>
            </span>
            <span
              aria-hidden
              className={clsx(
                "relative h-4 w-7 shrink-0 rounded-full transition-colors",
                tier === "fast" ? "bg-accent-brand" : "bg-muted",
              )}
            >
              <span
                className={clsx(
                  "absolute top-0.5 h-3 w-3 rounded-full bg-background shadow-sm transition-transform",
                  tier === "fast" ? "translate-x-3.5" : "translate-x-0.5",
                )}
              />
            </span>
          </button>
        </div>
      )}
    </BadgePopover>
  );
}
