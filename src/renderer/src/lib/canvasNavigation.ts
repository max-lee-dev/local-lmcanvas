import { navigate } from "@/App";
import { useActivePaneStore } from "@/hooks/useActivePane";

/**
 * Read the current hash and return the canvas pane ids, if on a canvas route.
 */
export function getCurrentPaneIds(): string[] {
  const h = window.location.hash.replace(/^#/, "");
  if (!h.startsWith("/canvas/")) return [];
  const rest = h.slice("/canvas/".length);
  return rest.split("/").filter(Boolean).slice(0, 2);
}

/**
 * Index of the active pane in the current canvas route. Returns 0 if not
 * split or if the active pane id doesn't match either slot.
 */
function activeIndex(): 0 | 1 {
  const ids = getCurrentPaneIds();
  const active = useActivePaneStore.getState().activePaneId;
  if (ids.length === 2 && active === ids[1]) return 1;
  return 0;
}

/**
 * Navigate to `canvasId` in the active pane, preserving the other pane in
 * split mode. Falls back to single-pane if not currently on a canvas route.
 */
export function navigateToCanvas(canvasId: string): void {
  const ids = getCurrentPaneIds();
  if (ids.length < 2) return navigate(`/canvas/${canvasId}`);
  const idx = activeIndex();
  const [a, b] = ids;
  if (idx === 1) return navigate(`/canvas/${a}/${canvasId}`);
  return navigate(`/canvas/${canvasId}/${b}`);
}

/**
 * Open `canvasId` alongside the currently-open canvas as a split pane. If
 * already split, replaces the inactive pane so the focused pane stays put.
 */
export function openInSplit(canvasId: string): void {
  const ids = getCurrentPaneIds();
  if (ids.length === 0) return navigate(`/canvas/${canvasId}`);
  if (ids.length === 1) return navigate(`/canvas/${ids[0]}/${canvasId}`);
  const idx = activeIndex();
  const [a, b] = ids;
  // Replace the OTHER pane so the focused pane stays put.
  if (idx === 0) return navigate(`/canvas/${a}/${canvasId}`);
  return navigate(`/canvas/${canvasId}/${b}`);
}

/**
 * Close the pane currently showing `canvasId`, leaving the other open. No-op
 * if not split or that canvas isn't currently in a pane.
 */
export function closePane(canvasId: string): void {
  const ids = getCurrentPaneIds();
  if (ids.length < 2) return;
  const remaining = ids.find((x) => x !== canvasId);
  if (!remaining) return;
  navigate(`/canvas/${remaining}`);
}
