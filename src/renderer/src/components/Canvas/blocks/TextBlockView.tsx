import { memo, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import clsx from "clsx";
import { CodeBlock } from "./CodeBlock";

type Props = {
  text: string;
  isUser?: boolean;
};

type CodeProps = ComponentPropsWithoutRef<"code"> & { inline?: boolean };

const markdownComponents: Components = {
  code(props) {
    const { inline, className, children, ...rest } = props as CodeProps;
    const codeString = String(children ?? "").replace(/\n$/, "");
    const langMatch = /language-(\w+)/.exec(className ?? "");
    const language = langMatch?.[1];

    const looksInline =
      inline === true || (!language && !codeString.includes("\n") && codeString.length < 80);

    if (looksInline) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    }

    return (
      <CodeBlock
        code={codeString}
        language={language}
        innerProps={{ className, ...rest }}
      />
    );
  },
  img({ alt, src }) {
    return (
      <a href={typeof src === "string" ? src : undefined} target="_blank" rel="noreferrer">
        {alt || src || "image"}
      </a>
    );
  },
};

function TextBlockViewImpl({ text, isUser }: Props) {
  if (isUser) {
    return (
      <div className="whitespace-pre-wrap break-words text-[10px] leading-relaxed text-foreground">
        {text}
      </div>
    );
  }

  return (
    <div className={clsx("node-md", "max-w-full min-w-0 cursor-text")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export const TextBlockView = memo(TextBlockViewImpl);
