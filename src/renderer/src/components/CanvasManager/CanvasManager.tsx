import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder, Loader2, PanelLeft, Plus, Settings, X } from "lucide-react";
import type { Canvas, CanvasSummary, Provider } from "@shared/types";
import { navigate } from "@/App";
import { prettyPath } from "@/lib/prettyPath";
import { SettingsModal } from "@/components/SettingsModal";
import { CanvasItem } from "./CanvasItem";
import { CanvasSearch, type CanvasSearchRef } from "./CanvasSearch";
import { DeleteCanvasModal } from "./DeleteCanvasModal";
import { ProviderPicker } from "./ProviderPicker";
import { onOpenSettings } from "@/lib/openSettings";

type CanvasManagerProps = {
  /** Canvas id of the currently-open canvas, if any. */
  currentCanvasId?: string | null;
  /** If true, the panel is open by default on mount. */
  defaultOpen?: boolean;
  /** Notified whenever the panel opens or closes. */
  onOpenChange?: (isOpen: boolean) => void;
};

type DraftCanvas = { name: string; cwd: string; provider: Provider };

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
  const [draft, setDraft] = useState<DraftCanvas | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState<Provider>("claude");
  const searchRef = useRef<CanvasSearchRef>(null);

  const refresh = async () => {
    setIsLoading(true);
    const list = await window.api.canvases.list();
    setCanvases(list);
    setIsLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Pull the default provider preference so the new-canvas form pre-selects it.
  useEffect(() => {
    let cancelled = false;
    void window.api.settings.read().then((s) => {
      if (cancelled) return;
      if (s.defaultProvider) setDefaultProvider(s.defaultProvider);
    });
    return () => {
      cancelled = true;
    };
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

  const beginCreate = () => {
    setDraft({ name: "", cwd: "", provider: defaultProvider });
  };

  const cancelCreate = () => {
    setDraft(null);
  };

  const pickFolder = async () => {
    const folder = await window.api.dialog.pickFolder();
    if (!folder) return;
    setDraft((d) =>
      d
        ? { ...d, cwd: folder }
        : { name: "", cwd: folder, provider: defaultProvider },
    );
  };

  const submitCreate = async () => {
    if (!draft || !draft.cwd) return;
    const name = draft.name.trim() || "untitled canvas";
    setIsCreating(true);
    try {
      const c = await window.api.canvases.create({
        name,
        cwd: draft.cwd,
        provider: draft.provider,
      });
      setDraft(null);
      navigate(`/canvas/${c.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelect = (canvas: CanvasSummary) => {
    searchRef.current?.close();
    navigate(`/canvas/${canvas.id}`);
  };

  const handleRename = async (id: string, newName: string) => {
    const canvas: Canvas | null = await window.api.canvases.read(id);
    if (!canvas) return;
    await window.api.canvases.write({ ...canvas, name: newName });
    void refresh();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`delete "${name}"? this cannot be undone.`)) return;
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
                    onClick={beginCreate}
                    disabled={!!draft}
                    className="flex-1 cursor-pointer h-11 px-3 hover:opacity-90 rounded-md disabled:opacity-50 transition-colors bg-primary text-primary-foreground border-0"
                    title="Create new canvas"
                    whileHover={draft ? {} : { scale: 1.01 }}
                    whileTap={draft ? {} : { scale: 0.99 }}
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

                {/* Inline draft creation */}
                <AnimatePresence>
                  {draft && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="mx-1 mb-2 rounded-md border border-border bg-background p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground">
                            new canvas
                          </span>
                          <button
                            onClick={cancelCreate}
                            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                            title="cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <input
                            autoFocus
                            value={draft.name}
                            onChange={(e) =>
                              setDraft({ ...draft, name: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && draft.cwd)
                                void submitCreate();
                              if (e.key === "Escape") cancelCreate();
                            }}
                            placeholder="canvas name"
                            className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => void pickFolder()}
                              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground hover:bg-muted cursor-pointer"
                            >
                              <Folder size={12} />
                              {draft.cwd ? "change folder" : "pick folder"}
                            </button>
                            <div
                              className="flex-1 truncate text-xs text-muted-foreground"
                              title={draft.cwd}
                            >
                              {draft.cwd
                                ? prettyPath(draft.cwd)
                                : "no folder selected"}
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                              provider
                            </div>
                            <ProviderPicker
                              value={draft.provider}
                              onChange={(p) =>
                                setDraft({ ...draft, provider: p })
                              }
                            />
                          </div>
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => void submitCreate()}
                              disabled={!draft.cwd || isCreating}
                              className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                            >
                              {isCreating ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  creating…
                                </>
                              ) : (
                                "create"
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
    </>
  );
}
