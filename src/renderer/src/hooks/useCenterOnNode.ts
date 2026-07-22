import { useCallback } from "react";
import { useReactFlow, useStoreApi } from "@xyflow/react";
import { FOCUS_DURATION_MS, FOCUS_ZOOM } from "@/lib/canvasConstants";

function getVisibleCenterX(flowElement: HTMLElement, width: number): number {
  const panel = document.querySelector<HTMLElement>("[data-node-panel]");
  if (!panel) return width / 2;

  const flowBounds = flowElement.getBoundingClientRect();
  const offsetParent = panel.offsetParent;
  const parentLeft =
    offsetParent instanceof HTMLElement
      ? offsetParent.getBoundingClientRect().left
      : 0;
  const panelLeft = parentLeft + panel.offsetLeft;
  const panelRight = panelLeft + panel.offsetWidth;
  const overlapsFlow =
    panelLeft < flowBounds.right && panelRight > flowBounds.left;

  if (!overlapsFlow) return width / 2;

  const visibleWidth = Math.min(width, panelLeft - flowBounds.left);
  return visibleWidth > 0 ? visibleWidth / 2 : width / 2;
}

/**
 * Wraps xyflow's setViewport to smoothly center on a node's bounding box at
 * the given zoom. When the node panel overlaps the pane, the node is centered
 * in the portion of the canvas that remains visible.
 */
export function useCenterOnNode(): (
  x: number,
  y: number,
  width: number,
  height: number,
  zoom?: number,
  duration?: number,
) => void {
  const { setViewport } = useReactFlow();
  const flowStore = useStoreApi();

  return useCallback(
    (
      x: number,
      y: number,
      width: number,
      height: number,
      zoom: number = FOCUS_ZOOM,
      duration: number = FOCUS_DURATION_MS,
    ) => {
      const {
        domNode,
        width: flowWidth,
        height: flowHeight,
      } = flowStore.getState();
      const cw = flowWidth || domNode?.clientWidth || window.innerWidth;
      const ch = flowHeight || domNode?.clientHeight || window.innerHeight;
      const visibleCenterX = domNode ? getVisibleCenterX(domNode, cw) : cw / 2;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const vx = visibleCenterX - centerX * zoom;
      const vy = ch / 2 - centerY * zoom;
      void setViewport({ x: vx, y: vy, zoom }, { duration });
    },
    [flowStore, setViewport],
  );
}
