import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

export const ROOT_DIR = join(homedir(), ".local-lmcanvas");
export const CANVASES_DIR = join(ROOT_DIR, "canvases");
export const SETTINGS_FILE = join(ROOT_DIR, "settings.json");

export async function ensureDirs(): Promise<void> {
  await mkdir(CANVASES_DIR, { recursive: true });
}

export function canvasFilePath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe || safe !== id) {
    throw new Error(`Invalid canvas id: ${id}`);
  }
  return join(CANVASES_DIR, `${safe}.json`);
}
