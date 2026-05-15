import { useEffect, useRef } from "react";
import { useCanvasStoreApi } from "./useCanvasStore";

/**
 * Watches `dirty` and flushes save() after quiet period.
 * Also saves on beforeunload.
 */
export function useDebouncedSave(delayMs = 1200) {
  const storeApi = useCanvasStoreApi();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = storeApi.subscribe(
      (s) => s.dirty.lastChangeAt,
      () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          void storeApi.getState().save();
        }, delayMs);
      }
    );
    const onUnload = () => {
      void storeApi.getState().save();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      unsub();
      window.removeEventListener("beforeunload", onUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [delayMs, storeApi]);
}
