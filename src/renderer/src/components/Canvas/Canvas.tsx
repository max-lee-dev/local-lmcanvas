import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  MiniMap,
  ReactFlow,
  SelectionMode,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCanvasStore, makeBlankNode } from "@/hooks/useCanvasStore";
import { useDebouncedSave } from "@/hooks/useDebouncedSave";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useContextMenu } from "@/hooks/useContextMenu";
import { useMinimapAutoHide } from "@/hooks/useMinimapAutoHide";
import { usePreferencesStore } from "@/hooks/usePreferencesStore";
import { getEdgeHandles } from "@/lib/edgeHandles";
import { useSearchModal } from "@/providers/SearchModalProvider";
import { useCommandPalette } from "@/providers/CommandPaletteProvider";
import { useIsActivePane } from "@/hooks/useActivePane";
import { CustomNode } from "./CustomNode";
import { focusNodeTextarea } from "@/lib/nodeDom";
import { ContextMenu } from "./ContextMenu";
import { OffsetEdge } from "./OffsetEdge";
import { SearchModalWrapper } from "./SearchModal";
import { MergeToolbar } from "./MergeToolbar";
import { CommandPaletteWrapper } from "./CommandPalette";
import { GroupSummaryOverlay } from "./GroupSummaryOverlay";
import {
  buildGroupSummaryInput,
  type DraftNode,
  type GeneratedNodeSummary,
  type GroupSummary,
} from "@/lib/groupSummary";
import { buildFallbackGroupSummaries } from "@/lib/groupClustering";
import type { ChatData } from "@shared/types";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { offset: OffsetEdge };

const defaultEdgeOptions = {
  type: "default",
};

const edgeStyle = {
  stroke: "var(--muted-foreground)",
  strokeWidth: 2.25,
  opacity: 0.95,
};

