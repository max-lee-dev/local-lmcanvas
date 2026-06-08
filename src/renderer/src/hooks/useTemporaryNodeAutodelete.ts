import { useEffect, useState } from "react";
import { useCanvasStore } from "@/hooks/useCanvasStore";

const TOTAL_SECONDS = 10;

type Options = {
  nodeId: string;
  isTemporary: boolean;
  streaming: boolean;
  hovered: boolean;
  /** True when the node has a finished assistant message (status === "complete").
   *  Error messages do NOT trigger auto-delete — the user should see them. */
  hasCompletedAssistant: boolean;
};

// For temporary nodes, runs a per-second countdown that removes the node when
// it hits zero. Pauses while the user hovers the node, while streaming is in
// progress, and before the first complete assistant message arrives. Returns
// the remaining seconds (or null when the timer is not running) so the caller
// can render a countdown indicator.
export function useTemporaryNodeAutodelete({
  nodeId,
  isTemporary,
  streaming,
  hovered,
  hasCompletedAssistant,
}: Options): number | null {
  const removeNode = useCanvasStore((s) => s.removeNode);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!isTemporary || streaming || !hasCompletedAssistant || hovered) {
      setRemaining(null);
      return;
    }
    let timeLeft = TOTAL_SECONDS;
    setRemaining(timeLeft);
    const interval = window.setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        window.clearInterval(interval);
        removeNode(nodeId);
      } else {
        setRemaining(timeLeft);
      }
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [isTemporary, streaming, hovered, hasCompletedAssistant, nodeId, removeNode]);

  return remaining;
}
