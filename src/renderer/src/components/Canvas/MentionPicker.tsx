import { useEffect, useMemo, useRef } from "react";
import { FileText } from "lucide-react";

const filesCacheByCwd = new Map<string, string[]>();
const inflightByCwd = new Map<string, Promise<string[]>>();

export async function getFilesForCwd(cwd: string): Promise<string[]> {
  if (!cwd) return [];
  const cached = filesCacheByCwd.get(cwd);
  if (cached) return cached;
  const existing = inflightByCwd.get(cwd);
  if (existing) return existing;
  const p = window.api.files
    .list(cwd)
    .then((files) => {
      filesCacheByCwd.set(cwd, files);
      inflightByCwd.delete(cwd);
      return files;
    })
    .catch((err) => {
      inflightByCwd.delete(cwd);
      throw err;
    });
  inflightByCwd.set(cwd, p);
  return p;
}

export function invalidateFilesCache(cwd?: string): void {
  if (cwd) filesCacheByCwd.delete(cwd);
  else filesCacheByCwd.clear();
}

type Props = {
  query: string;
  files: string[];
  highlightIdx: number;
  onSelect: (path: string) => void;
  onHoverIndex: (idx: number) => void;
  position?: "below" | "above";
};

const MAX_RESULTS = 8;

export function MentionPicker({
  query,
  files,
  highlightIdx,
  onSelect,
  onHoverIndex,
  position = "below",
}: Props) {
  const results = useMemo(() => filterFiles(files, query), [files, query]);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${highlightIdx}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  if (results.length === 0) return null;

  const containerClass =
    position === "above"
      ? "absolute left-0 right-0 bottom-full mb-1"
      : "absolute left-0 right-0 top-full mt-1";

  return (
    <div
      className={`${containerClass} z-50 nodrag bg-card border border-border rounded-[8px] shadow-md overflow-hidden`}
    >
      <ul ref={listRef} className="max-h-[180px] overflow-y-auto py-0.5">
        {results.map((path, i) => {
          const slash = path.lastIndexOf("/");
          const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
          const base = slash >= 0 ? path.slice(slash + 1) : path;
          const isActive = i === highlightIdx;
          return (
            <li
              key={path}
              data-idx={i}
              className={`flex items-center gap-2 px-2 py-1 text-[10px] cursor-pointer ${
                isActive ? "bg-accent" : ""
              }`}
              onMouseEnter={() => onHoverIndex(i)}
              onMouseDown={(e) => {
                // mousedown (not click) so it fires before textarea blur
                e.preventDefault();
                e.stopPropagation();
                onSelect(path);
              }}
            >
              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">
                <span className="text-muted-foreground">{dir}</span>
                <span className="text-foreground">{base}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function filterFiles(files: string[], query: string): string[] {
  if (query.length === 0) return files.slice(0, MAX_RESULTS);
  const q = query.toLowerCase();
  const scored: Array<{ path: string; score: number }> = [];
  for (const path of files) {
    const lower = path.toLowerCase();
    const slash = lower.lastIndexOf("/");
    const base = slash >= 0 ? lower.slice(slash + 1) : lower;
    const baseIdx = base.indexOf(q);
    const fullIdx = lower.indexOf(q);
    if (baseIdx < 0 && fullIdx < 0) continue;
    // Lower score = better. Prefer basename matches, then earlier-in-string matches.
    let score: number;
    if (baseIdx === 0) score = 0;
    else if (baseIdx > 0) score = 1 + baseIdx;
    else score = 100 + fullIdx;
    scored.push({ path, score });
    if (scored.length > 500) break; // cap work
  }
  scored.sort((a, b) => a.score - b.score || a.path.length - b.path.length);
  return scored.slice(0, MAX_RESULTS).map((s) => s.path);
}
