import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import clsx from "clsx";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { NODE_MAX_WIDTH, NODE_WIDTH } from "@/lib/canvasConstants";
import type { NodeId } from "@shared/types";

interface ResizeHandleProps {
  nodeId: NodeId;
  width: number;
  isVisible: boolean;
}

export function ResizeHandle({ nodeId, width, isVisible }: ResizeHandleProps) {
  const patchNode = useCanvasStore((s) => s.patchNode);
  const { getZoom } = useReactFlow();
  const [isResizing, setIsResizing] = useState(false);
  const startRef = useRef<{ x: number; w: number; zoom: number } | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      startRef.current = { x: e.clientX, w: width, zoom: getZoom() || 1 };
    },
    [width, getZoom],
  );

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const start = startRef.current;
      if (!start) return;
      const deltaScreen = e.clientX - start.x;
      const deltaFlow = deltaScreen / (start.zoom || 1);
      const next = Math.max(NODE_WIDTH, Math.min(NODE_MAX_WIDTH, start.w + deltaFlow));
      patchNode(nodeId, { width: next });
    };
    const onUp = () => {
      setIsResizing(false);
      startRef.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isResizing, nodeId, patchNode]);

  return (
    <div
      className={clsx(
        "nodrag absolute top-0 -right-1 h-full w-2 transition-opacity duration-150",
        isVisible || isResizing ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
    >
      <div
        role="button"
        aria-label="Resize node width"
        onMouseDown={onMouseDown}
        className="h-full w-full cursor-ew-resize"
      />
    </div>
  );
}
