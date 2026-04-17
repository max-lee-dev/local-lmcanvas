import { useCallback, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
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
import { CustomNode } from "./CustomNode";

const nodeTypes = { custom: CustomNode };

type LivePos = Record<string, { x: number; y: number }>;

function CanvasInner() {
  const nodesById = useCanvasStore((s) => s.nodes);
  const edgesState = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const connectEdge = useCanvasStore((s) => s.connectEdge);
  const movePosition = useCanvasStore((s) => s.movePosition);
  const removeNode = useCanvasStore((s) => s.removeNode);

  useDebouncedSave();
  useKeyboardShortcuts();

  // Position-only local cache. Node identity & data come directly from the store.
  // Using a cache here means streaming deltas (which churn `nodesById`) never
  // override an in-flight drag position.
  const [livePos, setLivePos] = useState<LivePos>({});

  const rfNodes = useMemo<Node[]>(() => {
    return Object.values(nodesById).map((n) => ({
      id: n.id,
      type: n.type === "custom" ? "custom" : "default",
      position: livePos[n.id] ?? n.position,
      data: n.data as unknown as Record<string, unknown>,
    }));
  }, [nodesById, livePos]);

  const rfEdges = useMemo<Edge[]>(
    () => edgesState.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "default" })),
    [edgesState]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === "position" && c.position) {
          const pos = c.position;
          setLivePos((p) => ({ ...p, [c.id]: pos }));
          if (!c.dragging) {
            movePosition(c.id, pos);
            // clear live entry so future store changes are visible
            setLivePos((p) => {
              const next = { ...p };
              delete next[c.id];
              return next;
            });
          }
        } else if (c.type === "remove") {
          removeNode(c.id);
        }
      }
    },
    [movePosition, removeNode]
  );

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
      addNode(makeBlankNode(pos));
    },
    [screenToFlowPosition, addNode]
  );

  const nodeCount = rfNodes.length;

  return (
    <div ref={wrapperRef} className="h-full w-full" onDoubleClick={onPaneDoubleClick}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView={nodeCount > 0}
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d4d4d8" />
        <Controls position="bottom-left" />
        <MiniMap pannable zoomable position="bottom-right" />
      </ReactFlow>
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
