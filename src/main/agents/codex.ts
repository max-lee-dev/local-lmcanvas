import { randomUUID } from "node:crypto";
import { shell as electronShell } from "electron";
import { writeAttachmentsToTemp } from "./attachmentTempFiles";
import {
  CodexAppServerClient,
  isThreadUnavailableError,
  type ServerRequestResolution,
} from "./codexAppServer";
import { requestAnswer } from "../claude/askUserBridge";
import type {
  CodexModelInfo,
  CodexRuntimeInfo,
  ReasoningEffort,
  UsageSummary,
} from "@shared/types";
import type { AskUserQuestion, AskUserResponsePayload } from "@shared/ipc";
import type {
  CommandApprovalParams,
  FileChangeApprovalParams,
  JsonObject,
  McpElicitationPropertySchema,
  McpServerElicitationParams,
  ToolRequestUserInputParams,
  TurnPlanUpdatedParams,
} from "./codexProtocol";
import {
  errorMessage,
  isAuthError,
  type RunAgentOpts,
  type RunnerEvent,
} from "./types";

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

function serviceTier(
  value: RunAgentOpts["serviceTier"],
  model: CodexModelInfo | undefined,
): string | null | undefined {
  if (value === "fast") {
    if (!model) return "priority";
    return model.serviceTiers.find(
      (tier) => tier.id === "priority" || tier.id === "fast",
    )?.id;
  }
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

    const connectStartedAt = Date.now();
    const client = await CodexAppServerClient.connect(opts.binPath || "codex");
    const runtimeInfo: CodexRuntimeInfo = await client.getRuntimeInfo().catch((error) => {
      console.warn("[codex] model catalog unavailable:", error);
      return { models: [], protocolVersion: 2 };
    });
    const modelId = opts.model ?? runtimeInfo.defaultModelId;
    const modelInfo = runtimeInfo.models.find((model) => model.id === modelId);
    const reasoningEffort =
      opts.reasoningEffort ?? modelInfo?.defaultReasoningEffort;
    const resolvedServiceTier = serviceTier(opts.serviceTier, modelInfo);
    console.info("[codex:latency]", {
      nodeId: opts.nodeId,
      phase: "connected",
      elapsedMs: Date.now() - connectStartedAt,
    });

    const threadConfig: JsonObject = {
      cwd: opts.cwd,
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      ...(modelId ? { model: modelId } : {}),
      ...(opts.systemPrompt ? { developerInstructions: opts.systemPrompt } : {}),
      ...(resolvedServiceTier !== undefined
        ? { serviceTier: resolvedServiceTier }
        : {}),
    };

    const currentThreadId =
      opts.currentSession?.provider === "codex"
        ? opts.currentSession.id
        : undefined;
    const parentThreadId =
      opts.parentSession?.provider === "codex" ? opts.parentSession.id : undefined;
    const lifecycleStartedAt = Date.now();
    let lifecycle = "continue";
    let threadId = currentThreadId;
    if (currentThreadId && !client.isThreadLoaded(currentThreadId)) {
      lifecycle = "resume";
      const result = await client.requestWithOverloadRetry("thread/resume", {
        threadId: currentThreadId,
        excludeTurns: true,
        ...threadConfig,
      });
      threadId = stringField(asObject(asObject(result)?.thread), "id");
    } else if (!currentThreadId && parentThreadId) {
      lifecycle = "fork";
      const result = await client.requestWithOverloadRetry("thread/fork", {
        threadId: parentThreadId,
        excludeTurns: true,
        ...threadConfig,
      });
      threadId = stringField(asObject(asObject(result)?.thread), "id");
    } else if (!currentThreadId) {
      lifecycle = "start";
      const result = await client.requestWithOverloadRetry(
        "thread/start",
        threadConfig,
      );
      threadId = stringField(asObject(asObject(result)?.thread), "id");
    }
    if (!threadId) throw new Error("Codex app-server did not return a thread ID.");
    client.markThreadLoaded(threadId);
    console.info("[codex:latency]", {
      nodeId: opts.nodeId,
      phase: "thread_ready",
      lifecycle,
      elapsedMs: Date.now() - lifecycleStartedAt,
    });

    emit({ kind: "session", session: { provider: "codex", id: threadId } });
    const runTurn = (activeThreadId: string) =>
      client.runThreadExclusive(activeThreadId, () =>
        runCodexTurn({
          client,
          threadId: activeThreadId,
          prompt,
          imagePaths,
          opts,
          emit,
          modelId,
          reasoningEffort,
          serviceTier: resolvedServiceTier,
        }),
      );
    try {
      await runTurn(threadId);
    } catch (error) {
      if (
        lifecycle !== "continue" ||
        !(error instanceof CodexTurnStartError) ||
        !isThreadUnavailableError(error.original)
      ) {
        throw error;
      }
      client.markThreadUnloaded(threadId);
      const result = await client.requestWithOverloadRetry("thread/resume", {
        threadId,
        excludeTurns: true,
        ...threadConfig,
      });
      const resumedThreadId = result.thread.id;
      if (!resumedThreadId) throw error;
      threadId = resumedThreadId;
      client.markThreadLoaded(threadId);
      console.info("[codex:latency]", {
        nodeId: opts.nodeId,
        phase: "thread_recovered",
        elapsedMs: Date.now() - lifecycleStartedAt,
      });
      await runTurn(threadId);
    }
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

type RunCodexTurnArgs = {
  client: CodexAppServerClient;
  threadId: string;
  prompt: string;
  imagePaths: string[];
  opts: RunAgentOpts;
  emit: (event: RunnerEvent) => void;
  modelId?: string;
  reasoningEffort?: ReasoningEffort;
  serviceTier?: string | null;
};

class CodexTurnStartError extends Error {
  constructor(readonly original: unknown) {
    super(errorMessage(original));
    this.name = "CodexTurnStartError";
  }
}

async function runCodexTurn({
  client,
  threadId,
  prompt,
  imagePaths,
  opts,
  emit,
  modelId,
  reasoningEffort,
  serviceTier: resolvedServiceTier,
}: RunCodexTurnArgs): Promise<void> {
  const startedAt = Date.now();
  let turnId: string | null = null;
  let settled = false;
  let firstDeltaSeen = false;
  let lastUsage: JsonObject | undefined;
  const agentDeltaItems = new Set<string>();
  const planDeltaItems = new Set<string>();
  const reasoningDeltaItems = new Set<string>();
  const commandOutput = new Map<string, string>();

  const markFirstDelta = (): void => {
    if (firstDeltaSeen) return;
    firstDeltaSeen = true;
    console.info("[codex:latency]", {
      nodeId: opts.nodeId,
      phase: "first_delta",
      elapsedMs: Date.now() - startedAt,
    });
  };

  let removeAbortListener = (): void => {};
  let cancelCompletion = (): void => {};
  const serverRequestController = new AbortController();
  const offServerRequests = client.onServerRequest((method, params) => {
    const requestThreadId =
      stringField(params, "threadId") ?? stringField(params, "conversationId");
    if (requestThreadId && requestThreadId !== threadId) return undefined;
    return handleCodexServerRequest(
      method,
      params,
      opts,
      serverRequestController.signal,
    );
  });
  const completion = new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      off();
      offServerRequests();
      serverRequestController.abort();
      removeAbortListener();
      if (error) reject(error);
      else resolve();
    };
    cancelCompletion = () => finish();

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
          markFirstDelta();
          agentDeltaItems.add(itemId);
          emit({ kind: "text_delta", text: delta });
        }
        return;
      }

      if (method === "item/plan/delta") {
        const itemId = stringField(params, "itemId") ?? "plan";
        const delta = stringField(params, "delta");
        if (delta) {
          markFirstDelta();
          planDeltaItems.add(itemId);
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
          markFirstDelta();
          reasoningDeltaItems.add(itemId);
          emit({ kind: "thinking_delta", text: delta });
        }
        return;
      }

      if (method === "item/commandExecution/outputDelta") {
        const itemId = stringField(params, "itemId");
        const delta = stringField(params, "delta");
        if (itemId && delta) {
          markFirstDelta();
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
        if (item) {
          markFirstDelta();
          emitStartedItem(item, emit);
        }
        return;
      }

      if (method === "item/completed") {
        const item = asObject(params.item);
        if (item) {
          emitCompletedItem(
            item,
            emit,
            agentDeltaItems,
            planDeltaItems,
            reasoningDeltaItems,
            commandOutput,
          );
        }
        return;
      }

      if (method === "thread/tokenUsage/updated") {
        const usageValue = asObject(asObject(params.tokenUsage)?.last);
        if (usageValue) lastUsage = usageValue;
        return;
      }

      if (method === "turn/plan/updated") {
        const plan = params as TurnPlanUpdatedParams;
        console.info("[codex] plan updated", {
          nodeId: opts.nodeId,
          turnId: plan.turnId,
          steps: Array.isArray(plan.plan) ? plan.plan.length : 0,
        });
        return;
      }

      if (method === "model/rerouted") {
        const fromModel = stringField(params, "fromModel");
        const toModel = stringField(params, "toModel");
        const reason = stringField(params, "reason");
        if (fromModel && toModel && reason === "highRiskCyberActivity") {
          emit({ kind: "model_fallback", fromModel, toModel, reason });
        }
        return;
      }

      if (method === "turn/completed") {
        const turn = asObject(params.turn);
        const status = stringField(turn, "status");
        console.info("[codex:latency]", {
          nodeId: opts.nodeId,
          phase: "turn_complete",
          status,
          elapsedMs: Date.now() - startedAt,
        });
        if (status === "failed") {
          const error = asObject(turn?.error);
          const message =
            stringField(error, "message") ?? "Codex app-server turn failed.";
          emit({ kind: "error", message });
          emit({ kind: "done", isError: true, result: message });
        } else {
          emit({
            kind: "done",
            isError: status === "interrupted",
            usage: usage(lastUsage),
          });
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
      serverRequestController.abort();
      if (!turnId) return;
      void client
        .request("turn/interrupt", { threadId, turnId })
        .catch((error) => console.warn("[codex] interrupt failed:", error));
    };
    if (opts.signal) {
      if (opts.signal.aborted) onAbort();
      else {
        opts.signal.addEventListener("abort", onAbort, { once: true });
        removeAbortListener = () => opts.signal?.removeEventListener("abort", onAbort);
      }
    }
  });

  const input: JsonObject[] = [
    { type: "text", text: prompt, textElements: [] },
    ...imagePaths.map((path) => ({ type: "localImage", path })),
  ];
  let turnResult: unknown;
  try {
    turnResult = await client.requestWithOverloadRetry("turn/start", {
      threadId,
      input,
      clientUserMessageId: randomUUID(),
      cwd: opts.cwd,
      approvalPolicy: "never",
      sandboxPolicy: { type: "dangerFullAccess" },
      ...(modelId ? { model: modelId } : {}),
      ...(reasoningEffort ? { effort: reasoningEffort } : {}),
      ...(resolvedServiceTier !== undefined
        ? { serviceTier: resolvedServiceTier }
        : {}),
    });
  } catch (error) {
    cancelCompletion();
    throw new CodexTurnStartError(error);
  }
  turnId = stringField(asObject(turnResult)?.turn, "id") ?? null;
  if (!turnId) {
    cancelCompletion();
    throw new Error("Codex app-server did not return a turn ID.");
  }
  console.info("[codex:latency]", {
    nodeId: opts.nodeId,
    phase: "turn_started",
    elapsedMs: Date.now() - startedAt,
  });
  if (opts.signal?.aborted) {
    await client.request("turn/interrupt", { threadId, turnId });
  }

  await completion;
}

