import { create } from "zustand";

export type BranchRequest = {
  /** Pane that owns the parent node — only that pane consumes the request. */
  paneId: string;
  parentId: string;
  prefill: string;
  addedContext?: string;
  /** Unique id per emit so consumers can detect new requests via id change. */
  requestId: string;
};

type BranchRequestState = {
  pending: BranchRequest | null;
  request: (req: Omit<BranchRequest, "requestId">) => void;
  consume: (requestId: string) => void;
};

/** Drawer (outside any pane) publishes a branch request; each CanvasPane
 *  watches and consumes requests targeted at its paneId. This indirection
 *  keeps the drawer decoupled from the per-pane ReactFlow + canvas store
 *  hooks that the actual branch operation depends on. */
export const useBranchRequestStore = create<BranchRequestState>((set) => ({
  pending: null,
  request: (req) =>
    set({
      pending: {
        ...req,
        requestId: `br-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    }),
  consume: (requestId) =>
    set((s) => {
      if (!s.pending || s.pending.requestId !== requestId) return s;
      return { pending: null };
    }),
}));
