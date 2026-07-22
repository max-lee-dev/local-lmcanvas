import { useCallback, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useCanvasStoreApi } from "./useCanvasStore";
import type {
  CanvasNode,
  ImageBlock,
  NodeId,
  Provider,
  TextBlock,
  ToolUseBlock,
  ContentBlock,
} from "@shared/types";
import type { Attachment, ChatEvent } from "@shared/ipc";
import { buildMergeContext } from "@shared/history";
import { isUnnamedCanvasName, promptToCanvasName } from "@shared/canvasName";
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
      const shouldNameCanvas =
        isUnnamedCanvasName(store.name) &&
        !!trimmed &&
        !!nodeBeforeSubmit &&
        !nodeBeforeSubmit.data.chat.messages.some((m) => m.role === "user");
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

      if (shouldNameCanvas) {
        const fallbackName = promptToCanvasName(trimmed);
        if (fallbackName) {
          storeApi.getState().setName(fallbackName);
          const notifyCanvasList = () =>
            window.dispatchEvent(new Event("lmc:canvases-changed"));
          void storeApi
            .getState()
            .save()
            .then(notifyCanvasList)
            .catch((err) =>
              console.error("Failed to save prompt-derived canvas name:", err),
            );
        }
      }

      const asstMsgId = nanoid();
      const messageProvider: Provider = store.getEffectiveProvider(nodeId);
      store.appendMessage(nodeId, {
        id: asstMsgId,
        role: "assistant",
        provider: messageProvider,
        blocks: [],
        createdAt: Date.now(),
        status: "streaming",
      });

      const fullHistory = storeApi.getState().getHistoryForNode(nodeId);
      const history = fullHistory.slice(0, -2);
      const currentSession = nodeBeforeSubmit?.data.chat.providerSession;
      const parentId =
        nodeBeforeSubmit?.data.chat.parentIds.length === 1
          ? nodeBeforeSubmit.data.chat.parentIds[0]
          : undefined;
      const parentSession = parentId
        ? storeApi.getState().nodes[parentId]?.data.chat.providerSession
        : undefined;

      const chatId = nanoid();
      activeChatIdRef.current = chatId;

      // Per-stream parser that strips any trailing `<next-steps>` block from
      // the visible text and persists the parsed items on the assistant
      // message. State lives inside this closure so concurrent chats can't
      // bleed into each other.
      const streamStartedAt = performance.now();
      let pendingText = "";
      let pendingThinking = "";
      let textTimer: ReturnType<typeof setTimeout> | null = null;
      let thinkingTimer: ReturnType<typeof setTimeout> | null = null;
      let firstPaintReported = false;

      const reportFirstPaint = () => {
        if (firstPaintReported) return;
        firstPaintReported = true;
        requestAnimationFrame(() => {
          console.info("[lmcanvas:latency]", {
            chatId,
            phase: "first_paint",
            elapsedMs: Math.round(performance.now() - streamStartedAt),
          });
        });
      };
      const flushText = () => {
        if (textTimer) clearTimeout(textTimer);
        textTimer = null;
        if (!pendingText) return;
        const text = pendingText;
        pendingText = "";
        storeApi.getState().appendTextDelta(nodeId, asstMsgId, text);
        reportFirstPaint();
      };
      const flushThinking = () => {
        if (thinkingTimer) clearTimeout(thinkingTimer);
        thinkingTimer = null;
        if (!pendingThinking) return;
        const text = pendingThinking;
        pendingThinking = "";
        storeApi.getState().appendThinkingDelta(nodeId, asstMsgId, text);
        reportFirstPaint();
      };
      const queueText = (text: string) => {
        pendingText += text;
        if (!textTimer) textTimer = setTimeout(flushText, 32);
      };
      const queueThinking = (text: string) => {
        pendingThinking += text;
        if (!thinkingTimer) thinkingTimer = setTimeout(flushThinking, 32);
      };

      const nextStepsStreamer = createNextStepsStreamer({
        onText: queueText,
        onSuggestions: (suggestions) =>
          storeApi.getState().setSuggestions(nodeId, asstMsgId, suggestions),
      });

      let off: (() => void) | null = null;
      let responseComplete = false;
      const completeVisibleResponse = () => {
        if (responseComplete) return;
        responseComplete = true;
        nextStepsStreamer.flush();
        flushThinking();
        flushText();
        storeApi.getState().finalizeMessage(nodeId, asstMsgId);
        setStreaming(false);
        void storeApi.getState().save();
      };
      const cleanup = () => {
        // Flush any remaining buffered text (e.g. an unterminated <next-steps>
        // block) so we don't silently swallow it.
        nextStepsStreamer.flush();
        flushThinking();
        flushText();
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
          case "response_complete":
            completeVisibleResponse();
            return;
          case "model_fallback":
            nextStepsStreamer.flush();
            flushThinking();
            flushText();
            responseComplete = false;
            setStreaming(true);
            s.setMessageModelFallback(nodeId, asstMsgId, {
              fromModel: ev.fromModel,
              toModel: ev.toModel,
              reason: ev.reason,
            });
            return;
          case "text_delta":
            flushThinking();
            nextStepsStreamer.ingest(ev.text);
            return;
          case "thinking_delta": {
            // Flush held-back text first so any pending characters land
            // before the new non-text block.
            nextStepsStreamer.flush();
            flushText();
            queueThinking(ev.text);
            return;
          }
          case "tool_use": {
            nextStepsStreamer.flush();
            flushText();
            flushThinking();
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
            flushText();
            flushThinking();
            s.setToolResult(nodeId, asstMsgId, ev.toolUseId, ev.content, ev.isError);
            return;
          case "session":
            s.setProviderSession(nodeId, ev.session);
            return;
          case "done":
            if (ev.usage) {
              s.setMessageUsage(nodeId, asstMsgId, ev.usage);
            }
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

      // One-shot plan mode: a leading `/plan` (followed by space or end) flips
      // the SDK into plan mode for this run only. The prefix is stripped from
      // what the model sees but kept verbatim in the user message bubble for
      // provenance.
      const inlinePlanMatch = trimmed.match(/^\/plan(?:\s+|$)/);
      const inlinePlanMode = Boolean(inlinePlanMatch);
      const afterPlanStrip = inlinePlanMatch
        ? trimmed.slice(inlinePlanMatch[0].length)
        : trimmed;

      // One-shot chat-only mode: leading `/chat` drops the claude_code preset
      // for this run so the model responds with chat-grade latency.
      const inlineChatMatch = afterPlanStrip.match(/^\/chat(?:\s+|$)/);
      const inlineChatOnly = Boolean(inlineChatMatch);
      const promptAfterPlanStrip = inlineChatMatch
        ? afterPlanStrip.slice(inlineChatMatch[0].length)
        : afterPlanStrip;

      const addedContext =
        storeApi.getState().nodes[nodeId]?.data.chat.addedContext;
      let promptForModel = addedContext
        ? `> ${addedContext.replace(/\n/g, "\n> ")}\n\n${promptAfterPlanStrip}`
        : promptAfterPlanStrip;
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
          planMode: inlinePlanMode || undefined,
          chatOnly: inlineChatOnly || undefined,
          parentSession,
          currentSession,
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

  return { submit, stop, streaming };
}
