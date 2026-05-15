import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { FileEntry } from "@shared/ipc";

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

export async function listFiles(cwd: string): Promise<FileEntry[]> {
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

async function listViaGit(cwd: string): Promise<FileEntry[]> {
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
  return withDerivedDirs(files);
}

async function listViaWalk(cwd: string): Promise<FileEntry[]> {
  const files: string[] = [];
  const dirs: string[] = [];
  await walk(cwd, cwd, 0, files, dirs);
  return mergeEntries(files.slice(0, MAX_FILES), dirs);
}

async function walk(
  root: string,
  dir: string,
  depth: number,
  files: string[],
  dirs: string[]
): Promise<void> {
  if (files.length >= MAX_FILES) return;
  if (depth > MAX_DEPTH) return;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (files.length >= MAX_FILES) return;
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith(".") && entry.name !== ".env") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const rel = relative(root, full);
      if (rel) dirs.push(rel);
      await walk(root, full, depth + 1, files, dirs);
    } else if (entry.isFile()) {
      files.push(relative(root, full));
    } else if (entry.isSymbolicLink()) {
      try {
        const s = await stat(full);
        if (s.isFile()) files.push(relative(root, full));
      } catch {
        // dangling symlink, skip
      }
    }
  }
}

// Derive directory entries from a flat list of file paths (git ls-files mode).
function withDerivedDirs(files: string[]): FileEntry[] {
  const dirSet = new Set<string>();
  for (const f of files) {
    let slash = f.indexOf("/");
    while (slash !== -1) {
      dirSet.add(f.slice(0, slash));
      slash = f.indexOf("/", slash + 1);
    }
  }
  return mergeEntries(files, Array.from(dirSet));
}

function mergeEntries(files: string[], dirs: string[]): FileEntry[] {
  const out: FileEntry[] = [];
  for (const path of dirs) out.push({ path, type: "dir" });
  for (const path of files) out.push({ path, type: "file" });
  return out;
}
