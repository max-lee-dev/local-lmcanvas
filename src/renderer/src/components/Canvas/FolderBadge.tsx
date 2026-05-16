import { useState } from "react";
import clsx from "clsx";
import { Folder, FolderPlus, X } from "lucide-react";
import type { NodeId } from "@shared/types";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useRecentsStore } from "@/hooks/useRecentsStore";
import { BadgePopover } from "./BadgePopover";

type Props = { nodeId: NodeId };

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

export function FolderBadge({ nodeId }: Props) {
  const effectiveCwd = useCanvasStore((s) => s.getEffectiveCwd(nodeId));
  const overrideCwd = useCanvasStore(
    (s) => s.nodes[nodeId]?.data.nodeSettings?.cwd,
  );
  const setNodeSettings = useCanvasStore((s) => s.setNodeSettings);
  const recentFolders = useRecentsStore((s) => s.folders);
  const addRecentFolder = useRecentsStore((s) => s.addFolder);
  const removeRecentFolder = useRecentsStore((s) => s.removeFolder);

  const [removePath, setRemovePath] = useState<string | null>(null);

  const overridden = overrideCwd !== undefined;
  const headerName = effectiveCwd ? splitPath(effectiveCwd).name : "no folder";

  const apply = (folder: string, close: () => void): void => {
    setNodeSettings(nodeId, { cwd: folder });
    addRecentFolder(folder);
    close();
  };

  const pick = async (close: () => void): Promise<void> => {
    const folder = await window.api.dialog.pickFolder(effectiveCwd);
    if (!folder) return;
    apply(folder, close);
  };

  const others = recentFolders.filter((p) => p !== effectiveCwd);
  const rows: { path: string; current: boolean }[] = [
    ...(effectiveCwd ? [{ path: effectiveCwd, current: true }] : []),
    ...others.map((path) => ({ path, current: false })),
  ];

  return (
    <BadgePopover
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
        <div
          className="flex flex-col py-1"
          onClick={() => setRemovePath(null)}
        >
          {rows.map((row) => {
            const { name, parent } = splitPath(row.path);
            const showRemove = removePath === row.path && !row.current;
            return (
              <div
                key={row.path}
                className={clsx(
                  "relative flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 cursor-pointer",
                  row.current ? "bg-muted/60" : "hover:bg-muted",
                )}
                onClick={() => (row.current ? close() : apply(row.path, close))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (row.current) return;
                  setRemovePath((cur) => (cur === row.path ? null : row.path));
                }}
                title={row.path}
              >
                <Folder className="w-3 h-3 shrink-0 text-muted-foreground" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[11px] leading-tight truncate text-foreground">
                    {name}
                  </span>
                  {parent && (
                    <span
                      className="text-[9px] leading-tight truncate text-muted-foreground"
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
                      removeRecentFolder(row.path);
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
          <div className="mt-1 border-t border-border pt-1">
            <button
              type="button"
              onClick={() => void pick(close)}
              aria-label="Pick a new folder"
              className="flex w-full items-center justify-center gap-2 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-muted cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </BadgePopover>
  );
}
