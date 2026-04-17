"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";
import { Canvas } from "@/components/Canvas/Canvas";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { SettingsModal } from "@/components/SettingsModal";

export default function CanvasPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const loaded = useCanvasStore((s) => s.loaded);
  const canvasId = useCanvasStore((s) => s.canvasId);
  const name = useCanvasStore((s) => s.name);
  const setName = useCanvasStore((s) => s.setName);
  const error = useCanvasStore((s) => s.error);
  const saving = useCanvasStore((s) => s.saving);
  const nodeCount = useCanvasStore((s) => Object.keys(s.nodes).length);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (id && canvasId !== id) void loadCanvas(id);
  }, [id, canvasId, loadCanvas]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-100">
            <ArrowLeft size={14} />
          </Link>
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
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-100"
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
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div className="pointer-events-none rounded-md bg-white/80 px-4 py-2 text-xs text-zinc-500 shadow-sm">
                  double-click anywhere to create your first node
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
