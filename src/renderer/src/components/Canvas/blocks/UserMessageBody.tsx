import { Command, File, Folder, Sparkles } from "lucide-react";
import React from "react";

// Display segments for the user's submitted prompt. Distinct from
// MentionEditor's edit-time Segment so the parser only has to consume the
// wire-format text — chips here are render-only.
type DisplaySeg =
  | { kind: "text"; text: string }
  | { kind: "mention"; path: string; isDir: boolean }
  | { kind: "slash"; name: string }
  | { kind: "skill"; name: string };

const SLASH_NAME_RE = /^[\w:-]+/;
// Matches `Use the `name` skill.` exactly as emitted by segmentsToText.
const SKILL_DIRECTIVE_RE = /^Use the `([\w:-]+)` skill\./;

// Walks the text in order, emitting chip segments when a token sits at a
// word boundary (start of string or after whitespace). Anything else falls
// back to text so phrases like "and/or" or "user@host" never get chipped.
export function parseUserMessageText(text: string): DisplaySeg[] {
  const segs: DisplaySeg[] = [];
  let cursor = 0;
  let runStart = 0;

  const flushRun = (end: number): void => {
    if (end > runStart) segs.push({ kind: "text", text: text.slice(runStart, end) });
  };

  while (cursor < text.length) {
    const ch = text[cursor];
    const atBoundary = cursor === 0 || /\s/.test(text[cursor - 1]);

    if (atBoundary && ch === "U" && text.startsWith("Use the `", cursor)) {
      const rest = text.slice(cursor);
      const m = SKILL_DIRECTIVE_RE.exec(rest);
      if (m) {
        flushRun(cursor);
        segs.push({ kind: "skill", name: m[1] });
        cursor += m[0].length;
        runStart = cursor;
        continue;
      }
    }

    if (atBoundary && ch === "/") {
      const rest = text.slice(cursor + 1);
      const m = SLASH_NAME_RE.exec(rest);
      if (m && m[0].length > 0) {
        flushRun(cursor);
        segs.push({ kind: "slash", name: m[0] });
        cursor += 1 + m[0].length;
        runStart = cursor;
        continue;
      }
    }

    if (atBoundary && ch === "@") {
      let end = cursor + 1;
      while (end < text.length && !/\s/.test(text[end])) end++;
      const raw = text.slice(cursor + 1, end);
      if (raw.length > 0) {
        flushRun(cursor);
        const isDir = raw.endsWith("/");
        segs.push({
          kind: "mention",
          path: isDir ? raw.slice(0, -1) : raw,
          isDir,
        });
        cursor = end;
        runStart = cursor;
        continue;
      }
    }

    cursor++;
  }
  flushRun(cursor);
  return segs;
}

type ChipStyle = "command" | "skill" | "file" | "dir";

const CHIP_BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "2px",
  padding: "0 3px",
  margin: "0 1px",
  borderRadius: "3px",
  fontSize: "9px",
  lineHeight: 1.4,
  verticalAlign: "baseline",
  color: "var(--foreground)",
  userSelect: "none",
  fontFamily: "inherit",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

function chipBg(style: ChipStyle): string {
  const accented = style === "skill" || style === "dir";
  return accented
    ? "color-mix(in oklab, var(--foreground) 18%, transparent)"
    : "color-mix(in oklab, var(--foreground) 9%, transparent)";
}

function Chip({
  style: kind,
  children,
  title,
}: {
  style: ChipStyle;
  children: React.ReactNode;
  title: string;
}) {
  const Icon =
    kind === "command" ? Command : kind === "skill" ? Sparkles : kind === "dir" ? Folder : File;
  return (
    <span style={{ ...CHIP_BASE, backgroundColor: chipBg(kind) }} title={title}>
      <Icon size={9} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span style={{ fontFamily: "inherit" }}>{children}</span>
    </span>
  );
}

type Props = {
  text: string;
};

export function UserMessageBody({ text }: Props) {
  const segs = parseUserMessageText(text);
  return (
    <>
      {segs.map((seg, i) => {
        if (seg.kind === "text") return <React.Fragment key={i}>{seg.text}</React.Fragment>;
        if (seg.kind === "slash") {
          return (
            <Chip key={i} style="command" title={`/${seg.name}`}>
              <span style={{ opacity: 0.75 }}>/</span>
              <span>{seg.name}</span>
            </Chip>
          );
        }
        if (seg.kind === "skill") {
          return (
            <Chip key={i} style="skill" title={`${seg.name} skill`}>
              <span>{seg.name}</span>
              <span style={{ opacity: 0.75 }}> skill</span>
            </Chip>
          );
        }
        const slashIdx = seg.path.lastIndexOf("/");
        const dir = slashIdx >= 0 ? seg.path.slice(0, slashIdx + 1) : "";
        const base = slashIdx >= 0 ? seg.path.slice(slashIdx + 1) : seg.path;
        const suffix = seg.isDir && !seg.path.endsWith("/") ? "/" : "";
        return (
          <Chip
            key={i}
            style={seg.isDir ? "dir" : "file"}
            title={`@${seg.path}${suffix}`}
          >
            <span style={{ opacity: 0.75 }}>@{dir}</span>
            <span>{base}</span>
            {suffix && <span style={{ opacity: 0.75 }}>{suffix}</span>}
          </Chip>
        );
      })}
    </>
  );
}
