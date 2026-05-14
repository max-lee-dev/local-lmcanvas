import { useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import clsx from "clsx";

type Props = {
  text: string;
};

export function ThinkingView({ text }: Props) {
  const [expanded, setExpanded] = useState(false);
  const preview = text.trim().split("\n", 1)[0] ?? "";

  if (!preview && !text.trim()) {
    return null;
  }

  return (
    <div className="my-1 nodrag overflow-hidden rounded-[8px] border border-border bg-muted/40">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-1.5 px-2 py-1 text-left transition-colors hover:bg-muted cursor-pointer"
        aria-label={expanded ? "Collapse reasoning" : "Expand reasoning"}
      >
        <Brain size={11} className="mt-[1px] shrink-0 text-muted-foreground" />
        <span
          className={clsx(
            "flex-1 min-w-0 text-[10px] italic text-muted-foreground",
            !expanded && "truncate"
          )}
        >
          {expanded ? text : preview || "thinking"}
        </span>
        <ChevronDown
          size={11}
          className={clsx(
            "mt-[2px] shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <div className="border-t border-border px-2.5 py-1.5 text-[10px] italic leading-snug text-muted-foreground whitespace-pre-wrap break-words">
          {text}
        </div>
      )}
    </div>
  );
}
