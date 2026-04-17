import { NextRequest, NextResponse } from "next/server";
import { createCanvas, listCanvases } from "@/lib/storage/canvases";

export const runtime = "nodejs";

export async function GET() {
  const canvases = await listCanvases();
  return NextResponse.json({ canvases });
}

export async function POST(req: NextRequest) {
  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const canvas = await createCanvas(body.name ?? "Untitled canvas");
  return NextResponse.json(canvas, { status: 201 });
}
