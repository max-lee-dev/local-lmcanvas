import { forwardRef, useMemo } from "react";

// Mirror layer rendered behind the prompt textarea. Highlights `@<path>` tokens
// with a chip-style background so users can visually distinguish file/folder
// mentions from regular text while still using a plain textarea for input.
//
// Alignment requirements (the chips break if any of these drift):
// - Identical font-family, font-size, line-height, letter-spacing
// - Identical white-space / word-wrap behavior
// - Identical box dimensions and padding
// - Trailing newline appended so the final empty line doesn't get clipped
//
// File mentions (no trailing slash) get one tint; folder mentions (trailing
// slash) get a subtly stronger tint so they're distinguishable at a glance.

type Props = {
  value: string;
  scrollTop: number;
};

const MENTION_RE = /(^|\s)(@[^\s]+)/g;

type Segment =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; isDir: boolean };

function tokenize(value: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  MENTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(value)) !== null) {
    const leading = m[1] ?? "";
    const mention = m[2] ?? "";
    const start = m.index + leading.length;
    if (start > last) out.push({ kind: "text", text: value.slice(last, start) });
    const isDir = mention.endsWith("/");
    out.push({ kind: "mention", text: mention, isDir });
    last = start + mention.length;
  }
  if (last < value.length) out.push({ kind: "text", text: value.slice(last) });
  return out;
}

export const MentionHighlight = forwardRef<HTMLDivElement, Props>(
  function MentionHighlight({ value, scrollTop }, ref) {
    const segments = useMemo(() => tokenize(value), [value]);
    return (
      <div
        ref={ref}
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden text-[10px] font-normal"
        style={{
          color: "transparent",
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
          overflowWrap: "break-word",
        }}
      >
        <div style={{ transform: `translateY(${-scrollTop}px)` }}>
          {segments.map((seg, i) =>
            seg.kind === "text" ? (
              <span key={i}>{seg.text}</span>
            ) : (
              <span
                key={i}
                className="rounded-[3px] px-[2px] -mx-[2px]"
                style={{
                  color: "var(--foreground)",
                  backgroundColor: seg.isDir
                    ? "color-mix(in srgb, var(--foreground) 14%, transparent)"
                    : "color-mix(in srgb, var(--foreground) 8%, transparent)",
                  boxShadow: seg.isDir
                    ? "inset 0 0 0 1px color-mix(in srgb, var(--foreground) 18%, transparent)"
                    : "inset 0 0 0 1px color-mix(in srgb, var(--foreground) 10%, transparent)",
                }}
              >
                {seg.text}
              </span>
            )
          )}
          {/* Trailing newline so the final line's height is preserved */}
          {"\n"}
        </div>
      </div>
    );
  }
);
