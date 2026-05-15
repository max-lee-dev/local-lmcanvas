import { createContext, createElement, useContext, type ReactNode } from "react";
import { create } from "zustand";

type ActivePaneState = {
  /** The canvas-id of the pane currently owning global affordances (⌘K, ⌘F,
   *  delete modal, etc.). Null only briefly on first paint. */
  activePaneId: string | null;
  setActive: (id: string) => void;
  clear: () => void;
};

export const useActivePaneStore = create<ActivePaneState>((set) => ({
  activePaneId: null,
  setActive: (id) => set({ activePaneId: id }),
  clear: () => set({ activePaneId: null }),
}));

/** Default `""` means "no pane wrapping me" — single-canvas legacy callers
 *  outside any pane still work, just never gated as active. */
const PaneContext = createContext<string>("");

export function PaneProvider({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return createElement(PaneContext.Provider, { value: id }, children);
}

/** The canvas-id of the pane the current component belongs to. */
export function usePaneId(): string {
  return useContext(PaneContext);
}

/** Whether the current pane is the active one. */
export function useIsActivePane(): boolean {
  const myId = useContext(PaneContext);
  const activeId = useActivePaneStore((s) => s.activePaneId);
  return myId !== "" && myId === activeId;
}
