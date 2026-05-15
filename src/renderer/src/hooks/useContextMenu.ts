import { useCallback, useState } from "react";
import { useReactFlow, useStore, type Node } from "@xyflow/react";
import { makeBlankNode, useCanvasStore, useCanvasStoreApi } from "./useCanvasStore";
import { focusNodeTextarea } from "@/components/Canvas/CustomNode";
import { useCenterOnNode } from "./useCenterOnNode";
import {
  FALLBACK_NODE_HEIGHT,
  NODE_WIDTH,
  RIGHT_LANE_X_OFFSET,
} from "@/lib/canvasConstants";
import {
  makeDomHeightMeasurer,
  resolveCollisions,
} from "@/lib/collisionResolution";

export type MenuOption = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export function useContextMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rightClickedNodeId, setRightClickedNodeId] = useState<string | null>(null);

  const storeApi = useCanvasStoreApi();
  const addNode = useCanvasStore((s) => s.addNode);
  const connectEdge = useCanvasStore((s) => s.connectEdge);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const movePosition = useCanvasStore((s) => s.movePosition);

  const { screenToFlowPosition } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const centerOnNode = useCenterOnNode();

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setRightClickedNodeId(null);
      setPosition({ x: event.clientX, y: event.clientY });
      setIsOpen(true);
    },
    []
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setRightClickedNodeId(node.id);
      setPosition({ x: event.clientX, y: event.clientY });
      setIsOpen(true);
    },
    []
  );

  const createNodeAtPointer = useCallback(() => {
    const parentId = rightClickedNodeId ?? undefined;

    // Orphan node (pane context menu): preserve the old cursor-centered
    // behavior. No camera animation, no collision resolution.
    if (!parentId) {
      const flowPos = screenToFlowPosition({ x: position.x, y: position.y });
      const centered = { x: flowPos.x - NODE_WIDTH / 2, y: flowPos.y - 50 };
      const node = makeBlankNode(centered);
      addNode(node);
      focusNodeTextarea(node.id);
      return;
    }

    // Child node (right-clicked an existing node): ignore cursor, place to
    // the right of the parent on the same y row — matches avera's
    // computeRightLaneBranchX exactly.
    const parent = storeApi.getState().nodes[parentId];
    if (!parent) return;

    // Child y follows the cursor (where the user right-clicked), so the new
     // node spawns where their attention is — not at the parent's row.
    const cursorFlow = screenToFlowPosition({ x: position.x, y: position.y });
    const childPos = {
      x: parent.position.x + RIGHT_LANE_X_OFFSET,
      y: cursorFlow.y - 50,
    };
    const child = makeBlankNode(childPos, parentId);
    addNode(child);
    // Attach the parent end of the edge near the cursor Y so the connector
    // emerges from the spot the user clicked instead of a fixed handle.
    const sourceYOffset = cursorFlow.y - parent.position.y;
    connectEdge(parentId, child.id, { sourceYOffset });

    // After the new node has mounted (rAF), measure, resolve collisions, pan
    // camera, then focus the textarea. RAF is required so the textarea/DOM
    // node exists for the height measurer.
    requestAnimationFrame(() => {
      const state = storeApi.getState();
      const measure = makeDomHeightMeasurer(zoom);
      const moves = resolveCollisions(child.id, state.nodes, measure, {
        fixedWidth: NODE_WIDTH,
        // Exclude the parent so siblings get pushed but the parent never moves.
        excludeIds: [parentId],
      });
      for (const id of Object.keys(moves)) {
        movePosition(id, moves[id]);
      }

      // Camera: center on the final child position at zoom 1.5, animated 400ms.
      const fresh = storeApi.getState().nodes[child.id];
      if (fresh) {
        const h = measure(child.id);
        centerOnNode(
          fresh.position.x,
          fresh.position.y,
          NODE_WIDTH,
          h || FALLBACK_NODE_HEIGHT,
        );
      }

      focusNodeTextarea(child.id);
    });
  }, [
    addNode,
    centerOnNode,
    connectEdge,
    movePosition,
    position.x,
    position.y,
    rightClickedNodeId,
    screenToFlowPosition,
    storeApi,
    zoom,
  ]);

  const deleteNodeAtPointer = useCallback(() => {
    if (!rightClickedNodeId) return;
    removeNode(rightClickedNodeId);
  }, [removeNode, rightClickedNodeId]);

  const close = useCallback(() => {
    setIsOpen(false);
    setRightClickedNodeId(null);
  }, []);

  return {
    isOpen,
    position,
    rightClickedNodeId,
    handlePaneContextMenu,
    handleNodeContextMenu,
    createNodeAtPointer,
    deleteNodeAtPointer,
    close,
  };
}
