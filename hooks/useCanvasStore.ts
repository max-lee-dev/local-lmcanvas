"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
  Canvas,
  CanvasEdge,
  CanvasNode,
  Message,
  NodeId,
} from "@/lib/graph/types";
import { getMessageHistoryForNode } from "@/lib/graph/history";

type Dirty = { count: number; lastChangeAt: number };

export type CanvasStoreState = {
  canvasId: string | null;
  name: string;
  createdAt: number;
  nodes: Record<NodeId, CanvasNode>;
  edges: CanvasEdge[];
  loaded: boolean;
  dirty: Dirty;
  saving: boolean;
  error: string | null;
  pendingPrefills: Record<NodeId, string>;

  loadCanvas: (id: string) => Promise<void>;
  setName: (name: string) => void;
  addNode: (node: CanvasNode) => void;
  patchNode: (id: NodeId, patch: Partial<CanvasNode["data"]>) => void;
  movePosition: (id: NodeId, pos: { x: number; y: number }) => void;
  removeNode: (id: NodeId) => void;
  connectEdge: (source: NodeId, target: NodeId) => void;
  appendMessage: (nodeId: NodeId, msg: Message) => void;
  appendDeltaToMessage: (nodeId: NodeId, messageId: string, delta: string) => void;
  finalizeMessage: (nodeId: NodeId, messageId: string, fullText?: string) => void;
  errorMessage: (nodeId: NodeId, messageId: string, error: string) => void;
  getHistoryForNode: (id: NodeId) => Message[];
  serialize: () => Canvas | null;
  markDirty: () => void;
  save: () => Promise<void>;
  setPrefill: (nodeId: NodeId, text: string) => void;
  consumePrefill: (nodeId: NodeId) => string | undefined;
};

function makeEdgeId(source: NodeId, target: NodeId): string {
  return `e-${source}-${target}`;
}

function canvasFromState(s: CanvasStoreState): Canvas | null {
  if (!s.canvasId) return null;
  return {
    id: s.canvasId,
    name: s.name,
    createdAt: s.createdAt,
    updatedAt: Date.now(),
    nodes: Object.values(s.nodes),
    edges: s.edges,
  };
}

