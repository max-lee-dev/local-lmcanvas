import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Plus, Timer, Trash2 } from "lucide-react";
import type { MenuOption } from "@/hooks/useContextMenu";

type ContextMenuOption = MenuOption & {
  id: string;
  icon?: React.ReactNode;
};

type ContextMenuProps = {
  isOpen: boolean;
  position: { x: number; y: number };
  rightClickedNodeId: string | null;
  createNodeAtPointer: (opts?: { isTemporary?: boolean }) => void;
  deleteNodeAtPointer: () => void;
  onClose: () => void;
};

export const ContextMenu = ({
  isOpen,
  position,
  rightClickedNodeId,
  createNodeAtPointer,
  deleteNodeAtPointer,
  onClose,
}: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  const menuOptions = useMemo<ContextMenuOption[]>(
    () => [
      {
        id: rightClickedNodeId ? "add_child_node" : "add_new_node",
        label: rightClickedNodeId ? "Add child node" : "Add new node",
        onClick: () => createNodeAtPointer(),
        icon: <Plus className="h-4 w-4" />,
      },
      {
        id: rightClickedNodeId
          ? "add_temporary_child_node"
          : "add_temporary_node",
        label: rightClickedNodeId
          ? "Add temporary child node"
          : "Add temporary node",
        onClick: () => createNodeAtPointer({ isTemporary: true }),
        icon: <Timer className="h-4 w-4" />,
      },
      ...(rightClickedNodeId
        ? [
            {
              id: "delete_node",
              label: "Delete node",
              onClick: deleteNodeAtPointer,
              icon: <Trash2 className="h-4 w-4" />,
            },
          ]
        : []),
    ],
    [rightClickedNodeId, createNodeAtPointer, deleteNodeAtPointer]
  );

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const primaryIndex = menuOptions.findIndex(
      (o) => o.id === "add_new_node" || o.id === "add_child_node"
    );
    let cursorOffsetY = menuRect.height / 2;
    if (primaryIndex >= 0) {
      const buttons = menuRef.current.querySelectorAll("button");
      const targetButton = buttons[primaryIndex];
      if (targetButton) {
        const btnRect = targetButton.getBoundingClientRect();
        cursorOffsetY = btnRect.top - menuRect.top + btnRect.height / 2;
      }
    }

    let x = position.x - menuRect.width / 2;
    let y = position.y - cursorOffsetY;

    if (x + menuRect.width > viewportWidth) {
      x = viewportWidth - menuRect.width - 10;
    }
    if (x < 10) {
      x = 10;
    }
    if (y + menuRect.height > viewportHeight) {
      y = viewportHeight - menuRect.height - 10;
    }
    if (y < 10) {
      y = 10;
    }

    setAdjustedPosition({ x, y });
  }, [isOpen, position, menuOptions]);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) {
        e.preventDefault();
      }
    };
    document.addEventListener("mousedown", handleMouseDown, true);
    return () => document.removeEventListener("mousedown", handleMouseDown, true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleContextMenuOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    document.addEventListener("contextmenu", handleContextMenuOutside, true);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside, true);
      document.removeEventListener("contextmenu", handleContextMenuOutside, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="fixed z-50 bg-card border border-border rounded-[10px] shadow-lg py-1 min-w-[180px]"
          style={{
            left: `${adjustedPosition.x}px`,
            top: `${adjustedPosition.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {menuOptions.map((option) => (
            <button
              key={option.id}
              onClick={(e) => {
                e.stopPropagation();
                if (!option.disabled) {
                  option.onClick();
                  onClose();
                }
              }}
              disabled={option.disabled}
              className={`w-full cursor-pointer text-left px-4 py-2 text-[12px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors ${
                option.label === "Delete node"
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {option.icon && <span className="w-4 h-4">{option.icon}</span>}
              <span>{option.label}</span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
