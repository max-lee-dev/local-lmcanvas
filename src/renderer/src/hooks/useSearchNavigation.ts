import { useCallback, useEffect, useState } from "react";
import type { SearchResult } from "./useSearchIndex";

type UseSearchNavigationProps = {
  results: SearchResult[];
  onConfirm: (result: SearchResult) => void;
  onToggleMode: () => void;
  onClose: () => void;
};

export const useSearchNavigation = ({
  results,
  onConfirm,
  onToggleMode,
  onClose,
}: UseSearchNavigationProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Tab") {
        e.preventDefault();
        onToggleMode();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) onConfirm(selected);
      }
    },
    [results, selectedIndex, onConfirm, onToggleMode, onClose],
  );

  const handleMouseEnter = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  return { selectedIndex, setSelectedIndex, handleKeyDown, handleMouseEnter };
};
