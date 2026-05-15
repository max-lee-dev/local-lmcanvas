import { useEffect, useRef, useState } from "react";
import { ChevronLeft, RotateCcw } from "lucide-react";
import {
  DEFAULT_KEYBINDINGS,
  usePreferencesStore,
  type KeybindingId,
} from "@/hooks/usePreferencesStore";
import { formatShortcut, shortcutFromEvent } from "@/lib/shortcut";
import { KEYBINDING_ROWS, type KeybindingRow } from "./keybindingRows";

type Props = {
  onBack: () => void;
};

export function KeybindingsPage({ onBack }: Props) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
          aria-label="back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold">keybindings</h2>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Click a shortcut to record a new combo. Press Escape to cancel.
      </p>
      <div className="flex flex-col gap-2">
        {KEYBINDING_ROWS.map((row) => (
          <KeybindingRowItem key={row.id} {...row} />
        ))}
      </div>
    </div>
  );
}

function KeybindingRowItem({ id, label, description }: KeybindingRow) {
  const shortcut = usePreferencesStore((s) => s.keybindings[id]);
  const setKeybinding = usePreferencesStore((s) => s.setKeybinding);
  const resetKeybinding = usePreferencesStore((s) => s.resetKeybinding);
  const [recording, setRecording] = useState(false);
  const isDefault = shortcut === DEFAULT_KEYBINDINGS[id];
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const next = shortcutFromEvent(e);
      if (!next) return;
      setKeybinding(id, next);
      setRecording(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, id, setKeybinding]);

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border bg-card border-border px-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs mt-0.5 text-muted-foreground">{description}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setRecording(true)}
          className={`min-w-[80px] rounded-md border px-2.5 py-1.5 text-center text-[11px] cursor-pointer ${
            recording
              ? "border-primary bg-primary/10 text-primary animate-pulse"
              : "border-border bg-background text-foreground hover:bg-secondary"
          }`}
        >
          {recording ? "press keys…" : formatShortcut(shortcut) || "unset"}
        </button>
        <button
          type="button"
          onClick={() => resetKeybinding(id)}
          disabled={isDefault}
          className={`rounded-md p-1.5 ${
            isDefault
              ? "text-muted-foreground/40 cursor-not-allowed"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
          }`}
          title={isDefault ? "already default" : "reset to default"}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
