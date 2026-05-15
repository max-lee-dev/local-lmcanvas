import { useEffect, useMemo, useRef } from "react";
import { Sparkles, SquareSlash } from "lucide-react";
import type { SlashItem } from "@shared/ipc";

const itemsCacheByCwd = new Map<string, SlashItem[]>();
const inflightByCwd = new Map<string, Promise<SlashItem[]>>();

export async function getSlashItemsForCwd(cwd: string): Promise<SlashItem[]> {
  const key = cwd ?? "";
  const cached = itemsCacheByCwd.get(key);
  if (cached) return cached;
  const existing = inflightByCwd.get(key);
  if (existing) return existing;
  const p = window.api.slash
    .list(key)
    .then((items) => {
      itemsCacheByCwd.set(key, items);
      inflightByCwd.delete(key);
      return items;
    })
    .catch((err) => {
      inflightByCwd.delete(key);
      throw err;
    });
  inflightByCwd.set(key, p);
  return p;
}

export function invalidateSlashItemsCache(cwd?: string): void {
  if (cwd) itemsCacheByCwd.delete(cwd);
  else itemsCacheByCwd.clear();
}

type Props = {
  query: string;
  items: SlashItem[];
  highlightIdx: number;
  onSelect: (item: SlashItem) => void;
  onHoverIndex: (idx: number) => void;
  position?: "below" | "above";
};

const MAX_RESULTS = 8;

export function SlashPicker({
  query,
  items,
  highlightIdx,
  onSelect,
  onHoverIndex,
  position = "below",
}: Props) {
  const results = useMemo(() => filterSlashItems(items, query), [items, query]);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${highlightIdx}"]`,
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
      <ul ref={listRef} className="max-h-[220px] overflow-y-auto py-0.5">
        {results.map((item, i) => {
          const isActive = i === highlightIdx;
          const Icon = item.kind === "skill" ? Sparkles : SquareSlash;
          const prefix = item.kind === "command" ? "/" : "";
          return (
            <li
              key={`${item.kind}:${item.name}:${item.source}`}
              data-idx={i}
              className={`flex items-start gap-2 px-2 py-1 text-[10px] cursor-pointer ${
                isActive ? "bg-accent" : ""
              }`}
              onMouseEnter={() => onHoverIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(item);
              }}
            >
              <Icon
                className={`h-3 w-3 shrink-0 mt-[1px] ${
                  item.kind === "skill"
                    ? "text-foreground/70"
                    : "text-muted-foreground"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate">
                    <span className="text-muted-foreground">{prefix}</span>
                    <span className="text-foreground">{item.name}</span>
                  </span>
                  <span className="text-muted-foreground/70 text-[8px] uppercase tracking-wide shrink-0">
                    {item.kind === "skill" ? "skill" : item.source}
                  </span>
                </div>
                {item.description && (
                  <div className="text-muted-foreground truncate text-[9px]">
                    {item.description}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function filterSlashItems(
  items: SlashItem[],
  query: string,
): SlashItem[] {
  if (query.length === 0) return items.slice(0, MAX_RESULTS);
  const q = query.toLowerCase();
  const scored: Array<{ item: SlashItem; score: number }> = [];
  for (const item of items) {
    const name = item.name.toLowerCase();
    const desc = item.description.toLowerCase();
    const nameIdx = name.indexOf(q);
    const descIdx = desc.indexOf(q);
    if (nameIdx < 0 && descIdx < 0) continue;
    let score: number;
    if (nameIdx === 0) score = 0;
    else if (nameIdx > 0) score = 1 + nameIdx;
    else score = 100 + descIdx;
    // Slight preference: skills surface above commands at equal score, since
    // they're typically what users mean when they type a noun-ish query.
    if (item.kind === "skill") score -= 0.25;
    scored.push({ item, score });
    if (scored.length > 500) break;
  }
  scored.sort(
    (a, b) => a.score - b.score || a.item.name.length - b.item.name.length,
  );
  return scored.slice(0, MAX_RESULTS).map((s) => s.item);
}
