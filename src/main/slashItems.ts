import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { SlashItem, SlashItemSource } from "@shared/ipc";

const COMMANDS_DIR = ".claude/commands";
const SKILLS_DIR = ".claude/skills";

/** Slash commands the app handles itself instead of forwarding to the SDK. */
const BUILTIN_ITEMS: SlashItem[] = [
  {
    kind: "command",
    name: "plan",
    description:
      "Run this turn in plan mode — Claude proposes a plan but can't use mutating tools.",
    source: "builtin",
  },
];

export async function listSlashItems(cwd: string): Promise<SlashItem[]> {
  const home = homedir();
  const tasks: Array<Promise<SlashItem[]>> = [
    collectCommands(join(home, COMMANDS_DIR), "user"),
    collectSkills(join(home, SKILLS_DIR), "user"),
    collectPluginItems(join(home, ".claude", "plugins", "cache")),
  ];
  if (cwd) {
    tasks.push(collectCommands(join(cwd, COMMANDS_DIR), "project"));
    tasks.push(collectSkills(join(cwd, SKILLS_DIR), "project"));
  }

  const buckets = await Promise.all(tasks);
  const flat = [...BUILTIN_ITEMS, ...buckets.flat()];

  // Project overrides user overrides plugin when names collide.
  const seen = new Map<string, SlashItem>();
  for (const item of flat) {
    const key = `${item.kind}:${item.name}`;
    const existing = seen.get(key);
    if (!existing || sourceRank(item.source) > sourceRank(existing.source)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function sourceRank(s: SlashItemSource): number {
  if (s === "project") return 3;
  if (s === "user") return 2;
  if (s === "plugin") return 1;
  return 0; // builtin — user/project/plugin all override
}

async function collectCommands(
  root: string,
  source: SlashItemSource,
): Promise<SlashItem[]> {
  const out: SlashItem[] = [];
  await walkMarkdown(root, root, async (relPath, fullPath) => {
    // Subdirectories become namespaced names: foo/bar.md -> "foo:bar"
    const name = relPath.replace(/\.md$/, "").split("/").join(":");
    const description = await firstParagraph(fullPath);
    out.push({ kind: "command", name, description, source });
  });
  return out;
}

async function collectSkills(
  root: string,
  source: SlashItemSource,
): Promise<SlashItem[]> {
  const out: SlashItem[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  await Promise.all(
    entries.map(async (e) => {
      if (!e.isDirectory()) return;
      const skillFile = join(root, e.name, "SKILL.md");
      try {
        const s = await stat(skillFile);
        if (!s.isFile()) return;
      } catch {
        return;
      }
      const description = await skillDescription(skillFile);
      out.push({ kind: "skill", name: e.name, description, source });
    }),
  );
  return out;
}

async function collectPluginItems(cacheRoot: string): Promise<SlashItem[]> {
  // Layout: <cache>/<marketplace>/<plugin>/<version>/{commands,skills}/...
  const out: SlashItem[] = [];
  let marketplaces: import("node:fs").Dirent[];
  try {
    marketplaces = await readdir(cacheRoot, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const m of marketplaces) {
    if (!m.isDirectory()) continue;
    const mPath = join(cacheRoot, m.name);
    let plugins: import("node:fs").Dirent[];
    try {
      plugins = await readdir(mPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const p of plugins) {
      if (!p.isDirectory()) continue;
      const pPath = join(mPath, p.name);
      let versions: import("node:fs").Dirent[];
      try {
        versions = await readdir(pPath, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const v of versions) {
        if (!v.isDirectory()) continue;
        const vRoot = join(pPath, v.name);
        const [cmds, skills] = await Promise.all([
          collectCommands(join(vRoot, "commands"), "plugin"),
          collectSkills(join(vRoot, "skills"), "plugin"),
        ]);
        out.push(...cmds, ...skills);
      }
    }
  }
  return out;
}

async function walkMarkdown(
  root: string,
  dir: string,
  visit: (relPath: string, fullPath: string) => Promise<void>,
): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walkMarkdown(root, full, visit);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      const rel = full.slice(root.length + 1).split("\\").join("/");
      await visit(rel, full);
    }
  }
}

async function firstParagraph(path: string): Promise<string> {
  try {
    const text = await readFile(path, "utf8");
    const stripped = stripFrontmatter(text).trim();
    const firstBlank = stripped.indexOf("\n\n");
    const first = firstBlank > 0 ? stripped.slice(0, firstBlank) : stripped;
    return first.replace(/\s+/g, " ").trim().slice(0, 280);
  } catch {
    return "";
  }
}

async function skillDescription(path: string): Promise<string> {
  try {
    const text = await readFile(path, "utf8");
    const fm = parseFrontmatter(text);
    if (fm.description) return fm.description.slice(0, 280);
    return await firstParagraph(path);
  } catch {
    return "";
  }
}

function stripFrontmatter(text: string): string {
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return text;
  return text.slice(end + 4);
}

function parseFrontmatter(text: string): Record<string, string> {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end < 0) return {};
  const block = text.slice(3, end);
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}
