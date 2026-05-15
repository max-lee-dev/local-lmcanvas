import { spawn } from "node:child_process";
import { consumeJsonl } from "./jsonlReader";
import { shellEnv } from "../shellPath";
import {
  composePromptWithSystem,
  errorMessage,
  isAuthError,
  type RunAgentOpts,
  type RunnerEvent,
} from "./types";

type CursorContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id?: string; name?: string; input?: unknown }
  | { type: string; [k: string]: unknown };

type CursorMessage = {
  role?: string;
  content?: CursorContentBlock[];
};

type CursorEvent =
  | { type: "system"; subtype?: string; [k: string]: unknown }
  | { type: "user"; message?: CursorMessage }
  | { type: "thinking"; subtype?: string; text?: string }
  | { type: "assistant"; message?: CursorMessage }
  | {
      type: "result";
      subtype?: string;
      is_error?: boolean;
      result?: string;
      error?: string;
    }
  | { type: string; [k: string]: unknown };

export async function runCursor(prompt: string, opts: RunAgentOpts): Promise<void> {
  if (opts.attachments && opts.attachments.length > 0) {
    opts.onEvent({
      kind: "error",
      message: "Image attachments are not yet supported for the cursor provider.",
    });
    opts.onEvent({ kind: "done", isError: true });
    return;
  }

  const bin = opts.binPath || "cursor-agent";
  const composedPrompt = composePromptWithSystem(prompt, opts.systemPrompt);
  const args = [
    "-p",
    composedPrompt,
    "--output-format",
    "stream-json",
    "--force",
    ...(opts.model ? ["--model", opts.model] : []),
  ];

  let doneEmitted = false;
  const emit = (ev: RunnerEvent): void => {
    if (ev.kind === "done") doneEmitted = true;
    if (ev.kind === "error" && !ev.code && isAuthError(ev.message)) {
      opts.onEvent({ ...ev, code: "auth_required" });
      return;
    }
    if (ev.kind === "done" && ev.isError && !ev.code && isAuthError(ev.result ?? "")) {
      opts.onEvent({ ...ev, code: "auth_required" });
      return;
    }
    opts.onEvent(ev);
  };

  const env = await shellEnv();
  const proc = spawn(bin, args, {
    cwd: opts.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });

  if (opts.signal) {
    if (opts.signal.aborted) proc.kill("SIGTERM");
    else
      opts.signal.addEventListener("abort", () => proc.kill("SIGTERM"), {
        once: true,
      });
  }

  proc.on("error", (err: NodeJS.ErrnoException) => {
    const msg =
      err.code === "ENOENT"
        ? `cursor-agent executable not found (tried "${bin}"). Install cursor-agent CLI.`
        : errorMessage(err);
    emit({ kind: "error", message: msg });
  });

  let stderrBuf = "";
  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (chunk: string) => {
    stderrBuf += chunk;
  });

  try {
    await consumeJsonl(proc.stdout, (obj) => handleEvent(obj as CursorEvent, emit));

    const code: number | null = await new Promise((resolve) => {
      if (proc.exitCode !== null) resolve(proc.exitCode);
      else proc.once("close", (c) => resolve(c));
    });

    if (!doneEmitted) {
      if (code !== 0 && code !== null) {
        emit({
          kind: "error",
          message: `cursor-agent exited with code ${code}${stderrBuf ? `\n${stderrBuf}` : ""}`,
        });
        emit({ kind: "done", isError: true });
      } else {
        emit({ kind: "done", isError: false });
      }
    }
  } catch (err) {
    emit({ kind: "error", message: errorMessage(err) });
    if (!doneEmitted) emit({ kind: "done", isError: true });
  }
}

function handleEvent(ev: CursorEvent, emit: (e: RunnerEvent) => void): void {
  switch (ev.type) {
    case "system":
    case "user":
      return;
    case "thinking": {
      const t = ev as { subtype?: string; text?: string };
      if (t.subtype === "delta" && typeof t.text === "string" && t.text.length > 0) {
        emit({ kind: "thinking_delta", text: t.text });
      }
      return;
    }
    case "assistant": {
      const msg = (ev as { message?: CursorMessage }).message;
      if (!msg || !Array.isArray(msg.content)) return;
      for (const block of msg.content) {
        handleAssistantBlock(block, emit);
      }
      return;
    }
    case "result": {
      const r = ev as {
        subtype?: string;
        is_error?: boolean;
        result?: string;
        error?: string;
      };
      if (r.is_error === true || r.subtype === "error") {
        emit({ kind: "error", message: r.error ?? r.result ?? "cursor-agent error" });
        emit({ kind: "done", isError: true });
      } else {
        emit({ kind: "done", isError: false, result: r.result });
      }
      return;
    }
    default:
      return;
  }
}

function handleAssistantBlock(
  block: CursorContentBlock,
  emit: (e: RunnerEvent) => void
): void {
  if (block.type === "text") {
    const text = (block as { text?: string }).text;
    if (typeof text === "string" && text.length > 0) {
      emit({ kind: "text_delta", text });
    }
    return;
  }
  if (block.type === "tool_use") {
    const tu = block as { id?: string; name?: string; input?: unknown };
    emit({
      kind: "tool_use",
      toolUseId: tu.id ?? `cursor_${Math.random().toString(36).slice(2)}`,
      name: tu.name ?? "tool",
      input: tu.input,
    });
  }
}
