import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { AppSettings } from "@shared/types";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void window.api.settings.read().then(setSettings);
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    await window.api.settings.write(settings);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">settings</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-zinc-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-zinc-600">system prompt</label>
            <textarea
              value={settings.systemPrompt ?? ""}
              onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
              className="mt-1 min-h-[80px] w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm"
              placeholder="optional system prompt passed to every turn"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">claude binary path</label>
            <input
              value={settings.claudeBinPath ?? "claude"}
              onChange={(e) => setSettings({ ...settings, claudeBinPath: e.target.value })}
              className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm"
              placeholder="claude"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              usually just &quot;claude&quot;. if it&apos;s not in PATH, give the full path (e.g. /Users/you/.local/bin/claude).
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">model (optional)</label>
            <input
              value={settings.claudeModel ?? ""}
              onChange={(e) => setSettings({ ...settings, claudeModel: e.target.value })}
              className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm"
              placeholder="e.g. claude-opus-4-7, or blank for default"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-50 cursor-pointer"
          >
            cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-700 disabled:opacity-60 cursor-pointer"
          >
            {saving ? "saving…" : "save"}
          </button>
        </div>
      </div>
    </div>
  );
}
