import { CircleStop, Loader2 } from "lucide-react";
import clsx from "clsx";
import { useState } from "react";
import type { ContentBlock, ImageBlock, Message, ToolUseBlock } from "@shared/types";
import { TextBlockView } from "./blocks/TextBlockView";
import { ToolGroupView } from "./blocks/ToolGroupView";
import { ThinkingView } from "./blocks/ThinkingView";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { ErrorBlock } from "./ErrorBlock";

type RenderItem =
  | { kind: "text"; text: string; key: string }
  | { kind: "thinking"; text: string; key: string }
  | { kind: "toolGroup"; blocks: ToolUseBlock[]; key: string };

function groupBlocks(blocks: ContentBlock[]): RenderItem[] {
  const items: RenderItem[] = [];
  let pendingTools: ToolUseBlock[] = [];
  const flush = () => {
    if (pendingTools.length > 0) {
      items.push({
        kind: "toolGroup",
        blocks: pendingTools,
        key: `tg-${pendingTools[0].id ?? items.length}`,
      });
      pendingTools = [];
    }
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
};

export function NodeResponse({ message, onStop, nodeId }: Props) {
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
      {isStreaming && !hasAnyContent && <GeneratingIndicator onStop={onStop} />}

      {(() => {
        const items = groupBlocks(message.blocks);
        const lastIdx = items.length - 1;
        return items.map((item, idx) => {
          if (item.kind === "text") {
            return <TextBlockView key={item.key} text={item.text} nodeId={nodeId} />;
          }
          if (item.kind === "thinking") {
            return <ThinkingView key={item.key} text={item.text} />;
          }
          const awaitingText = isStreaming && idx === lastIdx;
          return (
            <ToolGroupView
              key={item.key}
              blocks={item.blocks}
              awaitingText={awaitingText}
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

function UserImage({ src }: { src: string }) {
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
        className="h-10 w-10 rounded-md border border-border object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
      />
      <ImagePreviewModal
        src={previewOpen ? src : null}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
