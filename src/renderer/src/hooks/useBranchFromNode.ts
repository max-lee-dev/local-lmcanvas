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
import type { Attachment } from "@shared/ipc";

export type BranchOptions = {
  prefill?: string;
  attachments?: Attachment[];
  /** If true, the prefill is submitted immediately instead of populating the
   *  child's textarea — used by next-step suggestion buttons. */
  autoSubmit?: boolean;
  /** Force the child to be placed directly under the parent (same x) instead
   *  of in the right lane. Otherwise a prefill/context triggers right-lane. */
  placeBelow?: boolean;
  /** If false, create the child without moving or zooming the viewport. */
  focusViewport?: boolean;
  /** Pan to the child without changing the current viewport zoom. */
  preserveZoom?: boolean;
  /** If false, leave keyboard focus where the branch was initiated. */
  focusInput?: boolean;
  addedContext?: string;
  selectionViewportY?: number;
  /** Called synchronously with the new child's id right after it's added to
   *  the store. Lets callers programmatically follow the child (e.g. select
   *  it so the right-side node drawer auto-switches to it). */
  onCreated?: (childId: string) => void;
  /** Mark the new child as temporary — it will auto-delete 10s after its
   *  assistant message completes unless the user hovers it. */
  isTemporary?: boolean;
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
      const {
        prefill,
        attachments,
        autoSubmit,
        placeBelow,
        focusViewport = true,
        preserveZoom = false,
        focusInput = true,
        addedContext,
        selectionViewportY,
        onCreated,
        isTemporary,
      } = opts ?? {};
      const parentPos = parentNode?.position ?? { x: 0, y: 0 };
      const isRightLane =
        !placeBelow &&
        (Boolean(prefill) || Boolean(attachments?.length) || Boolean(addedContext));
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
      if (isTemporary) child.data.chat.isTemporary = true;
      if (prefill || attachments?.length) {
        setPrefill(child.id, prefill ?? "", { autoSubmit, attachments });
      }
      addNode(child);
      connectEdge(parentId, child.id, sourceYOffset != null ? { sourceYOffset } : undefined);
      onCreated?.(child.id);

      // Wait one rAF for the DOM to mount, then resolve horizontal collisions,
      // optionally center the camera on the child, and focus its textarea.
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
        if (fresh && focusViewport) {
          const h = measure(child.id);
          centerOnNode(
            fresh.position.x,
            fresh.position.y,
            NODE_WIDTH,
            h || FALLBACK_NODE_HEIGHT,
            preserveZoom ? zoom : undefined,
          );
        }

        if (focusInput) focusNodeTextarea(child.id);
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
