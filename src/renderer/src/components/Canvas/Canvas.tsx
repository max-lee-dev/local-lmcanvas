import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
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
import { CustomNode, focusNodeTextarea } from "./CustomNode";
import { ContextMenu } from "./ContextMenu";
import { SearchModalWrapper } from "./SearchModal";

const nodeTypes = { custom: CustomNode };

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
  const addNode = useCanvasStore((s) => s.addNode);
  const connectEdge = useCanvasStore((s) => s.connectEdge);
  const movePosition = useCanvasStore((s) => s.movePosition);
  const removeNode = useCanvasStore((s) => s.removeNode);

  useDebouncedSave();
  useKeyboardShortcuts();

  const showMinimap = usePreferencesStore((s) => s.showMinimap);
  const panOnScrollSpeed = usePreferencesStore((s) => s.panOnScrollSpeed);
  const minimap = useMinimapAutoHide(showMinimap);

  const { showSearchModal, isSearchModalOpen, inputRef: searchInputRef } =
    useSearchModal();
  const clearSearchHighlights = useCanvasStore((s) => s.clearSearchHighlights);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (isSearchModalOpen && searchInputRef?.current) {
          searchInputRef.current.focus();
        } else {
          showSearchModal();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSearchModalOpen, searchInputRef, showSearchModal]);

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
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div
      ref={wrapperRef}
      className="h-full w-full bg-background relative"
      onDoubleClick={onPaneDoubleClick}
    >
      <ReactFlow
        className="canvas-cursor-select"
        style={{ width: "100%", height: "100%" }}
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
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
          variant={BackgroundVariant.Lines}
          gap={32}
          size={1}
          color="var(--grid-line)"
        />
        {showMinimap && (
          <MiniMap
            pannable
            zoomable
            position="bottom-left"
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
    </div>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
