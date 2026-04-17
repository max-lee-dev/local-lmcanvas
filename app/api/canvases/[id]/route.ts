import { NextRequest, NextResponse } from "next/server";
import { deleteCanvas, readCanvas, writeCanvas } from "@/lib/storage/canvases";
import type { Canvas } from "@/lib/graph/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const canvas = await readCanvas(id);
  if (!canvas) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(canvas);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json()) as Canvas;
  if (body.id !== id) {
    return NextResponse.json({ error: "id mismatch" }, { status: 400 });
  }
  await writeCanvas(body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  await deleteCanvas(id);
  return NextResponse.json({ ok: true });
}
