import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { applyNodeChanges, type NodeChange } from "@xyflow/react";
import { nanoid } from "nanoid";
import type {
  Canvas,
  CanvasEdge,
  CanvasNode,
  ContentBlock,
  Message,
  NodeId,
  TextBlock,
  ToolUseBlock,
} from "@shared/types";
import {
  getMessageHistoryForNode,
  messageTextForTitle,
  migrateMessage,
} from "@shared/history";
import { getEdgeHandles } from "@/lib/edgeHandles";

type Dirty = { count: number; lastChangeAt: number };

export type CanvasStoreState = {
  canvasId: string | null;
  name: string;
  cwd: string;
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
  onNodesChange: (changes: NodeChange[]) => void;
  removeNode: (id: NodeId) => void;
  connectEdge: (source: NodeId, target: NodeId) => void;
  appendMessage: (nodeId: NodeId, msg: Message) => void;
  appendTextDelta: (nodeId: NodeId, messageId: string, text: string) => void;
  appendBlock: (nodeId: NodeId, messageId: string, block: ContentBlock) => void;
  setToolResult: (
    nodeId: NodeId,
    messageId: string,
    toolUseId: string,
    content: string,
    isError: boolean
  ) => void;
  finalizeMessage: (nodeId: NodeId, messageId: string) => void;
  errorMessage: (nodeId: NodeId, messageId: string, error: string) => void;
  clearMessages: (nodeId: NodeId) => void;
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
    cwd: s.cwd,
    createdAt: s.createdAt,
    updatedAt: Date.now(),
    nodes: Object.values(s.nodes),
    edges: s.edges,
  };
}

function updateMessages(
  nodes: Record<NodeId, CanvasNode>,
  nodeId: NodeId,
  updater: (messages: Message[]) => Message[]
): Record<NodeId, CanvasNode> | null {
  const n = nodes[nodeId];
  if (!n) return null;
  const messages = updater(n.data.chat.messages);
  if (messages === n.data.chat.messages) return null;
  return {
    ...nodes,
    [nodeId]: {
      ...n,
      data: { ...n.data, chat: { ...n.data.chat, messages } },
    },
  };
}

function mapMessage(
  messages: Message[],
  messageId: string,
  fn: (m: Message) => Message
): Message[] {
  let changed = false;
  const next = messages.map((m) => {
    if (m.id !== messageId) return m;
    changed = true;
    return fn(m);
  });
  return changed ? next : messages;
}

