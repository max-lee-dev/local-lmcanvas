import clsx from "clsx";
import { Check, Folder, FolderPlus } from "lucide-react";
import type { NodeId } from "@shared/types";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useRecentsStore } from "@/hooks/useRecentsStore";
import { BadgePopover } from "./BadgePopover";

type Props = { nodeId: NodeId };

function basename(p: string | undefined): string | undefined {
  if (!p) return undefined;
  const cleaned = p.replace(/[/\\]+$/u, "");
  const idx = Math.max(cleaned.lastIndexOf("/"), cleaned.lastIndexOf("\\"));
  return idx === -1 ? cleaned : cleaned.slice(idx + 1);
}

export function FolderBadge({ nodeId }: Props) {
  const effectiveCwd = useCanvasStore((s) => s.getEffectiveCwd(nodeId));
  const overrideCwd = useCanvasStore(
    (s) => s.nodes[nodeId]?.data.nodeSettings?.cwd,
  );
  const setNodeSettings = useCanvasStore((s) => s.setNodeSettings);
  const recentFolders = useRecentsStore((s) => s.folders);
  const addRecentFolder = useRecentsStore((s) => s.addFolder);

  const overridden = overrideCwd !== undefined;
  const displayName = basename(effectiveCwd) ?? "no folder";

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
      panelClassName="min-w-[200px]"
      label={
        <>
          <Folder className="w-[10px] h-[10px] text-muted-foreground" />
          <span
            className={clsx(
              "tracking-tight text-[8px] max-w-[120px] truncate",
              !effectiveCwd && "italic text-muted-foreground",
            )}
          >
            {displayName}
          </span>
        </>
      }
    >
      {({ close }) => (
        <div className="flex flex-col py-1">
          {rows.map((row) => (
            <button
              key={row.path}
              type="button"
              onClick={() => (row.current ? close() : apply(row.path, close))}
              title={row.path}
              className={clsx(
                "flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] cursor-pointer",
                row.current ? "bg-muted/60" : "hover:bg-muted",
              )}
            >
              <Folder className="w-3 h-3 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{basename(row.path)}</span>
              {row.current && (
                <Check className="w-3 h-3 shrink-0 text-foreground" />
              )}
            </button>
          ))}
          <div className="mt-1 border-t border-border pt-1">
            <button
              type="button"
              onClick={() => void pick(close)}
              title="Pick a new folder"
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