async function handleCodexServerRequest(
  method: string,
  params: JsonObject,
  opts: RunAgentOpts,
  requestSignal: AbortSignal,
): Promise<ServerRequestResolution | undefined> {
  if (method === "item/tool/requestUserInput") {
    const request = params as ToolRequestUserInputParams;
    const questions: AskUserQuestion[] = request.questions.map((question) => ({
      id: question.id,
      header: question.header,
      question: question.question,
      multiSelect: false,
      options: question.options ?? [],
      allowFreeText: question.isOther || question.options === null,
      secret: question.isSecret,
    }));
    const response = await requestAnswer(
      questions,
      opts.webContents,
      opts.nodeId,
      requestSignal,
      request.autoResolutionMs ?? undefined,
    );
    const answers: Record<string, { answers: string[] }> = {};
    if (!response.cancelled) {
      for (const question of request.questions) {
        const value = response.answers[question.id];
        answers[question.id] = {
          answers: Array.isArray(value) ? value : value ? [value] : [],
        };
      }
    }
    return { result: { answers } };
  }

  if (method === "item/commandExecution/requestApproval") {
    const request = params as CommandApprovalParams;
    const response = await requestCodexApproval(
      {
        id: "decision",
        header: "Command",
        question: request.reason ?? "Allow Codex to run this command?",
        multiSelect: false,
        options: [
          {
            label: "Allow once",
            description: "Run this command once.",
            preview: [request.command, request.cwd].filter(Boolean).join("\n"),
          },
          {
            label: "Allow session",
            description: "Allow this command for the current Codex session.",
          },
          { label: "Decline", description: "Do not run the command." },
        ],
      },
      opts,
      requestSignal,
    );
    const choice = approvalChoice(response);
    return {
      result: {
        decision:
          choice === "Allow once"
            ? "accept"
            : choice === "Allow session"
              ? "acceptForSession"
              : choice === "Decline"
                ? "decline"
                : "cancel",
      },
    };
  }

  if (method === "item/fileChange/requestApproval") {
    const request = params as FileChangeApprovalParams;
    const response = await requestCodexApproval(
      {
        id: "decision",
        header: "File change",
        question: request.reason ?? "Allow Codex to apply these file changes?",
        multiSelect: false,
        options: [
          {
            label: "Allow once",
            description: "Apply this change once.",
            preview: request.grantRoot ?? undefined,
          },
          {
            label: "Allow session",
            description: "Allow changes for the current Codex session.",
          },
          { label: "Decline", description: "Do not apply the changes." },
        ],
      },
      opts,
      requestSignal,
    );
    const choice = approvalChoice(response);
    return {
      result: {
        decision:
          choice === "Allow once"
            ? "accept"
            : choice === "Allow session"
              ? "acceptForSession"
              : choice === "Decline"
                ? "decline"
                : "cancel",
      },
    };
  }

  if (method === "execCommandApproval" || method === "applyPatchApproval") {
    const response = await requestCodexApproval(
      {
        id: "decision",
        header: "Approval",
        question:
          stringField(params, "reason") ??
          (method === "execCommandApproval"
            ? "Allow Codex to run this command?"
            : "Allow Codex to apply these changes?"),
        multiSelect: false,
        options: [
          { label: "Allow once", description: "Approve this action once." },
          {
            label: "Allow session",
            description: "Approve similar actions for this session.",
          },
          { label: "Decline", description: "Do not perform this action." },
        ],
      },
      opts,
      requestSignal,
    );
    const choice = approvalChoice(response);
    return {
      result: {
        decision:
          choice === "Allow once"
            ? "approved"
            : choice === "Allow session"
              ? "approved_for_session"
              : choice === "Decline"
                ? { denied: { rejection: "Declined by the user." } }
                : "abort",
      },
    };
  }

  if (method === "item/permissions/requestApproval") {
    return { result: { permissions: {}, scope: "turn" } };
  }

  if (method === "mcpServer/elicitation/request") {
    const request = params as McpServerElicitationParams;
    const message = request.message ?? "An MCP server needs input.";
    if (request.mode === "url") {
      const url = request.url;
      const response = await requestCodexApproval(
        {
          id: "decision",
          header: "MCP",
          question: message,
          multiSelect: false,
          options: [
            {
              label: "Open link",
              description: "Open the MCP authorization page.",
              preview: url,
            },
            { label: "Cancel", description: "Cancel this MCP request." },
          ],
        },
        opts,
        requestSignal,
      );
      if (!response.cancelled && response.answers.decision === "Open link" && url) {
        await electronShell.openExternal(url);
        return { result: { action: "accept", content: null, _meta: null } };
      }
      return { result: { action: "cancel", content: null, _meta: null } };
    }

    const formFields = buildMcpFormFields(request.requestedSchema);
    if (formFields.length > 0) {
      const response = await requestAnswer(
        formFields.map((field) => field.question),
        opts.webContents,
        opts.nodeId,
        requestSignal,
      );
      if (response.cancelled) {
        return { result: { action: "cancel", content: null, _meta: null } };
      }
      try {
        const content = Object.fromEntries(
          formFields.flatMap((field) => {
            const raw = response.answers[field.key];
            if ((raw === "" || raw === undefined) && field.question.required === false) {
              return [];
            }
            return [[field.key, parseMcpFormValue(raw, field.schema)]];
          }),
        );
        return { result: { action: "accept", content, _meta: null } };
      } catch {
        return { result: { action: "decline", content: null, _meta: null } };
      }
    }

    const response = await requestCodexApproval(
      {
        id: "content",
        header: "MCP",
        question: `${message} Enter the requested value as JSON.`,
        multiSelect: false,
        options: [],
        allowFreeText: true,
      },
      opts,
      requestSignal,
    );
    if (response.cancelled) {
      return { result: { action: "cancel", content: null, _meta: null } };
    }
    const raw = response.answers.content;
    try {
      const content = JSON.parse(Array.isArray(raw) ? raw.join("\n") : raw ?? "null");
      return { result: { action: "accept", content, _meta: null } };
    } catch {
      return { result: { action: "decline", content: null, _meta: null } };
    }
  }

  return undefined;
}

