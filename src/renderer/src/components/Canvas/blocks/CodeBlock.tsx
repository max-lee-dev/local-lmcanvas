import { memo, useState, type ComponentPropsWithoutRef } from "react";
import { Check, Copy } from "lucide-react";

type Props = {
  code: string;
  language?: string;
  innerProps?: ComponentPropsWithoutRef<"code">;
};

export const CodeBlock = memo(function CodeBlock({ code, language, innerProps }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  };

  return (
    <div className="group relative my-2 nodrag overflow-hidden rounded-[8px] border border-border bg-muted/60">
      <div className="flex items-center justify-between border-b border-border bg-muted px-2.5 py-1">
        <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
          aria-label="Copy code"
          title="Copy"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          <span>{copied ? "copied" : "copy"}</span>
        </button>
      </div>
      <pre className="node-scroll m-0 overflow-x-auto px-3 py-2 text-[9.5px] leading-snug">
        <code
          {...innerProps}
          className={`font-mono ${innerProps?.className ?? ""}`}
        >
          {code}
        </code>
      </pre>
    </div>
  );
});
