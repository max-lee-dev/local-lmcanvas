import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const execAsync = promisify(exec);

const MAX_FILES = 5000;
const MAX_DEPTH = 6;
const SKIP_DIRS = new Set<string>([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  ".DS_Store",
  ".turbo",
  ".cache",
]);

export async function listFiles(cwd: string): Promise<string[]> {
  if (!cwd) return [];
  try {
    return await listViaGit(cwd);
  } catch {
    try {
      return await listViaWalk(cwd);
    } catch {
      return [];
    }
  }
}

async function listViaGit(cwd: string): Promise<string[]> {
  // -z gives NUL-separated paths so spaces/newlines in names don't break parsing.
  // Buffer cap at 32MB.
  const { stdout } = await execAsync(
    "git ls-files -z --others --cached --exclude-standard",
    { cwd, maxBuffer: 32 * 1024 * 1024 }
  );
  const files = stdout
    .split("\0")
    .filter((s) => s.length > 0)
    .slice(0, MAX_FILES);
  return files;
}

async function listViaWalk(cwd: string): Promise<string[]> {
  const out: string[] = [];
  await walk(cwd, cwd, 0, out);
  return out.slice(0, MAX_FILES);
}

async function walk(
  root: string,
  dir: string,
  depth: number,
  out: string[]
): Promise<void> {
  if (out.length >= MAX_FILES) return;
  if (depth > MAX_DEPTH) return;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= MAX_FILES) return;
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith(".") && entry.name !== ".env") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, full, depth + 1, out);
    } else if (entry.isFile()) {
      out.push(relative(root, full));
    } else if (entry.isSymbolicLink()) {
      try {
        const s = await stat(full);
        if (s.isFile()) out.push(relative(root, full));
      } catch {
        // dangling symlink, skip
      }
    }
  }
}
