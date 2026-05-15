import { useCallback, useEffect, useRef } from "react";
import type { CanvasNode } from "@shared/types";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useCenterOnNode } from "@/hooks/useCenterOnNode";
import { useIsActivePane } from "@/hooks/useActivePane";
import { useSearchModal } from "@/providers/SearchModalProvider";
import { SearchModal } from "./SearchModal";

export function SearchModalWrapper() {
  const isActive = useIsActivePane();
  const nodes = useCanvasStore((s) => s.nodes);
  const setSearchHighlights = useCanvasStore((s) => s.setSearchHighlights);
  const clearSearchHighlights = useCanvasStore((s) => s.clearSearchHighlights);
  const { setInputRef, isSearchModalOpen } = useSearchModal();
  const inputRef = useRef<HTMLInputElement>(null);
  const centerOnNode = useCenterOnNode();

  useEffect(() => {
    if (!isActive) return;
    setInputRef(inputRef);
  }, [isActive, setInputRef]);

  useEffect(() => {
    if (isSearchModalOpen) clearSearchHighlights();
  }, [isSearchModalOpen, clearSearchHighlights]);

  const handleNodeSelect = useCallback(
    (node: CanvasNode) => {
      const width = (node.data as { width?: number }).width ?? 450;
      const height = (node.data as { height?: number }).height ?? 200;
      centerOnNode(node.position.x, node.position.y, width, height);
    },
    [centerOnNode],
  );

  const handleSearchHighlight = useCallback(
    (nodeId: string, query: string) => {
      clearSearchHighlights();
      if (query.trim() && nodeId) {
        setSearchHighlights(nodeId, [query]);
      }
    },
    [setSearchHighlights, clearSearchHighlights],
  );

  if (!isActive) return null;

  return (
    <SearchModal
      nodes={nodes}
      onNodeSelect={handleNodeSelect}
      onSearchHighlight={handleSearchHighlight}
      inputRef={inputRef}
    />
  );
}