export const useCanvasStore = create<CanvasStoreState>()(
  subscribeWithSelector((set, get) => ({
    canvasId: null,
    name: "",
    cwd: "",
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
      const canvas = await window.api.canvases.read(id);
      if (!canvas) {
        set({ error: `Failed to load canvas ${id}`, loaded: true });
        return;
      }
      const nodes: Record<NodeId, CanvasNode> = {};
      for (const n of canvas.nodes) {
        const migrated: Message[] = [];
        for (const raw of n.data.chat.messages) {
          const m = migrateMessage(raw);
          if (!m) continue;
          migrated.push(
            m.status === "streaming"
              ? { ...m, status: "error", error: "interrupted" }
              : m
          );
        }
        nodes[n.id] = {
          ...n,
          data: {
            ...n.data,
            chat: { ...n.data.chat, messages: migrated },
          },
        };
      }
      set({
        canvasId: canvas.id,
        name: canvas.name,
        cwd: canvas.cwd,
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

    onNodesChange: (changes) => {
      if (!changes.length) return;
      let didChange = false;
      set((s) => {
        const nodesArray = Object.values(s.nodes);
        const next = applyNodeChanges(changes, nodesArray) as CanvasNode[];

        const movedIds = new Set<string>();
        for (const c of changes) {
          if (c.type === "position" && c.position) movedIds.add(c.id);
        }

        const sameNodes =
          next.length === nodesArray.length &&
          next.every((n, i) => n === nodesArray[i]);
        if (sameNodes && movedIds.size === 0) return s;

        const nextById: Record<NodeId, CanvasNode> = {};
        for (const n of next) nextById[n.id] = n;

        let edges = s.edges;
        if (movedIds.size > 0 && s.edges.length > 0) {
          let edgesTouched = false;
          const nextEdges = s.edges.map((e) => {
            if (!movedIds.has(e.source) && !movedIds.has(e.target)) return e;
            const src = nextById[e.source];
            const tgt = nextById[e.target];
            if (!src || !tgt) return e;
            const handles = getEdgeHandles(src.position, tgt.position);
            if (
              e.sourceHandle === handles.sourceHandle &&
              e.targetHandle === handles.targetHandle
            ) {
              return e;
            }
            edgesTouched = true;
            return {
              ...e,
              sourceHandle: handles.sourceHandle,
              targetHandle: handles.targetHandle,
            };
          });
          if (edgesTouched) edges = nextEdges;
        }

        didChange = true;
        return { nodes: nextById, edges };
      });
      if (didChange) get().markDirty();
    },

    removeNode: (id) => {
      set((s) => {
        const nodes = { ...s.nodes };
        delete nodes[id];
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
        const derivedTitle =
          n.data.title || (msg.role === "user" ? messageTextForTitle(msg).slice(0, 60) : n.data.title);
        return {
          nodes: {
            ...s.nodes,
            [nodeId]: {
              ...n,
              data: {
                ...n.data,
                title: derivedTitle,
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

    appendTextDelta: (nodeId, messageId, text) => {
      if (!text) return;
      set((s) => {
        const nodes = updateMessages(s.nodes, nodeId, (messages) =>
          mapMessage(messages, messageId, (m) => {
            const blocks = m.blocks.length > 0 ? [...m.blocks] : [];
            const last = blocks[blocks.length - 1];
            if (last && last.type === "text") {
              blocks[blocks.length - 1] = { ...last, text: last.text + text };
            } else {
              const tb: TextBlock = { type: "text", text };
              blocks.push(tb);
            }
            return { ...m, blocks };
          })
        );
        return nodes ? { nodes } : s;
      });
      get().markDirty();
    },

    appendBlock: (nodeId, messageId, block) => {
      set((s) => {
        const nodes = updateMessages(s.nodes, nodeId, (messages) =>
          mapMessage(messages, messageId, (m) => ({
            ...m,
            blocks: [...m.blocks, block],
          }))
        );
        return nodes ? { nodes } : s;
      });
      get().markDirty();
    },

    setToolResult: (nodeId, messageId, toolUseId, content, isError) => {
      set((s) => {
        const nodes = updateMessages(s.nodes, nodeId, (messages) =>
          mapMessage(messages, messageId, (m) => {
            let touched = false;
            const blocks = m.blocks.map((b) => {
              if (b.type !== "tool_use") return b;
              const tu = b as ToolUseBlock;
              if (tu.id !== toolUseId) return b;
              touched = true;
              return { ...tu, result: { content, isError } } satisfies ToolUseBlock;
            });
            return touched ? { ...m, blocks } : m;
          })
        );
        return nodes ? { nodes } : s;
      });
      get().markDirty();
    },

    finalizeMessage: (nodeId, messageId) => {
      set((s) => {
        const nodes = updateMessages(s.nodes, nodeId, (messages) =>
          mapMessage(messages, messageId, (m) => ({ ...m, status: "complete" }))
        );
        return nodes ? { nodes } : s;
      });
      get().markDirty();
    },

    errorMessage: (nodeId, messageId, error) => {
      set((s) => {
        const nodes = updateMessages(s.nodes, nodeId, (messages) =>
          mapMessage(messages, messageId, (m) => ({ ...m, status: "error", error }))
        );
        return nodes ? { nodes } : s;
      });
      get().markDirty();
    },

    clearMessages: (nodeId) => {
      set((s) => {
        const nodes = updateMessages(s.nodes, nodeId, () => []);
        return nodes ? { nodes } : s;
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
        await window.api.canvases.write(canvas);
        set({ saving: false, dirty: { count: 0, lastChangeAt: 0 } });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        set({ saving: false, error: message });
      }
    },
  }))
);

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
