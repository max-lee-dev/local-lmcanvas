import { useState } from "react";
import clsx from "clsx";
import { Check, Copy } from "lucide-react";

export function NodeCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // noop
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className={clsx(
        "flex h-5 w-5 items-center justify-center rounded-md transition-all duration-200 cursor-pointer bg-card hover:bg-muted hover:text-foreground",
        copied ? "text-foreground" : "text-muted-foreground",
      )}
      aria-label="Copy assistant response"
      title={copied ? "Copied" : "Copy response"}
    >
      {copied ? <Check className="h-[7px] w-[7px]" /> : <Copy className="h-[7px] w-[7px]" />}
    </button>
  );
}
