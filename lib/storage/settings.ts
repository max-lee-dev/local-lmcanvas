import { readFile, writeFile } from "node:fs/promises";
import type { AppSettings } from "@/lib/graph/types";
import { SETTINGS_FILE, ensureDirs } from "./paths";

const DEFAULTS: AppSettings = {
  systemPrompt: "",
  claudeModel: undefined,
  claudeBinPath: "claude",
};

export async function readSettings(): Promise<AppSettings> {
  await ensureDirs();
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8");
    return { ...DEFAULTS, ...(JSON.parse(raw) as AppSettings) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function writeSettings(settings: AppSettings): Promise<AppSettings> {
  await ensureDirs();
  const merged = { ...DEFAULTS, ...settings };
  await writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}
