import { spawn } from "node:child_process";
import type { Provider } from "@shared/types";
import type { ProviderAuthStatus } from "@shared/ipc";
import { shellEnv } from "../shellPath";

const DEFAULT_BIN: Record<Provider, string> = {
  claude: "claude",
  codex: "codex",
  cursor: "cursor-agent",
};

const PROBE_TIMEOUT_MS = 5_000;

type ProbeResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  enoent: boolean;
  spawnError?: string;
};

async function probe(bin: string, args: string[]): Promise<ProbeResult> {
  const env = await shellEnv();
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], env });
    } catch (err) {
      resolve({
        code: null,
        stdout: "",
        stderr: "",
        enoent: false,
        spawnError: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill("SIGTERM");
      resolve({ code: null, stdout, stderr, enoent: false });
    }, PROBE_TIMEOUT_MS);

    proc.stdout?.setEncoding("utf8");
    proc.stderr?.setEncoding("utf8");
    proc.stdout?.on("data", (c: string) => {
      stdout += c;
    });
    proc.stderr?.on("data", (c: string) => {
      stderr += c;
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code: null,
        stdout,
        stderr,
        enoent: err.code === "ENOENT",
        spawnError: err.message,
      });
    });

    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, enoent: false });
    });
  });
}

export async function getProviderAuthStatus(
  provider: Provider,
  binPath?: string
): Promise<ProviderAuthStatus> {
  const bin = binPath || DEFAULT_BIN[provider];
  const resolved = binPath ?? null;

  switch (provider) {
    case "claude":
      return probeClaude(bin, resolved);
    case "codex":
      return probeCodex(bin, resolved);
    case "cursor":
      return probeCursor(bin, resolved);
  }
}

async function probeClaude(bin: string, binPath: string | null): Promise<ProviderAuthStatus> {
  const r = await probe(bin, ["--version"]);
  if (r.enoent) {
    return {
      provider: "claude",
      installed: false,
      authenticated: false,
      binPath,
      detail: r.spawnError ?? "claude binary not found",
    };
  }
  const installed = r.code === 0;
  const detail = (r.stdout || r.stderr || "").trim();
  return {
    provider: "claude",
    installed,
    // claude-agent-sdk handles its own auth; presence of the binary is enough
    authenticated: installed,
    binPath,
    detail: detail || undefined,
  };
}

async function probeCodex(bin: string, binPath: string | null): Promise<ProviderAuthStatus> {
  const r = await probe(bin, ["login", "status"]);
  if (r.enoent) {
    return {
      provider: "codex",
      installed: false,
      authenticated: false,
      binPath,
      detail: r.spawnError ?? "codex binary not found",
    };
  }
  const combined = `${r.stdout}\n${r.stderr}`.trim();
  const lower = combined.toLowerCase();
  let authenticated = false;
  if (lower.includes("not logged") || lower.includes("not signed")) {
    authenticated = false;
  } else if (
    lower.includes("logged in") ||
    lower.includes("chatgpt") ||
    /[\w.+-]+@[\w-]+\.[\w.-]+/.test(combined)
  ) {
    authenticated = true;
  }
  return {
    provider: "codex",
    installed: true,
    authenticated,
    binPath,
    detail: combined || undefined,
  };
}

async function probeCursor(bin: string, binPath: string | null): Promise<ProviderAuthStatus> {
  const r = await probe(bin, ["status"]);
  if (r.enoent) {
    return {
      provider: "cursor",
      installed: false,
      authenticated: false,
      binPath,
      detail: r.spawnError ?? "cursor-agent binary not found",
    };
  }
  const combined = `${r.stdout}\n${r.stderr}`.trim();
  const lower = combined.toLowerCase();
  let authenticated = false;
  if (lower.includes("not logged in")) {
    authenticated = false;
  } else if (lower.includes("logged in")) {
    authenticated = true;
  }
  return {
    provider: "cursor",
    installed: true,
    authenticated,
    binPath,
    detail: combined || undefined,
  };
}

export async function openLoginTerminal(
  provider: Provider,
  binPath?: string
): Promise<void> {
  if (process.platform !== "darwin") {
    console.warn(
      `[lmcanvas] openLoginTerminal: unsupported platform ${process.platform}`
    );
    throw new Error(`openLoginTerminal is only supported on macOS for MVP.`);
  }
  const bin = binPath || DEFAULT_BIN[provider];
  // escape double quotes for the embedded AppleScript string
  const cmd = `${bin} login`.replace(/"/g, '\\"');
  const script = `tell application "Terminal" to do script "${cmd}"`;
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("osascript", ["-e", script], { stdio: "ignore" });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`osascript exited with code ${code}`));
    });
  });
}
