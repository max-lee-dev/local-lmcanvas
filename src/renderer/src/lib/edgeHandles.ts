export type EdgeHandlePair = {
  sourceHandle: string;
  targetHandle: string;
};

// Ported from avera's getEdgeHandles. Picks the best handle pair based on the
// relative positions of source and target. Position deltas alone are enough —
// node widths/heights would only refine center math, but the dominant axis of
// a position delta already gives the correct visual routing.
//
// Never returns target-bottom: edges should not enter a child from below
// (it produces a confusing upward loop).
export function getEdgeHandles(
  source: { x: number; y: number },
  target: { x: number; y: number },
): EdgeHandlePair {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX >= absY) {
    if (deltaX >= 0) {
      return { sourceHandle: "source-right", targetHandle: "target-left" };
    }
    return { sourceHandle: "source-left", targetHandle: "target-right" };
  }

  if (deltaY >= 0) {
    return { sourceHandle: "source-bottom", targetHandle: "target-top" };
  }
  if (deltaX >= 0) {
    return { sourceHandle: "source-right", targetHandle: "target-left" };
  }
  return { sourceHandle: "source-left", targetHandle: "target-right" };
}