export const useCanvasStore = create<CanvasStoreState>()(
  subscribeWithSelector((set, get) => ({
    canvasId: null,
    name: "",
    createdAt: 0,
    nodes: {},
    edges: [],
    loaded: false,
    dirty: { count: 0, lastChangeAt: 0 },
    saving: false,
    error: null,
    pendingPrefills: {},

    loadCanvas: async (id: string) => {
      set({ loaded: false, error: null });
      const res = await fetch(`/api/canvases/${id}`);
      if (!res.ok) {
        set({ error: `Failed to load canvas ${id}`, loaded: true });
        return;
      }
      const canvas = (await res.json()) as Canvas;
      const nodes: Record<NodeId, CanvasNode> = {};
      for (const n of canvas.nodes) {
        const sanitized: CanvasNode = {
          ...n,
          data: {
            ...n.data,
            chat: {
              ...n.data.chat,
              messages: n.data.chat.messages.map((m) =>
                m.status === "streaming"
                  ? { ...m, status: "error" as const, error: "interrupted" }
                  : m
              ),
            },
          },
        };
        nodes[n.id] = sanitized;
      }
      set({
        canvasId: canvas.id,
        name: canvas.name,
        createdAt: canvas.createdAt,
        nodes,
        edges: canvas.edges,
        loaded: true,
        dirty: { count: 0, lastChangeAt: 0 },
      });
    },

    setName: (name) => {
      set({ name });
      get().markDirty();
    },

    addNode: (node) => {
      set((s) => ({ nodes: { ...s.nodes, [node.id]: node } }));
      get().markDirty();
    },

    patchNode: (id, patch) => {
      set((s) => {
        const existing = s.nodes[id];
        if (!existing) return s;
        return {
          nodes: {
            ...s.nodes,
            [id]: { ...existing, data: { ...existing.data, ...patch } },
          },
        };
      });
      get().markDirty();
    },

    movePosition: (id, pos) => {
      set((s) => {
        const existing = s.nodes[id];
        if (!existing) return s;
        return {
          nodes: { ...s.nodes, [id]: { ...existing, position: pos } },
        };
      });
      get().markDirty();
    },

    removeNode: (id) => {
      set((s) => {
        const nodes = { ...s.nodes };
        delete nodes[id];
        // clean parent/child references
        for (const nid of Object.keys(nodes)) {
          const n = nodes[nid];
          const parentIds = n.data.chat.parentIds.filter((p) => p !== id);
          const childIds = n.data.chat.childIds.filter((p) => p !== id);
          if (
            parentIds.length !== n.data.chat.parentIds.length ||
            childIds.length !== n.data.chat.childIds.length
          ) {
            nodes[nid] = {
              ...n,
              data: {
                ...n.data,
                chat: { ...n.data.chat, parentIds, childIds },
              },
            };
          }
        }
        const edges = s.edges.filter((e) => e.source !== id && e.target !== id);
        return { nodes, edges };
      });
      get().markDirty();
    },

    connectEdge: (source, target) => {
      set((s) => {
        if (source === target) return s;
        if (!s.nodes[source] || !s.nodes[target]) return s;
        const id = makeEdgeId(source, target);
        if (s.edges.some((e) => e.id === id)) return s;
        const edges = [...s.edges, { id, source, target }];
        const nodes = { ...s.nodes };
        const parent = nodes[source];
        nodes[source] = {
          ...parent,
          data: {
            ...parent.data,
            chat: {
              ...parent.data.chat,
              childIds: parent.data.chat.childIds.includes(target)
                ? parent.data.chat.childIds
                : [...parent.data.chat.childIds, target],
            },
          },
        };
        const child = nodes[target];
        nodes[target] = {
          ...child,
          data: {
            ...child.data,
            chat: {
              ...child.data.chat,
              parentIds: child.data.chat.parentIds.includes(source)
                ? child.data.chat.parentIds
                : [...child.data.chat.parentIds, source],
            },
          },
        };
        return { edges, nodes };
      });
      get().markDirty();
    },

    appendMessage: (nodeId, msg) => {
      set((s) => {
        const n = s.nodes[nodeId];
        if (!n) return s;
        return {
          nodes: {
            ...s.nodes,
            [nodeId]: {
              ...n,
              data: {
                ...n.data,
                title: n.data.title || (msg.role === "user" ? msg.content.slice(0, 60) : n.data.title),
                chat: {
                  ...n.data.chat,
                  messages: [...n.data.chat.messages, msg],
                },
              },
            },
          },
        };
      });
      get().markDirty();
    },

    appendDeltaToMessage: (nodeId, messageId, delta) => {
      set((s) => {
        const n = s.nodes[nodeId];
        if (!n) return s;
        const messages = n.data.chat.messages.map((m) =>
          m.id === messageId ? { ...m, content: m.content + delta } : m
        );
        return {
          nodes: {
            ...s.nodes,
            [nodeId]: {
              ...n,
              data: { ...n.data, chat: { ...n.data.chat, messages } },
            },
          },
        };
      });
      // streaming deltas are frequent; mark dirty but defer save
      get().markDirty();
    },

    finalizeMessage: (nodeId, messageId, fullText) => {
      set((s) => {
        const n = s.nodes[nodeId];
        if (!n) return s;
        const messages = n.data.chat.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: fullText && fullText.length > m.content.length ? fullText : m.content,
                status: "complete" as const,
              }
            : m
        );
        return {
          nodes: {
            ...s.nodes,
            [nodeId]: {
              ...n,
              data: { ...n.data, chat: { ...n.data.chat, messages } },
            },
          },
        };
      });
      get().markDirty();
    },

    errorMessage: (nodeId, messageId, error) => {
      set((s) => {
        const n = s.nodes[nodeId];
        if (!n) return s;
        const messages = n.data.chat.messages.map((m) =>
          m.id === messageId ? { ...m, status: "error" as const, error } : m
        );
        return {
          nodes: {
            ...s.nodes,
            [nodeId]: {
              ...n,
              data: { ...n.data, chat: { ...n.data.chat, messages } },
            },
          },
        };
      });
      get().markDirty();
    },

    getHistoryForNode: (id) => getMessageHistoryForNode(id, get().nodes),

    serialize: () => canvasFromState(get()),

    markDirty: () => {
      set((s) => ({
        dirty: { count: s.dirty.count + 1, lastChangeAt: Date.now() },
      }));
    },

    setPrefill: (nodeId, text) => {
      set((s) => ({ pendingPrefills: { ...s.pendingPrefills, [nodeId]: text } }));
    },

    consumePrefill: (nodeId) => {
      const current = get().pendingPrefills[nodeId];
      if (current === undefined) return undefined;
      set((s) => {
        const next = { ...s.pendingPrefills };
        delete next[nodeId];
        return { pendingPrefills: next };
      });
      return current;
    },

    save: async () => {
      const canvas = canvasFromState(get());
      if (!canvas) return;
      set({ saving: true });
      try {
        const res = await fetch(`/api/canvases/${canvas.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(canvas),
        });
        if (!res.ok) throw new Error("save failed");
        set({ saving: false, dirty: { count: 0, lastChangeAt: 0 } });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set({ saving: false, error: message });
      }
    },
  }))
);

// helper to build a fresh node
export function makeBlankNode(position: { x: number; y: number }, parentId?: NodeId): CanvasNode {
  return {
    id: nanoid(10),
    type: "custom",
    position,
    data: {
      chat: {
        messages: [],
        parentIds: parentId ? [parentId] : [],
        childIds: [],
      },
    },
  };
}
