import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type {
  CodexModelInfo,
  CodexRuntimeInfo,
  ReasoningEffort,
} from "@shared/types";
import { REASONING_EFFORTS } from "@shared/types";
import { shellEnv } from "../shellPath";

type JsonObject = Record<string, unknown>;
type NotificationHandler = (method: string, params: JsonObject) => void;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const clients = new Map<string, Promise<CodexAppServerClient>>();
const MAX_SUBSCRIBED_THREADS = 24;

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object"
    ? (value as JsonObject)
    : null;
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
    await client.initialize();
    return client;
  }

  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly handlers = new Set<NotificationHandler>();
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
    await this.request("initialize", {
      clientInfo: {
        name: "local_lmcanvas",
        title: "LMCanvas",
        version: "1.0.0",
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
      },
    });
    this.notify("initialized");
  }

  request(method: string, params: JsonObject): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(new Error(`Codex app-server is not running (${this.bin}).`));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.write({ method, id, params });
    });
  }

  async requestWithOverloadRetry(
    method: string,
    params: JsonObject,
    maxAttempts = 3,
  ): Promise<unknown> {
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
    };
  }

  notify(method: string, params?: JsonObject): void {
    this.write(params ? { method, params } : { method });
  }

  onNotification(handler: NotificationHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  shutdown(): void {
    if (this.closed) return;
    this.closed = true;
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

    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
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

  private fail(error: Error): void {
    if (this.closed) return;
    this.closed = true;
    clients.delete(this.bin);
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    for (const handler of this.handlers) {
      handler("transport/error", { message: error.message });
    }
    this.handlers.clear();
  }
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

export async function shutdownCodexAppServers(): Promise<void> {
  const pending = [...clients.values()];
  clients.clear();
  const resolved = await Promise.allSettled(pending);
  for (const result of resolved) {
    if (result.status === "fulfilled") result.value.shutdown();
  }
}
