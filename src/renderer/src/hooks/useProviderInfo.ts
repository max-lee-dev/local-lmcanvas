import { useEffect, useState } from "react";
import { PROVIDERS, type AppSettings, type Provider } from "@shared/types";
import { useCanvasStore } from "./useCanvasStore";

export type ProviderInfoState = {
  provider: Provider;
  label: string;
  labelsByProvider: Record<Provider, string>;
};

const DEFAULT_MODEL_BY_PROVIDER: Record<Provider, string> = {
  claude: "claude-opus-4-7",
  codex: "gpt-5.3-codex",
  cursor: "auto",
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
  }, [canvasProvider]);

  const provider: Provider =
    canvasProvider ?? settings?.defaultProvider ?? "claude";

  const labelsByProvider = PROVIDERS.reduce<Record<Provider, string>>(
    (acc, p) => {
      const configuredModel =
        settings?.providers?.[p]?.model ??
        (p === "claude" ? settings?.claudeModel : undefined);
      const modelId = configuredModel ?? DEFAULT_MODEL_BY_PROVIDER[p];
      acc[p] = prettyModelLabel(p, modelId);
      return acc;
    },
    {
      claude: prettyModelLabel("claude", DEFAULT_MODEL_BY_PROVIDER.claude),
      codex: prettyModelLabel("codex", DEFAULT_MODEL_BY_PROVIDER.codex),
      cursor: prettyModelLabel("cursor", DEFAULT_MODEL_BY_PROVIDER.cursor),
    }
  );

  return { provider, label: labelsByProvider[provider], labelsByProvider };
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
    if (!modelId || modelId.length === 0) return "GPT-5.3 Codex";
    const lower = normalizeModelId(modelId);
    if (
      lower === "codex" ||
      lower === "openai" ||
      lower === "default" ||
      lower === "openai/default"
    ) {
      return "Codex (Default)";
    }
    return prettyOpenAIModelName(modelId);
  }
  if (provider === "cursor") {
    if (!modelId || modelId.length === 0) return "Auto";
    const lower = normalizeModelId(modelId);
    if (
      lower === "auto" ||
      lower === "default" ||
      lower === "cursor" ||
      lower === "cursor-agent" ||
      lower === "cursor/default"
    ) {
      return "Auto";
    }
    return prettyOpenAIModelName(modelId);
  }
  return modelId ?? "Default";
}

function prettyOpenAIModelName(modelId?: string): string {
  if (!modelId || modelId.length === 0) return "GPT-5.3 Codex";
  const lower = normalizeModelId(modelId);
  if (lower === "auto") return "Auto";
  if (lower === "codex") return "Codex (Default)";
  if (lower === "cursor" || lower === "cursor-agent") return "Auto";

  const sanitized = modelId.replace(/[\\/_]+/g, "-").replace(/\s+/g, "-");
  const pretty = sanitized
    .split("-")
    .map((part) => {
      const token = part.toLowerCase();
      if (token === "gpt") return "GPT";
      if (token === "codex") return "Codex";
      if (/^\d+(\.\d+)*$/.test(part)) return part;
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join("-");
  return pretty.replace("-Codex", " Codex").replace("-Turbo", " Turbo");
}

function normalizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase();
}
