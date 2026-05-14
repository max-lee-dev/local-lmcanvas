import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal, Pencil, Trash2, Loader2, ExternalLink } from "lucide-react";
import type { CanvasSummary } from "@shared/types";
import { prettyPath } from "@/lib/prettyPath";

type CanvasItemProps = {
  canvas: CanvasSummary;
  isSelected: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onRename: (newName: string) => Promise<void>;
  onDelete: () => void;
};

export const CanvasItem = ({
  canvas,
  isSelected,
  isDeleting,
  onSelect,
  onRename,
  onDelete,
}: CanvasItemProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(canvas.name || "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isRenaming) {
      setNewName(canvas.name || "");
    }
  }, [canvas.name, isRenaming]);

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
    <div
      className={`flex items-center justify-between px-2 rounded-lg py-1 cursor-pointer transition-colors ${
        isSelected ? "bg-accent border border-accent/30" : "hover:bg-muted"
      }`}
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
      <div className="flex-1 min-w-0">
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
            <div
              className="text-[11px] text-muted-foreground truncate"
              title={canvas.cwd}
            >
              {canvas.cwd ? prettyPath(canvas.cwd) : "no folder"}
            </div>
          </div>
        )}
      </div>

      {!isRenaming && (
        <div className="relative ml-2">
          <motion.button
            ref={buttonRef}
            onClick={handleMenuClick}
            disabled={isDeleting}
            className={`p-1 cursor-pointer rounded disabled:opacity-50 disabled:cursor-not-allowed transition-opacity text-muted-foreground hover:bg-muted hover:text-foreground ${isHovered ? "opacity-100" : "opacity-0"}`}
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
  );
};
