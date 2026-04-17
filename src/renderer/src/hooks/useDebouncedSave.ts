import { useEffect, useRef } from "react";
import { useCanvasStore } from "./useCanvasStore";

/**
 * Watches `dirty` and flushes save() after quiet period.
 * Also saves on beforeunload.
 */
export function useDebouncedSave(delayMs = 1200) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = useCanvasStore.subscribe(
      (s) => s.dirty.lastChangeAt,
      () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          void useCanvasStore.getState().save();
        }, delayMs);
      }
    );
    const onUnload = () => {
      void useCanvasStore.getState().save();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      unsub();
      window.removeEventListener("beforeunload", onUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [delayMs]);
}
