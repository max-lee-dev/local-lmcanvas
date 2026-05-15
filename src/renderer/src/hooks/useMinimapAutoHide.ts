import { useCallback, useEffect, useRef, useState } from "react";

const AUTO_HIDE_DELAY_MS = 3000;

export function useMinimapAutoHide(enabled: boolean): {
  visible: boolean;
  onMoveStart: () => void;
  onMove: () => void;
} {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const bump = useCallback(() => {
    if (!enabled) return;
    setVisible(true);
    clear();
    timeoutRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_DELAY_MS);
  }, [enabled, clear]);

  useEffect(() => {
    if (!enabled) {
      clear();
      setVisible(false);
    }
  }, [enabled, clear]);

  useEffect(() => () => clear(), [clear]);

  return { visible, onMoveStart: bump, onMove: bump };
}
