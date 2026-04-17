import { spawn } from "node:child_process";

export type RunClaudeOpts = {
  claudeBin?: string;
  model?: string;
  systemPrompt?: string;
  signal?: AbortSignal;
};

export type RunClaudeDelta =
  | { kind: "delta"; text: string }
  | { kind: "done"; fullText: string };

type JsonObj = Record<string, unknown>;

function asObj(v: unknown): JsonObj | null {
  return typeof v === "object" && v !== null ? (v as JsonObj) : null;
}
function asStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function asArr(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null;
}

/**
 * Spawn `claude -p` in stream-json mode and yield text deltas as they arrive.
 *
 * Event handling:
 *  - stream_event / content_block_delta / text_delta  →  yield incremental text
 *  - type:"assistant"                                  →  yield full text ONLY IF no streaming deltas arrived (fallback)
 *  - type:"result"                                     →  checked for is_error; otherwise terminal
 *  - all others                                        →  ignored
 */
export async function* runClaude(
  prompt: string,
  opts: RunClaudeOpts = {}
): AsyncGenerator<RunClaudeDelta, void, void> {
  const bin = opts.claudeBin || "claude";
  const args = [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
  ];
  if (opts.model) args.push("--model", opts.model);
  if (opts.systemPrompt) args.push("--append-system-prompt", opts.systemPrompt);

  const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

  if (opts.signal) {
    const abort = () => {
      if (!proc.killed) proc.kill("SIGTERM");
    };
    opts.signal.addEventListener("abort", abort, { once: true });
  }

  let stderr = "";
  proc.stderr.on("data", (d: Buffer) => {
    stderr += d.toString();
  });

  const spawnError = await new Promise<Error | null>((resolve) => {
    proc.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        resolve(
          new Error(
            `claude binary not found at "${bin}". Install Claude Code and ensure it is in PATH, or set claudeBinPath in settings.`
          )
        );
      } else {
        resolve(err);
      }
    });
    proc.once("spawn", () => resolve(null));
  });
  if (spawnError) throw spawnError;

  let buffer = "";
  let totalEmitted = "";
  let sawStreamingDelta = false;

  for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let ev: unknown;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      const o = asObj(ev);
      if (!o) continue;
      const type = asStr(o.type);
      if (!type) continue;

      if (type === "result") {
        if (o.is_error === true) {
          const msg = asStr(o.result) ?? "claude reported an error";
          throw new Error(msg);
        }
        continue;
      }

      if (type === "stream_event") {
        const inner = asObj(o.event);
        const innerType = inner ? asStr(inner.type) : null;
        if (inner && innerType === "content_block_delta") {
          const delta = asObj(inner.delta);
          const text = delta ? asStr(delta.text) : null;
          if (text) {
            sawStreamingDelta = true;
            totalEmitted += text;
            yield { kind: "delta", text };
          }
        }
        continue;
      }

      if (type === "assistant" && !sawStreamingDelta) {
        const message = asObj(o.message);
        const content = message ? asArr(message.content) : null;
        if (content) {
          const parts: string[] = [];
          for (const c of content) {
            const co = asObj(c);
            if (co && asStr(co.type) === "text") {
              const t = asStr(co.text);
              if (t) parts.push(t);
            }
          }
          const full = parts.join("");
          if (full && full.length > totalEmitted.length && full.startsWith(totalEmitted)) {
            const suffix = full.slice(totalEmitted.length);
            totalEmitted = full;
            yield { kind: "delta", text: suffix };
          } else if (full && !totalEmitted) {
            totalEmitted = full;
            yield { kind: "delta", text: full };
          }
        }
      }
    }
  }

  const exitCode: number = await new Promise((res) => proc.on("close", (c) => res(c ?? 0)));
  if (exitCode !== 0) {
    throw new Error(`claude exited ${exitCode}: ${stderr.slice(0, 500)}`);
  }

  yield { kind: "done", fullText: totalEmitted };
}