type McpFormField = {
  key: string;
  schema: McpElicitationPropertySchema;
  question: AskUserQuestion;
};

function buildMcpFormFields(schemaValue: unknown): McpFormField[] {
  const schema = asObject(schemaValue);
  const properties = asObject(schema?.properties);
  if (!properties) return [];
  const required = new Set(
    Array.isArray(schema?.required)
      ? schema.required.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  );
  return Object.entries(properties).flatMap(([key, value]) => {
    const property = asObject(value) as McpElicitationPropertySchema | null;
    if (!property) return [];
    const type = stringField(property, "type");
    const options = mcpFormOptions(property);
    const isMulti = type === "array";
    const title = stringField(property, "title") ?? key;
    const description = stringField(property, "description");
    return [
      {
        key,
        schema: property,
        question: {
          id: key,
          header: title.slice(0, 24),
          question: description ?? `Enter ${title}.`,
          multiSelect: isMulti,
          options,
          allowFreeText: options.length === 0,
          secret: /password|secret|token|api.?key/i.test(`${key} ${title}`),
          required: required.has(key),
        },
      },
    ];
  });
}

function mcpFormOptions(
  schema: McpElicitationPropertySchema,
): AskUserQuestion["options"] {
  if (schema.type === "boolean") {
    return [
      { label: "Yes", value: "true", description: "Use true." },
      { label: "No", value: "false", description: "Use false." },
    ];
  }
  const directValues = Array.isArray(schema.enum)
    ? schema.enum.filter((value): value is string => typeof value === "string")
    : [];
  if (directValues.length > 0) {
    return directValues.map((value, index) => ({
      label: schema.enumNames?.[index] ?? value,
      value,
      description: `Use ${value}.`,
    }));
  }
  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.flatMap((option) =>
      typeof option?.const === "string"
        ? [
            {
              label: option.title ?? option.const,
              value: option.const,
              description: `Use ${option.const}.`,
            },
          ]
        : [],
    );
  }
  const items = asObject(schema.items);
  const itemValues = Array.isArray(items?.enum)
    ? items.enum.filter((value): value is string => typeof value === "string")
    : [];
  if (itemValues.length > 0) {
    return itemValues.map((value) => ({
      label: value,
      value,
      description: `Include ${value}.`,
    }));
  }
  const itemOptions = Array.isArray(items?.anyOf)
    ? items.anyOf
    : Array.isArray(items?.oneOf)
      ? items.oneOf
      : [];
  return itemOptions.flatMap((value) => {
    const option = asObject(value);
    const optionValue = stringField(option, "const");
    if (!optionValue) return [];
    return [
      {
        label: stringField(option, "title") ?? optionValue,
        value: optionValue,
        description: `Include ${optionValue}.`,
      },
    ];
  });
}

