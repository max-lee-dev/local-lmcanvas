import { create } from "zustand";
import type { NodeId } from "@shared/types";

type ConfirmDeleteState = {
  pendingIds: NodeId[];
  request: (ids: NodeId | NodeId[]) => void;
  clear: () => void;
};

export const useConfirmDeleteStore = create<ConfirmDeleteState>((set) => ({
  pendingIds: [],
  request: (ids) =>
    set({ pendingIds: Array.isArray(ids) ? [...ids] : [ids] }),
  clear: () => set({ pendingIds: [] }),
}));
