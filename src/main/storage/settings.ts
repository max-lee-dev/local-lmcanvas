import { readFile } from "node:fs/promises";
import type {
  AppSettings,
  CodexServiceTier,
  NodeSettings,
  Provider,
  ReasoningEffort,
} from "@shared/types";
import { PROVIDERS, REASONING_EFFORTS } from "@shared/types";
import { SETTINGS_FILE, atomicWriteFile, ensureDirs } from "./paths";

const MAX_RECENTS = 8;

const DEFAULTS: AppSettings = {
  systemPrompt: "",
  claudeModel: "claude-fable-5",
  claudeBinPath: "claude",
  defaultProvider: "claude",
  providers: {
    claude: { binPath: "claude" },
    codex: {
      binPath: "codex",
      model: "gpt-5.6-sol",
      reasoningEffort: "high",
      serviceTier: "standard",
    },
    cursor: { binPath: "cursor-agent" },
  },
  onboardingCompleted: false,
  terseToolNarration: false,
  recentFolders: [],
  recentBranches: [],
};

function sanitizeRecents(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_RECENTS) break;
  }
  return out;
}

function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return (
    typeof value === "string" &&
    (REASONING_EFFORTS as readonly string[]).includes(value)
  );
}

function isCodexServiceTier(value: unknown): value is CodexServiceTier {
  return value === "standard" || value === "fast";
}

function sanitizeNodeSettings(raw: unknown): NodeSettings | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const obj = raw as Record<string, unknown>;
  const out: NodeSettings = {};
  if (typeof obj.provider === "string" && (PROVIDERS as readonly string[]).includes(obj.provider)) {
    out.provider = obj.provider as Provider;
  }
  if (typeof obj.cwd === "string" && obj.cwd.length > 0) out.cwd = obj.cwd;
  if (typeof obj.branch === "string" && obj.branch.length > 0) out.branch = obj.branch;
  if (typeof obj.planMode === "boolean") out.planMode = obj.planMode;
  if (typeof obj.chatOnly === "boolean") out.chatOnly = obj.chatOnly;
  if (isReasoningEffort(obj.reasoningEffort)) out.reasoningEffort = obj.reasoningEffort;
  if (isCodexServiceTier(obj.serviceTier)) out.serviceTier = obj.serviceTier;
  return out.provider ||
    out.cwd ||
    out.branch ||
    out.planMode ||
    out.chatOnly ||
    out.reasoningEffort ||
    out.serviceTier
    ? out
    : undefined;
}

function mergeWithDefaults(s: Partial<AppSettings>): AppSettings {
  const providers = {
    claude: {
      ...DEFAULTS.providers?.claude,
      ...(s.providers?.claude ?? {}),
    },
    codex: {
      ...DEFAULTS.providers?.codex,
      ...(s.providers?.codex ?? {}),
    },
    cursor: {
      ...DEFAULTS.providers?.cursor,
      ...(s.providers?.cursor ?? {}),
    },
  };
  const lastNodeSettings = sanitizeNodeSettings(s.lastNodeSettings);
  return {
    ...DEFAULTS,
    ...s,
    providers,
    recentFolders: sanitizeRecents(s.recentFolders),
    recentBranches: sanitizeRecents(s.recentBranches),
    ...(lastNodeSettings ? { lastNodeSettings } : { lastNodeSettings: undefined }),
  };
}

export async function readSettings(): Promise<AppSettings> {
  await ensureDirs();
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8");
    return mergeWithDefaults(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return mergeWithDefaults({});
  }
}

export async function writeSettings(settings: AppSettings): Promise<AppSettings> {
  await ensureDirs();
  const merged = mergeWithDefaults(settings);
  await atomicWriteFile(SETTINGS_FILE, JSON.stringify(merged, null, 2));
  return merged;
}
