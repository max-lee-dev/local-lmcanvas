import { FileText, Folder, X } from "lucide-react";

// A parsed `@mention` token found in the prompt text.
export type ParsedMention = {
  // The literal substring (including the leading `@`) so callers can splice it out.
  raw: string;
  // The path portion without the `@`. Folders keep their trailing `/`.
  path: string;
  type: "file" | "dir";
  // Character offset of the `@` in the source string.
  start: number;
  end: number;
};

// Matches `@<path>` tokens at start of string or after whitespace.
// Path stops at the next whitespace. A trailing `/` marks a folder.
const MENTION_RE = /(^|\s)(@[^\s]+)/g;

export function parseMentions(value: string): ParsedMention[] {
  const out: ParsedMention[] = [];
  if (!value) return out;
  MENTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(value)) !== null) {
    const leading = m[1] ?? "";
    const raw = m[2] ?? "";
    const start = m.index + leading.length;
    const end = start + raw.length;
    const path = raw.slice(1);
    if (path.length === 0) continue;
    const type: "file" | "dir" = path.endsWith("/") ? "dir" : "file";
    out.push({ raw, path, type, start, end });
  }
  return out;
}

type Props = {
  value: string;
  onRemove: (mention: ParsedMention) => void;
};

export function MentionChips({ value, onRemove }: Props) {
  const mentions = parseMentions(value);
  if (mentions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pb-1">
      {mentions.map((m) => (
        <Chip key={`${m.start}-${m.path}`} mention={m} onRemove={() => onRemove(m)} />
      ))}
    </div>
  );
}

function Chip({
  mention,
  onRemove,
}: {
  mention: ParsedMention;
  onRemove: () => void;
}) {
  const Icon = mention.type === "dir" ? Folder : FileText;
  const display = mention.type === "dir"
    ? mention.path.replace(/\/$/, "")
    : mention.path;
  const slash = display.lastIndexOf("/");
  const dir = slash >= 0 ? display.slice(0, slash + 1) : "";
  const base = slash >= 0 ? display.slice(slash + 1) : display;
  return (
    <span
      className="group/chip inline-flex items-center gap-1 px-1.5 py-[2px] rounded-[4px] text-[9px] bg-accent border border-border text-foreground"
      title={mention.path}
    >
      <Icon className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
      <span className="truncate max-w-[140px]">
        {dir && <span className="text-muted-foreground">{dir}</span>}
        <span>{base}</span>
        {mention.type === "dir" && (
          <span className="text-muted-foreground">/</span>
        )}
      </span>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="h-3 w-3 inline-flex items-center justify-center rounded-full opacity-60 hover:opacity-100 cursor-pointer"
        aria-label={`Remove ${mention.path}`}
      >
        <X className="h-2 w-2" />
      </button>
    </span>
  );
}
