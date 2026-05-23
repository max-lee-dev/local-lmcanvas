import { useEffect } from "react";
import { create } from "zustand";
import type { CanvasStoreApi } from "./useCanvasStore";
import { useActivePaneStore } from "./useActivePane";

type PaneRegistryState = {
  /** Each mounted CanvasPane registers its store API here so components
   *  rendered outside the pane (like the right-side NodePanel drawer) can
   *  reach into the active pane's state. */
  stores: Record<string, CanvasStoreApi>;
  register: (paneId: string, api: CanvasStoreApi) => void;
  unregister: (paneId: string) => void;
};

export const usePaneRegistry = create<PaneRegistryState>((set) => ({
  stores: {},
  register: (paneId, api) =>
    set((s) => ({ stores: { ...s.stores, [paneId]: api } })),
  unregister: (paneId) =>
    set((s) => {
      if (!(paneId in s.stores)) return s;
      const next = { ...s.stores };
      delete next[paneId];
      return { stores: next };
    }),
}));

/** Mounted inside a CanvasPane to publish its store to the registry. */
export function useRegisterPaneStore(paneId: string, api: CanvasStoreApi) {
  const register = usePaneRegistry((s) => s.register);
  const unregister = usePaneRegistry((s) => s.unregister);
  useEffect(() => {
    register(paneId, api);
    return () => unregister(paneId);
  }, [paneId, api, register, unregister]);
}

/** Read the active pane's store API, if any. */
export function useActivePaneStoreApi(): CanvasStoreApi | null {
  const activeId = useActivePaneStore((s) => s.activePaneId);
  const api = usePaneRegistry((s) =>
    activeId ? s.stores[activeId] ?? null : null,
  );
  return api;
}