function parseMcpFormValue(
  raw: string | string[] | undefined,
  schema: McpElicitationPropertySchema,
): unknown {
  if (schema.type === "array") return Array.isArray(raw) ? raw : raw ? [raw] : [];
  const value = Array.isArray(raw) ? raw[0] : raw ?? "";
  if (schema.type === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error("Invalid boolean MCP form value.");
  }
  if (schema.type === "number" || schema.type === "integer") {
    const number = Number(value);
    if (
      !Number.isFinite(number) ||
      (schema.type === "integer" && !Number.isInteger(number))
    ) {
      throw new Error("Invalid numeric MCP form value.");
    }
    return number;
  }
  return value;
}

function requestCodexApproval(
  question: AskUserQuestion,
  opts: RunAgentOpts,
  signal: AbortSignal,
): Promise<AskUserResponsePayload> {
  return requestAnswer(
    [question],
    opts.webContents,
    opts.nodeId,
    signal,
  );
}

function approvalChoice(response: AskUserResponsePayload): string | undefined {
  if (response.cancelled) return undefined;
  const value = response.answers.decision;
  return Array.isArray(value) ? value[0] : value;
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
  planDeltaItems: Set<string>,
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
  if (type === "plan" && !planDeltaItems.has(id)) {
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
  if (type === "fileChange") {
    const changes = Array.isArray(item.changes) ? item.changes : [];
    emit({
      kind: "tool_result",
      toolUseId: id,
      content:
        changes.length > 0
          ? JSON.stringify(changes, null, 2)
          : stringField(item, "status") ?? "File change completed.",
      isError:
        stringField(item, "status") === "failed" ||
        stringField(item, "status") === "declined",
    });
    return;
  }
  if (type === "webSearch") {
    emit({
      kind: "tool_result",
      toolUseId: id,
      content: JSON.stringify(item, null, 2),
      isError: stringField(item, "status") === "failed",
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
