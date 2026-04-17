import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { runClaude } from "@/lib/claude/runner";
import { buildPromptWithHistory } from "@/lib/claude/history";
import { readSettings } from "@/lib/storage/settings";
import type { Message } from "@/lib/graph/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatBody = {
  canvasId: string;
  nodeId: string;
  history: Message[];
  prompt: string;
  systemPrompt?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatBody;
  const settings = await readSettings();
  const combinedPrompt = buildPromptWithHistory(body.history ?? [], body.prompt);
  const systemPrompt = body.systemPrompt ?? settings.systemPrompt ?? undefined;

  const abortController = new AbortController();
  req.signal.addEventListener("abort", () => abortController.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          // controller closed
        }
      };

      try {
        send({ type: "start", messageId: nanoid() });
        for await (const ev of runClaude(combinedPrompt, {
          claudeBin: settings.claudeBinPath,
          model: settings.claudeModel,
          systemPrompt,
          signal: abortController.signal,
        })) {
          if (ev.kind === "delta") {
            send({ type: "delta", text: ev.text });
          } else if (ev.kind === "done") {
            send({ type: "done", fullText: ev.fullText });
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "error", message });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
