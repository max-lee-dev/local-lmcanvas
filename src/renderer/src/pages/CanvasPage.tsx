import { useEffect, useRef, useState } from "react";
import { Globe, Settings } from "lucide-react";
import { CanvasPane } from "@/components/Canvas/CanvasPane";
import { SplitDivider } from "@/components/Canvas/SplitDivider";
import { SettingsModal } from "@/components/SettingsModal";
import { BrowserPanel } from "@/components/BrowserPanel/BrowserPanel";
import { NodePanel } from "@/components/NodePanel/NodePanel";
import { CanvasManager } from "@/components/CanvasManager/CanvasManager";
import { SplitPanePicker } from "@/components/CanvasManager/SplitPanePicker";
import { useActivePaneStore } from "@/hooks/useActivePane";
import { useBrowserPanelStore } from "@/hooks/useBrowserPanelStore";
import {
  TIMELINE_PANEL_WIDTH,
  useTimelinePanelStore,
} from "@/hooks/useTimelinePanelStore";
import { TimelinePanel } from "@/components/TimelinePanel/TimelinePanel";
import { useActiveSelectedNodeId } from "@/hooks/useActiveSelectedNode";
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
  const [nodePanelWidth, setNodePanelWidth] = useState<number | null>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const activePaneId = useActivePaneStore((s) => s.activePaneId);
  const browserOpen = useBrowserPanelStore((s) => s.open);
  const toggleBrowser = useBrowserPanelStore((s) => s.toggle);
  const timelineOpen = useTimelinePanelStore((s) => s.open);
  const selectedNodeId = useActiveSelectedNodeId();
  // Either drawer occupies the same right slot. When a node is selected, the
  // NodePanel takes priority over the (toggled) BrowserPanel.
  const nodeDrawerOpen = selectedNodeId !== null;
  const rightDrawerOpen = nodeDrawerOpen || browserOpen;
  // The timeline panel sits on the far right edge. When open, the
  // NodePanel/BrowserPanel + the top-right control cluster shift inward by
  // its width so nothing overlaps.
  const timelineOffset = timelineOpen ? TIMELINE_PANEL_WIDTH : 0;
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

      {/* Top-right: browser toggle + global settings. Shifted left in split
          mode so it never crowds the left pane's right-anchored search button
          when the divider is dragged close to the right edge. Shifted further
          left when the browser panel is open so the buttons stay accessible.
          Also shifted left by the timeline panel's width when it's open. */}
      <div
        className="absolute top-3 z-50 no-drag flex items-center gap-1"
        style={{
          right: nodeDrawerOpen
            ? nodePanelWidth !== null
              ? nodePanelWidth + 12 + timelineOffset
              : `calc(50% + 12px + ${timelineOffset}px)`
            : rightDrawerOpen
              ? `calc(33.333% + 12px + ${timelineOffset}px)`
            : (isSplit ? 48 : 12) + timelineOffset,
        }}
      >
        <button
          onClick={toggleBrowser}
          className={`flex h-7 w-7 items-center justify-center rounded-md cursor-pointer ${
            browserOpen
              ? "bg-muted text-foreground"
              : "text-foreground/70 hover:text-foreground hover:bg-muted"
          }`}
          title={browserOpen ? "hide browser" : "show browser"}
        >
          <Globe size={14} />
        </button>
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

      {/* Right drawer: NodePanel takes priority when a node is selected;
          otherwise the BrowserPanel renders per its own open/closed state.
          Both drawers shift inward by the timeline panel's width when it's
          open, so all three (drawer + timeline + canvas) coexist cleanly. */}
      {nodeDrawerOpen ? (
        <NodePanel
          rightOffset={timelineOffset}
          width={nodePanelWidth}
          onWidthChange={setNodePanelWidth}
        />
      ) : (
        <BrowserPanel rightOffset={timelineOffset} />
      )}

      <TimelinePanel />

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <SplitPanePicker
        open={showSplitPicker}
        onClose={() => setShowSplitPicker(false)}
        excludeIds={ids}
      />
    </div>
  );
}
