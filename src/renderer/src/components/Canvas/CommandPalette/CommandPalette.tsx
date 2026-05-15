import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import clsx from "clsx";
import { useCommandPalette } from "@/providers/CommandPaletteProvider";

export type CommandPaletteAction = {
  id: string;
  label: string;
  description: string;
  keywords?: string[];
  run: () => void | Promise<void>;
};

type CommandPaletteProps = {
  actions: CommandPaletteAction[];
  inputRef?: RefObject<HTMLInputElement | null>;
};

export function CommandPalette({
  actions,
  inputRef: externalInputRef,
}: CommandPaletteProps) {
  const { isCommandPaletteOpen, hideCommandPalette } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasMouseMoved, setHasMouseMoved] = useState(false);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef ?? internalInputRef;

  const filteredActions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return actions;
    return actions.filter((action) => {
      const haystack = [
        action.label,
        action.description,
        ...(action.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [actions, query]);

  const handleConfirm = useCallback(
    (action: CommandPaletteAction) => {
      hideCommandPalette();
      void Promise.resolve(action.run()).catch((err) => {
        console.error("Command palette action failed:", err);
      });
    },
    [hideCommandPalette],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        hideCommandPalette();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((p) => Math.min(p + 1, filteredActions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((p) => Math.max(p - 1, 0));
        return;
      }
      if (e.key === "Enter" && filteredActions.length > 0) {
        e.preventDefault();
        const action = filteredActions[selectedIndex];
        if (action) handleConfirm(action);
      }
    },
    [filteredActions, handleConfirm, hideCommandPalette, selectedIndex],
  );

  const handleMouseEnter = useCallback(
    (index: number) => {
      if (hasMouseMoved) setSelectedIndex(index);
    },
    [hasMouseMoved],
  );

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setHasMouseMoved(false);
      return;
    }
    setQuery("");
    setSelectedIndex(0);
    setHasMouseMoved(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [inputRef, isCommandPaletteOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, filteredActions.length]);

  return (
    <AnimatePresence>
      {isCommandPaletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-50"
            onClick={hideCommandPalette}
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
            style={{ fontFamily: "var(--font-geist-sans)" }}
          >
            <div className="rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl border border-white/10 bg-popover/70 backdrop-saturate-150">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search commands..."
                  className="w-full px-12 py-4 text-lg focus:outline-none bg-popover/50 text-foreground"
                />
              </div>

              {filteredActions.length > 0 ? (
                <div className="max-h-96 overflow-y-auto border-t border-border">
                  {filteredActions.map((action, index) => (
                    <motion.button
                      key={action.id}
                      type="button"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onMouseEnter={() => handleMouseEnter(index)}
                      onClick={() => handleConfirm(action)}
                      className={clsx(
                        "w-full text-left px-4 py-3 cursor-pointer transition-colors",
                        index === selectedIndex
                          ? "border-l-4 border-l-primary bg-accent/10"
                          : "border-l-4 border-l-transparent",
                        index !== selectedIndex &&
                          hasMouseMoved &&
                          "hover:bg-muted",
                      )}
                    >
                      <p className="text-sm font-medium text-foreground">
                        {action.label}
                      </p>
                      <p className="text-xs mt-1 text-muted-foreground">
                        {action.description}
                      </p>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  No commands found for &quot;{query}&quot;
                </div>
              )}

              <div className="px-4 py-2 text-xs text-center border-t border-border text-muted-foreground">
                <span className="inline-flex items-center gap-4">
                  <span>⌘K Open</span>
                  <span>↑↓ Navigate</span>
                  <span>Enter Select</span>
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
