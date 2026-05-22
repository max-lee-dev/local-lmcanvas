import { spawn } from "node:child_process";
import { appendFileSync, closeSync, mkdirSync, openSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import { shellEnv } from "./shellPath";
import type {
  PersistentProcessStartArgs,
  PersistentProcessStartResult,
  PersistentProcessStopResult,
} from "@shared/ipc";

type ProcessEntry = {
  id: string;
  pid: number;
  command: string;
  logPath: string;
};

const processes = new Map<string, ProcessEntry>();

export async function startPersistentProcess(
  args: PersistentProcessStartArgs
): Promise<PersistentProcessStartResult> {
  const command = args.command.trim();
  if (!command) throw new Error("Command is required.");

  const cwd = args.cwd && args.cwd.trim() ? args.cwd : homedir();
  const dir = join(app.getPath("userData"), "persistent-processes");
  mkdirSync(dir, { recursive: true });

  const id = `proc-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const logPath = join(dir, `${id}.log`);
  appendFileSync(
    logPath,
    [
      `$ ${command}`,
      `# cwd: ${cwd}`,
      `# started: ${new Date().toISOString()}`,
      "",
      "",
    ].join("\n"),
  );

  const fd = openSync(logPath, "a");
  try {
    const child = spawn(command, {
      cwd,
      shell: true,
      detached: true,
      stdio: ["ignore", fd, fd],
      env: await shellEnv(),
      windowsHide: true,
    });
    if (typeof child.pid !== "number") {
      throw new Error("Failed to start process.");
    }

    child.unref();
    const entry: ProcessEntry = { id, pid: child.pid, command, logPath };
    processes.set(id, entry);
    child.once("exit", (code, signal) => {
      processes.delete(id);
      appendFileSync(
        logPath,
        `\n# exited: ${new Date().toISOString()} code=${code ?? ""} signal=${signal ?? ""}\n`,
      );
    });
    child.once("error", (err) => {
      processes.delete(id);
      appendFileSync(logPath, `\n# failed: ${err.message}\n`);
    });
    return { id, pid: entry.pid, logPath };
  } finally {
    closeSync(fd);
  }
}

export function stopPersistentProcess(id: string): PersistentProcessStopResult {
  const entry = processes.get(id);
  if (!entry) {
    return { stopped: false, message: "Process is no longer tracked." };
  }

  try {
    if (process.platform === "win32") {
      process.kill(entry.pid, "SIGTERM");
    } else {
      process.kill(-entry.pid, "SIGTERM");
    }
    processes.delete(id);
    appendFileSync(
      entry.logPath,
      `\n# stopped by LMCanvas: ${new Date().toISOString()}\n`,
    );
    return { stopped: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { stopped: false, message };
  }
}
