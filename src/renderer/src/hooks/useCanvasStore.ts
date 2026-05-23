import { createContext, createElement, useContext, useRef, type ReactNode } from "react";
import { createStore, useStore, type Mutate, type StoreApi } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { applyNodeChanges, type NodeChange } from "@xyflow/react";
import { nanoid } from "nanoid";
import type {
  Canvas,
  CanvasEdge,
  CanvasNode,
  ContentBlock,
  ErrorCode,
  Message,
  NodeId,
  NodeSettings,
  Provider,
  Suggestion,
  TextBlock,
  ToolUseBlock,
  UsageSummary,
} from "@shared/types";
import {
  getMessageHistoryForNode,
  messageTextForTitle,
  migrateMessage,
} from "@shared/history";
import { isUnnamedCanvasName, promptToCanvasName } from "@shared/canvasName";
import { getEdgeHandles } from "@/lib/edgeHandles";
import { FALLBACK_NODE_HEIGHT, VERTICAL_CHILD_OFFSET } from "@/lib/canvasConstants";
import { useRecentsStore } from "@/hooks/useRecentsStore";

type Dirty = { count: number; lastChangeAt: number };

export type CanvasStoreState = {
  canvasId: string | null;
  name: string;
  cwd: string | undefined;
  createdAt: number;
  provider: Provider | undefined;
  /** Mirror of AppSettings.defaultProvider — populated on canvas load so effective-provider lookups don't have to hit IPC. */
  defaultProvider: Provider | undefined;
  nodes: Record<NodeId, CanvasNode>;
  edges: CanvasEdge[];
  loaded: boolean;
  dirty: Dirty;
  saving: boolean;
  error: string | null;
  pendingPrefills: Record<NodeId, PendingPrefill>;
  searchHighlights: Map<NodeId, Set<string>>;
  setSearchHighlights: (nodeId: NodeId, textMatches: string[]) => void;
  clearSearchHighlights: () => void;

  /** Merge-mode state. `merging` is true while the user is picking parents for a merge child. */
  merging: boolean;
  /** All nodes selected to become parents of the merge child. First entry is the initiating source. */
  mergeIds: NodeId[];
  startMerge: (sourceId: NodeId) => void;
  toggleMergeNode: (id: NodeId) => void;
  cancelMerge: () => void;
  /** Create a new child node whose parents are `mergeIds`. Returns the new node id, or null if invalid. */
  commitMerge: () => NodeId | null;

  loadCanvas: (id: string) => Promise<void>;
  setName: (name: string) => void;
  setProvider: (provider: Provider) => void;
  /** Merge a patch into `node.data.nodeSettings`. Per-node override of provider/cwd/branch. */
  setNodeSettings: (nodeId: NodeId, patch: Partial<NodeSettings>) => void;
  /** Unset a single nodeSettings field so the node falls back to canvas defaults. */
  clearNodeSettingsField: (nodeId: NodeId, field: keyof NodeSettings) => void;
  /** Effective provider: node override → canvas → AppSettings.defaultProvider → "claude". */
  getEffectiveProvider: (nodeId: NodeId) => Provider;
  /** Effective cwd: node override → canvas → undefined. */
  getEffectiveCwd: (nodeId: NodeId) => string | undefined;
  /** Effective branch label: node override only — there is no canvas-level branch. */
  getEffectiveBranch: (nodeId: NodeId) => string | undefined;
  addNode: (node: CanvasNode) => void;
  patchNode: (id: NodeId, patch: Partial<CanvasNode["data"]>) => void;
  movePosition: (id: NodeId, pos: { x: number; y: number }) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  /** Programmatically set the canvas selection to exactly one node, or clear
   *  it. Drives the right-side node drawer's auto-switch behavior. */
  setSelectedNodeId: (id: NodeId | null) => void;
  removeNode: (id: NodeId) => void;
  connectEdge: (source: NodeId, target: NodeId, opts?: { sourceYOffset?: number }) => void;
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
  setMessageUsage: (nodeId: NodeId, messageId: string, usage?: UsageSummary) => void;
  finalizeMessage: (nodeId: NodeId, messageId: string) => void;
  errorMessage: (
    nodeId: NodeId,
    messageId: string,
    error: string,
    opts?: { code?: ErrorCode; provider?: Provider }
  ) => void;
  clearMessages: (nodeId: NodeId) => void;
  getHistoryForNode: (id: NodeId) => Message[];
  serialize: () => Canvas | null;
  markDirty: () => void;
  save: () => Promise<void>;
  setPrefill: (nodeId: NodeId, text: string, opts?: { autoSubmit?: boolean }) => void;
  consumePrefill: (nodeId: NodeId) => PendingPrefill | undefined;
  /** Replace a message's parsed `<next-steps>` suggestions. */
  setSuggestions: (nodeId: NodeId, messageId: string, suggestions: Suggestion[]) => void;
};

