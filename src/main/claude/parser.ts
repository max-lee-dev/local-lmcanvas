type UnknownEvent = Record<string, unknown>;

function pickString(o: unknown, key: string): string | undefined {
  if (typeof o !== "object" || o === null) return undefined;
  const v = (o as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

function pickObject(o: unknown, key: string): UnknownEvent | undefined {
  if (typeof o !== "object" || o === null) return undefined;
  const v = (o as Record<string, unknown>)[key];
  return typeof v === "object" && v !== null ? (v as UnknownEvent) : undefined;
}

function pickArray(o: unknown, key: string): unknown[] | undefined {
  if (typeof o !== "object" || o === null) return undefined;
  const v = (o as Record<string, unknown>)[key];
  return Array.isArray(v) ? v : undefined;
}

/**
 * Extract the *full* text of an assistant message event.
 * Claude Code `stream-json` mostly emits completed assistant blocks; we track
 * per-message-id to deduplicate when partial deltas also arrive.
 */
export function extractAssistantText(ev: unknown): { messageId?: string; text: string } | null {
  const type = pickString(ev, "type");
  if (!type) return null;

  if (type === "assistant") {
    const message = pickObject(ev, "message");
    if (!message) return null;
    const messageId = pickString(message, "id");
    const content = pickArray(message, "content");
    if (!content) return null;
    const parts: string[] = [];
    for (const c of content) {
      const ctype = pickString(c, "type");
      const text = pickString(c, "text");
      if (ctype === "text" && text) parts.push(text);
    }
    if (!parts.length) return null;
    return { messageId, text: parts.join("") };
  }

  if (type === "stream_event") {
    const inner = pickObject(ev, "event");
    if (!inner) return null;
    const innerType = pickString(inner, "type");
    if (innerType === "content_block_delta") {
      const delta = pickObject(inner, "delta");
      const text = delta ? pickString(delta, "text") : undefined;
      if (text) return { text };
    }
  }

  return null;
}

export function extractFinalResult(ev: unknown): string | null {
  const type = pickString(ev, "type");
  if (type !== "result") return null;
  return pickString(ev, "result") ?? null;
}

export function extractError(ev: unknown): string | null {
  const type = pickString(ev, "type");
  if (type === "result") {
    const isError = (ev as Record<string, unknown>).is_error;
    if (isError === true) {
      return pickString(ev, "result") ?? "claude returned an error";
    }
  }
  return null;
}
