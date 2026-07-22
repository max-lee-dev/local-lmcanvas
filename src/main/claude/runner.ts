import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKResultMessage,
  SDKPartialAssistantMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { existsSync } from "node:fs";

const nodeRequire = createRequire(import.meta.url);

function resolveClaudeBin(): string | undefined {
  const binName = process.platform === "win32" ? "claude.exe" : "claude";
  const platformPkgShort = `claude-agent-sdk-${process.platform}-${process.arch}`;
  const platformPkg = `@anthropic-ai/${platformPkgShort}`;
  const candidates: string[] = [];

  // 1. Packaged Electron: binary is unpacked next to app.asar.
  if (process.resourcesPath) {
    candidates.push(
      join(
        process.resourcesPath,
        "app.asar.unpacked",
        "node_modules",
        "@anthropic-ai",
        "claude-agent-sdk",
        "node_modules",
        "@anthropic-ai",
        platformPkgShort,
        binName,
      ),
      // Fallback: if it ever lands flat at top-level unpacked.
      join(
        process.resourcesPath,
        "app.asar.unpacked",
        "node_modules",
        "@anthropic-ai",
        platformPkgShort,
        binName,
      ),
    );
  }

  // 2. Dev / hoisted install: resolve the SDK entry, then jump to the nested platform pkg.
  try {
    const sdkEntry = nodeRequire.resolve("@anthropic-ai/claude-agent-sdk");
    const sdkDir = dirname(sdkEntry);
    candidates.push(
      join(sdkDir, "node_modules", "@anthropic-ai", platformPkgShort, binName),
    );
  } catch {
    /* SDK unresolvable — shouldn't happen */
  }

  // 3. Top-level hoist (npm/yarn).
  try {
    const direct = nodeRequire.resolve(`${platformPkg}/package.json`);
    candidates.push(join(dirname(direct), binName));
  } catch {
    /* not hoisted */
  }

  for (let candidate of candidates) {
    const asarSeg = `${sep}app.asar${sep}`;
    if (candidate.includes(asarSeg)) {
      candidate = candidate.replace(asarSeg, `${sep}app.asar.unpacked${sep}`);
    }
    if (existsSync(candidate)) return candidate;
  }
  console.error("[lmcanvas] No claude binary found. Candidates tried:", candidates);
  return undefined;
}

