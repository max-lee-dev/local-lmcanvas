import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { shellEnv } from "../shellPath";

type JsonObject = Record<string, unknown>;
type NotificationHandler = (method: string, params: JsonObject) => void;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

const clients = new Map<string, Promise<CodexAppServerClient>>();

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object"
    ? (value as JsonObject)
    : null;
}

function errorFromResponse(message: JsonObject): Error {
  const error = asObject(message.error);
  const detail = typeof error?.message === "string" ? error.message : "unknown error";
  return new Error(`Codex app-server request failed: ${detail}`);
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

export async function shutdownCodexAppServers(): Promise<void> {
  const pending = [...clients.values()];
  clients.clear();
  const resolved = await Promise.allSettled(pending);
  for (const result of resolved) {
    if (result.status === "fulfilled") result.value.shutdown();
  }
}
