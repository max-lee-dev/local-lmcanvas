import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { GitBranch } from "lucide-react";
import type { NodeId } from "@shared/types";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useRecentsStore } from "@/hooks/useRecentsStore";
import { BadgePopover } from "./BadgePopover";

type Props = { nodeId: NodeId };

export function BranchBadge({ nodeId }: Props) {
  const effectiveBranch = useCanvasStore((s) => s.getEffectiveBranch(nodeId));
  const setNodeSettings = useCanvasStore((s) => s.setNodeSettings);
  const recentBranches = useRecentsStore((s) => s.branches);
  const addRecentBranch = useRecentsStore((s) => s.addBranch);
  const overridden = effectiveBranch !== undefined;

  const displayName = effectiveBranch && effectiveBranch.length > 0
    ? effectiveBranch
    : "no branch";

  return (
    <BadgePopover
      title={overridden ? `Branch: ${effectiveBranch}` : "No branch label set"}
      overridden={overridden}
      ariaHasPopup="dialog"
      panelClassName="min-w-[220px]"
      label={
        <>
          <GitBranch className="w-[10px] h-[10px] text-muted-foreground" />
          <span
            className={clsx(
              "tracking-tight text-[8px] max-w-[120px] truncate",
              !overridden && "italic text-muted-foreground",
            )}
          >
            {displayName}
          </span>
        </>
      }
    >
      {({ close }) => (
        <BranchEditor
          initial={effectiveBranch ?? ""}
          recents={recentBranches.filter((b) => b !== effectiveBranch)}
          onSubmit={(value) => {
            const trimmed = value.trim();
            if (trimmed.length > 0) {
              setNodeSettings(nodeId, { branch: trimmed });
              addRecentBranch(trimmed);
            } else {
              setNodeSettings(nodeId, { branch: undefined });
            }
            close();
          }}
        />
      )}
    </BadgePopover>
  );
}

type EditorProps = {
  initial: string;
  recents: string[];
  onSubmit: (value: string) => void;
};

function BranchEditor({ initial, recents, onSubmit }: EditorProps) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="p-2 space-y-2">
      <div
        className="px-1 text-[8px] uppercase tracking-[0.14em] text-muted-foreground"
        style={{ fontFamily: "var(--font-geist-mono)" }}
      >
        Node branch
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit(value);
          }
        }}
        placeholder="branch name (free text)"
        className="w-full rounded-sm border border-border bg-card px-2 py-1 text-[11px] outline-none focus:border-accent"
      />
      {recents.length > 0 && (
        <div className="flex flex-col gap-0.5 pt-1">
          <div
            className="px-1 pb-0.5 text-[8px] uppercase tracking-[0.14em] text-muted-foreground"
            style={{ fontFamily: "var(--font-geist-mono)" }}
          >
            Recent
          </div>
          {recents.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onSubmit(b)}
              title={b}
              className="w-full rounded-sm px-2 py-1 text-left text-[11px] hover:bg-muted cursor-pointer truncate"
            >
              {b}
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={() => onSubmit("")}
          className="rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:bg-muted cursor-pointer"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => onSubmit(value)}
          className="rounded-sm border border-border bg-card px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-foreground hover:bg-muted cursor-pointer"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
