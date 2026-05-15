import { useEffect, useState } from "react";
import type { AppSettings, Provider } from "@shared/types";
import { useCanvasStore } from "./useCanvasStore";

export type ProviderInfoState = {
  provider: Provider;
  label: string;
};

/**
 * Resolves the current provider for the open canvas, and a pretty label for
 * its configured model. Falls back to AppSettings.defaultProvider, then
 * "claude". Re-reads settings whenever the canvas's provider changes so the
 * model label tracks the active provider.
 */
export function useProviderInfo(): ProviderInfoState {
  const canvasProvider = useCanvasStore((s) => s.provider);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.api.settings.read().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const provider: Provider =
    canvasProvider ?? settings?.defaultProvider ?? "claude";

  const modelId =
    settings?.providers?.[provider]?.model ??
    (provider === "claude" ? settings?.claudeModel : undefined);

  return { provider, label: prettyModelLabel(provider, modelId) };
}

function prettyModelLabel(provider: Provider, modelId?: string): string {
  if (provider === "claude") {
    if (!modelId) return "Opus 4.7";
    if (modelId.includes("opus")) {
      if (modelId.includes("4-7")) return "Opus 4.7";
      if (modelId.includes("4-6")) return "Opus 4.6";
      if (modelId.includes("4-5")) return "Opus 4.5";
      return "Opus";
    }
    if (modelId.includes("sonnet")) {
      if (modelId.includes("4-6")) return "Sonnet 4.6";
      if (modelId.includes("4-5")) return "Sonnet 4.5";
      return "Sonnet";
    }
    if (modelId.includes("haiku")) {
      if (modelId.includes("4-5")) return "Haiku 4.5";
      return "Haiku";
    }
    return modelId;
  }
  if (provider === "codex") {
    return modelId && modelId.length > 0 ? modelId : "Codex";
  }
  if (provider === "cursor") {
    return modelId && modelId.length > 0 ? modelId : "Cursor";
  }
  return modelId ?? provider;
}
