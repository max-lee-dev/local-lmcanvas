import { spawn } from "node:child_process";
import { consumeJsonl } from "./jsonlReader";
import { shellEnv } from "../shellPath";
import { writeAttachmentsToTemp } from "./attachmentTempFiles";
import { normalizeUsage } from "./usage";
import {
  composePromptWithSystem,
  errorMessage,
  isAuthError,
  type RunAgentOpts,
  type RunnerEvent,
} from "./types";

type CodexItem = {
  id?: string;
  type?: string;
  text?: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  command?: string | string[];
  path?: string;
  diff?: string;
  tool_name?: string;
  arguments?: unknown;
  result?: unknown;
  [k: string]: unknown;
};

type CodexEvent =
  | { type: "thread.started"; thread_id?: string }
  | { type: "turn.started" }
  | { type: "turn.completed"; usage?: unknown }
  | { type: "turn.failed"; error?: { message?: string } }
  | { type: "item.started"; item?: CodexItem }
  | { type: "item.completed"; item?: CodexItem }
  | { type: "error"; message?: string }
  | { type: string; [k: string]: unknown };

export async function runCodex(prompt: string, opts: RunAgentOpts): Promise<void> {
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

  let attachmentCleanup: (() => Promise<void>) | null = null;
  let imagePaths: string[] = [];
  if (opts.attachments && opts.attachments.length > 0) {
    try {
      const written = await writeAttachmentsToTemp(opts.attachments);
      imagePaths = written.paths;
      attachmentCleanup = written.cleanup;
    } catch (err) {
      emit({
        kind: "error",
        message: `Failed to stage codex image attachments: ${errorMessage(err)}`,
      });
      emit({ kind: "done", isError: true });
      return;
    }
  }

  const bin = opts.binPath || "codex";
  // `-` is the positional PROMPT arg meaning "read from stdin". clap's variadic
  // `-i <FILE>...` will greedily consume the `-` as another image path unless
  // we terminate option parsing with `--`. The separator is harmless when
  // there are no images.
  const args = [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--dangerously-bypass-approvals-and-sandbox",
    "--cd",
    opts.cwd,
    ...(opts.model ? ["-c", `model="${opts.model}"`] : []),
    ...imagePaths.flatMap((p) => ["-i", p]),
    "--",
    "-",
  ];

  const env = await shellEnv();
  const proc = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"], env });

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
        ? `codex executable not found (tried "${bin}"). Install codex CLI.`
        : errorMessage(err);
    emit({ kind: "error", message: msg });
  });

  let stderrBuf = "";
  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (chunk: string) => {
    stderrBuf += chunk;
  });

  // EPIPE on stdin (subprocess died before/during the write) is async and
  // bypasses the surrounding try/catch — surface it as a runner error instead
  // of letting it crash the main process.
  proc.stdin.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") return;
    emit({ kind: "error", message: errorMessage(err) });
  });

  try {
    proc.stdin.write(composePromptWithSystem(prompt, opts.systemPrompt));
    proc.stdin.end();

    await consumeJsonl(proc.stdout, (obj) => handleEvent(obj as CodexEvent, emit));

    const code: number | null = await new Promise((resolve) => {
      if (proc.exitCode !== null) resolve(proc.exitCode);
      else proc.once("close", (c) => resolve(c));
    });

    if (!doneEmitted) {
      if (code !== 0 && code !== null) {
        const message = `codex exited with code ${code}${stderrBuf ? `\n${stderrBuf}` : ""}`;
        emit({ kind: "error", message });
        emit({ kind: "done", isError: true, result: message });
      } else {
        emit({ kind: "done", isError: false });
      }
    }
  } catch (err) {
    emit({ kind: "error", message: errorMessage(err) });
    if (!doneEmitted) emit({ kind: "done", isError: true });
  } finally {
    if (attachmentCleanup) {
      try {
        await attachmentCleanup();
      } catch {
        // best-effort; temp files in os.tmpdir() are cleared by the OS eventually
      }
    }
  }
}

function handleEvent(ev: CodexEvent, emit: (e: RunnerEvent) => void): void {
  switch (ev.type) {
    case "thread.started":
    case "turn.started":
    case "item.started":
      return;
    case "turn.completed":
      emit({
        kind: "done",
        isError: false,
        usage: normalizeUsage((ev as { usage?: unknown }).usage),
      });
      return;
    case "turn.failed": {
      const message =
        (ev as { error?: { message?: string } }).error?.message ?? "codex turn failed";
      emit({ kind: "error", message });
      emit({ kind: "done", isError: true });
      return;
    }
    case "error": {
      const message = (ev as { message?: string }).message ?? "codex error";
      emit({ kind: "error", message });
      return;
    }
    case "item.completed": {
      const item = (ev as { item?: CodexItem }).item;
      if (item) handleItem(item, emit);
      return;
    }
    default:
      return;
  }
}

function handleItem(item: CodexItem, emit: (e: RunnerEvent) => void): void {
  const id = item.id ?? `codex_${Math.random().toString(36).slice(2)}`;
  switch (item.type) {
    case "agent_message":
      if (typeof item.text === "string" && item.text.length > 0) {
        emit({ kind: "text_delta", text: item.text });
      }
      return;
    case "reasoning":
      if (typeof item.text === "string" && item.text.length > 0) {
        emit({ kind: "thinking_delta", text: item.text });
      }
      return;
    case "command_execution": {
      emit({ kind: "tool_use", toolUseId: id, name: "exec", input: item });
      const out = combineOutputs(item.stdout, item.stderr);
      if (out.length > 0 || typeof item.exit_code === "number") {
        emit({
          kind: "tool_result",
          toolUseId: id,
          content: out,
          isError: typeof item.exit_code === "number" && item.exit_code !== 0,
        });
      }
      return;
    }
    case "file_change":
      emit({ kind: "tool_use", toolUseId: id, name: "file_change", input: item });
      return;
    case "mcp_tool_call": {
      const name =
        typeof item.tool_name === "string" ? item.tool_name : "mcp_tool_call";
      emit({ kind: "tool_use", toolUseId: id, name, input: item });
      if (item.result !== undefined) {
        emit({
          kind: "tool_result",
          toolUseId: id,
          content:
            typeof item.result === "string" ? item.result : JSON.stringify(item.result),
          isError: false,
        });
      }
      return;
    }
    default:
      emit({
        kind: "tool_use",
        toolUseId: id,
        name: item.type ?? "unknown",
        input: item,
      });
      return;
  }
}

function combineOutputs(stdout?: string, stderr?: string): string {
  const parts: string[] = [];
  if (stdout && stdout.length > 0) parts.push(stdout);
  if (stderr && stderr.length > 0) parts.push(stderr);
  return parts.join("\n");
}
