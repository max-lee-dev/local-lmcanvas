import React, { memo, useCallback, useMemo, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import clsx from "clsx";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { CodeBlock } from "./CodeBlock";

type Props = {
  text: string;
  isUser?: boolean;
  nodeId?: string;
};

type CodeProps = ComponentPropsWithoutRef<"code"> & { inline?: boolean };
type AnchorProps = ComponentPropsWithoutRef<"a">;

function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(href) || /^mailto:/i.test(href);
}

function stripEditorLineSuffix(path: string): string {
  return path
    .replace(/#L\d+(C\d+)?$/i, "")
    .replace(/:\d+:\d+$/, "")
    .replace(/:\d+$/, "");
}

function toOpenablePath(rawHref: string, cwd: string): string | null {
  const trimmed = rawHref.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  if (isExternalHref(trimmed)) return null;

  let path = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
  if (path.startsWith("file://")) {
    try {
      path = decodeURIComponent(new URL(path).pathname);
    } catch {
      path = path.slice("file://".length);
    }
  }
  path = stripEditorLineSuffix(path);
  if (!path) return null;

  const isAbsolute = path.startsWith("/") || /^[a-z]:[\\/]/i.test(path);
  if (isAbsolute) return path;
  if (!cwd) return path;
  return `${cwd.replace(/\/+$/, "")}/${path.replace(/^\.?\//, "")}`;
}

function highlightTextInString(
  text: string,
  highlightedTexts: Set<string>,
): (string | React.ReactElement)[] {
  if (!text) return [text];
  const sortedTexts = Array.from(highlightedTexts).sort(
    (a, b) => b.length - a.length,
  );
  let parts: (string | React.ReactElement)[] = [text];
  let keyCounter = 0;

  for (const textToHighlight of sortedTexts) {
    if (!textToHighlight.trim()) continue;
    const escaped = textToHighlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const newParts: (string | React.ReactElement)[] = [];
    for (const part of parts) {
      if (typeof part !== "string") {
        newParts.push(part);
        continue;
      }
      const regex = new RegExp(`(${escaped})`, "gi");
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(part)) !== null) {
        if (match.index > lastIndex) {
          newParts.push(part.substring(lastIndex, match.index));
        }
        newParts.push(
          <mark
            key={`hl-${keyCounter++}-${match.index}`}
            className="bg-yellow-200/60 text-foreground px-0 rounded-none"
          >
            {match[0]}
          </mark>,
        );
        lastIndex = regex.lastIndex;
        if (match[0].length === 0) {
          regex.lastIndex++;
          break;
        }
      }
      if (lastIndex < part.length) {
        newParts.push(part.substring(lastIndex));
      }
    }
    parts = newParts.length > 0 ? newParts : parts;
  }
  return parts;
}

function processChildren(
  children: React.ReactNode,
  highlightedTexts: Set<string>,
): React.ReactNode {
  if (typeof children === "string") {
    return highlightTextInString(children, highlightedTexts);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === "string") {
        return (
          <React.Fragment key={`s-${i}`}>
            {highlightTextInString(child, highlightedTexts)}
          </React.Fragment>
        );
      }
      if (React.isValidElement(child)) {
        const el = child as React.ReactElement<{ children?: React.ReactNode }>;
        if (el.props.children) {
          return React.cloneElement(el, {
            ...el.props,
            children: processChildren(el.props.children, highlightedTexts),
          });
        }
      }
      return child;
    });
  }
  if (React.isValidElement(children)) {
    const el = children as React.ReactElement<{ children?: React.ReactNode }>;
    if (el.props.children) {
      return React.cloneElement(el, {
        ...el.props,
        children: processChildren(el.props.children, highlightedTexts),
      });
    }
  }
  return children;
}

function TextBlockViewImpl({ text, isUser, nodeId }: Props) {
  const cwd = useCanvasStore((state) => state.cwd);
  const highlightedTexts = useCanvasStore(
    useCallback(
      (state) => {
        if (!nodeId) return undefined;
        const set = state.searchHighlights.get(nodeId);
        return set && set.size > 0 ? set : undefined;
      },
      [nodeId],
    ),
  );

  const onLinkClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href?: string) => {
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      if (isExternalHref(href)) {
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }
      const path = toOpenablePath(href, cwd);
      if (!path) return;
      void window.api.shell.openPath(path);
    },
    [cwd],
  );

  const components = useMemo((): Components => {
    const base: Components = {
      code(props) {
        const { inline, className, children, ...rest } = props as CodeProps;
        const codeString = String(children ?? "").replace(/\n$/, "");
        const langMatch = /language-(\w+)/.exec(className ?? "");
        const language = langMatch?.[1];
        const looksInline =
          inline === true ||
          (!language && !codeString.includes("\n") && codeString.length < 80);
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
          <a
            href={typeof src === "string" ? src : undefined}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => onLinkClick(e, typeof src === "string" ? src : undefined)}
          >
            {alt || src || "image"}
          </a>
        );
      },
      a(props) {
        const { href, children, ...rest } = props as AnchorProps;
        return (
          <a
            href={href}
            rel="noreferrer"
            {...rest}
            onClick={(e) => onLinkClick(e, href)}
          >
            {children}
          </a>
        );
      },
    };
    if (!highlightedTexts || highlightedTexts.size === 0) return base;
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return {
      ...base,
      p: ({ children, ...rest }: any) => (
        <p {...rest}>{processChildren(children, highlightedTexts)}</p>
      ),
      li: ({ children, ...rest }: any) => (
        <li {...rest}>{processChildren(children, highlightedTexts)}</li>
      ),
      strong: ({ children, ...rest }: any) => (
        <strong {...rest}>{processChildren(children, highlightedTexts)}</strong>
      ),
      em: ({ children, ...rest }: any) => (
        <em {...rest}>{processChildren(children, highlightedTexts)}</em>
      ),
      h1: ({ children, ...rest }: any) => (
        <h1 {...rest}>{processChildren(children, highlightedTexts)}</h1>
      ),
      h2: ({ children, ...rest }: any) => (
        <h2 {...rest}>{processChildren(children, highlightedTexts)}</h2>
      ),
      h3: ({ children, ...rest }: any) => (
        <h3 {...rest}>{processChildren(children, highlightedTexts)}</h3>
      ),
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, [highlightedTexts, onLinkClick]);

  if (isUser) {
    return (
      <div className="whitespace-pre-wrap break-words text-[10px] leading-relaxed text-foreground select-text cursor-text">
        {highlightedTexts ? highlightTextInString(text, highlightedTexts) : text}
      </div>
    );
  }

  return (
    <div className={clsx("node-md", "max-w-full min-w-0 cursor-text")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export const TextBlockView = memo(TextBlockViewImpl);
