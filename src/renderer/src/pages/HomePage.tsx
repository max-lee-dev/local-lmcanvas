import { useEffect, useState } from "react";
import { Plus, Trash2, Settings, Pencil, Check, X, Folder } from "lucide-react";
import type { Canvas, CanvasSummary } from "@shared/types";
import { SettingsModal } from "@/components/SettingsModal";
import { navigate } from "@/App";
import { prettyPath } from "@/lib/prettyPath";

type DraftCanvas = { name: string; cwd: string };

export function HomePage() {
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [draft, setDraft] = useState<DraftCanvas | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const list = await window.api.canvases.list();
    setCanvases(list);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const beginCreate = () => {
    setDraft({ name: "", cwd: "" });
  };

  const cancelCreate = () => {
    setDraft(null);
  };

  const pickFolder = async () => {
    const folder = await window.api.dialog.pickFolder();
    if (!folder) return;
    setDraft((d) => (d ? { ...d, cwd: folder } : { name: "", cwd: folder }));
  };

  const submitCreate = async () => {
    if (!draft) return;
    const name = draft.name.trim() || "untitled canvas";
    if (!draft.cwd) return;
    setCreating(true);
    try {
      const c = await window.api.canvases.create({ name, cwd: draft.cwd });
      navigate(`/canvas/${c.id}`);
    } finally {
      setCreating(false);
    }
  };

  const deleteCanvas = async (id: string, name: string) => {
    if (!confirm(`delete "${name}"? this cannot be undone.`)) return;
    await window.api.canvases.delete(id);
    void refresh();
  };

  const startRename = (c: CanvasSummary) => {
    setRenamingId(c.id);
    setRenameValue(c.name);
  };

  const commitRename = async (id: string) => {
    const name = renameValue.trim() || "untitled canvas";
    const canvas: Canvas | null = await window.api.canvases.read(id);
    if (!canvas) return;
    await window.api.canvases.write({ ...canvas, name });
    setRenamingId(null);
    void refresh();
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-10">
      <header className="mb-8 flex items-center justify-between app-drag">
        <div className="no-drag">
          <h1 className="text-xl font-semibold">local-lmcanvas</h1>
          <p className="text-xs text-zinc-500">branching AI conversations, stored locally</p>
        </div>
        <div className="flex items-center gap-2 no-drag">
          <button
            onClick={() => setShowSettings(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 hover:bg-zinc-50"
            title="settings"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={beginCreate}
            disabled={!!draft}
            className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            <Plus size={12} />
            new canvas
          </button>
        </div>
      </header>

      {draft && (
        <div className="mb-4 rounded-md border border-zinc-300 bg-zinc-50 p-3">
          <div className="mb-2 text-xs font-medium text-zinc-700">new canvas</div>
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.cwd) void submitCreate();
                if (e.key === "Escape") cancelCreate();
              }}
              placeholder="canvas name"
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => void pickFolder()}
                className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs hover:bg-zinc-100"
              >
                <Folder size={12} />
                {draft.cwd ? "change folder" : "pick folder"}
              </button>
              <div
                className="flex-1 truncate text-xs text-zinc-500"
                title={draft.cwd}
              >
                {draft.cwd ? prettyPath(draft.cwd) : "no folder selected"}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={cancelCreate}
                className="rounded-md px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                cancel
              </button>
              <button
                onClick={() => void submitCreate()}
                disabled={!draft.cwd || creating}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {creating ? "creating…" : "create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-zinc-400">loading…</div>}

      {!loading && canvases.length === 0 && !draft && (
        <div className="rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          no canvases yet. click <span className="font-medium">new canvas</span> to start.
        </div>
      )}

      {!loading && canvases.length > 0 && (
        <div className="flex flex-col gap-1">
          {canvases.map((c) => {
            const isRenaming = renamingId === c.id;
            return (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 hover:bg-zinc-50"
              >
                {isRenaming ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commitRename(c.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500"
                    />
                    <button
                      onClick={() => void commitRename(c.id)}
                      className="flex h-7 w-7 items-center justify-center rounded text-green-600 hover:bg-green-50"
                      title="save"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setRenamingId(null)}
                      className="flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-100"
                      title="cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => navigate(`/canvas/${c.id}`)}
                      className="flex-1 text-left"
                    >
                      <div className="text-sm font-medium">{c.name || "untitled"}</div>
                      <div
                        className="truncate text-[11px] text-zinc-500"
                        title={c.cwd}
                      >
                        {c.cwd ? prettyPath(c.cwd) : "no folder"}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {c.nodeCount} node{c.nodeCount === 1 ? "" : "s"} · updated{" "}
                        {new Date(c.updatedAt).toLocaleString()}
                      </div>
                    </button>
                    <button
                      onClick={() => startRename(c)}
                      className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100"
                      title="rename"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteCanvas(c.id, c.name)}
                      className="flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50"
                      title="delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
