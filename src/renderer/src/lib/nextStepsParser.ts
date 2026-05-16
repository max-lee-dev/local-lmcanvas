import type { Suggestion } from "@shared/types";

const TAG_OPEN = "<next-steps>";
const TAG_CLOSE = "</next-steps>";
const MAX_SUGGESTIONS = 3;

/** Parse the body of a `<next-steps>` block — lines of `- label :: prompt`. */
export function parseSuggestionLines(body: string): Suggestion[] {
  const out: Suggestion[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("-")) continue;
    const rest = line.slice(1).trim();
    const sepIdx = rest.indexOf(" :: ");
    if (sepIdx < 0) continue;
    const label = rest.slice(0, sepIdx).trim();
    const prompt = rest.slice(sepIdx + 4).trim();
    if (!label || !prompt) continue;
    out.push({ label, prompt });
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * Longest suffix of `s` that is a prefix of `tag`. Used to decide how many
 * trailing characters we must hold back before flushing — i.e. enough that a
 * tag opener split across two deltas can still be recognized.
 */
function suffixThatIsPrefixOf(s: string, tag: string): number {
  const max = Math.min(s.length, tag.length - 1);
  for (let i = max; i > 0; i--) {
    if (tag.startsWith(s.slice(s.length - i))) return i;
  }
  return 0;
}

export type StreamerCallbacks = {
  onText: (text: string) => void;
  onSuggestions: (suggestions: Suggestion[]) => void;
};

/**
 * Stateful tail-buffer parser for streamed assistant text. Strips any trailing
 * `<next-steps>…</next-steps>` block and emits its parsed items via
 * `onSuggestions`. Everything outside the block is forwarded to `onText` as
 * soon as it is provably outside a tag opener.
 *
 * Failure modes:
 *  - Malformed lines inside the block: silently skipped.
 *  - Unterminated block on stream end (`flush()`): the buffered content is
 *    restored verbatim as text so we never silently swallow output.
 */
export function createNextStepsStreamer(cb: StreamerCallbacks) {
  let pending = "";
  let mode: "text" | "block" = "text";
  let blockBuf = "";

  const ingest = (delta: string): void => {
    if (!delta) return;
    pending += delta;
    for (;;) {
      if (mode === "text") {
        const idx = pending.indexOf(TAG_OPEN);
        if (idx >= 0) {
          const safe = pending.slice(0, idx);
          if (safe) cb.onText(safe);
          pending = pending.slice(idx + TAG_OPEN.length);
          mode = "block";
          continue;
        }
        const hold = suffixThatIsPrefixOf(pending, TAG_OPEN);
        const flushLen = pending.length - hold;
        if (flushLen > 0) {
          cb.onText(pending.slice(0, flushLen));
          pending = pending.slice(flushLen);
        }
        return;
      } else {
        const idx = pending.indexOf(TAG_CLOSE);
        if (idx >= 0) {
          blockBuf += pending.slice(0, idx);
          pending = pending.slice(idx + TAG_CLOSE.length);
          const suggestions = parseSuggestionLines(blockBuf);
          if (suggestions.length > 0) cb.onSuggestions(suggestions);
          blockBuf = "";
          mode = "text";
          continue;
        }
        const hold = suffixThatIsPrefixOf(pending, TAG_CLOSE);
        const absorbLen = pending.length - hold;
        if (absorbLen > 0) {
          blockBuf += pending.slice(0, absorbLen);
          pending = pending.slice(absorbLen);
        }
        return;
      }
    }
  };

  const flush = (): void => {
    if (mode === "text") {
      if (pending) {
        cb.onText(pending);
        pending = "";
      }
      return;
    }
    const restored = TAG_OPEN + blockBuf + pending;
    blockBuf = "";
    pending = "";
    mode = "text";
    if (restored) cb.onText(restored);
  };

  return { ingest, flush };
}
