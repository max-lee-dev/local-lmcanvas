import { readFile } from "node:fs/promises";
import type { AppSettings, NodeSettings, Provider } from "@shared/types";
import { PROVIDERS } from "@shared/types";
import { SETTINGS_FILE, atomicWriteFile, ensureDirs } from "./paths";

const MAX_RECENTS = 8;

const DEFAULTS: AppSettings = {
  systemPrompt: "",
  claudeModel: undefined,
  claudeBinPath: "claude",
  defaultProvider: "claude",
  providers: {
    claude: { binPath: "claude" },
    codex: { binPath: "codex" },
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

function sanitizeNodeSettings(raw: unknown): NodeSettings | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const obj = raw as Record<string, unknown>;
  const out: NodeSettings = {};
  if (typeof obj.provider === "string" && (PROVIDERS as readonly string[]).includes(obj.provider)) {
    out.provider = obj.provider as Provider;
  }
  if (typeof obj.cwd === "string" && obj.cwd.length > 0) out.cwd = obj.cwd;
  if (typeof obj.branch === "string" && obj.branch.length > 0) out.branch = obj.branch;
  return out.provider || out.cwd || out.branch ? out : undefined;
}

function mergeWithDefaults(s: Partial<AppSettings>): AppSettings {
  const providers = {
    ...DEFAULTS.providers,
    ...(s.providers ?? {}),
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
