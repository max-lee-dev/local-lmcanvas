import { useState } from "react";
import { ChevronRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import type { ToolUseBlock } from "@shared/types";
import { ToolUseView } from "./ToolUseView";
import { getToolIcon } from "./toolMeta";

type Props = {
  blocks: ToolUseBlock[];
  awaitingText?: boolean;
};

export function ToolGroupView({ blocks, awaitingText = false }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (blocks.length === 1) {
    return <ToolUseView block={blocks[0]} awaitingText={awaitingText} />;
  }

  const errorCount = blocks.filter((b) => b.result?.isError).length;
  const pendingCount = blocks.filter((b) => !b.result).length;
  const isRunning = pendingCount > 0;
  const hasErrors = errorCount > 0;
  const showLoader = isRunning || awaitingText;

  const statusIcon = showLoader ? (
    <Loader2 size={12} className="animate-spin text-muted-foreground" />
  ) : hasErrors ? (
    <AlertCircle size={12} className="text-destructive" />
  ) : (
    <CheckCircle2 size={12} className="text-muted-foreground" />
  );

  const summaryLabel = isRunning
    ? `Running ${blocks.length} tools…`
    : hasErrors
      ? `Ran ${blocks.length} tools · ${errorCount} failed`
      : `Ran ${blocks.length} tools`;

  return (
    <div
      className={clsx(
        "rounded-[8px] border bg-card overflow-hidden",
        hasErrors ? "border-destructive/30" : "border-border"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="nodrag flex w-full items-center gap-2 px-2.5 py-1.5 text-[10px] hover:bg-muted/50 transition-colors cursor-pointer"
        aria-expanded={expanded}
      >
        <ChevronRight
          size={11}
          className={clsx(
            "text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )}
        />
        <div className="flex -space-x-0.5">
          {blocks.slice(0, 3).map((b, i) => {
            const Icon = getToolIcon(b.name);
            return (
              <span
                key={b.id || i}
                className={clsx(
                  "flex h-4 w-4 items-center justify-center rounded-[4px] border bg-card",
                  b.result?.isError ? "border-destructive/40" : "border-border"
                )}
              >
                <Icon size={9} className="text-foreground" />
              </span>
            );
          })}
        </div>
        <span className="flex-1 text-left font-medium text-foreground">
          {summaryLabel}
        </span>
        {statusIcon}
      </button>

      {expanded && (
        <div className="flex flex-col gap-1 border-t border-border bg-muted/30 p-1.5">
          {blocks.map((b, i) => (
            <ToolUseView key={b.id || i} block={b} />
          ))}
        </div>
      )}
    </div>
  );
}
