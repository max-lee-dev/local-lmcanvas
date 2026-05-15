import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { CanvasPane } from "@/components/Canvas/CanvasPane";
import { SplitDivider } from "@/components/Canvas/SplitDivider";
import { SettingsModal } from "@/components/SettingsModal";
import { CanvasManager } from "@/components/CanvasManager/CanvasManager";
import { SplitPanePicker } from "@/components/CanvasManager/SplitPanePicker";
import { useActivePaneStore } from "@/hooks/useActivePane";
import { usePreferencesStore } from "@/hooks/usePreferencesStore";
import { onOpenSettings } from "@/lib/openSettings";
import { matchesShortcut } from "@/lib/shortcut";

type CanvasPageProps = {
  ids: [string] | [string, string];
};

/**
 * Top-level canvas route. Renders the sidebar + global settings + either a
 * single pane or two side-by-side panes with a draggable divider.
 */
export function CanvasPage({ ids }: CanvasPageProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [splitFraction, setSplitFraction] = useState(0.5);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const activePaneId = useActivePaneStore((s) => s.activePaneId);
  const splitPickerShortcut = usePreferencesStore(
    (s) => s.keybindings.splitPanePicker,
  );
  const isSplit = ids.length === 2;

  useEffect(() => onOpenSettings(() => setShowSettings(true)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Skip if a recorder/dialog already swallowed this (e.g. keybinding capture).
      if (e.defaultPrevented) return;
      if (matchesShortcut(e, splitPickerShortcut)) {
        e.preventDefault();
        setShowSplitPicker((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [splitPickerShortcut]);

  // Sidebar tracks whichever pane is active so highlight + sidebar actions
  // follow the user's focus.
  const sidebarCanvasId =
    isSplit && activePaneId === ids[1] ? ids[1] : ids[0];

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Invisible drag strip across the top for moving the window */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-12 z-10 app-drag" />

      {/* Sidebar (handles its own toggle button) */}
      <CanvasManager currentCanvasId={sidebarCanvasId} />

      {/* Top-right: global settings */}
      <div className="absolute top-3 right-3 z-50 no-drag flex items-center gap-1">
        <button
          onClick={() => setShowSettings(true)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-muted cursor-pointer"
          title="settings"
        >
          <Settings size={14} />
        </button>
      </div>

      {/* Panes */}
      <div ref={splitContainerRef} className="absolute inset-0 flex">
        {isSplit ? (
          <>
            <div style={{ width: `${splitFraction * 100}%` }} className="h-full">
              <CanvasPane key={`a-${ids[0]}`} id={ids[0]} splitMode />
            </div>
            <SplitDivider
              fraction={splitFraction}
              onFractionChange={setSplitFraction}
              containerRef={splitContainerRef}
            />
            <div className="h-full flex-1">
              <CanvasPane
                key={`b-${ids[1]}`}
                id={ids[1]}
                splitMode
                controlsSide="left"
              />
            </div>
          </>
        ) : (
          <div className="h-full w-full">
            <CanvasPane key={`main-${ids[0]}`} id={ids[0]} splitMode={false} />
          </div>
        )}
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <SplitPanePicker
        open={showSplitPicker}
        onClose={() => setShowSplitPicker(false)}
        excludeIds={ids}
      />
    </div>
  );
}
