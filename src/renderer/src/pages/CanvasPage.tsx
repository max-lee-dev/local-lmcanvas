import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Settings } from "lucide-react";
import { Canvas } from "@/components/Canvas/Canvas";
import { makeBlankNode, useCanvasStore } from "@/hooks/useCanvasStore";
import { SettingsModal } from "@/components/SettingsModal";
import { navigate } from "@/App";

export function CanvasPage({ id }: { id: string }) {
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const loaded = useCanvasStore((s) => s.loaded);
  const canvasId = useCanvasStore((s) => s.canvasId);
  const name = useCanvasStore((s) => s.name);
  const setName = useCanvasStore((s) => s.setName);
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

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2 app-drag">
        <div className="flex items-center gap-3 no-drag">
          <button
            onClick={() => navigate("/")}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-100"
            title="back"
          >
            <ArrowLeft size={14} />
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-[240px] bg-transparent text-sm font-semibold outline-none"
            placeholder="untitled canvas"
          />
          <span className="text-xs text-zinc-400">
            {saving ? "saving…" : nodeCount === 0 ? "empty" : `${nodeCount} node${nodeCount === 1 ? "" : "s"}`}
          </span>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-100 no-drag"
          title="settings"
        >
          <Settings size={14} />
        </button>
      </header>
      <div className="relative flex-1">
        {!loaded && (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">loading…</div>
        )}
        {loaded && error && (
          <div className="flex h-full items-center justify-center text-sm text-red-500">{error}</div>
        )}
        {loaded && !error && (
          <>
            {nodeCount === 0 && (
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
                <button
                  onClick={createFirstNode}
                  className="pointer-events-auto flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white shadow-md hover:bg-zinc-700"
                >
                  <Plus size={14} />
                  new node
                </button>
                <div className="pointer-events-none text-xs text-zinc-500">
                  or double-click anywhere on the canvas
                </div>
              </div>
            )}
            <Canvas />
          </>
        )}
      </div>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
