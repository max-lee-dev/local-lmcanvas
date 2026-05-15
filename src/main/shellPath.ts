import { spawn } from "node:child_process";

let cached: string | null = null;
let pending: Promise<string> | null = null;

const SHELL_TIMEOUT_MS = 3000;
const MARKER_START = "__LMC_PATH_START__";
const MARKER_END = "__LMC_PATH_END__";

export async function getShellPath(): Promise<string> {
  if (cached !== null) return cached;
  if (pending) return pending;
  pending = resolveShellPath().then((p) => {
    cached = p;
    pending = null;
    return p;
  });
  return pending;
}

export async function shellEnv(): Promise<NodeJS.ProcessEnv> {
  return { ...process.env, PATH: await getShellPath() };
}

function resolveShellPath(): Promise<string> {
  return new Promise((resolve) => {
    const shell = process.env.SHELL || "/bin/zsh";
    let out = "";
    let settled = false;
    const proc = spawn(
      shell,
      ["-ilc", `printf '%s%s%s' "${MARKER_START}" "$PATH" "${MARKER_END}"`],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    proc.stdout?.setEncoding("utf8");
    proc.stdout?.on("data", (d: string) => {
      out += d;
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill("SIGTERM");
      resolve(process.env.PATH ?? "");
    }, SHELL_TIMEOUT_MS);
    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    proc.on("close", () => {
      const start = out.indexOf(MARKER_START);
      const end = out.indexOf(MARKER_END);
      if (start === -1 || end === -1 || end <= start) {
        finish(process.env.PATH ?? "");
        return;
      }
      const path = out.slice(start + MARKER_START.length, end).trim();
      finish(path || process.env.PATH || "");
    });
    proc.on("error", () => finish(process.env.PATH ?? ""));
  });
}
