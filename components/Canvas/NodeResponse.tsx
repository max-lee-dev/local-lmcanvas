"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "@/lib/graph/types";

type Props = {
  message: Message;
};

export function NodeResponse({ message }: Props) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";

  return (
    <div
      className={`rounded-md px-3 py-2 text-sm ${
        isUser ? "bg-zinc-100 text-zinc-900" : "bg-white text-zinc-900"
      } ${isError ? "border border-red-300 bg-red-50" : ""}`}
    >
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
        {isUser ? "you" : "claude"}
        {isStreaming && <span className="ml-1 text-blue-500">streaming…</span>}
        {isError && <span className="ml-1 text-red-500">error</span>}
      </div>
      {isUser ? (
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      ) : (
        <div className="prose prose-sm max-w-none break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {message.content || (isStreaming ? "…" : "")}
          </ReactMarkdown>
        </div>
      )}
      {isError && message.error && (
        <div className="mt-1 text-xs text-red-600">{message.error}</div>
      )}
    </div>
  );
}
