import { memo } from "react";
import {
  BaseEdge,
  Position,
  getBezierPath,
  useInternalNode,
  type EdgeProps,
} from "@xyflow/react";
import { NODE_WIDTH, FALLBACK_NODE_HEIGHT } from "@/lib/canvasConstants";

type OffsetEdgeData = {
  sourceYOffset?: number;
};

// Ported from avera's SelectionEdge: when an edge carries a `sourceYOffset`,
// override the source attach point so the connector emerges from the parent
// at the Y where the child was created. Falls back to the node's vertical
// center if the offset is missing. Side (left/right) is chosen by the relative
// X of the target so the edge still routes sensibly if the child is dragged.
function OffsetEdgeComponent({
  id,
  source,
  targetX,
  targetY,
  targetPosition,
  data,
  style,
  markerEnd,
}: EdgeProps & { data?: OffsetEdgeData }) {
  const sourceNode = useInternalNode(source);
  if (!sourceNode) return null;

  const width = sourceNode.measured?.width ?? NODE_WIDTH;
  const height = sourceNode.measured?.height ?? FALLBACK_NODE_HEIGHT;
  const offset = data?.sourceYOffset ?? height / 2;
  const clampedY = Math.max(0, Math.min(offset, height));

  const absX = sourceNode.internals.positionAbsolute.x;
  const absY = sourceNode.internals.positionAbsolute.y;

  const targetOnRight = targetX >= absX + width / 2;
  const sourcePosition = targetOnRight ? Position.Right : Position.Left;
  const sourceX = targetOnRight ? absX + width : absX;
  const sourceY = absY + clampedY;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition: targetPosition ?? Position.Left,
  });

  return <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />;
}

export const OffsetEdge = memo(OffsetEdgeComponent);
