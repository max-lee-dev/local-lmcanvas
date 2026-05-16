import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import type { Canvas, CanvasSummary } from "@shared/types";
import { computeThreads, type ThreadTree } from "@shared/threads";
import { prettyPath } from "@/lib/prettyPath";
import { ThreadList } from "./ThreadList";

type CanvasItemProps = {
  canvas: CanvasSummary;
  isSelected: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onRename: (newName: string) => Promise<void>;
  onDelete: () => void;
  /** Click handler for a thread inside this canvas; receives the starting node id. */
  onThreadSelect: (canvasId: string, startNodeId: string) => void;
};

type ThreadsCache =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; threads: ThreadTree[] }
  | { status: "error"; message: string };

export const CanvasItem = ({
  canvas,
  isSelected,
  isDeleting,
  onSelect,
  onRename,
  onDelete,
  onThreadSelect,
}: CanvasItemProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(canvas.name || "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [threadsCache, setThreadsCache] = useState<ThreadsCache>({ status: "idle" });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isRenaming) {
      setNewName(canvas.name || "");
    }
  }, [canvas.name, isRenaming]);

  // Re-load threads when the summary's updatedAt changes while expanded so the
  // tree stays in sync with edits made in the active canvas pane.
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setThreadsCache((prev) =>
      prev.status === "ready" ? prev : { status: "loading" },
    );
    void window.api.canvases
      .read(canvas.id)
      .then((c: Canvas | null) => {
        if (cancelled) return;
        if (!c) {
          setThreadsCache({ status: "error", message: "Canvas not found" });
          return;
        }
        setThreadsCache({ status: "ready", threads: computeThreads(c.nodes) });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setThreadsCache({ status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, canvas.id, canvas.updatedAt]);

  const threads = useMemo(
    () => (threadsCache.status === "ready" ? threadsCache.threads : []),
    [threadsCache],
  );

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu((bool) => !bool);
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewName(canvas.name || "");
    setIsRenaming(true);
    setShowMenu(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
    setShowMenu(false);
  };

  const handleOpenNewWindow = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    window.api.window
      .openCanvas(canvas.id)
      .catch((err) => console.error("openCanvas failed:", err));
  };

  const handleSaveName = async () => {
    if (!newName.trim() || newName.trim() === canvas.name) {
      setIsRenaming(false);
      return;
    }

    setIsSavingName(true);
    try {
      await onRename(newName.trim());
      setIsRenaming(false);
    } catch (error) {
      console.error("Failed to rename canvas:", error);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelRename = () => {
    setNewName(canvas.name || "");
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelRename();
    }
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  return (
    <div className="flex flex-col">
      <div
        className={clsx(
          "flex items-center justify-between rounded-lg py-1 pr-2 cursor-pointer transition-colors",
          isSelected ? "bg-accent border border-accent/30" : "hover:bg-muted",
        )}
        onClick={onSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={(e) => {
          if (isRenaming) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <button
          type="button"
          onClick={handleExpandToggle}
          className="flex h-5 w-5 ml-1 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-background/60 cursor-pointer shrink-0"
          title={expanded ? "Collapse" : "Expand"}
          aria-label={expanded ? "Collapse threads" : "Expand threads"}
        >
          <ChevronRight
            className={clsx(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-90",
            )}
          />
        </button>

        <div className="flex-1 min-w-0 pl-1">
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveName}
              disabled={isSavingName}
              className="w-full px-2 py-1 text-sm border border-accent bg-card text-foreground rounded focus:outline-none focus:ring-1 disabled:opacity-50"
              onClick={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex flex-col min-w-0">
              <div className="text-sm font-medium truncate text-foreground">
                {canvas.name || "Untitled Canvas"}
              </div>
              {canvas.cwd && (
                <div
                  className="text-[11px] text-muted-foreground truncate"
                  title={canvas.cwd}
                >
                  {prettyPath(canvas.cwd)}
                </div>
              )}
            </div>
          )}
        </div>

        {!isRenaming && (
          <div className="relative ml-2">
            <motion.button
              ref={buttonRef}
              onClick={handleMenuClick}
              disabled={isDeleting}
              className={clsx(
                "p-1 cursor-pointer rounded disabled:opacity-50 disabled:cursor-not-allowed transition-opacity text-muted-foreground hover:bg-muted hover:text-foreground",
                isHovered ? "opacity-100" : "opacity-0",
              )}
              title="Canvas options"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </motion.button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg overflow-visible z-50 border border-border bg-popover"
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="w-full cursor-pointer px-3 py-2 text-sm text-left transition-colors flex items-center gap-2 text-foreground hover:bg-muted"
                    onClick={handleOpenNewWindow}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in new window
                  </button>
                  <button
                    className="w-full cursor-pointer px-3 py-2 text-sm text-left transition-colors flex items-center gap-2 text-foreground hover:bg-muted"
                    onClick={handleRenameClick}
                  >
                    <Pencil className="h-4 w-4" />
                    Rename
                  </button>
                  <button
                    className="w-full cursor-pointer px-3 py-2 text-sm text-left transition-colors flex items-center gap-2 text-destructive hover:bg-destructive/10"
                    onClick={handleDeleteClick}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="py-0.5">
              {threadsCache.status === "loading" && (
                <div className="pl-9 pr-2 py-1 text-[11px] text-muted-foreground">
                  loading…
                </div>
              )}
              {threadsCache.status === "error" && (
                <div className="pl-9 pr-2 py-1 text-[11px] text-destructive">
                  {threadsCache.message}
                </div>
              )}
              {threadsCache.status === "ready" && threads.length === 0 && (
                <div className="pl-9 pr-2 py-1 text-[11px] text-muted-foreground">
                  no threads yet
                </div>
              )}
              {threadsCache.status === "ready" && threads.length > 0 && (
                <ThreadList
                  threads={threads}
                  onSelect={(startNodeId) =>
                    onThreadSelect(canvas.id, startNodeId)
                  }
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
