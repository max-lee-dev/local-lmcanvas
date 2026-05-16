import clsx from "clsx";
import type { ThreadTree } from "@shared/threads";

type ThreadListProps = {
  threads: ThreadTree[];
  onSelect: (startNodeId: string) => void;
  /** Visual depth, capped at 2. */
  depth?: number;
};

export function ThreadList({ threads, onSelect, depth = 0 }: ThreadListProps) {
  if (threads.length === 0) return null;
  return (
    <div className="flex flex-col">
      {threads.map((t) => (
        <ThreadRow key={t.id} thread={t} onSelect={onSelect} depth={depth} />
      ))}
    </div>
  );
}

type ThreadRowProps = {
  thread: ThreadTree;
  onSelect: (startNodeId: string) => void;
  depth: number;
};

function ThreadRow({ thread, onSelect, depth }: ThreadRowProps) {
  const cappedDepth = Math.min(depth, 1);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(thread.startNodeId);
        }}
        className={clsx(
          "group flex w-full items-center gap-1.5 rounded-md py-1 text-left text-xs text-foreground/80 hover:bg-muted hover:text-foreground transition-colors cursor-pointer truncate",
          cappedDepth === 0 ? "pl-5 pr-2" : "pl-9 pr-2",
        )}
        title={thread.title}
      >
        <span className="text-muted-foreground/60">·</span>
        <span className="truncate">{thread.title}</span>
      </button>
      {thread.children.length > 0 && (
        <ThreadList
          threads={thread.children}
          onSelect={onSelect}
          depth={depth + 1}
        />
      )}
    </>
  );
}
