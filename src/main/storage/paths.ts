import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, open, rename, unlink } from "node:fs/promises";

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

/**
 * Crash-safe file write: write to a unique tmp path, fsync, then rename over the target.
 * `rename` is atomic on the same filesystem, so a crash mid-write leaves either the
 * old file fully intact or the new file fully written — never a truncated hybrid.
 */
export async function atomicWriteFile(path: string, contents: string): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const handle = await open(tmp, "w");
  try {
    await handle.writeFile(contents, "utf-8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(tmp, path);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}
