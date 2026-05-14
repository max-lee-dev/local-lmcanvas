import { randomUUID } from "node:crypto";
import type { WebContents } from "electron";
import type {
  AskUserQuestion,
  AskUserResponsePayload,
} from "@shared/ipc";

type Pending = {
  resolve: (response: AskUserResponsePayload) => void;
  reject: (err: unknown) => void;
  signal?: AbortSignal;
  abortHandler?: () => void;
  webContents: WebContents;
  destroyedHandler?: () => void;
};

const pending = new Map<string, Pending>();

/**
 * Send an ask-user request to a specific renderer (window) and wait for its
 * answers. Routing per webContents keeps multi-window safe. `nodeId` lets the
 * renderer render the prompt inline on the node that initiated the chat.
 */
export function requestAnswer(
  questions: AskUserQuestion[],
  webContents: WebContents,
  nodeId: string,
  signal?: AbortSignal,
): Promise<AskUserResponsePayload> {
  if (webContents.isDestroyed()) {
    return Promise.reject(new Error("Target window is destroyed"));
  }
  if (signal?.aborted) {
    return Promise.reject(new Error("Aborted"));
  }

  const id = randomUUID();
  return new Promise<AskUserResponsePayload>((resolve, reject) => {
    const entry: Pending = { resolve, reject, signal, webContents };

    if (signal) {
      const onAbort = () => {
        cleanup(id);
        reject(new Error("Aborted"));
      };
      entry.abortHandler = onAbort;
      signal.addEventListener("abort", onAbort, { once: true });
    }

    const onDestroyed = () => {
      cleanup(id);
      resolve({ id, cancelled: true });
    };
    entry.destroyedHandler = onDestroyed;
    webContents.once("destroyed", onDestroyed);

    pending.set(id, entry);
    webContents.send("askUser:request", { id, nodeId, questions });
  });
}

function cleanup(id: string): Pending | undefined {
  const entry = pending.get(id);
  if (!entry) return undefined;
  pending.delete(id);
  if (entry.signal && entry.abortHandler) {
    entry.signal.removeEventListener("abort", entry.abortHandler);
  }
  if (entry.destroyedHandler && !entry.webContents.isDestroyed()) {
    entry.webContents.off("destroyed", entry.destroyedHandler);
  }
  return entry;
}

export function completeRequest(payload: AskUserResponsePayload): void {
  const entry = cleanup(payload.id);
  if (!entry) return;
  entry.resolve(payload);
}

/** Cancel all in-flight requests originating from a specific window. */
export function cancelAllForWebContents(webContents: WebContents): void {
  for (const [id, entry] of pending) {
    if (entry.webContents !== webContents) continue;
    cleanup(id);
    entry.resolve({ id, cancelled: true });
  }
}