export const CLAUDE_BIN_PATH = resolveClaudeBin();
console.log("[lmcanvas] CLAUDE_BIN_PATH =", CLAUDE_BIN_PATH);
import type {
  BetaContentBlock,
  BetaRawContentBlockDeltaEvent,
  BetaTextDelta,
  BetaThinkingDelta,
  BetaToolUseBlock,
  BetaTextBlock,
  BetaThinkingBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import type {
  ContentBlockParam,
  ImageBlockParam,
  TextBlockParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import type { WebContents } from "electron";
import type { Attachment } from "@shared/ipc";
import type { ProviderSessionRef } from "@shared/types";
import { buildAskUserServer } from "./askUserMcp";
import { isAuthError, type RunnerEvent } from "../agents/types";
import { normalizeUsage } from "../agents/usage";

const ASK_USER_SYSTEM_NOTE = `\n\nWhen you need to ask the local user a structured multiple-choice question, use the \`mcp__lmc__ask_user_question\` tool. It renders an interactive picker inside the local-lmcanvas app. Do NOT use the built-in AskUserQuestion tool — it is disabled in this environment.`;

// Built-in agentic tools dropped in chatOnly mode. Removing them from the
// model's context means the SDK doesn't ship their descriptions on every
// turn — that's the bulk of the per-request token tax.
const CHAT_ONLY_DISALLOWED_TOOLS = [
  "AskUserQuestion",
  "Bash",
  "BashOutput",
  "KillShell",
  "Read",
  "Edit",
  "Write",
  "MultiEdit",
  "NotebookEdit",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "TodoWrite",
  "Task",
  "SlashCommand",
  "ExitPlanMode",
];

export type { RunnerEvent };

export type RunClaudeOpts = {
  cwd: string;
  model?: string;
  systemPrompt?: string;
  attachments?: Attachment[];
  signal?: AbortSignal;
  /** When true, the SDK runs in plan mode (read-only: model proposes a plan but can't use mutating tools). */
  planMode?: boolean;
  /** When true, skip the claude_code preset and drop agent tools — fast pure-chat path. Ignored when planMode is also true. */
  chatOnly?: boolean;
  parentSession?: ProviderSessionRef;
  webContents: WebContents;
  nodeId: string;
  onEvent: (ev: RunnerEvent) => void;
};

export async function runClaude(prompt: string, opts: RunClaudeOpts): Promise<void> {
  const controller = new AbortController();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const seenToolUseIds = new Set<string>();
  let doneEmitted = false;
  let emittedSessionId: string | null = null;

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

  const attachments = opts.attachments ?? [];
  // string-prompt path is preserved when there are no attachments so we don't
  // change the working behaviour for plain-text chats. only images route through
  // streaming-input.
  const promptInput: string | AsyncIterable<SDKUserMessage> =
    attachments.length > 0 ? buildStreamingPrompt(prompt, attachments) : prompt;

  // Plan mode forces the agent preset; chatOnly only kicks in for vanilla chat.
  const chatOnly = opts.chatOnly === true && !opts.planMode;
  const baseSystemPrompt = opts.systemPrompt ?? "";
  const askUserServer = chatOnly
    ? undefined
    : buildAskUserServer(opts.webContents, opts.nodeId, controller.signal);

  const systemPromptOption = chatOnly
    ? baseSystemPrompt.length > 0
      ? baseSystemPrompt
      : undefined
    : {
        type: "preset" as const,
        preset: "claude_code" as const,
        append: baseSystemPrompt + ASK_USER_SYSTEM_NOTE,
      };

  try {
    const q = query({
      prompt: promptInput,
      options: {
        cwd: opts.cwd,
        // Plan mode: SDK disallows mutating tools and the model returns a plan.
        // Default: full bypass so user-approved local actions run without prompts.
        permissionMode: opts.planMode ? "plan" : "bypassPermissions",
        allowDangerouslySkipPermissions: !opts.planMode,
        model: opts.model,
        resume:
          opts.parentSession?.provider === "claude"
            ? opts.parentSession.id
            : undefined,
        forkSession: opts.parentSession?.provider === "claude" || undefined,
        pathToClaudeCodeExecutable: CLAUDE_BIN_PATH,
        // chatOnly: raw system prompt (no claude_code preset) → drops ~10k
        // tokens of agentic tool instructions on every turn, big TTFT win.
        systemPrompt: systemPromptOption,
        includePartialMessages: true,
        settingSources: ["user", "project"],
        abortController: controller,
        mcpServers: askUserServer ? { lmc: askUserServer } : {},
        disallowedTools: chatOnly ? CHAT_ONLY_DISALLOWED_TOOLS : ["AskUserQuestion"],
      },
    });

    for await (const msg of q as AsyncIterable<SDKMessage>) {
      const sessionId = (msg as { session_id?: unknown }).session_id;
      if (
        typeof sessionId === "string" &&
        sessionId.length > 0 &&
        sessionId !== emittedSessionId
      ) {
        emittedSessionId = sessionId;
        emit({ kind: "session", session: { provider: "claude", id: sessionId } });
      }
      handleMessage(msg, seenToolUseIds, emit);
      if (msg.type === "result") {
        break;
      }
    }
  } catch (err: unknown) {
    const message = errorMessage(err);
    emit({ kind: "error", message });
  } finally {
    if (!doneEmitted) emit({ kind: "done", isError: false });
  }
}

function handleMessage(
  msg: SDKMessage,
  seenToolUseIds: Set<string>,
  emit: (ev: RunnerEvent) => void
): void {
  switch (msg.type) {
    case "stream_event":
      handleStreamEvent(msg, emit);
      return;
    case "assistant":
      handleAssistant(msg, seenToolUseIds, emit);
      return;
    case "user":
      handleUser(msg, emit);
      return;
    case "result":
      handleResult(msg, emit);
      return;
    default:
      return;
  }
}

function handleStreamEvent(
  msg: SDKPartialAssistantMessage,
  emit: (ev: RunnerEvent) => void
): void {
  const event = msg.event;
  if (event.type !== "content_block_delta") return;
  const delta = (event as BetaRawContentBlockDeltaEvent).delta;
  if (delta.type === "text_delta") {
    emit({ kind: "text_delta", text: (delta as BetaTextDelta).text });
  } else if (delta.type === "thinking_delta") {
    emit({ kind: "thinking_delta", text: (delta as BetaThinkingDelta).thinking });
  }
}

function handleAssistant(
  msg: SDKAssistantMessage,
  seenToolUseIds: Set<string>,
  emit: (ev: RunnerEvent) => void
): void {
  const content = msg.message.content as BetaContentBlock[];
  for (const block of content) {
    if (block.type === "tool_use") {
      const tu = block as BetaToolUseBlock;
      if (seenToolUseIds.has(tu.id)) continue;
      seenToolUseIds.add(tu.id);
      emit({ kind: "tool_use", toolUseId: tu.id, name: tu.name, input: tu.input });
    }
    // text/thinking already arrived as deltas via stream_event
    void (block as BetaTextBlock | BetaThinkingBlock);
  }
}

function handleUser(msg: SDKUserMessage, emit: (ev: RunnerEvent) => void): void {
  const content = msg.message.content;
  if (typeof content === "string") return;
  for (const block of content as ContentBlockParam[]) {
    if (block.type !== "tool_result") continue;
    const tr = block as ToolResultBlockParam;
    emit({
      kind: "tool_result",
      toolUseId: tr.tool_use_id,
      content: toolResultContentToString(tr.content),
      isError: tr.is_error === true,
    });
  }
}

function handleResult(msg: SDKResultMessage, emit: (ev: RunnerEvent) => void): void {
  const usage = normalizeUsage((msg as { usage?: unknown }).usage, {
    totalCostUsd: (msg as { total_cost_usd?: unknown }).total_cost_usd,
  });
  if (msg.subtype === "success") {
    emit({ kind: "done", isError: msg.is_error, result: msg.result, usage });
    return;
  }
  const errText = msg.errors && msg.errors.length ? msg.errors.join("\n") : msg.subtype;
  emit({ kind: "done", isError: true, result: errText, usage });
}

function toolResultContentToString(content: ToolResultBlockParam["content"]): string {
  if (content === undefined) return "";
  if (typeof content === "string") return content;
  const parts: string[] = [];
  for (const c of content) {
    if (c.type === "text") {
      parts.push(c.text);
    } else {
      // images / docs / search results aren't meaningful to render as plain text;
      // surface a placeholder so the UI knows something was there
      parts.push(`[${c.type}]`);
    }
  }
  return parts.join("\n");
}

async function* buildStreamingPrompt(
  text: string,
  attachments: Attachment[]
): AsyncIterable<SDKUserMessage> {
  const content: ContentBlockParam[] = [];
  if (text.length > 0) {
    const tb: TextBlockParam = { type: "text", text };
    content.push(tb);
  }
  for (const a of attachments) {
    const ib: ImageBlockParam = {
      type: "image",
      source: { type: "base64", media_type: a.mediaType, data: a.base64 },
    };
    content.push(ib);
  }
  yield {
    type: "user",
    parent_tool_use_id: null,
    message: { role: "user", content },
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return `Claude Code executable not found. Install Claude Code so the SDK can spawn it. (${err.message})`;
    }
    return err.message;
  }
  return String(err);
}
