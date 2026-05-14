import { randomUUID } from "node:crypto";
import type { BrowserWindow } from "electron";
import type {
  AskUserQuestion,
  AskUserResponsePayload,
} from "@shared/ipc";

type Pending = {
  resolve: (response: AskUserResponsePayload) => void;
  reject: (err: unknown) => void;
  signal?: AbortSignal;
  abortHandler?: () => void;
};

let win: BrowserWindow | null = null;
const pending = new Map<string, Pending>();

export function setMainWindow(w: BrowserWindow | null): void {
  win = w;
}

/**
 * Send an ask-user request to the renderer and wait for the user's answers.
 *
 * Resolves with the renderer's response. If `signal` aborts before the user
 * responds, rejects with an `AbortError`-style error.
 */
export function requestAnswer(
  questions: AskUserQuestion[],
  signal?: AbortSignal,
): Promise<AskUserResponsePayload> {
  if (!win) {
    return Promise.reject(new Error("Main window is not initialized"));
  }
  if (signal?.aborted) {
    return Promise.reject(new Error("Aborted"));
  }

  const id = randomUUID();
  return new Promise<AskUserResponsePayload>((resolve, reject) => {
    const entry: Pending = { resolve, reject, signal };

    if (signal) {
      const onAbort = () => {
        pending.delete(id);
        reject(new Error("Aborted"));
      };
      entry.abortHandler = onAbort;
      signal.addEventListener("abort", onAbort, { once: true });
    }

    pending.set(id, entry);
    win!.webContents.send("askUser:request", { id, questions });
  });
}

export function completeRequest(payload: AskUserResponsePayload): void {
  const entry = pending.get(payload.id);
  if (!entry) return;
  pending.delete(payload.id);
  if (entry.signal && entry.abortHandler) {
    entry.signal.removeEventListener("abort", entry.abortHandler);
  }
  entry.resolve(payload);
}

/** Reject all in-flight requests. Used when the chat is cancelled. */
export function cancelAll(): void {
  for (const [id, entry] of pending) {
    pending.delete(id);
    if (entry.signal && entry.abortHandler) {
      entry.signal.removeEventListener("abort", entry.abortHandler);
    }
    entry.resolve({ id, cancelled: true });
  }
}
