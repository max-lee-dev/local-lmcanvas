import { useCallback, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useCanvasStore } from "./useCanvasStore";
import type { NodeId } from "@shared/types";
import type { ChatEvent } from "@shared/ipc";

export function useNodeChat(nodeId: NodeId) {
  const [streaming, setStreaming] = useState(false);
  const activeChatIdRef = useRef<string | null>(null);

  const submit = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed) return;
      setStreaming(true);

      const store = useCanvasStore.getState();
      const userMsgId = nanoid();
      store.appendMessage(nodeId, {
        id: userMsgId,
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
        status: "complete",
      });

      const asstMsgId = nanoid();
      store.appendMessage(nodeId, {
        id: asstMsgId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        status: "streaming",
      });

      const fullHistory = useCanvasStore.getState().getHistoryForNode(nodeId);
      const history = fullHistory.slice(0, -2);

      const chatId = nanoid();
      activeChatIdRef.current = chatId;

      const cleanup = () => {
        off();
        setStreaming(false);
        activeChatIdRef.current = null;
        void useCanvasStore.getState().save();
      };

      const off = window.api.chat.onEvent((ev: ChatEvent) => {
        if (ev.chatId !== chatId) return;
        if (ev.type === "delta") {
          useCanvasStore.getState().appendDeltaToMessage(nodeId, asstMsgId, ev.text);
        } else if (ev.type === "done") {
          useCanvasStore.getState().finalizeMessage(nodeId, asstMsgId, ev.fullText);
          cleanup();
        } else if (ev.type === "error") {
          useCanvasStore.getState().errorMessage(nodeId, asstMsgId, ev.message);
          cleanup();
        }
      });

      try {
        await window.api.chat.start({ chatId, history, prompt: trimmed });
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
