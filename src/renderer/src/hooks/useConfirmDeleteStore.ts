import { create } from "zustand";
import type { NodeId } from "@shared/types";

type ConfirmDeleteState = {
  pendingId: NodeId | null;
  request: (id: NodeId) => void;
  clear: () => void;
};

export const useConfirmDeleteStore = create<ConfirmDeleteState>((set) => ({
  pendingId: null,
  request: (id) => set({ pendingId: id }),
  clear: () => set({ pendingId: null }),
}));
