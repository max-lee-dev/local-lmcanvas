import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PanelLeft, Plus, Settings } from "lucide-react";
import type { Canvas, CanvasSummary } from "@shared/types";
import { navigateToCanvas } from "@/lib/canvasNavigation";
import { SettingsModal } from "@/components/SettingsModal";
import { useFocusRequestStore } from "@/hooks/useFocusRequestStore";
import { CanvasItem } from "./CanvasItem";
import { CanvasSearch, type CanvasSearchRef } from "./CanvasSearch";
import { DeleteCanvasModal } from "./DeleteCanvasModal";
import { onOpenSettings } from "@/lib/openSettings";

type CanvasManagerProps = {
  /** Canvas id of the currently-open canvas, if any. */
  currentCanvasId?: string | null;
  /** If true, the panel is open by default on mount. */
  defaultOpen?: boolean;
  /** Notified whenever the panel opens or closes. */
  onOpenChange?: (isOpen: boolean) => void;
};

export function CanvasManager({
  currentCanvasId = null,
  defaultOpen = false,
  onOpenChange,
}: CanvasManagerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);
  useEffect(() => onOpenSettings(() => setShowSettings(true)), []);
  const [isLargeScreen, setIsLargeScreen] = useState(true);
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [deletingCanvasId, setDeletingCanvasId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const searchRef = useRef<CanvasSearchRef>(null);
  const requestFocus = useFocusRequestStore((s) => s.requestFocus);

  const refresh = async () => {
    setIsLoading(true);
    const list = await window.api.canvases.list();
    setCanvases(list);
    setIsLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const check = () => setIsLargeScreen(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const currentCanvas = useMemo(
    () => canvases.find((c) => c.id === currentCanvasId) ?? null,
    [canvases, currentCanvasId],
  );

  const filteredCanvases = useMemo(() => {
    const sorted = [...canvases].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => (c.name ?? "").toLowerCase().includes(q));
  }, [canvases, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;
  const noResults = isSearching && filteredCanvases.length === 0;

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const c = await window.api.canvases.create({});
      await refresh();
      navigateToCanvas(c.id);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelect = (canvas: CanvasSummary) => {
    searchRef.current?.close();
    navigateToCanvas(canvas.id);
  };

  const handleThreadSelect = (canvasId: string, startNodeId: string) => {
    if (canvasId !== currentCanvasId) {
      navigateToCanvas(canvasId);
    }
    requestFocus(canvasId, startNodeId);
  };

  const handleRename = async (id: string, newName: string) => {
    const canvas: Canvas | null = await window.api.canvases.read(id);
    if (!canvas) return;
    await window.api.canvases.write({ ...canvas, name: newName });
    void refresh();
  };

  const handleDelete = (id: string, name: string) => {
    setPendingDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    setDeletingCanvasId(id);
    try {
      await window.api.canvases.delete(id);
      void refresh();
    } finally {
      setDeletingCanvasId(null);
    }
  };

  return (
    <>
      {/* Toggle Button — sits to the right of the macOS traffic lights, vertically centered with them */}
      <motion.button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed cursor-pointer top-[6px] left-[88px] z-50 h-6 w-6 rounded-md flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-muted no-drag focus:outline-none"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        <PanelLeft className="h-4 w-4" />
      </motion.button>

      {/* Side Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {!isLargeScreen && (
              <motion.div
                className="fixed inset-0 z-30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setIsOpen(false)}
              />
            )}
            <motion.div
              className="fixed left-0 top-0 h-screen w-80 border-r border-border shadow-lg z-40 flex flex-col bg-card no-drag"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              {/* Header */}
              <div className="flex items-center h-10 justify-between px-4 border-b border-border bg-card app-drag">
                <h2 className="pl-[104px] text-sm font-normal truncate text-foreground no-drag">
                  {currentCanvas?.name}
                </h2>
              </div>

              {/* Create canvas section */}
              <div className="p-2">
                <div className="relative my-2 flex h-11 w-full px-1">
                  <motion.button
                    onClick={() => void handleCreate()}
                    disabled={isCreating}
                    className="flex-1 cursor-pointer h-11 px-3 hover:opacity-90 rounded-md disabled:opacity-50 transition-colors bg-primary text-primary-foreground border-0"
                    title="Create new canvas"
                    whileHover={isCreating ? {} : { scale: 1.01 }}
                    whileTap={isCreating ? {} : { scale: 0.99 }}
                  >
                    <div className="flex justify-center items-center gap-1.5">
                      <div className="rounded-full">
                        <Plus className="h-5 w-5" />
                      </div>
                      <span className="text-md pb-0 font-normal">
                        New canvas
                      </span>
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Canvas list */}
              <div className="flex-1 overflow-y-auto px-3">
                <CanvasSearch
                  ref={searchRef}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />

                {isLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    loading…
                  </div>
                ) : noResults ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No chats match &quot;{searchQuery}&quot;
                  </div>
                ) : filteredCanvases.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No canvases yet. Click <span className="font-medium">New canvas</span> to start.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {filteredCanvases.map((c) => (
                      <CanvasItem
                        key={c.id}
                        canvas={c}
                        isSelected={c.id === currentCanvasId}
                        isDeleting={deletingCanvasId === c.id}
                        onSelect={() => handleSelect(c)}
                        onRename={(newName) => handleRename(c.id, newName)}
                        onDelete={() => handleDelete(c.id, c.name)}
                        onThreadSelect={handleThreadSelect}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-2 border-t border-border">
                <button
                  onClick={() => setShowSettings(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm text-foreground cursor-pointer"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />

      <DeleteCanvasModal
        isOpen={pendingDelete !== null}
        canvasName={pendingDelete?.name ?? ""}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
