import { create } from "zustand";
import type { AskUserAnswers, AskUserRequest } from "@shared/ipc";

type AskUserStoreState = {
  /** Active requests keyed by nodeId. One pending request per node at a time. */
  byNode: Record<string, AskUserRequest>;
  open: (req: AskUserRequest) => void;
  resolve: (id: string, answers: AskUserAnswers) => void;
  cancel: (id: string) => void;
  getForNode: (nodeId: string) => AskUserRequest | undefined;
};

export const useAskUserStore = create<AskUserStoreState>((set, get) => ({
  byNode: {},

  open: (req) =>
    set((s) => ({ byNode: { ...s.byNode, [req.nodeId]: req } })),

  resolve: (id, answers) => {
    const entry = findById(get().byNode, id);
    if (!entry) return;
    void window.api.askUser.respond({ id, cancelled: false, answers });
    set((s) => removeByNode(s.byNode, entry.nodeId));
  },

  cancel: (id) => {
    const entry = findById(get().byNode, id);
    if (!entry) return;
    void window.api.askUser.respond({ id, cancelled: true });
    set((s) => removeByNode(s.byNode, entry.nodeId));
  },

  getForNode: (nodeId) => get().byNode[nodeId],
}));

function findById(
  byNode: Record<string, AskUserRequest>,
  id: string,
): AskUserRequest | undefined {
  for (const req of Object.values(byNode)) {
    if (req.id === id) return req;
  }
  return undefined;
}

function removeByNode(
  byNode: Record<string, AskUserRequest>,
  nodeId: string,
): { byNode: Record<string, AskUserRequest> } {
  if (!(nodeId in byNode)) return { byNode };
  const next = { ...byNode };
  delete next[nodeId];
  return { byNode: next };
}

/** Subscribe to incoming askUser requests from the main process. Call once at app start. */
export function subscribeAskUserRequests(): () => void {
  return window.api.askUser.onRequest((req) => {
    useAskUserStore.getState().open(req);
  });
}
