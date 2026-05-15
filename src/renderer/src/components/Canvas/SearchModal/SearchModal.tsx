import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CanvasNode } from "@shared/types";
import { useSearchIndex, type SearchResult } from "@/hooks/useSearchIndex";
import { useSearchNavigation } from "@/hooks/useSearchNavigation";
import { useSearchModal } from "@/providers/SearchModalProvider";
import { SearchInput } from "./SearchInput";
import { SearchResultsList } from "./SearchResultsList";

type SearchModalProps = {
  nodes: Record<string, CanvasNode>;
  onNodeSelect: (node: CanvasNode) => void;
  onSearchHighlight?: (nodeId: string, query: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
};

export function SearchModal({
  nodes,
  onNodeSelect,
  onSearchHighlight,
  inputRef: externalInputRef,
}: SearchModalProps) {
  const { isSearchModalOpen, hideSearchModal } = useSearchModal();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"user" | "both">("both");
  const [hasMouseMoved, setHasMouseMoved] = useState(false);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef || internalInputRef;

  const searchResults = useSearchIndex(nodes, searchMode, searchQuery);

  const handleConfirm = (result: SearchResult) => {
    if (onSearchHighlight && searchQuery.trim()) {
      onSearchHighlight(result.node.id, searchQuery);
    }
    onNodeSelect(result.node);
    hideSearchModal();
  };

  const { selectedIndex, setSelectedIndex, handleKeyDown, handleMouseEnter } =
    useSearchNavigation({
      results: searchResults,
      onConfirm: handleConfirm,
      onToggleMode: () =>
        setSearchMode((prev) => (prev === "user" ? "both" : "user")),
      onClose: hideSearchModal,
    });

  const wrappedMouseEnter = (index: number) => {
    if (hasMouseMoved) handleMouseEnter(index);
  };

  const selectedNodeId =
    searchResults.length > 0 &&
    selectedIndex >= 0 &&
    selectedIndex < searchResults.length
      ? searchResults[selectedIndex]?.node.id
      : null;

  useEffect(() => {
    if (!isSearchModalOpen || !onSearchHighlight) return;
    const timer = setTimeout(() => {
      if (searchQuery.trim() && selectedNodeId) {
        onSearchHighlight(selectedNodeId, searchQuery);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [isSearchModalOpen, selectedNodeId, searchQuery, onSearchHighlight]);

  useEffect(() => {
    if (isSearchModalOpen) {
      setSearchQuery("");
      setSearchMode("both");
      setHasMouseMoved(false);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
      setHasMouseMoved(false);
      setSelectedIndex(0);
    }
  }, [isSearchModalOpen, inputRef, setSelectedIndex]);

  useEffect(() => {
    if (!isSearchModalOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onSearchHighlight?.("", "");
        hideSearchModal();
      }
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isSearchModalOpen, hideSearchModal, onSearchHighlight]);

  return (
    <AnimatePresence>
      {isSearchModalOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-50"
            onClick={() => {
              onSearchHighlight?.("", "");
              hideSearchModal();
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
            onClick={(e) => e.stopPropagation()}
            onMouseMove={() => {
              if (!hasMouseMoved) setHasMouseMoved(true);
            }}
          >
            <div className="rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl border border-white/10 bg-popover/70 backdrop-saturate-150">
              <SearchInput
                searchQuery={searchQuery}
                searchMode={searchMode}
                onQueryChange={setSearchQuery}
                onToggleMode={() =>
                  setSearchMode((prev) => (prev === "user" ? "both" : "user"))
                }
                onKeyDown={handleKeyDown}
                inputRef={inputRef}
              />
              <SearchResultsList
                results={searchResults}
                searchQuery={searchQuery}
                selectedIndex={selectedIndex}
                onMouseEnter={wrappedMouseEnter}
                onClick={handleConfirm}
                hasMouseMoved={hasMouseMoved}
              />
              {searchQuery.trim() && searchResults.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  No results found for &quot;{searchQuery}&quot;
                </div>
              )}
              <div className="px-4 py-2 text-xs text-center border-t border-border text-muted-foreground">
                <span className="inline-flex items-center gap-4">
                  <span>⌘F Search</span>
                  <span>↑↓ Navigate</span>
                  <span>Enter Select</span>
                  <span>Tab Toggle</span>
                  <span>Esc Close</span>
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
