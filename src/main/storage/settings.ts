import { readFile, writeFile } from "node:fs/promises";
import type { AppSettings } from "@shared/types";
import { SETTINGS_FILE, ensureDirs } from "./paths";

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
};

function mergeWithDefaults(s: Partial<AppSettings>): AppSettings {
  const providers = {
    ...DEFAULTS.providers,
    ...(s.providers ?? {}),
  };
  return {
    ...DEFAULTS,
    ...s,
    providers,
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
  await writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}
