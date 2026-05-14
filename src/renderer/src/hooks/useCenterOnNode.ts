import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { FOCUS_DURATION_MS, FOCUS_ZOOM } from "@/lib/canvasConstants";

/**
 * Wraps xyflow's setViewport to smoothly center on a node's bounding box at
 * the given zoom. Mirrors avera's `centerOnNode(x, y, w, h, zoom, duration)`.
 *
 * We compute the target viewport ourselves rather than using `setCenter` so
 * that the math matches avera's helper exactly (in case we ever want to
 * offset, e.g. for mobile top-padding).
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

  return useCallback(
    (
      x: number,
      y: number,
      width: number,
      height: number,
      zoom: number = FOCUS_ZOOM,
      duration: number = FOCUS_DURATION_MS,
    ) => {
      const container = document.querySelector(".react-flow") as HTMLElement | null;
      const cw = container?.clientWidth ?? window.innerWidth;
      const ch = container?.clientHeight ?? window.innerHeight;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const vx = cw / 2 - centerX * zoom;
      const vy = ch / 2 - centerY * zoom;
      void setViewport({ x: vx, y: vy, zoom }, { duration });
    },
    [setViewport],
  );
}
