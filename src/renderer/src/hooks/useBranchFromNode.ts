import { useCallback } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import {
  FALLBACK_NODE_HEIGHT,
  NODE_WIDTH,
  RIGHT_LANE_X_OFFSET,
  VERTICAL_CHILD_OFFSET,
} from "@/lib/canvasConstants";
import {
  makeDomHeightMeasurer,
  resolveCollisions,
} from "@/lib/collisionResolution";
import { focusNodeTextarea, measureNodeHeight } from "@/lib/nodeDom";
import {
  makeBlankNode,
  useCanvasStore,
  useCanvasStoreApi,
} from "@/hooks/useCanvasStore";
import { useCenterOnNode } from "@/hooks/useCenterOnNode";

export type BranchOptions = {
  prefill?: string;
  addedContext?: string;
  selectionViewportY?: number;
};

export type BranchFn = (opts?: BranchOptions) => void;

export function useBranchFromNode(parentId: string): BranchFn {
  const addNode = useCanvasStore((s) => s.addNode);
  const connectEdge = useCanvasStore((s) => s.connectEdge);
  const movePosition = useCanvasStore((s) => s.movePosition);
  const setPrefill = useCanvasStore((s) => s.setPrefill);
  const parentNode = useCanvasStore((s) => s.nodes[parentId]);
  const storeApi = useCanvasStoreApi();
  const zoom = useStore((s) => s.transform[2]);
  const { screenToFlowPosition } = useReactFlow();
  const centerOnNode = useCenterOnNode();

  return useCallback(
    (opts) => {
      const { prefill, addedContext, selectionViewportY } = opts ?? {};
      const parentPos = parentNode?.position ?? { x: 0, y: 0 };
      const isRightLane = Boolean(prefill) || Boolean(addedContext);
      let position: { x: number; y: number };
      let sourceYOffset: number | undefined;
      if (isRightLane) {
        const x = parentPos.x + RIGHT_LANE_X_OFFSET;
        if (selectionViewportY != null) {
          // Project the selection's viewport Y into flow coords so the new
          // node sits at the same vertical level as where the user selected,
          // not pinned to the top of the parent.
          const projected = screenToFlowPosition({ x: 0, y: selectionViewportY });
          position = { x, y: projected.y - FALLBACK_NODE_HEIGHT / 2 };
          // Attach the parent end of the edge at the selection Y so the
          // connector emerges from the selected text instead of a fixed handle.
          sourceYOffset = projected.y - parentPos.y;
        } else {
          position = { x, y: parentPos.y + 30 };
        }
      } else {
        position = {
          x: parentPos.x,
          y:
            parentPos.y +
            measureNodeHeight(parentId, zoom) +
            VERTICAL_CHILD_OFFSET,
        };
      }
      const child = makeBlankNode(position, parentId, addedContext);
      if (prefill) setPrefill(child.id, prefill);
      addNode(child);
      connectEdge(parentId, child.id, sourceYOffset != null ? { sourceYOffset } : undefined);

      // Wait one rAF for the DOM to mount, then resolve horizontal collisions,
      // animate the camera to center on the child, and focus its textarea.
      requestAnimationFrame(() => {
        const state = storeApi.getState();
        const measure = makeDomHeightMeasurer(zoom);
        const moves = resolveCollisions(child.id, state.nodes, measure, {
          fixedWidth: NODE_WIDTH,
          excludeIds: [parentId],
        });
        for (const movedId of Object.keys(moves)) {
          movePosition(movedId, moves[movedId]);
        }

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
    },
    [
      parentId,
      parentNode,
      addNode,
      connectEdge,
      setPrefill,
      zoom,
      movePosition,
      centerOnNode,
      screenToFlowPosition,
      storeApi,
    ],
  );
}
