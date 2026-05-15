import { FileText, Folder, X } from "lucide-react";
import type { FileEntry } from "@shared/ipc";

// Matches `@<path>` tokens at start of string or after whitespace. The path
// continues until the next whitespace; a trailing `/` marks a folder. Used to
// pull existing mentions out of restored prompt text and turn them into chips.
const MENTION_RE = /(^|\s)@([^\s]+)/g;

export type ExtractResult = {
  // Text with `@<path>` tokens stripped (collapses any double space they leave).
  text: string;
  mentions: FileEntry[];
};

export function extractMentions(value: string): ExtractResult {
  if (!value) return { text: "", mentions: [] };
  const mentions: FileEntry[] = [];
  const text = value.replace(MENTION_RE, (_match, lead: string, path: string) => {
    if (!path) return _match;
    const type: "file" | "dir" = path.endsWith("/") ? "dir" : "file";
    const cleanPath = type === "dir" ? path.replace(/\/$/, "") : path;
    mentions.push({ path: cleanPath, type });
    // Drop the token entirely; preserve the leading whitespace so words don't
    // run into each other.
    return lead;
  }).replace(/[ \t]{2,}/g, " ").replace(/\s+$/g, "");
  return { text, mentions };
}

// Re-emit chips as `@path` (or `@path/` for folders) for sending to the model.
export function serializeMentions(mentions: FileEntry[]): string {
  return mentions
    .map((m) => `@${m.path}${m.type === "dir" ? "/" : ""}`)
    .join(" ");
}

type Props = {
  mentions: FileEntry[];
  onRemove: (index: number) => void;
};

export function MentionChips({ mentions, onRemove }: Props) {
  if (mentions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 pb-1">
      {mentions.map((m, i) => (
        <Chip key={`${i}-${m.path}`} entry={m} onRemove={() => onRemove(i)} />
      ))}
    </div>
  );
}

function Chip({
  entry,
  onRemove,
}: {
  entry: FileEntry;
  onRemove: () => void;
}) {
  const Icon = entry.type === "dir" ? Folder : FileText;
  const slash = entry.path.lastIndexOf("/");
  const dir = slash >= 0 ? entry.path.slice(0, slash + 1) : "";
  const base = slash >= 0 ? entry.path.slice(slash + 1) : entry.path;
  return (
    <span
      className="group/chip inline-flex items-center gap-1 px-1.5 py-[2px] rounded-[4px] text-[9px] bg-accent border border-border text-foreground"
      title={entry.path + (entry.type === "dir" ? "/" : "")}
    >
      <Icon className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
      <span className="truncate max-w-[140px]">
        {dir && <span className="text-muted-foreground">{dir}</span>}
        <span>{base}</span>
        {entry.type === "dir" && (
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
        aria-label={`Remove ${entry.path}`}
      >
        <X className="h-2 w-2" />
      </button>
    </span>
  );
}
