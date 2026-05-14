// Horizontal collision resolution, ported from avera's
// `app/lib/collisionDetection.ts` (resolveHorizontalCollisions) but simplified
// for local-lmcanvas, which doesn't carry node dimensions in node.data.
//
// Gist: when a new node is inserted, any existing node whose bounding box
// overlaps it on the same horizontal lane gets pushed to the right. Pushed
// nodes can transitively push further nodes (cascade), but only rightward —
// never back leftward — to avoid ping-pong.

import type { CanvasNode, NodeId } from "@shared/types";
import {
  COLLISION_PADDING_PX,
  FALLBACK_NODE_HEIGHT,
  MAX_CASCADE_ITERATIONS_MIN,
  NODE_WIDTH,
} from "./canvasConstants";

export type Rect = { x: number; y: number; width: number; height: number };
export type Displacement = { x: number; y: number };

type QueueItem = { nodeId: NodeId | null; box: Rect };

function getRect(
  node: CanvasNode,
  measureHeight: (id: NodeId) => number,
  fixedWidth: number,
): Rect {
  return {
    x: node.position.x,
    y: node.position.y,
    width: fixedWidth,
    height: measureHeight(node.id),
  };
}

function horizontalOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x;
}

function verticalOverlap(a: Rect, b: Rect): boolean {
  return a.y < b.y + b.height && a.y + a.height > b.y;
}

function offset(base: Rect, d: Displacement): Rect {
  return { x: base.x + d.x, y: base.y + d.y, width: base.width, height: base.height };
}

export type ResolveCollisionsOptions = {
  /** Width to use for every node (we don't store per-node width). */
  fixedWidth?: number;
  /** Extra padding around overlap test. Default 50. */
  paddingPx?: number;
  /** Node ids to exclude from being pushed (e.g. the new node's parents). */
  excludeIds?: NodeId[];
};

/**
 * Resolve horizontal collisions for `targetId` against the other nodes.
 *
 * Returns a map of { nodeId -> { x, y } } NEW absolute positions for every
 * node that needs to move. Nodes that don't move are not included.
 *
 * `measureHeight` should consult the DOM (`document.querySelector('.react-flow__node[data-id=...]')`)
 * and fall back to FALLBACK_NODE_HEIGHT when the node hasn't rendered yet.
 */
export function resolveCollisions(
  targetId: NodeId,
  nodesById: Record<NodeId, CanvasNode>,
  measureHeight: (id: NodeId) => number,
  options: ResolveCollisionsOptions = {},
): Record<NodeId, { x: number; y: number }> {
  const fixedWidth = options.fixedWidth ?? NODE_WIDTH;
  const padding = options.paddingPx ?? COLLISION_PADDING_PX;
  const excludeIds = new Set(options.excludeIds ?? []);

  const target = nodesById[targetId];
  if (!target) return {};

  const targetBox = getRect(target, measureHeight, fixedWidth);

  const candidates: CanvasNode[] = [];
  for (const id of Object.keys(nodesById)) {
    if (id === targetId) continue;
    if (excludeIds.has(id)) continue;
    candidates.push(nodesById[id]);
  }
  if (candidates.length === 0) return {};

  const baseBoxes = new Map<NodeId, Rect>();
  for (const n of candidates) {
    baseBoxes.set(n.id, getRect(n, measureHeight, fixedWidth));
  }

  // Quick reject: if nothing overlaps the target box at all, bail early.
  let hasOverlap = false;
  for (const n of candidates) {
    const box = baseBoxes.get(n.id);
    if (!box) continue;
    if (verticalOverlap(targetBox, box) && horizontalOverlap(targetBox, box)) {
      hasOverlap = true;
      break;
    }
  }
  if (!hasOverlap) return {};

  const displacements = new Map<NodeId, Displacement>();
  const queue: QueueItem[] = [{ nodeId: null, box: targetBox }];

  const maxIterations = Math.max(
    MAX_CASCADE_ITERATIONS_MIN,
    candidates.length * candidates.length,
  );
  let iterations = 0;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations += 1;
    const source = queue.shift();
    if (!source) break;

    for (const node of candidates) {
      if (source.nodeId === node.id) continue;

      const baseBox = baseBoxes.get(node.id);
      if (!baseBox) continue;

      const current = displacements.get(node.id) ?? { x: 0, y: 0 };
      const currentBox = offset(baseBox, current);

      if (!verticalOverlap(source.box, currentBox)) continue;
      // Rightward-only push (avera's invariant — prevents ping-pong)
      if (currentBox.x < source.box.x) continue;
      if (!horizontalOverlap(source.box, currentBox)) continue;

      const requiredX = source.box.x + source.box.width + padding;
      const deltaX = requiredX - currentBox.x;
      if (deltaX <= 0) continue;

      const next = { x: current.x + deltaX, y: current.y };
      displacements.set(node.id, next);
      queue.push({ nodeId: node.id, box: offset(baseBox, next) });
    }
  }

  const moves: Record<NodeId, { x: number; y: number }> = {};
  for (const [id, d] of displacements) {
    const baseBox = baseBoxes.get(id);
    if (!baseBox) continue;
    moves[id] = { x: baseBox.x + d.x, y: baseBox.y + d.y };
  }
  return moves;
}

/**
 * Default height-measurer that reads the rendered DOM node's bounding rect
 * and falls back to FALLBACK_NODE_HEIGHT when the element isn't mounted yet.
 * `zoom` is needed because react-flow's transform scales the rendered height.
 */
export function makeDomHeightMeasurer(zoom: number): (id: NodeId) => number {
  return (id: NodeId): number => {
    if (typeof document === "undefined") return FALLBACK_NODE_HEIGHT;
    const el = document.querySelector(
      `.react-flow__node[data-id="${id}"]`,
    );
    if (!el) return FALLBACK_NODE_HEIGHT;
    const rect = (el as HTMLElement).getBoundingClientRect();
    if (!zoom || zoom <= 0) return rect.height || FALLBACK_NODE_HEIGHT;
    return rect.height / zoom || FALLBACK_NODE_HEIGHT;
  };
}
