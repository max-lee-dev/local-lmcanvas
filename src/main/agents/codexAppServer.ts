import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { app } from "electron";
import type {
  CodexModelInfo,
  CodexRuntimeInfo,
  ReasoningEffort,
} from "@shared/types";
import { REASONING_EFFORTS } from "@shared/types";
import { shellEnv } from "../shellPath";
import {
  isJsonObject,
  isJsonRpcId,
  type CodexClientRequestMap,
  type JsonObject,
  type JsonRpcId,
} from "./codexProtocol";

type NotificationHandler = (method: string, params: JsonObject) => void;
export type ServerRequestResolution = { result: unknown };
type ServerRequestHandler = (
  method: string,
  params: JsonObject,
) => Promise<ServerRequestResolution | undefined> | ServerRequestResolution | undefined;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const clients = new Map<string, Promise<CodexAppServerClient>>();
const liveClients = new Set<CodexAppServerClient>();
const MAX_SUBSCRIBED_THREADS = 24;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

function asObject(value: unknown): JsonObject | null {
  return isJsonObject(value) ? value : null;
}

class CodexRpcError extends Error {
  constructor(
    message: string,
    readonly code: number | undefined,
    readonly data: unknown,
  ) {
    super(message);
    this.name = "CodexRpcError";
  }
}

function errorFromResponse(message: JsonObject): Error {
  const error = asObject(message.error);
  const detail = typeof error?.message === "string" ? error.message : "unknown error";
  const code = typeof error?.code === "number" ? error.code : undefined;
  return new CodexRpcError(
    `Codex app-server request failed: ${detail}`,
    code,
    error?.data,
  );
}

function containsServerOverload(value: unknown): boolean {
  if (typeof value === "string") {
    return value.toLowerCase() === "server_overloaded";
  }
  if (Array.isArray(value)) return value.some(containsServerOverload);
  const object = asObject(value);
  return object ? Object.values(object).some(containsServerOverload) : false;
}