/** Initial prompt to render into a freshly-created node's input. `autoSubmit` skips
 *  the editor population and fires the prompt directly — used by next-step buttons. */
export type PendingPrefill = { text: string; autoSubmit?: boolean };

export type CanvasStoreApi = Mutate<
  StoreApi<CanvasStoreState>,
  [["zustand/subscribeWithSelector", never]]
>;

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
    provider: s.provider,
    ...(s.cwd ? { cwd: s.cwd } : {}),
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

function firstUserPrompt(nodes: CanvasNode[]): string | null {
  for (const node of nodes) {
    const message = node.data.chat.messages.find((m) => m.role === "user");
    if (!message) continue;
    const text = messageTextForTitle(message).trim();
    if (text) return text;
  }
  return null;
}

export function createCanvasStoreApi(): CanvasStoreApi {
  return createStore<CanvasStoreState>()(
    subscribeWithSelector((set, get) => ({
      canvasId: null,
      name: "",
      cwd: undefined,
      createdAt: 0,
      provider: undefined,
      defaultProvider: undefined,
      nodes: {},
      edges: [],
      loaded: false,
      dirty: { count: 0, lastChangeAt: 0 },
      saving: false,
      error: null,
      pendingPrefills: {},
      searchHighlights: new Map(),
      merging: false,
      mergeIds: [],

      startMerge: (sourceId) => {
        set((s) => {
          if (!s.nodes[sourceId]) return s;
          return { merging: true, mergeIds: [sourceId] };
        });
      },

      toggleMergeNode: (id) => {
        set((s) => {
          if (!s.merging || !s.nodes[id]) return s;
          const idx = s.mergeIds.indexOf(id);
          if (idx === -1) return { mergeIds: [...s.mergeIds, id] };
          // Don't allow removing the source (mergeIds[0]); cancel instead.
          if (idx === 0) return s;
          const next = [...s.mergeIds];
          next.splice(idx, 1);
          return { mergeIds: next };
        });
      },

      cancelMerge: () => {
        set((s) => (s.merging ? { merging: false, mergeIds: [] } : s));
      },

      commitMerge: () => {
        const s = get();
        if (!s.merging || s.mergeIds.length < 2) return null;
        const parents = s.mergeIds
          .map((id) => s.nodes[id])
          .filter((n): n is CanvasNode => Boolean(n));
        if (parents.length < 2) return null;
        const avgX =
          parents.reduce((acc, n) => acc + n.position.x, 0) / parents.length;
        const maxY = parents.reduce((acc, n) => Math.max(acc, n.position.y), 0);
        const position = {
          x: avgX,
          y: maxY + FALLBACK_NODE_HEIGHT + VERTICAL_CHILD_OFFSET,
        };
        const child: CanvasNode = {
          id: nanoid(10),
          type: "custom",
          position,
          data: {
            chat: {
              messages: [],
              parentIds: [],
              childIds: [],
            },
          },
        };
        // Insert child, then connect each parent → child.
        set((prev) => ({ nodes: { ...prev.nodes, [child.id]: child } }));
        for (const p of parents) {
          get().connectEdge(p.id, child.id);
        }
        set({ merging: false, mergeIds: [] });
        get().markDirty();
        return child.id;
      },

      setSearchHighlights: (nodeId, textMatches) => {
        set((s) => {
          const next = new Map(s.searchHighlights);
          next.set(nodeId, new Set(textMatches));
          return { searchHighlights: next };
        });
      },

      clearSearchHighlights: () => {
        set((s) => {
          if (s.searchHighlights.size === 0) return s;
          return { searchHighlights: new Map() };
        });
      },

      loadCanvas: async (id: string) => {
        set({ loaded: false, error: null });
        const [canvas, settings] = await Promise.all([
          window.api.canvases.read(id),
          window.api.settings.read(),
        ]);
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
          provider: canvas.provider,
          defaultProvider: settings.defaultProvider,
          nodes,
          edges: canvas.edges,
          loaded: true,
          dirty: { count: 0, lastChangeAt: 0 },
        });
        const prompt = isUnnamedCanvasName(canvas.name)
          ? firstUserPrompt(canvas.nodes)
          : null;
        const fallbackName = prompt ? promptToCanvasName(prompt) : "";
        if (prompt && fallbackName) {
          set({ name: fallbackName });
          get().markDirty();
          const notifyCanvasList = () =>
            window.dispatchEvent(new Event("lmc:canvases-changed"));
          void get()
            .save()
            .then(notifyCanvasList)
            .catch((err) =>
              console.error("Failed to save prompt-derived canvas name:", err),
            );
          void window.api.canvasName
            .generate({ prompt })
            .then((generatedName) => {
              if (!generatedName) return;
              const currentName = get().name;
              if (currentName !== fallbackName && !isUnnamedCanvasName(currentName)) {
                return;
              }
              set({ name: generatedName });
              get().markDirty();
              void get()
                .save()
                .then(notifyCanvasList)
                .catch((err) =>
                  console.error("Failed to save generated canvas name:", err),
                );
            })
            .catch((err) =>
              console.error("Failed to generate canvas name:", err),
            );
        }
      },

      setName: (name) => {
        set({ name });
        get().markDirty();
      },

      setProvider: (provider) => {
        set({ provider });
        get().markDirty();
      },

      setNodeSettings: (nodeId, patch) => {
        let snapshot: NodeSettings | undefined;
        set((s) => {
          const existing = s.nodes[nodeId];
          if (!existing) return s;
          const current = existing.data.nodeSettings ?? {};
          const merged: NodeSettings = { ...current };
          for (const key of Object.keys(patch) as (keyof NodeSettings)[]) {
            const value = patch[key];
            if (value === undefined) delete merged[key];
            else if (key === "provider") merged.provider = value as Provider;
            else if (key === "cwd") merged.cwd = value as string;
            else if (key === "branch") merged.branch = value as string;
          }
          const hasAny =
            merged.provider !== undefined ||
            merged.cwd !== undefined ||
            merged.branch !== undefined;
          const nextData = { ...existing.data };
          if (hasAny) nextData.nodeSettings = merged;
          else delete nextData.nodeSettings;
          snapshot = hasAny ? { ...merged } : undefined;
          return {
            nodes: { ...s.nodes, [nodeId]: { ...existing, data: nextData } },
          };
        });
        if (snapshot) useRecentsStore.getState().setLastNodeSettings(snapshot);
        get().markDirty();
      },

      clearNodeSettingsField: (nodeId, field) => {
        set((s) => {
          const existing = s.nodes[nodeId];
          if (!existing) return s;
          const current = existing.data.nodeSettings;
          if (!current || current[field] === undefined) return s;
          const next: NodeSettings = { ...current };
          delete next[field];
          const hasAny =
            next.provider !== undefined ||
            next.cwd !== undefined ||
            next.branch !== undefined;
          const nextData = { ...existing.data };
          if (hasAny) nextData.nodeSettings = next;
          else delete nextData.nodeSettings;
          return {
            nodes: { ...s.nodes, [nodeId]: { ...existing, data: nextData } },
          };
        });
        get().markDirty();
      },

      getEffectiveProvider: (nodeId) => {
        const s = get();
        const nodeProvider = s.nodes[nodeId]?.data.nodeSettings?.provider;
        return nodeProvider ?? s.provider ?? s.defaultProvider ?? "claude";
      },

      getEffectiveCwd: (nodeId) => {
        const s = get();
        const nodeCwd = s.nodes[nodeId]?.data.nodeSettings?.cwd;
        return nodeCwd ?? s.cwd;
      },

      getEffectiveBranch: (nodeId) => {
        const s = get();
        return s.nodes[nodeId]?.data.nodeSettings?.branch;
      },

      addNode: (node) => {
        set((s) => {
          let nextNode = node;
          if (!node.data.nodeSettings) {
            const parentId = node.data.chat.parentIds[0];
            const parentSettings = parentId
              ? s.nodes[parentId]?.data.nodeSettings
              : undefined;
            const inherited =
              parentSettings ?? useRecentsStore.getState().lastNodeSettings;
            if (inherited && (inherited.provider || inherited.cwd || inherited.branch)) {
              nextNode = {
                ...node,
                data: { ...node.data, nodeSettings: { ...inherited } },
              };
            }
          }
          return { nodes: { ...s.nodes, [node.id]: nextNode } };
        });
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

      setSelectedNodeId: (id) => {
        // xyflow attaches `selected` at runtime on the CanvasNode shape, even
        // though our static type omits it. Widen locally to read/write it.
        type WithSelected = CanvasNode & { selected?: boolean };
        set((s) => {
          let changed = false;
          const nextById: Record<NodeId, CanvasNode> = {};
          for (const key of Object.keys(s.nodes)) {
            const n = s.nodes[key] as WithSelected;
            const shouldBeSelected = id !== null && n.id === id;
            if (Boolean(n.selected) === shouldBeSelected) {
              nextById[key] = n;
              continue;
            }
            changed = true;
            nextById[key] = { ...n, selected: shouldBeSelected } as CanvasNode;
          }
          return changed ? { nodes: nextById } : s;
        });
      },

      removeNode: (id) => {
        void window.api.chat.cancelForNode(id);
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

      connectEdge: (source, target, opts) => {
        set((s) => {
          if (source === target) return s;
          if (!s.nodes[source] || !s.nodes[target]) return s;
          const id = makeEdgeId(source, target);
          if (s.edges.some((e) => e.id === id)) return s;
          const edge: CanvasEdge = { id, source, target };
          if (opts?.sourceYOffset != null) edge.sourceYOffset = opts.sourceYOffset;
          const edges = [...s.edges, edge];
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

      setMessageUsage: (nodeId, messageId, usage) => {
        set((s) => {
          const nodes = updateMessages(s.nodes, nodeId, (messages) =>
            mapMessage(messages, messageId, (m) => ({ ...m, usage })),
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

      errorMessage: (nodeId, messageId, error, opts) => {
        set((s) => {
          const nodes = updateMessages(s.nodes, nodeId, (messages) =>
            mapMessage(messages, messageId, (m) => ({
              ...m,
              status: "error",
              error,
              errorCode: opts?.code,
              errorProvider: opts?.provider,
            }))
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

      setPrefill: (nodeId, text, opts) => {
        const entry: PendingPrefill = opts?.autoSubmit
          ? { text, autoSubmit: true }
          : { text };
        set((s) => ({ pendingPrefills: { ...s.pendingPrefills, [nodeId]: entry } }));
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

      setSuggestions: (nodeId, messageId, suggestions) => {
        set((s) => {
          const nodes = updateMessages(s.nodes, nodeId, (messages) =>
            mapMessage(messages, messageId, (m) => ({ ...m, suggestions })),
          );
          return nodes ? { nodes } : s;
        });
        get().markDirty();
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
}

const CanvasStoreContext = createContext<CanvasStoreApi | null>(null);

export function CanvasStoreProvider({ children }: { children: ReactNode }) {
  const ref = useRef<CanvasStoreApi | null>(null);
  if (!ref.current) ref.current = createCanvasStoreApi();
  return createElement(CanvasStoreContext.Provider, { value: ref.current }, children);
}

/** Re-expose an existing store under CanvasStoreContext. Lets components
 *  rendered outside any pane (e.g. the right-side NodePanel drawer) reuse
 *  hooks/components that call `useCanvasStore`, by bridging the active
 *  pane's store API down into their subtree. */
export function CanvasStoreBridge({
  api,
  children,
}: {
  api: CanvasStoreApi;
  children: ReactNode;
}) {
  return createElement(CanvasStoreContext.Provider, { value: api }, children);
}

export function useCanvasStoreApi(): CanvasStoreApi {
  const api = useContext(CanvasStoreContext);
  if (!api) {
    throw new Error(
      "useCanvasStoreApi must be used within a <CanvasStoreProvider>"
    );
  }
  return api;
}

export function useCanvasStore<T>(selector: (s: CanvasStoreState) => T): T {
  const api = useCanvasStoreApi();
  return useStore(api, selector);
}

export function makeBlankNode(
  position: { x: number; y: number },
  parentId?: NodeId,
  addedContext?: string,
): CanvasNode {
  return {
    id: nanoid(10),
    type: "custom",
    position,
    data: {
      chat: {
        messages: [],
        parentIds: parentId ? [parentId] : [],
        childIds: [],
        ...(addedContext ? { addedContext } : {}),
      },
    },
  };
}
