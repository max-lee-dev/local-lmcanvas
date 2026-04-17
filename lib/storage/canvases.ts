import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { nanoid } from "nanoid";
import type { Canvas, CanvasSummary } from "@/lib/graph/types";
import { CANVASES_DIR, canvasFilePath, ensureDirs } from "./paths";

export async function listCanvases(): Promise<CanvasSummary[]> {
  await ensureDirs();
  const files = await readdir(CANVASES_DIR);
  const summaries: CanvasSummary[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const raw = await readFile(`${CANVASES_DIR}/${f}`, "utf-8");
      const c: Canvas = JSON.parse(raw);
      summaries.push({
        id: c.id,
        name: c.name,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        nodeCount: c.nodes?.length ?? 0,
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
    return JSON.parse(raw) as Canvas;
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

export async function createCanvas(name: string): Promise<Canvas> {
  await ensureDirs();
  const id = nanoid(10);
  const now = Date.now();
  const canvas: Canvas = {
    id,
    name: name || "Untitled canvas",
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
