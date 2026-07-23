import { CircleStop, Loader2, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { useState } from "react";
import type {
  ContentBlock,
  ImageBlock,
  Message,
  ModelFallback,
  ToolUseBlock,
} from "@shared/types";
import { TextBlockView } from "./blocks/TextBlockView";
import { ToolGroupView } from "./blocks/ToolGroupView";
import { ThinkingView } from "./blocks/ThinkingView";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { ErrorBlock } from "./ErrorBlock";
import { pickSuggestionIcons } from "@/lib/suggestionIcon";

const MAX_TOOLS_PER_CHUNK = 5;

type RenderItem =
  | { kind: "text"; text: string; key: string }
  | { kind: "thinking"; text: string; key: string }
  | {
      kind: "toolGroup";
      blocks: ToolUseBlock[];
      key: string;
      summary?: string;
      chunkIndex: number;
      totalChunks: number;
    };

function groupBlocks(blocks: ContentBlock[]): RenderItem[] {
  const items: RenderItem[] = [];
  let pendingTools: ToolUseBlock[] = [];
  const flush = () => {
    if (pendingTools.length === 0) return;
    const totalChunks = Math.ceil(pendingTools.length / MAX_TOOLS_PER_CHUNK);
    for (let c = 0; c < totalChunks; c++) {
      const slice = pendingTools.slice(
        c * MAX_TOOLS_PER_CHUNK,
        (c + 1) * MAX_TOOLS_PER_CHUNK
      );
      items.push({
        kind: "toolGroup",
        blocks: slice,
        key: `tg-${slice[0].id ?? `${items.length}-${c}`}`,
        // Label is derived from the tool calls inside ToolGroupView; the
        // model's preceding prose stays as its own text block above so the
        // user can read/expand it.
        summary: undefined,
        chunkIndex: c,
        totalChunks,
      });
    }
    pendingTools = [];
  };
  blocks.forEach((b, i) => {
    if (b.type === "tool_use") {
      pendingTools.push(b);
      return;
    }
    flush();
    if (b.type === "text") {
      if (b.text.length === 0) return;
      items.push({ kind: "text", text: b.text, key: `t-${i}` });
    } else if (b.type === "thinking") {
      items.push({ kind: "thinking", text: b.text, key: `th-${i}` });
    }
  });
  flush();
  return items;
}

type Props = {
  message: Message;
  onStop?: () => void;
  nodeId?: string;
  imageDisplay?: "thumbnail" | "preview";
  /** Click handler for a `<next-steps>` suggestion button — receives the
   *  full prompt the button represents. */
  onSuggestionClick?: (prompt: string) => void;
};

export function NodeResponse({
  message,
  onStop,
  nodeId,
  imageDisplay = "thumbnail",
  onSuggestionClick,
}: Props) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";
  const hasAnyContent = message.blocks.some((b) => {
    if (b.type === "text") return b.text.length > 0;
    return true;
  });

  if (isUser) {
    // Avera: prompt section renders the user's raw input as text-[10px] foreground.
    const text = message.blocks
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("");
    const images = message.blocks.filter((b): b is ImageBlock => b.type === "image");
    return (
      <div className="flex flex-col gap-2">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {images.map((img, i) => (
              <UserImage
                key={i}
                src={`data:${img.mediaType};base64,${img.base64}`}
                display={imageDisplay}
              />
            ))}
          </div>
        )}
        {text && (
          <TextBlockView text={text} isUser nodeId={nodeId} />
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex flex-col gap-1",
        isError && "rounded-[8px] border border-destructive/30 bg-destructive/5 px-2 py-1.5"
      )}
    >
      {message.modelFallback && (
        <ModelFallbackNotice fallback={message.modelFallback} />
      )}

      {isStreaming && !hasAnyContent && <GeneratingIndicator onStop={onStop} />}

      {(() => {
        const items = groupBlocks(message.blocks);
        const lastIdx = items.length - 1;
        return items.map((item, idx) => {
          if (item.kind === "text") {
            return (
              <TextBlockView
                key={item.key}
                text={item.text}
                nodeId={nodeId}
                streaming={isStreaming && idx === lastIdx}
              />
            );
          }
          if (item.kind === "thinking") {
            return <ThinkingView key={item.key} text={item.text} />;
          }
          const awaitingText = isStreaming && idx === lastIdx;
          return (
            <ToolGroupView
              key={item.key}
              blocks={item.blocks}
              nodeId={nodeId}
              awaitingText={awaitingText}
              summary={item.summary}
              chunkIndex={item.chunkIndex}
              totalChunks={item.totalChunks}
            />
          );
        });
      })()}

      {isStreaming && hasAnyContent && (
        <div className="pt-0.5">
          <GeneratingIndicator onStop={onStop} compact />
        </div>
      )}

      {isError && message.error && <ErrorBlock message={message} />}

      {message.suggestions && message.suggestions.length > 0 && onSuggestionClick && (
        <SuggestionButtons
          suggestions={message.suggestions}
          onClick={onSuggestionClick}
        />
      )}
    </div>
  );
}

