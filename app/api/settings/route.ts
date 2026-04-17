import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/storage/settings";
import type { AppSettings } from "@/lib/graph/types";

export const runtime = "nodejs";

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as AppSettings;
  const saved = await writeSettings(body);
  return NextResponse.json(saved);
}
