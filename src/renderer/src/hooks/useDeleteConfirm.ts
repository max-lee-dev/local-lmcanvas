import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  requireConfirm: boolean;
  onDelete: () => void;
  timeoutMs?: number;
};

// Two-stage delete: when requireConfirm is true, the first trigger arms a
// confirmation state that auto-resets after timeoutMs; the second commits.
// When false, fires immediately.
export function useDeleteConfirm({
  requireConfirm,
  onDelete,
  timeoutMs = 10000,
}: Options) {
  const [isConfirming, setIsConfirming] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(
    (e?: { stopPropagation?: () => void }) => {
      e?.stopPropagation?.();
      if (!requireConfirm) {
        onDelete();
        return;
      }
      if (isConfirming) {
        onDelete();
        setIsConfirming(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      } else {
        setIsConfirming(true);
      }
    },
    [requireConfirm, isConfirming, onDelete],
  );

  useEffect(() => {
    if (!isConfirming) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }
    timeoutRef.current = setTimeout(() => {
      setIsConfirming(false);
      timeoutRef.current = null;
    }, timeoutMs);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isConfirming, timeoutMs]);

  return { isConfirming, trigger };
}
