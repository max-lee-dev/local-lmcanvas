import { useEffect, useState } from "react";
import { Plus, Settings } from "lucide-react";
import { Canvas } from "@/components/Canvas/Canvas";
import { makeBlankNode, useCanvasStore } from "@/hooks/useCanvasStore";
import { SettingsModal } from "@/components/SettingsModal";
import { SearchButton } from "@/components/Canvas/SearchModal";
import { CanvasManager } from "@/components/CanvasManager/CanvasManager";
import { CanvasBreadcrumb } from "@/components/CanvasManager/CanvasBreadcrumb";
import { DeleteNodeModal } from "@/components/Canvas/DeleteNodeModal";
import { onOpenSettings } from "@/lib/openSettings";

export function CanvasPage({ id }: { id: string }) {
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const loaded = useCanvasStore((s) => s.loaded);
  const canvasId = useCanvasStore((s) => s.canvasId);
  const cwd = useCanvasStore((s) => s.cwd);
  const error = useCanvasStore((s) => s.error);
  const saving = useCanvasStore((s) => s.saving);
  const nodeCount = useCanvasStore((s) => Object.keys(s.nodes).length);
  const addNode = useCanvasStore((s) => s.addNode);
  const [showSettings, setShowSettings] = useState(false);

  const createFirstNode = () => {
    addNode(makeBlankNode({ x: 0, y: 0 }));
  };

  useEffect(() => {
    if (id && canvasId !== id) void loadCanvas(id);
  }, [id, canvasId, loadCanvas]);

  useEffect(() => onOpenSettings(() => setShowSettings(true)), []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Invisible drag strip across the top of the window for moving the window */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-12 z-10 app-drag" />

      {/* Sidebar (handles its own toggle button) */}
      <CanvasManager currentCanvasId={id} />

      {/* Top-center: breadcrumb pill with canvas switcher dropdown on hover */}
      {(cwd || saving) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 no-drag">
          <CanvasBreadcrumb
            cwd={cwd}
            currentCanvasId={id}
            saving={saving}
          />
        </div>
      )}

      {/* Top-right: search + settings */}
      <div className="absolute top-3 right-3 z-30 no-drag flex items-center gap-1">
        <SearchButton />
        <button
          onClick={() => setShowSettings(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-muted cursor-pointer"
          title="settings"
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Canvas — fills the entire window */}
      <div className="absolute inset-0">
        {!loaded && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            loading…
          </div>
        )}
        {loaded && error && (
          <div className="flex h-full items-center justify-center text-sm text-destructive">
            {error}
          </div>
        )}
        {loaded && !error && (
          <>
            {nodeCount === 0 && (
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
                <button
                  onClick={createFirstNode}
                  className="pointer-events-auto flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground shadow-md hover:opacity-90 cursor-pointer"
                >
                  <Plus size={14} />
                  new node
                </button>
                <div className="pointer-events-none text-xs text-muted-foreground">
                  or double-click anywhere on the canvas
                </div>
              </div>
            )}
            <Canvas />
          </>
        )}
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <DeleteNodeModal />
    </div>
  );
}
