import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { nanoid } from "nanoid";
import type { Canvas, CanvasNode, CanvasSummary, Message, Provider } from "@shared/types";
import { PROVIDERS } from "@shared/types";
import { migrateMessage } from "@shared/history";
import { CANVASES_DIR, canvasFilePath, ensureDirs } from "./paths";

export async function listCanvases(): Promise<CanvasSummary[]> {
  await ensureDirs();
  const files = await readdir(CANVASES_DIR);
  const summaries: CanvasSummary[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await readFile(`${CANVASES_DIR}/${f}`, "utf-8");
      const parsed = JSON.parse(raw) as Partial<Canvas>;
      if (!parsed.id || !parsed.name) continue;
      summaries.push({
        id: parsed.id,
        name: parsed.name,
        cwd: parsed.cwd ?? homedir(),
        createdAt: parsed.createdAt ?? 0,
        updatedAt: parsed.updatedAt ?? 0,
        nodeCount: parsed.nodes?.length ?? 0,
      });
    } catch {
      // skip corrupt files
    }
  }
  summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  return summaries;
}

export async function readCanvas(id: string): Promise<Canvas | null> {
  await ensureDirs();
  try {
    const raw = await readFile(canvasFilePath(id), "utf-8");
    const parsed = JSON.parse(raw) as Partial<Canvas> & Record<string, unknown>;
    return migrateCanvas(parsed);
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "ENOENT"
    ) {
      return null;
    }
    throw err;
  }
}

export async function writeCanvas(canvas: Canvas): Promise<void> {
  await ensureDirs();
  const updated: Canvas = { ...canvas, updatedAt: Date.now() };
  await writeFile(canvasFilePath(canvas.id), JSON.stringify(updated, null, 2), "utf-8");
}

export async function createCanvas(args: { name: string; cwd: string }): Promise<Canvas> {
  await ensureDirs();
  const id = nanoid(10);
  const now = Date.now();
  const canvas: Canvas = {
    id,
    name: args.name || "Untitled canvas",
    cwd: args.cwd || homedir(),
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
  };
  await writeCanvas(canvas);
  return canvas;
}

export async function deleteCanvas(id: string): Promise<void> {
  try {
    await unlink(canvasFilePath(id));
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "ENOENT"
    ) {
      return;
    }
    throw err;
  }
}

function migrateCanvas(raw: Partial<Canvas> & Record<string, unknown>): Canvas | null {
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  const nodes: CanvasNode[] = Array.isArray(raw.nodes)
    ? (raw.nodes as CanvasNode[]).map(migrateNode)
    : [];
  return {
    id: raw.id,
    name: raw.name,
    cwd: typeof raw.cwd === "string" && raw.cwd.length > 0 ? raw.cwd : homedir(),
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    nodes,
    edges: Array.isArray(raw.edges) ? raw.edges : [],
  };
}

function migrateNode(node: CanvasNode): CanvasNode {
  const chat = node.data?.chat;
  if (!chat) return node;
  const rawMessages = (chat.messages ?? []) as unknown[];
  const messages: Message[] = [];
  for (const m of rawMessages) {
    const migrated = migrateMessage(m);
    if (migrated) messages.push(migrated);
  }
  return {
    ...node,
    data: {
      ...node.data,
      chat: {
        ...chat,
        messages,
      },
    },
  };
}
