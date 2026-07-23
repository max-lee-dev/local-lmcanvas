import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Folder, FolderPlus, Search, X } from "lucide-react";
import type { NodeId } from "@shared/types";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useRecentsStore } from "@/hooks/useRecentsStore";
import { BadgePopover } from "./BadgePopover";

type Props = { nodeId: NodeId; popoverSide?: "top" | "bottom" };

function splitPath(p: string): { name: string; parent: string } {
  const cleaned = p.replace(/[/\\]+$/u, "");
  const idx = Math.max(cleaned.lastIndexOf("/"), cleaned.lastIndexOf("\\"));
  if (idx === -1) return { name: cleaned, parent: "" };
  return { name: cleaned.slice(idx + 1), parent: cleaned.slice(0, idx) };
}

function prettyParent(parent: string): string {
  if (!parent) return "";
  const normalized = parent.replace(/\\/g, "/").replace(/\/+$/u, "");
  const homeMatch = normalized.match(/^\/Users\/[^/]+(?:\/|$)/u);
  if (homeMatch) {
    const rest = normalized.slice(homeMatch[0].length);
    return rest ? `~/${rest}` : "~";
  }
  return normalized || "/";
}

function isLikelyPath(value: string): boolean {
  return (
    value.startsWith("/") ||
    /^[a-z]:[\\/]/iu.test(value)
  );
}

export function FolderBadge({ nodeId, popoverSide }: Props) {
  const effectiveCwd = useCanvasStore((s) => s.getEffectiveCwd(nodeId));
  const overrideCwd = useCanvasStore(
    (s) => s.nodes[nodeId]?.data.nodeSettings?.cwd,
  );
  const setNodeSettings = useCanvasStore((s) => s.setNodeSettings);
  const recentFolders = useRecentsStore((s) => s.folders);
  const addRecentFolder = useRecentsStore((s) => s.addFolder);
  const removeRecentFolder = useRecentsStore((s) => s.removeFolder);

  const overridden = overrideCwd !== undefined;
  const headerName = effectiveCwd ? splitPath(effectiveCwd).name : "no folder";

  const others = recentFolders.filter((p) => p !== effectiveCwd);
  const rows: { path: string; current: boolean }[] = [
    ...(effectiveCwd ? [{ path: effectiveCwd, current: true }] : []),
    ...others.map((path) => ({ path, current: false })),
  ];

  return (
    <BadgePopover
      side={popoverSide}
      title={effectiveCwd ?? "No folder set"}
      overridden={overridden}
      ariaHasPopup="dialog"
      panelClassName="min-w-[240px]"
      label={
        <>
          <Folder className="w-[10px] h-[10px] text-muted-foreground" />
          <span
            className={clsx(
              "tracking-tight text-[8px] max-w-[120px] truncate",
              !effectiveCwd && "italic text-muted-foreground",
            )}
          >
            {headerName}
          </span>
        </>
      }
    >
      {({ close }) => (
        <FolderPicker
          currentCwd={effectiveCwd}
          rows={rows}
          onClose={close}
          onApply={(folder) => {
            setNodeSettings(nodeId, { cwd: folder });
            addRecentFolder(folder);
            close();
          }}
          onPick={async () => {
            const folder = await window.api.dialog.pickFolder(effectiveCwd);
            if (!folder) return;
            setNodeSettings(nodeId, { cwd: folder });
            addRecentFolder(folder);
            close();
          }}
          onRemove={removeRecentFolder}
        />
      )}
    </BadgePopover>
  );
}

type FolderPickerProps = {
  currentCwd?: string;
  rows: { path: string; current: boolean }[];
  onClose: () => void;
  onApply: (folder: string) => void;
  onPick: () => Promise<void>;
  onRemove: (folder: string) => void;
};

function FolderPicker({
  currentCwd,
  rows,
  onClose,
  onApply,
  onPick,
  onRemove,
}: FolderPickerProps) {
  const [query, setQuery] = useState("");
  const [removePath, setRemovePath] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.path.toLowerCase().includes(q));
  }, [query, rows]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (selectedIndex < filteredRows.length) return;
    setSelectedIndex(Math.max(0, filteredRows.length - 1));
  }, [filteredRows.length, selectedIndex]);

  const submitQuery = (): void => {
    const row = filteredRows[selectedIndex] ?? filteredRows[0];
    if (row) {
      if (row.current) {
        onClose();
        return;
      }
      onApply(row.path);
      return;
    }

    const trimmed = query.trim();
    if (isLikelyPath(trimmed) && trimmed !== currentCwd) onApply(trimmed);
  };

  return (
    <div className="flex flex-col py-1" onClick={() => setRemovePath(null)}>
      <div className="px-2 pb-1.5 pt-1">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitQuery();
                return;
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((i) =>
                  filteredRows.length === 0
                    ? 0
                    : Math.min(i + 1, filteredRows.length - 1),
                );
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(i - 1, 0));
              }
            }}
            placeholder="Search folders"
            className="w-full rounded-sm border border-border bg-card py-1 pl-6 pr-2 text-[11px] outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="max-h-[180px] overflow-y-auto">
        {filteredRows.map((row, index) => {
          const { name, parent } = splitPath(row.path);
          const showRemove = removePath === row.path && !row.current;
          const selected = index === selectedIndex;
          return (
            <div
              key={row.path}
              className={clsx(
                "relative flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 cursor-pointer",
                row.current && "bg-muted/60",
                !row.current && selected && "bg-muted",
                !row.current && !selected && "hover:bg-muted",
              )}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => (row.current ? onClose() : onApply(row.path))}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (row.current) return;
                setRemovePath((cur) => (cur === row.path ? null : row.path));
              }}
              title={row.path}
            >
              <Folder className="w-3 h-3 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[11px] leading-tight text-foreground">
                  {name}
                </span>
                {parent && (
                  <span
                    className="truncate text-[9px] leading-tight text-muted-foreground"
                    style={{ fontFamily: "var(--font-geist-mono)" }}
                  >
                    {prettyParent(parent)}
                  </span>
                )}
              </div>
              {showRemove && (
                <button
                  type="button"
                  aria-label="Remove from recents"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(row.path);
                    setRemovePath(null);
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {filteredRows.length === 0 && (
        <div className="px-2.5 py-2 text-[10px] text-muted-foreground">
          No matching folders
        </div>
      )}

      <div className="mt-1 border-t border-border pt-1">
        <button
          type="button"
          onClick={() => void onPick()}
          aria-label="Pick a new folder"
          className="flex w-full items-center justify-center gap-2 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-muted cursor-pointer"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