function isRetryableOverload(error: unknown): boolean {
  if (!(error instanceof CodexRpcError)) return false;
  return (
    containsServerOverload(error.data) ||
    /retry limit|too many failed attempts/i.test(error.message)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringField(value: unknown, key: string): string | undefined {
  const object = asObject(value);
  return typeof object?.[key] === "string" ? object[key] : undefined;
}

function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return (
    typeof value === "string" &&
    (REASONING_EFFORTS as readonly string[]).includes(value)
  );
}

function parseModel(value: unknown): CodexModelInfo | null {
  const model = asObject(value);
  const id = stringField(model, "id") ?? stringField(model, "model");
  const defaultReasoningEffort = model?.defaultReasoningEffort;
  if (!id || !isReasoningEffort(defaultReasoningEffort)) return null;

  const supportedReasoningEfforts = Array.isArray(model?.supportedReasoningEfforts)
    ? model.supportedReasoningEfforts
        .map((option) => stringField(option, "reasoningEffort"))
        .filter(isReasoningEffort)
    : [];
  const serviceTiers = Array.isArray(model?.serviceTiers)
    ? model.serviceTiers.flatMap((value) => {
        const tier = asObject(value);
        const tierId = stringField(tier, "id");
        if (!tierId) return [];
        return [
          {
            id: tierId,
            name: stringField(tier, "name") ?? tierId,
            description: stringField(tier, "description") ?? "",
          },
        ];
      })
    : [];

  return {
    id,
    displayName: stringField(model, "displayName") ?? id,
    description: stringField(model, "description") ?? "",
    isDefault: model?.isDefault === true,
    supportedReasoningEfforts:
      supportedReasoningEfforts.length > 0
        ? supportedReasoningEfforts
        : [defaultReasoningEffort],
    defaultReasoningEffort,
    serviceTiers,
    ...(typeof model?.defaultServiceTier === "string"
      ? { defaultServiceTier: model.defaultServiceTier }
      : {}),
  };
}

export class CodexAppServerClient {
  static async connect(bin: string): Promise<CodexAppServerClient> {
    const existing = clients.get(bin);
    if (existing) return existing;
    const pending = CodexAppServerClient.start(bin).catch((error) => {
      clients.delete(bin);
      throw error;
    });
    clients.set(bin, pending);
    return pending;
  }

  private static async start(bin: string): Promise<CodexAppServerClient> {
    const env = await shellEnv();
    const proc = spawn(bin, ["app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });
    const client = new CodexAppServerClient(bin, proc);
    liveClients.add(client);
    try {
      await client.initialize();
    } catch (error) {
      client.shutdown();
      throw error;
    }
    return client;
  }

  private nextId = 1;
  private readonly pending = new Map<JsonRpcId, PendingRequest>();
  private readonly handlers = new Set<NotificationHandler>();
  private readonly serverRequestHandlers = new Set<ServerRequestHandler>();
  private readonly loadedThreads = new Set<string>();
  private readonly threadLastUsedAt = new Map<string, number>();
  private readonly activeThreads = new Set<string>();
  private readonly threadQueues = new Map<string, Promise<void>>();
  private runtimeInfoPromise: Promise<CodexRuntimeInfo> | null = null;
  private stderrTail = "";
  private closed = false;

  private constructor(
    private readonly bin: string,
    private readonly proc: ChildProcessWithoutNullStreams,
  ) {
    const lines = createInterface({ input: proc.stdout });
    lines.on("line", (line) => this.handleLine(line));
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-16_000);
    });
    proc.on("error", (error) => this.fail(error));
    proc.on("close", (code) => {
      const suffix = this.stderrTail.trim() ? `\n${this.stderrTail.trim()}` : "";
      this.fail(new Error(`Codex app-server exited with code ${code ?? "unknown"}${suffix}`));
    });
    proc.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE") this.fail(error);
    });
  }

  private async initialize(): Promise<void> {
    const response = await this.request("initialize", {
      clientInfo: {
        name: "local_lmcanvas",
        title: "LMCanvas",
        version: app.getVersion(),
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
      },
    });
    this.userAgent = response.userAgent;
    this.notify("initialized");
  }

  private userAgent: string | undefined;

  request<M extends keyof CodexClientRequestMap>(
    method: M,
    params: CodexClientRequestMap[M]["params"],
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<CodexClientRequestMap[M]["result"]> {
    if (this.closed) {
      return Promise.reject(new Error(`Codex app-server is not running (${this.bin}).`));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Codex app-server request timed out after ${timeoutMs}ms (${String(method)}).`,
          ),
        );
      }, timeoutMs);
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      this.write({ method, id, params });
    });
  }

  async requestWithOverloadRetry<M extends keyof CodexClientRequestMap>(
    method: M,
    params: CodexClientRequestMap[M]["params"],
    maxAttempts = 3,
  ): Promise<CodexClientRequestMap[M]["result"]> {
    let delayMs = 250;
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.request(method, params);
      } catch (error) {
        if (attempt >= maxAttempts || !isRetryableOverload(error)) throw error;
        const jitter = delayMs * 0.2 * (Math.random() * 2 - 1);
        const waitMs = Math.max(0, Math.round(delayMs + jitter));
        console.warn("[codex] server overloaded; retrying", {
          method,
          attempt: attempt + 1,
          waitMs,
        });
        await sleep(waitMs);
        delayMs = Math.min(2_000, delayMs * 2);
      }
    }
  }

  isThreadLoaded(threadId: string): boolean {
    return this.loadedThreads.has(threadId);
  }

  markThreadUnloaded(threadId: string): void {
    this.loadedThreads.delete(threadId);
    this.threadLastUsedAt.delete(threadId);
  }

  markThreadLoaded(threadId: string): void {
    this.loadedThreads.add(threadId);
    this.threadLastUsedAt.set(threadId, Date.now());
  }

  async runThreadExclusive<T>(threadId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.threadQueues.get(threadId) ?? Promise.resolve();
    let release = (): void => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.threadQueues.set(threadId, queued);
    await previous;
    this.activeThreads.add(threadId);
    this.threadLastUsedAt.set(threadId, Date.now());
    try {
      return await task();
    } finally {
      this.activeThreads.delete(threadId);
      this.threadLastUsedAt.set(threadId, Date.now());
      release();
      if (this.threadQueues.get(threadId) === queued) {
        this.threadQueues.delete(threadId);
      }
      this.pruneThreadSubscriptions();
    }
  }

  private pruneThreadSubscriptions(): void {
    const excess = this.loadedThreads.size - MAX_SUBSCRIBED_THREADS;
    if (excess <= 0) return;
    const candidates = [...this.loadedThreads]
      .filter((threadId) => !this.activeThreads.has(threadId))
      .sort(
        (a, b) =>
          (this.threadLastUsedAt.get(a) ?? 0) -
          (this.threadLastUsedAt.get(b) ?? 0),
      )
      .slice(0, excess);
    for (const threadId of candidates) {
      this.loadedThreads.delete(threadId);
      this.threadLastUsedAt.delete(threadId);
      void this.request("thread/unsubscribe", { threadId }).catch((error) =>
        console.warn("[codex] thread unsubscribe failed:", error),
      );
    }
  }

  getRuntimeInfo(): Promise<CodexRuntimeInfo> {
    if (this.runtimeInfoPromise) return this.runtimeInfoPromise;
    this.runtimeInfoPromise = this.loadRuntimeInfo().catch((error) => {
      this.runtimeInfoPromise = null;
      throw error;
    });
    return this.runtimeInfoPromise;
  }

  private async loadRuntimeInfo(): Promise<CodexRuntimeInfo> {
    const models: CodexModelInfo[] = [];
    let cursor: string | undefined;
    do {
      const response = asObject(
        await this.requestWithOverloadRetry("model/list", {
          limit: 100,
          ...(cursor ? { cursor } : {}),
        }),
      );
      if (Array.isArray(response?.data)) {
        for (const raw of response.data) {
          const model = parseModel(raw);
          if (model) models.push(model);
        }
      }
      cursor = stringField(response, "nextCursor");
    } while (cursor);
    return {
      models,
      defaultModelId: models.find((model) => model.isDefault)?.id,
      ...(this.userAgent ? { codexUserAgent: this.userAgent } : {}),
      protocolVersion: 2,
    };
  }

  notify(method: string, params?: JsonObject): void {
    this.write(params ? { method, params } : { method });
  }

  onNotification(handler: NotificationHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onServerRequest(handler: ServerRequestHandler): () => void {
    this.serverRequestHandlers.add(handler);
    return () => this.serverRequestHandlers.delete(handler);
  }

  shutdown(): void {
    if (this.closed) return;
    this.closed = true;
    clients.delete(this.bin);
    liveClients.delete(this);
    const error = new Error(`Codex app-server was shut down (${this.bin}).`);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.proc.kill("SIGTERM");
  }

  private write(message: JsonObject): void {
    this.proc.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }
    const message = asObject(parsed);
    if (!message) return;

    if (typeof message.method === "string" && isJsonRpcId(message.id)) {
      void this.handleServerRequest(message.id, message.method, asObject(message.params) ?? {});
      return;
    }

    if (isJsonRpcId(message.id)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error !== undefined) pending.reject(errorFromResponse(message));
      else pending.resolve(message.result);
      return;
    }

    if (typeof message.method !== "string") return;
    const params = asObject(message.params) ?? {};
    if (message.method === "thread/closed") {
      const threadId = stringField(params, "threadId");
      if (threadId) {
        this.loadedThreads.delete(threadId);
        this.threadLastUsedAt.delete(threadId);
      }
    }
    for (const handler of this.handlers) handler(message.method, params);
  }

  private async handleServerRequest(
    id: JsonRpcId,
    method: string,
    params: JsonObject,
  ): Promise<void> {
    if (method === "currentTime/read") {
      this.write({ id, result: { currentTimeAt: Math.floor(Date.now() / 1000) } });
      return;
    }
    try {
      for (const handler of this.serverRequestHandlers) {
        const resolution = await handler(method, params);
        if (!resolution) continue;
        this.write({ id, result: resolution.result });
        return;
      }
      this.write({
        id,
        error: {
          code: -32601,
          message: `LMCanvas does not support Codex server request: ${method}`,
        },
      });
    } catch (error) {
      this.write({
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private fail(error: Error): void {
    if (this.closed) return;
    this.closed = true;
    clients.delete(this.bin);
    liveClients.delete(this);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    for (const handler of this.handlers) {
      handler("transport/error", { message: error.message });
    }
    this.handlers.clear();
    this.serverRequestHandlers.clear();
  }
}

export function isThreadUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /thread .*(?:not found|not loaded|closed)|no rollout found/i.test(message);
}

export async function getCodexRuntimeInfo(bin: string): Promise<CodexRuntimeInfo> {
  const client = await CodexAppServerClient.connect(bin);
  return client.getRuntimeInfo();
}

export async function prewarmCodexAppServer(bin: string): Promise<void> {
  const startedAt = Date.now();
  const info = await getCodexRuntimeInfo(bin);
  console.info("[codex:latency]", {
    phase: "prewarm_complete",
    elapsedMs: Date.now() - startedAt,
    modelCount: info.models.length,
  });
}

export function shutdownCodexAppServers(): void {
  clients.clear();
  for (const client of [...liveClients]) client.shutdown();
}
