import { readdir, readFile, unlink } from "node:fs/promises";
import { nanoid } from "nanoid";
import type { Canvas, CanvasNode, CanvasSummary, Message, Provider } from "@shared/types";
import { PROVIDERS } from "@shared/types";
import { migrateMessage } from "@shared/history";
import { CANVASES_DIR, atomicWriteFile, canvasFilePath, ensureDirs } from "./paths";

export async function listCanvases(): Promise<CanvasSummary[]> {
  await ensureDirs();
  const files = await readdir(CANVASES_DIR);
  const summaries: CanvasSummary[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const full = `${CANVASES_DIR}/${f}`;
    try {
      const raw = await readFile(full, "utf-8");
      const parsed = JSON.parse(raw) as Partial<Canvas>;
      if (!parsed.id || !parsed.name) continue;
      summaries.push({
        id: parsed.id,
        name: parsed.name,
        cwd: typeof parsed.cwd === "string" && parsed.cwd.length > 0 ? parsed.cwd : undefined,
        createdAt: parsed.createdAt ?? 0,
        updatedAt: parsed.updatedAt ?? 0,
        nodeCount: parsed.nodes?.length ?? 0,
        provider: isProvider(parsed.provider) ? parsed.provider : undefined,
      });
    } catch (err) {
      console.error(`[canvases] failed to load ${full}:`, err);
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
  await atomicWriteFile(canvasFilePath(canvas.id), JSON.stringify(updated, null, 2));
}

export async function createCanvas(args: {
  name?: string;
  cwd?: string;
  provider?: Provider;
}): Promise<Canvas> {
  await ensureDirs();
  const id = nanoid(10);
  const now = Date.now();
  const cwd = args.cwd && args.cwd.length > 0 ? args.cwd : undefined;
  const canvas: Canvas = {
    id,
    name: args.name && args.name.length > 0 ? args.name : "Untitled canvas",
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
    provider: args.provider,
    ...(cwd ? { cwd } : {}),
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

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value);
}

function migrateCanvas(raw: Partial<Canvas> & Record<string, unknown>): Canvas | null {
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  const nodes: CanvasNode[] = Array.isArray(raw.nodes)
    ? (raw.nodes as CanvasNode[]).map(migrateNode)
    : [];
  const cwd = typeof raw.cwd === "string" && raw.cwd.length > 0 ? raw.cwd : undefined;
  return {
    id: raw.id,
    name: raw.name,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
    nodes,
    edges: Array.isArray(raw.edges) ? raw.edges : [],
    provider: isProvider(raw.provider) ? raw.provider : undefined,
    ...(cwd ? { cwd } : {}),
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
