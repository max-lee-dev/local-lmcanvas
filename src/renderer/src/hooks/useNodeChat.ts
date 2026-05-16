import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useCanvasStoreApi } from "./useCanvasStore";
import type {
  CanvasNode,
  ImageBlock,
  NodeId,
  TextBlock,
  ThinkingBlock,
  ToolUseBlock,
  ContentBlock,
} from "@shared/types";
import type { Attachment, ChatEvent } from "@shared/ipc";
import { buildMergeContext } from "@shared/history";
import { createNextStepsStreamer } from "@/lib/nextStepsParser";

export function useNodeChat(nodeId: NodeId) {
  const storeApi = useCanvasStoreApi();
  const [streaming, setStreaming] = useState(false);
  const activeChatIdRef = useRef<string | null>(null);

  const submit = useCallback(
    async (promptText: string, attachments: Attachment[] = []) => {
      const trimmed = promptText.trim();
      if (!trimmed && attachments.length === 0) return;

      const canvasId = storeApi.getState().canvasId;
      if (!canvasId) {
        return;
      }

      setStreaming(true);

      const store = storeApi.getState();
      const nodeBeforeSubmit = store.nodes[nodeId];
      const isFirstMergePrompt =
        !!nodeBeforeSubmit &&
        nodeBeforeSubmit.data.chat.parentIds.length > 1 &&
        nodeBeforeSubmit.data.chat.messages.length === 0;
      let mergeContext = "";
      if (isFirstMergePrompt) {
        const parents = nodeBeforeSubmit.data.chat.parentIds
          .map((pid) => store.nodes[pid])
          .filter((n): n is CanvasNode => Boolean(n));
        mergeContext = buildMergeContext(parents);
      }
      const userMsgId = nanoid();
      const userBlocks: ContentBlock[] = [];
      if (trimmed) {
        userBlocks.push({ type: "text", text: trimmed } satisfies TextBlock);
      }
      for (const a of attachments) {
        userBlocks.push({
          type: "image",
          mediaType: a.mediaType,
          base64: a.base64,
        } satisfies ImageBlock);
      }
      store.appendMessage(nodeId, {
        id: userMsgId,
        role: "user",
        blocks: userBlocks,
        createdAt: Date.now(),
        status: "complete",
      });

      const asstMsgId = nanoid();
      store.appendMessage(nodeId, {
        id: asstMsgId,
        role: "assistant",
        blocks: [],
        createdAt: Date.now(),
        status: "streaming",
      });

      const fullHistory = storeApi.getState().getHistoryForNode(nodeId);
      const history = fullHistory.slice(0, -2);

      const chatId = nanoid();
      activeChatIdRef.current = chatId;

      // Per-stream parser that strips any trailing `<next-steps>` block from
      // the visible text and persists the parsed items on the assistant
      // message. State lives inside this closure so concurrent chats can't
      // bleed into each other.
      const nextStepsStreamer = createNextStepsStreamer({
        onText: (text) =>
          storeApi.getState().appendTextDelta(nodeId, asstMsgId, text),
        onSuggestions: (suggestions) =>
          storeApi.getState().setSuggestions(nodeId, asstMsgId, suggestions),
      });

      let off: (() => void) | null = null;
      const cleanup = () => {
        // Flush any remaining buffered text (e.g. an unterminated <next-steps>
        // block) so we don't silently swallow it.
        nextStepsStreamer.flush();
        if (off) {
          off();
          off = null;
        }
        setStreaming(false);
        activeChatIdRef.current = null;
        void storeApi.getState().save();
      };

      off = window.api.chat.onEvent((ev: ChatEvent) => {
        if (ev.chatId !== chatId) return;
        const s = storeApi.getState();
        switch (ev.type) {
          case "start":
            return;
          case "text_delta":
            nextStepsStreamer.ingest(ev.text);
            return;
          case "thinking_delta": {
            // Flush held-back text first so any pending characters land
            // before the new non-text block.
            nextStepsStreamer.flush();
            const block: ThinkingBlock = { type: "thinking", text: ev.text };
            s.appendBlock(nodeId, asstMsgId, block);
            return;
          }
          case "tool_use": {
            nextStepsStreamer.flush();
            const block: ToolUseBlock = {
              type: "tool_use",
              id: ev.toolUseId,
              name: ev.name,
              input: ev.input,
            };
            s.appendBlock(nodeId, asstMsgId, block);
            return;
          }
          case "tool_result":
            s.setToolResult(nodeId, asstMsgId, ev.toolUseId, ev.content, ev.isError);
            return;
          case "done":
            if (ev.isError) {
              s.errorMessage(nodeId, asstMsgId, ev.result ?? "error", {
                code: ev.code,
                provider: ev.provider,
              });
            } else {
              s.finalizeMessage(nodeId, asstMsgId);
            }
            cleanup();
            return;
          case "error":
            s.errorMessage(nodeId, asstMsgId, ev.message, {
              code: ev.code,
              provider: ev.provider,
            });
            cleanup();
            return;
        }
      });

      const addedContext =
        storeApi.getState().nodes[nodeId]?.data.chat.addedContext;
      let promptForModel = addedContext
        ? `> ${addedContext.replace(/\n/g, "\n> ")}\n\n${trimmed}`
        : trimmed;
      if (mergeContext) {
        promptForModel = `${mergeContext}\n\n---\n\n${promptForModel}`;
      }

      const nodeSettings = storeApi.getState().nodes[nodeId]?.data.nodeSettings;

      try {
        await window.api.chat.start({
          chatId,
          nodeId,
          canvasId,
          history,
          prompt: promptForModel,
          attachments: attachments.length > 0 ? attachments : undefined,
          nodeSettings,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        storeApi.getState().errorMessage(nodeId, asstMsgId, message);
        cleanup();
      }
    },
    [nodeId, storeApi]
  );

  const stop = useCallback(() => {
    const id = activeChatIdRef.current;
    if (id) void window.api.chat.cancel(id);
  }, []);

  useEffect(() => {
    return () => {
      const id = activeChatIdRef.current;
      if (id) void window.api.chat.cancel(id);
    };
  }, []);

  return { submit, stop, streaming };
}
