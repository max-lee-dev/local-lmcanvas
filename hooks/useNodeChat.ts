"use client";

import { useCallback, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useCanvasStore } from "./useCanvasStore";
import type { NodeId } from "@/lib/graph/types";

export function useNodeChat(nodeId: NodeId) {
  const store = useCanvasStore();
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const submit = useCallback(
    async (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed) return;
      setStreaming(true);

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

      // history = everything up to THIS node's messages, excluding the two just appended
      const fullHistory = store.getHistoryForNode(nodeId);
      const history = fullHistory.slice(0, -2);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            canvasId: useCanvasStore.getState().canvasId,
            nodeId,
            history,
            prompt: trimmed,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const msg = `Request failed: ${res.status}`;
          useCanvasStore.getState().errorMessage(nodeId, asstMsgId, msg);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let done = false;
        let fullText = "";
        let errored = false;
        while (!done) {
          const { value, done: rDone } = await reader.read();
          if (rDone) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const raw of parts) {
            const line = raw.trim();
            if (!line.startsWith("data:")) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;
            let payload: {
              type: string;
              text?: string;
              fullText?: string;
              message?: string;
            };
            try {
              payload = JSON.parse(jsonStr);
            } catch {
              continue;
            }
            if (payload.type === "delta" && payload.text) {
              fullText += payload.text;
              useCanvasStore.getState().appendDeltaToMessage(nodeId, asstMsgId, payload.text);
            } else if (payload.type === "done") {
              done = true;
              useCanvasStore
                .getState()
                .finalizeMessage(nodeId, asstMsgId, payload.fullText ?? fullText);
            } else if (payload.type === "error") {
              errored = true;
              useCanvasStore
                .getState()
                .errorMessage(nodeId, asstMsgId, payload.message ?? "claude error");
            }
          }
        }
        if (!done && !errored) {
          useCanvasStore.getState().finalizeMessage(nodeId, asstMsgId, fullText);
        }
        // persist once the stream finishes
        await useCanvasStore.getState().save();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          useCanvasStore.getState().errorMessage(nodeId, asstMsgId, "aborted");
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          useCanvasStore.getState().errorMessage(nodeId, asstMsgId, msg);
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [nodeId, store]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { submit, stop, streaming };
}
