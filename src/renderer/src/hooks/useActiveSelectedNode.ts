import { useStore } from "zustand";
import type { StoreApi } from "zustand";
import { createStore } from "zustand";
import type { CanvasNode } from "@shared/types";
import { useActivePaneStoreApi } from "./usePaneRegistry";

type WithSelected = CanvasNode & { selected?: boolean };

type SelectableState = { nodes: Record<string, CanvasNode> };

// Tiny stand-in store used when no pane is active so the hook can still run
// useStore unconditionally (hooks rule). The selector early-returns null.
const FALLBACK_STORE: StoreApi<SelectableState> = createStore<SelectableState>(
  () => ({ nodes: {} }),
);

/** Returns the id of the currently-selected node in the active pane, if
 *  exactly one node is selected. Null when zero, two-or-more, or no active
 *  pane. Drives the right-side NodePanel drawer's visibility. */
export function useActiveSelectedNodeId(): string | null {
  const api = useActivePaneStoreApi();
  const hasActive = api !== null;
  const target = (api as StoreApi<SelectableState> | null) ?? FALLBACK_STORE;
  return useStore(target, (s): string | null => {
    if (!hasActive) return null;
    let found: string | null = null;
    for (const id of Object.keys(s.nodes)) {
      const n = s.nodes[id] as WithSelected;
      if (n.selected && n.type === "custom") {
        if (found !== null) return null; // more than one — bail
        found = id;
      }
    }
    return found;
  });
}
