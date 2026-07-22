#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const binIndex = args.indexOf("--bin");
const bin = binIndex >= 0 ? args[binIndex + 1] : (process.env.CODEX_BIN ?? "codex");
const timeoutMs = 30_000;
const startedAt = performance.now();
const child = spawn(bin, ["app-server", "--stdio"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: process.env,
});
const pending = new Map();
let nextId = 1;
let stderr = "";

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr = (stderr + chunk).slice(-16_000);
});
child.stdin.on("error", (error) => failPending(error));

const lines = createInterface({ input: child.stdout });
lines.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.method && (typeof message.id === "number" || typeof message.id === "string")) {
    const result = message.method === "currentTime/read"
      ? { currentTimeAt: Math.floor(Date.now() / 1000) }
      : undefined;
    write(result === undefined
      ? { id: message.id, error: { code: -32601, message: `Unsupported smoke request: ${message.method}` } }
      : { id: message.id, result });
    return;
  }
  if (typeof message.id !== "number" && typeof message.id !== "string") return;
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timer);
  if (message.error) request.reject(new Error(message.error.message ?? JSON.stringify(message.error)));
  else request.resolve(message.result);
});

child.on("error", (error) => failPending(error));
child.on("close", (code) => {
  if (pending.size === 0) return;
  failPending(new Error(`Codex app-server exited with code ${code ?? "unknown"}. ${stderr.trim()}`));
});

function write(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    write({ method, id, params });
  });
}

function failPending(error) {
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(error);
  }
  pending.clear();
}

try {
  const initializeStartedAt = performance.now();
  const initialized = await request("initialize", {
    clientInfo: { name: "lmcanvas_harness_smoke", title: "LMCanvas harness smoke", version: "1" },
    capabilities: { experimentalApi: true, requestAttestation: false },
  });
  write({ method: "initialized" });
  const initializedAt = performance.now();
  const catalog = await request("model/list", { limit: 100 });
  const catalogAt = performance.now();
  const thread = await request("thread/start", {
    cwd: process.cwd(),
    approvalPolicy: "never",
    sandbox: "danger-full-access",
    ephemeral: true,
  });
  const threadAt = performance.now();
  if (!thread?.thread?.id) throw new Error("thread/start returned no thread id.");
  await request("thread/unsubscribe", { threadId: thread.thread.id });
  console.log(JSON.stringify({
    ok: true,
    bin,
    userAgent: initialized?.userAgent ?? null,
    modelCount: Array.isArray(catalog?.data) ? catalog.data.length : 0,
    timingsMs: {
      processAndInitialize: Math.round(initializedAt - initializeStartedAt),
      modelCatalog: Math.round(catalogAt - initializedAt),
      ephemeralThreadStart: Math.round(threadAt - catalogAt),
      total: Math.round(performance.now() - startedAt),
    },
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (stderr.trim()) console.error(stderr.trim());
  process.exitCode = 1;
} finally {
  lines.close();
  child.kill("SIGTERM");
}
