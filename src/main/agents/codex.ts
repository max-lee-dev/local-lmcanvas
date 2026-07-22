import { writeAttachmentsToTemp } from "./attachmentTempFiles";
import { CodexAppServerClient } from "./codexAppServer";
import type { UsageSummary } from "@shared/types";
import {
  errorMessage,
  isAuthError,
  type RunAgentOpts,
  type RunnerEvent,
} from "./types";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object"
    ? (value as JsonObject)
    : null;
}

function stringField(value: unknown, key: string): string | undefined {
  const obj = asObject(value);
  return typeof obj?.[key] === "string" ? obj[key] : undefined;
}

function numberField(value: unknown, key: string): number | undefined {
  const obj = asObject(value);
  return typeof obj?.[key] === "number" ? obj[key] : undefined;
}

function serviceTier(value: RunAgentOpts["serviceTier"]): string | null | undefined {
  if (value === "fast") return "fast";
  if (value === "standard") return null;
  return undefined;
}

export async function runCodex(prompt: string, opts: RunAgentOpts): Promise<void> {
  let doneEmitted = false;
  const emit = (event: RunnerEvent): void => {
    if (event.kind === "done") doneEmitted = true;
    if (event.kind === "error" && !event.code && isAuthError(event.message)) {
      opts.onEvent({ ...event, code: "auth_required" });
      return;
    }
    if (
      event.kind === "done" &&
      event.isError &&
      !event.code &&
      isAuthError(event.result ?? "")
    ) {
      opts.onEvent({ ...event, code: "auth_required" });
      return;
    }
    opts.onEvent(event);
  };

  let attachmentCleanup: (() => Promise<void>) | null = null;
  try {
    let imagePaths: string[] = [];
    if (opts.attachments && opts.attachments.length > 0) {
      const written = await writeAttachmentsToTemp(opts.attachments);
      imagePaths = written.paths;
      attachmentCleanup = written.cleanup;
    }

    const client = await CodexAppServerClient.connect(opts.binPath || "codex");
    const threadConfig: JsonObject = {
      cwd: opts.cwd,
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.systemPrompt ? { developerInstructions: opts.systemPrompt } : {}),
      ...(serviceTier(opts.serviceTier) !== undefined
        ? { serviceTier: serviceTier(opts.serviceTier) }
        : {}),
    };

    const parentThreadId =
      opts.parentSession?.provider === "codex" ? opts.parentSession.id : undefined;
    const threadResult = await client.request(
      parentThreadId ? "thread/fork" : "thread/start",
      parentThreadId ? { threadId: parentThreadId, ...threadConfig } : threadConfig,
    );
    const thread = asObject(asObject(threadResult)?.thread);
    const threadId = typeof thread?.id === "string" ? thread.id : undefined;
    if (!threadId) throw new Error("Codex app-server did not return a thread ID.");

    emit({ kind: "session", session: { provider: "codex", id: threadId } });

    let turnId: string | null = null;
    let settled = false;
    let lastUsage: JsonObject | undefined;
    const agentDeltaItems = new Set<string>();
    const reasoningDeltaItems = new Set<string>();
    const commandOutput = new Map<string, string>();

    const completion = new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        off();
        if (error) reject(error);
        else resolve();
      };

      const off = client.onNotification((method, params) => {
        if (method === "transport/error") {
          finish(new Error(stringField(params, "message") ?? "Codex app-server stopped."));
          return;
        }
        if (params.threadId !== threadId) return;
        const notificationTurnId =
          typeof params.turnId === "string"
            ? params.turnId
            : stringField(params.turn, "id");
        if (turnId && notificationTurnId && notificationTurnId !== turnId) return;

        if (method === "item/agentMessage/delta") {
          const itemId = stringField(params, "itemId") ?? "agent";
          const delta = stringField(params, "delta");
          if (delta) {
            agentDeltaItems.add(itemId);
            emit({ kind: "text_delta", text: delta });
          }
          return;
        }

        if (
          method === "item/reasoning/summaryTextDelta" ||
          method === "item/reasoning/textDelta"
        ) {
          const itemId = stringField(params, "itemId") ?? "reasoning";
          const delta = stringField(params, "delta");
          if (delta) {
            reasoningDeltaItems.add(itemId);
            emit({ kind: "thinking_delta", text: delta });
          }
          return;
        }

        if (method === "item/commandExecution/outputDelta") {
          const itemId = stringField(params, "itemId");
          const delta = stringField(params, "delta");
          if (itemId && delta) {
            const output = (commandOutput.get(itemId) ?? "") + delta;
            commandOutput.set(itemId, output);
            emit({
              kind: "tool_result",
              toolUseId: itemId,
              content: output,
              isError: false,
            });
          }
          return;
        }

        if (method === "item/started") {
          const item = asObject(params.item);
          if (item) emitStartedItem(item, emit);
          return;
        }

        if (method === "item/completed") {
          const item = asObject(params.item);
          if (item) {
            emitCompletedItem(
              item,
              emit,
              agentDeltaItems,
              reasoningDeltaItems,
              commandOutput,
            );
          }
          return;
        }

        if (method === "thread/tokenUsage/updated") {
          const usage = asObject(asObject(params.tokenUsage)?.last);
          if (usage) lastUsage = usage;
          return;
        }

        if (method === "turn/completed") {
          const turn = asObject(params.turn);
          const status = stringField(turn, "status");
          if (status === "failed") {
            const error = asObject(turn?.error);
            const message =
              stringField(error, "message") ?? "Codex app-server turn failed.";
            emit({ kind: "error", message });
            emit({ kind: "done", isError: true, result: message });
          } else {
            emit({ kind: "done", isError: status === "interrupted", usage: usage(lastUsage) });
          }
          finish();
          return;
        }

        if (method === "error") {
          const message = stringField(params, "message") ?? "Codex app-server error.";
          finish(new Error(message));
        }
      });

      const onAbort = () => {
        if (!turnId) return;
        void client
          .request("turn/interrupt", { threadId, turnId })
          .catch((error) => console.warn("[codex] interrupt failed:", error));
      };
      if (opts.signal) {
        if (opts.signal.aborted) onAbort();
        else opts.signal.addEventListener("abort", onAbort, { once: true });
      }
    });

    const input: JsonObject[] = [
      { type: "text", text: prompt, text_elements: [] },
      ...imagePaths.map((path) => ({ type: "localImage", path })),
    ];
    const turnResult = await client.request("turn/start", {
      threadId,
      input,
      cwd: opts.cwd,
      approvalPolicy: "never",
      sandboxPolicy: { type: "dangerFullAccess" },
      ...(opts.model ? { model: opts.model } : {}),
      ...(opts.reasoningEffort ? { effort: opts.reasoningEffort } : {}),
      ...(serviceTier(opts.serviceTier) !== undefined
        ? { serviceTier: serviceTier(opts.serviceTier) }
        : {}),
    });
    turnId = stringField(asObject(turnResult)?.turn, "id") ?? null;
    if (!turnId) throw new Error("Codex app-server did not return a turn ID.");
    if (opts.signal?.aborted) {
      await client.request("turn/interrupt", { threadId, turnId });
    }

    await completion;
  } catch (error) {
    const message = errorMessage(error);
    emit({ kind: "error", message });
    if (!doneEmitted) emit({ kind: "done", isError: true, result: message });
  } finally {
    if (attachmentCleanup) {
      try {
        await attachmentCleanup();
      } catch {
        // best effort; the OS also clears its temporary directory
      }
    }
  }
}

