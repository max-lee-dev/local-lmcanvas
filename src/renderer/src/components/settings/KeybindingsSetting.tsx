import { ChevronRight, Keyboard } from "lucide-react";
import { usePreferencesStore } from "@/hooks/usePreferencesStore";
import { formatShortcut } from "@/lib/shortcut";
import { KEYBINDING_ROWS } from "./keybindingRows";

type Props = {
  onOpen: () => void;
};

export function KeybindingsSetting({ onOpen }: Props) {
  const keybindings = usePreferencesStore((s) => s.keybindings);
  const summary =
    KEYBINDING_ROWS.length === 1
      ? formatShortcut(keybindings[KEYBINDING_ROWS[0].id])
      : `${KEYBINDING_ROWS.length} shortcuts`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center justify-between w-full px-3 py-3 rounded-xl border bg-card border-border text-left hover:bg-muted/40 cursor-pointer transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">
          <Keyboard className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">Keybindings</div>
          <div className="text-xs mt-0.5 text-muted-foreground">
            Customize keyboard shortcuts.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
          {summary}
        </span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </button>
  );
}