function CanvasInner() {
  const nodesById = useCanvasStore((s) => s.nodes);
  const edgesState = useCanvasStore((s) => s.edges);
  const canvasId = useCanvasStore((s) => s.canvasId);
  const addNode = useCanvasStore((s) => s.addNode);
  const connectEdge = useCanvasStore((s) => s.connectEdge);
  const movePosition = useCanvasStore((s) => s.movePosition);
  const removeNode = useCanvasStore((s) => s.removeNode);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useDebouncedSave();
  useKeyboardShortcuts(wrapperRef);

  const showMinimap = usePreferencesStore((s) => s.showMinimap);
  const panOnScrollSpeed = usePreferencesStore((s) => s.panOnScrollSpeed);
  const minimap = useMinimapAutoHide(showMinimap);

  const { showSearchModal, isSearchModalOpen, inputRef: searchInputRef } =
    useSearchModal();
  const {
    showCommandPalette,
    hideCommandPalette,
    isCommandPaletteOpen,
    inputRef: commandInputRef,
  } = useCommandPalette();
  const clearSearchHighlights = useCanvasStore((s) => s.clearSearchHighlights);
  const isActive = useIsActivePane();

  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (isSearchModalOpen && searchInputRef?.current) {
          searchInputRef.current.focus();
        } else {
          showSearchModal();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isCommandPaletteOpen) {
          if (commandInputRef?.current) commandInputRef.current.focus();
          else hideCommandPalette();
        } else {
          showCommandPalette();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    isActive,
    isSearchModalOpen,
    searchInputRef,
    showSearchModal,
    isCommandPaletteOpen,
    commandInputRef,
    showCommandPalette,
    hideCommandPalette,
  ]);

  const {
    isOpen: ctxIsOpen,
    position: ctxPosition,
    rightClickedNodeId: ctxNodeId,
    handlePaneContextMenu,
    handleNodeContextMenu,
    createNodeAtPointer,
    deleteNodeAtPointer,
    close: closeCtx,
  } = useContextMenu();

  // Local rfNodes: xyflow-shaped state owned by the canvas. We pull from
  // `nodesById` for additions/removals + data changes, but during drag the
  // intermediate positions live here only — we never write them to the store
  // until drag stop. This is what makes drag smooth: no store churn, no
  // dirty-mark spam, no debounced-save thrash.
  const [rfNodes, setRfNodes] = useState<Node[]>([]);

  // Track which node ids are mid-drag so the sync-effect doesn't clobber the
  // in-flight positions if the store ticks for an unrelated reason (e.g. a
  // streamed token updates a node's data).
  const draggingIdsRef = useRef<Set<string>>(new Set());
  const [draggingTick, setDraggingTick] = useState(0);

  // Sync FROM store: handle additions, removals, and data updates. Preserve
  // local position for any node currently being dragged.
  useEffect(() => {
    setRfNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      const dragging = draggingIdsRef.current;
      const next: Node[] = [];
      let changed = prev.length !== Object.keys(nodesById).length;
      for (const n of Object.values(nodesById)) {
        const existing = prevById.get(n.id);
        const data = n.data as unknown as Record<string, unknown>;
        const type = n.type === "custom" ? "custom" : "default";
        // If currently dragging, keep the in-flight position from local state.
        const position = dragging.has(n.id) && existing
          ? existing.position
          : n.position;
        if (
          existing &&
          existing.data === data &&
          existing.type === type &&
          existing.position.x === position.x &&
          existing.position.y === position.y
        ) {
          next.push(existing);
        } else {
          changed = true;
          next.push({
            id: n.id,
            type,
            position,
            data,
            // preserve selection/dragging flags xyflow may have attached
            selected: existing?.selected,
            dragging: existing?.dragging,
          });
        }
      }
      return changed ? next : prev;
    });
  }, [nodesById]);

  // Edges: recompute handles for edges touching a dragging node from the live
  // rfNodes positions; for everything else use the store's cached handles.
  const rfNodesById = useMemo(() => {
    const m = new Map<string, Node>();
    for (const n of rfNodes) m.set(n.id, n);
    return m;
  }, [rfNodes]);

  const rfEdges = useMemo<Edge[]>(() => {
    const dragging = draggingIdsRef.current;
    return edgesState.map((e) => {
      // Edges that carry a `sourceYOffset` route through OffsetEdge, which
      // overrides the source attach point — handle recomputation would just
      // be ignored, so we skip it.
      if (e.sourceYOffset != null) {
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "offset",
          // Pin the target side to the left so the bezier reads as a
          // right-lane connector; OffsetEdge picks source side adaptively.
          targetHandle: e.targetHandle ?? "target-left",
          data: { sourceYOffset: e.sourceYOffset },
          style: edgeStyle,
        };
      }
      const touchesDrag = dragging.has(e.source) || dragging.has(e.target);
      let sourceHandle = e.sourceHandle ?? "source-bottom";
      let targetHandle = e.targetHandle ?? "target-top";
      if (touchesDrag) {
        const src = rfNodesById.get(e.source);
        const tgt = rfNodesById.get(e.target);
        if (src && tgt) {
          const handles = getEdgeHandles(src.position, tgt.position);
          sourceHandle = handles.sourceHandle;
          targetHandle = handles.targetHandle;
        }
      }
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "default",
        sourceHandle,
        targetHandle,
        style: edgeStyle,
      };
    });
    // draggingTick forces re-derivation while a drag is in flight so edge
    // handles track the moving node every frame. The dep on rfNodesById is
    // already enough in practice; the tick is belt-and-suspenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgesState, rfNodesById, draggingTick]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((nodes) => applyNodeChanges(changes, nodes));
      for (const c of changes) {
        if (c.type === "position") {
          // Commit to store only when drag finishes (dragging === false on the
          // final tick of a drag). Intermediate frames stay local.
          if (c.dragging === false && c.position) {
            movePosition(c.id, c.position);
          }
        } else if (c.type === "remove") {
          removeNode(c.id);
        }
      }
    },
    [movePosition, removeNode]
  );

  const onNodeDragStart = useCallback((_e: React.MouseEvent, node: Node) => {
    draggingIdsRef.current.add(node.id);
    setDraggingTick((t) => t + 1);
  }, []);

  const onNodeDragStop = useCallback((_e: React.MouseEvent, node: Node) => {
    draggingIdsRef.current.delete(node.id);
    setDraggingTick((t) => t + 1);
  }, []);

  const onEdgesChange = useCallback((_changes: EdgeChange[]) => {
    // edges are fully owned by the store; selection/remove handled via store only
  }, []);

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      connectEdge(conn.source, conn.target);
    },
    [connectEdge]
  );

  const { screenToFlowPosition } = useReactFlow();

  const onPaneDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".react-flow__node")) return;
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const centered = { x: pos.x - 225, y: pos.y - 50 };
      const node = makeBlankNode(centered);
      addNode(node);
      focusNodeTextarea(node.id);
    },
    [screenToFlowPosition, addNode]
  );

  const nodeCount = rfNodes.length;

  // TODO(group-summary): the candidates → groups pipeline runs entirely on
  // the client right now, using avera's deterministic Jaccard clustering +
  // fallback titler. When an LLM-backed summarizer lands, the candidates
  // stay the same shape and the LLM-produced groups replace the fallback.
  const candidates = useMemo(() => {
    const drafts: DraftNode[] = [];
    for (const n of rfNodes) {
      const chat = (n.data as { chat?: ChatData }).chat;
      if (!chat) continue;
      const draft: DraftNode = { id: n.id, messages: chat.messages };
      if (chat.addedContext) draft.addedContext = chat.addedContext;
      drafts.push(draft);
    }
    return buildGroupSummaryInput(drafts);
  }, [rfNodes]);

  const mockNodeSummaries = useMemo<GeneratedNodeSummary[]>(() => {
    return candidates.map((c) => ({
      nodeId: c.nodeId,
      summary: c.prompt.split(/\s+/).filter(Boolean).slice(0, 10).join(" "),
    }));
  }, [candidates]);

  const mockSummaries = useMemo<GroupSummary[]>(() => {
    if (candidates.length < 2) return [];
    return buildFallbackGroupSummaries(candidates).map((g, i) => ({
      id: `fallback-group-${i}`,
      title: g.title,
      nodeIds: g.nodeIds,
    }));
  }, [candidates]);

  return (
    <div
      ref={wrapperRef}
      className="h-full w-full bg-background relative"
      onDoubleClick={onPaneDoubleClick}
    >
      <ReactFlow
        id={canvasId ?? undefined}
        className="canvas-cursor-select"
        style={{ width: "100%", height: "100%" }}
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onMoveStart={minimap.onMoveStart}
        onMove={minimap.onMove}
        onPaneClick={clearSearchHighlights}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        defaultViewport={{ x: 200, y: 200, zoom: 1 }}
        fitView={nodeCount > 0}
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        selectNodesOnDrag
        noDragClassName="nodrag"
        maxZoom={4}
        minZoom={0.1}
        deleteKeyCode={null}
        panOnScroll
        panOnScrollSpeed={panOnScrollSpeed}
        zoomOnScroll={false}
        disableKeyboardA11y={true}
        zoomOnPinch
        panOnDrag={[1]}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={edgeStyle}
      >
        <Background
          id={canvasId ?? undefined}
          variant={BackgroundVariant.Lines}
          gap={32}
          size={1}
          color="var(--grid-line)"
        />
        <GroupSummaryOverlay
          summaries={mockSummaries}
          nodeSummaries={mockNodeSummaries}
          nodes={rfNodes}
        />
        {showMinimap && (
          <MiniMap
            pannable
            zoomable
            position="bottom-right"
            style={{
              opacity: minimap.visible ? 1 : 0,
              transition: "opacity 250ms ease-out",
              pointerEvents: minimap.visible ? "auto" : "none",
            }}
          />
        )}
      </ReactFlow>
      <ContextMenu
        isOpen={ctxIsOpen}
        position={ctxPosition}
        rightClickedNodeId={ctxNodeId}
        createNodeAtPointer={createNodeAtPointer}
        deleteNodeAtPointer={deleteNodeAtPointer}
        onClose={closeCtx}
      />
      <SearchModalWrapper />
      <MergeToolbar />
      <CommandPaletteWrapper />
    </div>
  );
}

export function Canvas() {
  return <CanvasInner />;
}