function emitStartedItem(item: JsonObject, emit: (event: RunnerEvent) => void): void {
  const id = stringField(item, "id") ?? `codex_${Math.random().toString(36).slice(2)}`;
  const type = stringField(item, "type");
  if (type === "commandExecution") {
    emit({ kind: "tool_use", toolUseId: id, name: "exec", input: item });
  } else if (type === "fileChange") {
    emit({ kind: "tool_use", toolUseId: id, name: "file_change", input: item });
  } else if (type === "mcpToolCall" || type === "dynamicToolCall") {
    const tool = stringField(item, "tool") ?? type;
    emit({ kind: "tool_use", toolUseId: id, name: tool, input: item });
  } else if (type === "webSearch") {
    emit({ kind: "tool_use", toolUseId: id, name: "web_search", input: item });
  }
}

function emitCompletedItem(
  item: JsonObject,
  emit: (event: RunnerEvent) => void,
  agentDeltaItems: Set<string>,
  reasoningDeltaItems: Set<string>,
  commandOutput: Map<string, string>,
): void {
  const id = stringField(item, "id") ?? `codex_${Math.random().toString(36).slice(2)}`;
  const type = stringField(item, "type");
  if (type === "agentMessage" && !agentDeltaItems.has(id)) {
    const text = stringField(item, "text");
    if (text) emit({ kind: "text_delta", text });
    return;
  }
  if (type === "reasoning" && !reasoningDeltaItems.has(id)) {
    const summary = Array.isArray(item.summary)
      ? item.summary.filter((value): value is string => typeof value === "string")
      : [];
    const content = Array.isArray(item.content)
      ? item.content.filter((value): value is string => typeof value === "string")
      : [];
    const text = [...summary, ...content].join("\n");
    if (text) emit({ kind: "thinking_delta", text });
    return;
  }
  if (type === "commandExecution") {
    const output = stringField(item, "aggregatedOutput") ?? commandOutput.get(id) ?? "";
    const exitCode = numberField(item, "exitCode");
    emit({
      kind: "tool_result",
      toolUseId: id,
      content: output,
      isError: stringField(item, "status") === "failed" || (exitCode ?? 0) !== 0,
    });
    return;
  }
  if (type === "mcpToolCall" || type === "dynamicToolCall") {
    const result = item.result ?? item.contentItems ?? item.error ?? "";
    emit({
      kind: "tool_result",
      toolUseId: id,
      content: typeof result === "string" ? result : JSON.stringify(result),
      isError: item.error != null || item.success === false,
    });
  }
}

function usage(raw: JsonObject | undefined): UsageSummary | undefined {
  if (!raw) return undefined;
  const inputTokens = numberField(raw, "inputTokens");
  const outputTokens = numberField(raw, "outputTokens");
  const cachedInputTokens = numberField(raw, "cachedInputTokens");
  const reasoningOutputTokens = numberField(raw, "reasoningOutputTokens");
  const totalTokens = numberField(raw, "totalTokens");
  return {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
    ...(reasoningOutputTokens !== undefined ? { reasoningOutputTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
  };
}
