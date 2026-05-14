import { useCallback, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useCanvasStore } from "./useCanvasStore";
import type {
  ImageBlock,
  NodeId,
  TextBlock,
  ThinkingBlock,
  ToolUseBlock,
  ContentBlock,
} from "@shared/types";
import type { Attachment, ChatEvent } from "@shared/ipc";

export function useNodeChat(nodeId: NodeId) {
  const [streaming, setStreaming] = useState(false);
  const activeChatIdRef = useRef<string | null>(null);

  const submit = useCallback(
    async (promptText: string, attachments: Attachment[] = []) => {
      const trimmed = promptText.trim();
      if (!trimmed && attachments.length === 0) return;

      const canvasId = useCanvasStore.getState().canvasId;
      if (!canvasId) {
        return;
      }

      setStreaming(true);

      const store = useCanvasStore.getState();
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

      const fullHistory = useCanvasStore.getState().getHistoryForNode(nodeId);
      const history = fullHistory.slice(0, -2);

      const chatId = nanoid();
      activeChatIdRef.current = chatId;

      let off: (() => void) | null = null;
      const cleanup = () => {
        if (off) {
          off();
          off = null;
        }
        setStreaming(false);
        activeChatIdRef.current = null;
        void useCanvasStore.getState().save();
      };

      off = window.api.chat.onEvent((ev: ChatEvent) => {
        if (ev.chatId !== chatId) return;
        const s = useCanvasStore.getState();
        switch (ev.type) {
          case "start":
            return;
          case "text_delta":
            s.appendTextDelta(nodeId, asstMsgId, ev.text);
            return;
          case "thinking_delta": {
            const block: ThinkingBlock = { type: "thinking", text: ev.text };
            s.appendBlock(nodeId, asstMsgId, block);
            return;
          }
          case "tool_use": {
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
              s.errorMessage(nodeId, asstMsgId, ev.result ?? "error");
            } else {
              s.finalizeMessage(nodeId, asstMsgId);
            }
            cleanup();
            return;
          case "error":
            s.errorMessage(nodeId, asstMsgId, ev.message);
            cleanup();
            return;
        }
      });

      try {
        await window.api.chat.start({
          chatId,
          canvasId,
          history,
          prompt: trimmed,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        useCanvasStore.getState().errorMessage(nodeId, asstMsgId, message);
        cleanup();
      }
    },
    [nodeId]
  );

  const stop = useCallback(() => {
    const id = activeChatIdRef.current;
    if (id) void window.api.chat.cancel(id);
  }, []);

  return { submit, stop, streaming };
}