function ModelFallbackNotice({ fallback }: { fallback: ModelFallback }) {
  return (
    <div className="mb-1.5 flex items-start gap-1.5 rounded-[6px] border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-600 dark:text-amber-400">
      <RefreshCw className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        {fallback.reason === "policy_refusal" ? (
          <>
            {modelLabel(fallback.fromModel)} was blocked by Claude policy checks.
            Retried automatically with {modelLabel(fallback.toModel)}.
          </>
        ) : (
          <>
            Codex rerouted {modelLabel(fallback.fromModel)} to
            {" "}{modelLabel(fallback.toModel)} for high-risk cyber safeguards.
          </>
        )}
      </span>
    </div>
  );
}

function modelLabel(model: string): string {
  if (model === "claude-fable-5") return "Fable 5";
  if (model === "claude-opus-4-8") return "Opus 4.8";
  return model;
}

function SuggestionButtons({
  suggestions,
  onClick,
}: {
  suggestions: { label: string; prompt: string }[];
  onClick: (prompt: string) => void;
}) {
  return (
    <div className="nodrag mt-3 flex flex-col items-start gap-1.5 border-t border-border/60 pt-3">
      <span
        className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70"
        style={{ fontFamily: "var(--font-geist-mono)" }}
      >
        next steps
      </span>
      <div className="flex flex-wrap gap-1.5">
        {(() => {
          const icons = pickSuggestionIcons(suggestions.map((s) => s.label));
          return suggestions.map((s, i) => {
            const Icon = icons[i];
            return (
            <motion.button
              key={i}
              type="button"
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick(s.prompt);
              }}
              title={s.prompt}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/80 transition-colors hover:border-foreground/40 hover:text-foreground focus:outline-none"
              style={{ fontFamily: "var(--font-geist-mono)" }}
            >
              <Icon size={11} className="opacity-70" strokeWidth={2} />
              {s.label}
            </motion.button>
          );
          });
        })()}
      </div>
    </div>
  );
}

function GeneratingIndicator({
  onStop,
  compact = false,
}: {
  onStop?: () => void;
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={clsx(
        "flex items-center gap-1.5 text-[10px] text-muted-foreground",
        compact ? "pb-0" : "pb-1"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onStop}
        className="cursor-pointer rounded transition-opacity hover:opacity-80 focus:outline-none"
        aria-label="Stop generating"
      >
        {hovered ? (
          <CircleStop size={12} className="text-foreground" />
        ) : (
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
        )}
      </button>
      <span className="node-shimmer font-medium">Generating response…</span>
    </div>
  );
}

function UserImage({
  src,
  display,
}: {
  src: string;
  display: "thumbnail" | "preview";
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <>
      <img
        src={src}
        alt=""
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPreviewOpen(true);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          "cursor-zoom-in border border-border object-cover transition-opacity hover:opacity-90",
          display === "preview"
            ? "h-auto max-h-72 max-w-full rounded-lg object-contain"
            : "h-10 w-10 rounded-md",
        )}
      />
      <ImagePreviewModal
        src={previewOpen ? src : null}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
