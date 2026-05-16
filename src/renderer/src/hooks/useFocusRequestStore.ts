import { create } from "zustand";

export type FocusRequest = {
  canvasId: string;
  nodeId: string;
  /** Monotonic counter so repeat clicks on the same node re-trigger. */
  requestedAt: number;
};

type FocusRequestState = {
  request: FocusRequest | null;
  requestFocus: (canvasId: string, nodeId: string) => void;
  /** Called by a pane after it has consumed the request. */
  consume: (canvasId: string, nodeId: string, requestedAt: number) => void;
};

export const useFocusRequestStore = create<FocusRequestState>((set) => ({
  request: null,
  requestFocus: (canvasId, nodeId) =>
    set({ request: { canvasId, nodeId, requestedAt: Date.now() } }),
  consume: (canvasId, nodeId, requestedAt) =>
    set((s) => {
      const r = s.request;
      if (!r) return s;
      if (
        r.canvasId === canvasId &&
        r.nodeId === nodeId &&
        r.requestedAt === requestedAt
      ) {
        return { request: null };
      }
      return s;
    }),
}));
