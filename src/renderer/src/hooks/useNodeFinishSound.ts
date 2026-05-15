import { useEffect, useRef, useState } from "react";
import { playFinishSound } from "@/lib/finishSound";
import { usePreferencesStore } from "@/hooks/usePreferencesStore";
import { useCanvasStoreApi } from "@/hooks/useCanvasStore";

type Options = {
  nodeId: string;
  streaming: boolean;
  hovered: boolean;
};

// Detects the streaming -> done transition on a node and (a) plays the
// configured finish sound, (b) returns a justFinished flag the caller can use
// to render a brief glow. The glow auto-clears on hover.
export function useNodeFinishSound({ nodeId, streaming, hovered }: Options): boolean {
  const storeApi = useCanvasStoreApi();
  const [justFinished, setJustFinished] = useState(false);
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    const wasStreaming = wasStreamingRef.current;
    wasStreamingRef.current = streaming;
    if (!wasStreaming || streaming) return;
    const node = storeApi.getState().nodes[nodeId];
    if (!node) return;
    const msgs = node.data.chat.messages;
    let lastAssistant;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") {
        lastAssistant = msgs[i];
        break;
      }
    }
    if (lastAssistant?.status !== "complete") return;
    setJustFinished(true);
    const prefs = usePreferencesStore.getState();
    if (prefs.finishSoundEnabled) playFinishSound(prefs.finishSound);
  }, [streaming, nodeId, storeApi]);

  useEffect(() => {
    if (hovered && justFinished) setJustFinished(false);
  }, [hovered, justFinished]);

  return justFinished;
}
