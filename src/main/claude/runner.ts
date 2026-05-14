import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKMessage,
  SDKAssistantMessage,
  SDKUserMessage,
  SDKResultMessage,
  SDKPartialAssistantMessage,
} from "@anthropic-ai/claude-agent-sdk";
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
import type { Attachment } from "@shared/ipc";
import { buildAskUserServer } from "./askUserMcp";

const ASK_USER_SYSTEM_NOTE = `\n\nWhen you need to ask the local user a structured multiple-choice question, use the \`mcp__lmc__ask_user_question\` tool. It renders an interactive picker inside the local-lmcanvas app. Do NOT use the built-in AskUserQuestion tool — it is disabled in this environment.`;

export type RunnerEvent =
  | { kind: "text_delta"; text: string }
  | { kind: "tool_use"; toolUseId: string; name: string; input: unknown }
  | { kind: "tool_result"; toolUseId: string; content: string; isError: boolean }
  | { kind: "thinking_delta"; text: string }
  | { kind: "done"; isError?: boolean; result?: string }
  | { kind: "error"; message: string };

export type RunClaudeOpts = {
  cwd: string;
  model?: string;
  systemPrompt?: string;
  attachments?: Attachment[];
  signal?: AbortSignal;
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

  const emit = (ev: RunnerEvent): void => {
    if (ev.kind === "done") doneEmitted = true;
    opts.onEvent(ev);
  };

  const attachments = opts.attachments ?? [];
  // string-prompt path is preserved when there are no attachments so we don't
  // change the working behaviour for plain-text chats. only images route through
  // streaming-input.
  const promptInput: string | AsyncIterable<SDKUserMessage> =
    attachments.length > 0 ? buildStreamingPrompt(prompt, attachments) : prompt;

  const askUserServer = buildAskUserServer(controller.signal);
  const appendedSystemPrompt = (opts.systemPrompt ?? "") + ASK_USER_SYSTEM_NOTE;

  try {
    const q = query({
      prompt: promptInput,
      options: {
        cwd: opts.cwd,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        model: opts.model,
        // append vs raw: we always extend claude_code preset so the agent
        // keeps its built-in tooling instructions
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: appendedSystemPrompt,
        },
        includePartialMessages: true,
        settingSources: ["user", "project"],
        abortController: controller,
        mcpServers: { lmc: askUserServer },
        disallowedTools: ["AskUserQuestion"],
      },
    });

    for await (const msg of q as AsyncIterable<SDKMessage>) {
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
  if (msg.subtype === "success") {
    emit({ kind: "done", isError: msg.is_error, result: msg.result });
    return;
  }
  const errText = msg.errors && msg.errors.length ? msg.errors.join("\n") : msg.subtype;
  emit({ kind: "done", isError: true, result: errText });
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
