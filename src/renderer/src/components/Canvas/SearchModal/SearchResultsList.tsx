import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { SearchResult } from "@/hooks/useSearchIndex";
import {
  getResponseSnippet,
  highlightMatches,
  stripMarkdownToPlainText,
} from "@/lib/searchUtils";

type SearchResultsListProps = {
  results: SearchResult[];
  searchQuery: string;
  selectedIndex: number;
  onMouseEnter: (index: number) => void;
  onClick: (result: SearchResult) => void;
  hasMouseMoved?: boolean;
};

export function SearchResultsList({
  results,
  searchQuery,
  selectedIndex,
  onMouseEnter,
  onClick,
  hasMouseMoved = true,
}: SearchResultsListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, results.length);
  }, [results.length]);

  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= itemRefs.current.length) return;
    const item = itemRefs.current[selectedIndex];
    const container = scrollContainerRef.current;
    if (!item || !container) return;
    const cr = container.getBoundingClientRect();
    const ir = item.getBoundingClientRect();
    if (ir.top < cr.top || ir.bottom > cr.bottom) {
      item.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedIndex]);

  if (results.length === 0) return null;

  return (
    <div
      ref={scrollContainerRef}
      className="max-h-96 overflow-y-auto border-t border-border"
    >
      {results.map((result, index) => (
        <motion.div
          key={result.node.id}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.02 }}
          onMouseEnter={() => onMouseEnter(index)}
          onClick={() => onClick(result)}
          className={`px-4 py-3 cursor-pointer transition-colors ${
            index === selectedIndex
              ? "border-l-4 border-l-primary bg-accent/10"
              : ""
          } ${index !== selectedIndex && hasMouseMoved ? "hover:bg-muted" : ""}`}
        >
          <p className="text-sm font-medium line-clamp-2 text-foreground">
            {highlightMatches(result.matchedQuery, searchQuery)}
          </p>
          <div className="text-xs mt-1 max-h-16 overflow-hidden whitespace-pre-wrap text-muted-foreground">
            {result.response ? (
              (() => {
                const plain = stripMarkdownToPlainText(result.response || "");
                const snippet = getResponseSnippet(plain, searchQuery);
                return (
                  <p className="line-clamp-3">
                    {highlightMatches(snippet, searchQuery)}
                  </p>
                );
              })()
            ) : (
              <span className="italic">No response yet</span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
