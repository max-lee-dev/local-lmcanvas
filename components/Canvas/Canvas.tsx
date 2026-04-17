"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
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
import { CustomNode } from "./CustomNode";
import type { CanvasNode } from "@/lib/graph/types";

const nodeTypes = { custom: CustomNode };

function toRFNodes(byId: Record<string, CanvasNode>): Node[] {
  return Object.values(byId).map((n) => ({
    id: n.id,
    type: n.type === "custom" ? "custom" : "default",
    position: n.position,
    data: n.data as unknown as Record<string, unknown>,
  }));
}

function toRFEdges(edges: { id: string; source: string; target: string }[]): Edge[] {
  return edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "default" }));
}

function CanvasInner() {
  const nodesById = useCanvasStore((s) => s.nodes);
  const edgesState = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const connectEdge = useCanvasStore((s) => s.connectEdge);
  const movePosition = useCanvasStore((s) => s.movePosition);
  const removeNode = useCanvasStore((s) => s.removeNode);

  useDebouncedSave();
  useKeyboardShortcuts();

  // Local rf state, kept in sync with the store; lets xyflow handle drag visuals.
  const [rfNodes, setRfNodes] = useState<Node[]>(() => toRFNodes(nodesById));
  const [rfEdges, setRfEdges] = useState<Edge[]>(() => toRFEdges(edgesState));

  // Sync store → local when store changes (add/remove/streamed content).
  useEffect(() => {
    setRfNodes((prev) => {
      const next = toRFNodes(nodesById);
      // preserve in-flight positions from prev if the node exists in both
      const prevById = new Map(prev.map((n) => [n.id, n]));
      return next.map((n) => {
        const p = prevById.get(n.id);
        // if stored position differs and prev has newer drag position, keep store (source of truth after drop)
        return p ? { ...n, position: n.position } : n;
      });
    });
  }, [nodesById]);

  useEffect(() => {
    setRfEdges(toRFEdges(edgesState));
  }, [edgesState]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((nds) => applyNodeChanges(changes, nds));
      for (const c of changes) {
        if (c.type === "position" && !c.dragging && c.position) {
          movePosition(c.id, c.position);
        } else if (c.type === "remove") {
          removeNode(c.id);
        }
      }
    },
    [movePosition, removeNode]
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((eds) => applyEdgeChanges(changes, eds));
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

  const nodeCount = useMemo(() => rfNodes.length, [rfNodes]);

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
