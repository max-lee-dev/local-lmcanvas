import { useState, useImperativeHandle, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";

interface CanvasSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchClose?: () => void;
}

export interface CanvasSearchRef {
  close: () => void;
}

export const CanvasSearch = forwardRef<CanvasSearchRef, CanvasSearchProps>(
  ({ searchQuery, onSearchChange, onSearchClose }, ref) => {
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      close: () => {
        setIsSearchOpen(false);
        onSearchChange("");
        onSearchClose?.();
      },
    }));

    const handleSearchToggle = () => {
      setIsSearchOpen(!isSearchOpen);
      if (isSearchOpen) {
        onSearchChange("");
        onSearchClose?.();
      }
    };

    const handleClose = () => {
      setIsSearchOpen(false);
      onSearchChange("");
      onSearchClose?.();
    };

    return (
      <div className="px-0 pb-2 relative h-8 flex items-center">
        <AnimatePresence mode="wait">
          {isSearchOpen ? (
            <motion.div
              key="search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-x-0 flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none"
                  autoFocus
                />
              </div>
              <button
                onClick={handleClose}
                className="p-1 rounded-md hover:bg-muted transition-colors cursor-pointer flex-shrink-0"
                aria-label="Close search"
                tabIndex={0}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="recents"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-x-0 px-2 flex items-center justify-between"
            >
              <span className="text-xs text-foreground">Chats</span>
              <button
                onClick={handleSearchToggle}
                className="p-1 rounded-md hover:bg-muted transition-colors cursor-pointer"
                aria-label="Search canvases"
                tabIndex={0}
              >
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

CanvasSearch.displayName = "CanvasSearch";
