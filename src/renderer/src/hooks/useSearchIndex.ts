import { useMemo } from "react";
import type { CanvasNode, ContentBlock, Message } from "@shared/types";

export type SearchResult = {
  node: CanvasNode;
  matchedQuery: string;
  messageIndex: number;
  response?: string;
};

function messageToText(message: Message): string {
  const parts: string[] = [];
  for (const b of message.blocks as ContentBlock[]) {
    if (b.type === "text") parts.push(b.text);
  }
  return parts.join("\n").trim();
}

export const useSearchIndex = (
  nodesById: Record<string, CanvasNode>,
  searchMode: "user" | "both",
  searchQuery: string,
): SearchResult[] => {
  return useMemo(() => {
    const query = searchQuery.trim();
    const results: SearchResult[] = [];
    const seenKeys = new Set<string>();
    const nodes = Object.values(nodesById);

    const collect = (filterFn: (userText: string, asstText: string) => boolean) => {
      for (const node of nodes) {
        if (seenKeys.has(node.id)) continue;
        const messages = node.data?.chat?.messages ?? [];
        if (messages.length === 0) continue;

        let lastUserMessage: { content: string; index: number } | null = null;
        let lastAssistantMessage: { content: string; index: number } | null = null;

        for (let index = messages.length - 1; index >= 0; index--) {
          const message = messages[index];
          if (message.role === "user" && !lastUserMessage) {
            lastUserMessage = { content: messageToText(message), index };
          }
          if (message.role === "assistant" && !lastAssistantMessage) {
            lastAssistantMessage = { content: messageToText(message), index };
          }
          if (lastUserMessage && lastAssistantMessage) break;
        }
        if (!lastUserMessage) continue;

        const addedContext = node.data?.chat?.addedContext;
        const userContent = addedContext
          ? lastUserMessage.content.replace(addedContext, "")
          : lastUserMessage.content;
        const assistantContent = lastAssistantMessage?.content || "";

        if (!filterFn(userContent, assistantContent)) continue;

        seenKeys.add(node.id);
        results.push({
          node,
          matchedQuery: userContent,
          messageIndex: lastUserMessage.index,
          response: assistantContent,
        });
      }
    };

    if (!query) {
      collect(() => true);
      results.sort((a, b) => b.node.position.y - a.node.position.y);
      return results.slice(0, 20);
    }

    const queryLower = query.toLowerCase();
    collect((userText, asstText) => {
      const userLower = userText.toLowerCase();
      const asstLower = asstText.toLowerCase();
      return (
        userLower.includes(queryLower) ||
        (searchMode === "both" && asstLower.includes(queryLower))
      );
    });
    results.sort((a, b) => b.node.position.y - a.node.position.y);
    return results;
  }, [nodesById, searchMode, searchQuery]);
};
