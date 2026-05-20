import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, useStoreApi, type Node } from "@xyflow/react";
import { FALLBACK_NODE_HEIGHT, NODE_WIDTH } from "@/lib/canvasConstants";
import type {
  GeneratedNodeSummary,
  GroupSummary,
} from "@/lib/groupSummary";

const GROUP_PADDING = 28;
const OVERLAP_STEP_BASE = 28;
const VIEWPORT_VISIBILITY_TOLERANCE = 8;
const VISIBILITY_DEBOUNCE_MS = 10;
const NEAR_MAX_ZOOM_OUT_THRESHOLD = 0.15;
const TOO_ZOOMED_IN_THRESHOLD = 3.0;

const OVERLAY_PALETTE = [
  { border: "rgba(59, 130, 246, 0.88)", fill: "rgba(59, 130, 246, 0.06)" },
  { border: "rgba(16, 185, 129, 0.88)", fill: "rgba(16, 185, 129, 0.06)" },
  { border: "rgba(245, 158, 11, 0.88)", fill: "rgba(245, 158, 11, 0.06)" },
  { border: "rgba(239, 68, 68, 0.88)", fill: "rgba(239, 68, 68, 0.06)" },
  { border: "rgba(20, 184, 166, 0.88)", fill: "rgba(20, 184, 166, 0.06)" },
  { border: "rgba(168, 85, 247, 0.88)", fill: "rgba(168, 85, 247, 0.06)" },
  { border: "rgba(236, 72, 153, 0.88)", fill: "rgba(236, 72, 153, 0.06)" },
  { border: "rgba(34, 197, 94, 0.88)", fill: "rgba(34, 197, 94, 0.06)" },
  { border: "rgba(99, 102, 241, 0.88)", fill: "rgba(99, 102, 241, 0.06)" },
  { border: "rgba(251, 146, 60, 0.88)", fill: "rgba(251, 146, 60, 0.06)" },
];

type GroupSummaryOverlayProps = {
  summaries: GroupSummary[];
  nodeSummaries: GeneratedNodeSummary[];
  isGeneratingNodeSummaries?: boolean;
  isGeneratingGroups?: boolean;
  pendingSummaryNodeIds?: string[];
  nodes: Node[];
};

type GroupBounds = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  overlapLevel: number;
};

type NodeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

type SingleNodeLabel = {
  summaryId?: string;
  nodeId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  hasContext: boolean;
};

type NodeDataShape = {
  chat?: { addedContext?: string };
  width?: number;
};

function nodeData(node: Node): NodeDataShape {
  return (node.data ?? {}) as NodeDataShape;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getNodeDimensions(node: Node): { width: number; height: number } {
  const measured = (node as unknown as {
    measured?: { width?: number; height?: number };
    style?: { width?: number | string; height?: number | string };
  });

  const widthCandidates = [
    toFiniteNumber(measured.measured?.width),
    toFiniteNumber(node.width),
    toFiniteNumber(nodeData(node).width),
    toFiniteNumber(measured.style?.width),
  ].filter((v): v is number => Boolean(v && v > 0));

  const heightCandidates = [
    toFiniteNumber(measured.measured?.height),
    toFiniteNumber(node.height),
    toFiniteNumber(measured.style?.height),
  ].filter((v): v is number => Boolean(v && v > 0));

  return {
    width: widthCandidates.length > 0 ? Math.max(...widthCandidates) : NODE_WIDTH,
    height: heightCandidates.length > 0 ? Math.max(...heightCandidates) : FALLBACK_NODE_HEIGHT,
  };
}

function getNodeRect(node: Node): NodeRect {
  const { width, height } = getNodeDimensions(node);
  const x = node.position.x ?? 0;
  const y = node.position.y ?? 0;
  return { x, y, width, height, right: x + width, bottom: y + height };
}

function computeAllNodesVisible(
  nodes: Node[],
  vpX: number,
  vpY: number,
  zoom: number,
  vpWidth: number,
  vpHeight: number,
): boolean {
  if (nodes.length === 0 || vpWidth <= 0 || vpHeight <= 0) return false;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const rect = getNodeRect(node);
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.right);
    maxY = Math.max(maxY, rect.bottom);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return false;
  }

  const left = minX * zoom + vpX;
  const top = minY * zoom + vpY;
  const right = maxX * zoom + vpX;
  const bottom = maxY * zoom + vpY;

  return (
    left >= -VIEWPORT_VISIBILITY_TOLERANCE &&
    top >= -VIEWPORT_VISIBILITY_TOLERANCE &&
    right <= vpWidth + VIEWPORT_VISIBILITY_TOLERANCE &&
    bottom <= vpHeight + VIEWPORT_VISIBILITY_TOLERANCE
  );
}

export function GroupSummaryOverlay({
  summaries,
  nodeSummaries,
  isGeneratingNodeSummaries = false,
  isGeneratingGroups = false,
  pendingSummaryNodeIds,
  nodes,
}: GroupSummaryOverlayProps) {
  const storeApi = useStoreApi();
  const viewportWidth = useStore((s) => s.width);
  const viewportHeight = useStore((s) => s.height);

  const transformRef = useRef<HTMLDivElement>(null);
  const [areAllNodesVisible, setAreAllNodesVisible] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);

  // Subscribe to viewport transform; apply via DOM (no re-render). Only the
  // debounced visibility check triggers React state updates.
  useEffect(() => {
    const debounceTimerRef = { current: 0 as unknown as ReturnType<typeof setTimeout> };

    const applyTransform = (x: number, y: number, zoom: number) => {
      if (!transformRef.current) return;
      const el = transformRef.current;
      el.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
      const safeZoom = zoom > 0 ? zoom : 1;
      const groupTarget = Math.max(11, Math.min(20, 12 * safeZoom));
      const labelTarget = Math.max(11, Math.min(16, 11 * safeZoom));
      el.style.setProperty("--group-font-size", `${groupTarget / safeZoom}px`);
      el.style.setProperty("--label-font-size", `${labelTarget / safeZoom}px`);
    };

    const unsubscribe = storeApi.subscribe((state) => {
      const [x, y, zoom] = state.transform;
      applyTransform(x, y, zoom);
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setCurrentZoom(zoom);
        setAreAllNodesVisible(
          computeAllNodesVisible(nodes, x, y, zoom, state.width, state.height),
        );
      }, VISIBILITY_DEBOUNCE_MS);
    });

    const state = storeApi.getState();
    const [x, y, zoom] = state.transform;
    applyTransform(x, y, zoom);
    setCurrentZoom(zoom);
    setAreAllNodesVisible(
      computeAllNodesVisible(nodes, x, y, zoom, state.width, state.height),
    );

    return () => {
      unsubscribe();
      clearTimeout(debounceTimerRef.current);
    };
  }, [storeApi, nodes, viewportWidth, viewportHeight]);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const groups = useMemo<GroupBounds[]>(() => {
    if (summaries.length === 0 || nodes.length === 0) return [];

    const rawGroups: (GroupBounds & { nodeIdSet: Set<string> })[] = [];

    for (const summary of summaries) {
      if (summary.nodeIds.length <= 1) continue;

      const memberNodes = summary.nodeIds
        .map((id) => nodeMap.get(id))
        .filter((n): n is Node => Boolean(n));

      if (memberNodes.length === 0) continue;

      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      for (const node of memberNodes) {
        const rect = getNodeRect(node);
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.right);
        maxY = Math.max(maxY, rect.bottom);
      }

      rawGroups.push({
        id: summary.id,
        title: summary.title,
        x: minX - GROUP_PADDING,
        y: minY - GROUP_PADDING,
        width: maxX - minX + GROUP_PADDING * 2,
        height: maxY - minY + GROUP_PADDING * 2,
        overlapLevel: 0,
        nodeIdSet: new Set(summary.nodeIds),
      });
    }

    // Stagger overlapping groups outward.
    for (let i = 0; i < rawGroups.length; i++) {
      for (let j = 0; j < i; j++) {
        const sharesNode = [...rawGroups[i].nodeIdSet].some((id) =>
          rawGroups[j].nodeIdSet.has(id),
        );
        if (sharesNode) {
          rawGroups[i].overlapLevel = Math.max(
            rawGroups[i].overlapLevel,
            rawGroups[j].overlapLevel + 1,
          );
        }
      }
    }

    const safeZoom = Math.max(currentZoom, 0.05);
    const overlapStep = OVERLAP_STEP_BASE / safeZoom;

    return rawGroups.map(({ nodeIdSet: _drop, ...group }) => {
      void _drop;
      const expand = group.overlapLevel * overlapStep;
      return {
        ...group,
        x: group.x - expand,
        y: group.y - expand,
        width: group.width + expand * 2,
        height: group.height + expand * 2,
      };
    });
  }, [nodeMap, nodes.length, summaries, currentZoom]);

  const singleNodeLabels = useMemo<SingleNodeLabel[]>(() => {
    if (nodeSummaries.length === 0 || nodes.length === 0) return [];

    return nodeSummaries
      .map((summary) => {
        const node = nodeMap.get(summary.nodeId);
        if (!node) return null;
        const rect = getNodeRect(node);
        const label: SingleNodeLabel = {
          nodeId: summary.nodeId,
          title: summary.summary,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          hasContext: Boolean(nodeData(node).chat?.addedContext),
        };
        if (summary.id) label.summaryId = summary.id;
        return label;
      })
      .filter((l): l is SingleNodeLabel => l !== null);
  }, [nodeMap, nodeSummaries, nodes.length]);

  const summarizedNodeIds = useMemo(
    () => new Set(nodeSummaries.map((s) => s.nodeId)),
    [nodeSummaries],
  );

  const skeletonLabels = useMemo(() => {
    if (nodes.length === 0) return [];
    const pendingSet = new Set(pendingSummaryNodeIds ?? []);
    return nodes
      .filter(
        (node) =>
          !summarizedNodeIds.has(node.id) &&
          (isGeneratingNodeSummaries || pendingSet.has(node.id)),
      )
      .map((node) => {
        const rect = getNodeRect(node);
        return {
          nodeId: node.id,
          x: rect.x,
          y: rect.y,
          hasContext: Boolean(nodeData(node).chat?.addedContext),
        };
      });
  }, [isGeneratingNodeSummaries, nodes, summarizedNodeIds, pendingSummaryNodeIds]);

  const isNearMaxZoomOut = currentZoom <= NEAR_MAX_ZOOM_OUT_THRESHOLD;
  const isTooZoomedIn = currentZoom >= TOO_ZOOMED_IN_THRESHOLD;
  const isGenerating = isGeneratingNodeSummaries || isGeneratingGroups;
  const shouldShowOverlays =
    groups.length > 0 && (isNearMaxZoomOut || (areAllNodesVisible && !isTooZoomedIn));
  const shouldShowSingleNodeLabels =
    !isNearMaxZoomOut &&
    singleNodeLabels.length > 0 &&
    (isGenerating || !areAllNodesVisible || nodes.length === 1 || groups.length === 0);

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      <div ref={transformRef} style={{ transformOrigin: "0 0" }}>
        <AnimatePresence mode="sync">
          {shouldShowOverlays
            ? groups.map((group, index) => {
                const palette = OVERLAY_PALETTE[index % OVERLAY_PALETTE.length];
                return (
                  <motion.div
                    key={group.id}
                    className="absolute border pointer-events-none"
                    initial={{ opacity: 0, y: 6, scale: 0.992 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.996 }}
                    transition={{
                      duration: 0.15,
                      ease: [0.22, 1, 0.36, 1],
                      delay: Math.min(index * 0.02, 0.06),
                    }}
                    style={{
                      left: group.x,
                      top: group.y,
                      width: group.width,
                      height: group.height,
                      borderWidth: "1px",
                      borderStyle: "solid",
                      borderColor: palette.border,
                      backgroundColor: palette.fill,
                    }}
                  >
                    <div
                      className="absolute left-0 pointer-events-none"
                      style={{ top: "calc(-1em - 8px)" }}
                    >
                      <span
                        className="block whitespace-nowrap font-semibold tracking-tight text-foreground/90"
                        style={{
                          fontSize: "var(--group-font-size, 12px)",
                          lineHeight: 1.05,
                          opacity: 0.96,
                        }}
                      >
                        {group.title}
                      </span>
                    </div>
                  </motion.div>
                );
              })
            : null}
          {shouldShowSingleNodeLabels
            ? singleNodeLabels.map((label, index) => (
                <motion.div
                  key={`node-summary-${label.nodeId}`}
                  className="group absolute pointer-events-none"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 2 }}
                  transition={{
                    duration: 0.12,
                    ease: [0.22, 1, 0.36, 1],
                    delay: Math.min(index * 0.01, 0.04),
                  }}
                  style={{
                    left: label.x + 2,
                    top: `calc(${label.y}px - var(--label-font-size, 11px) * 1.5${label.hasContext ? " - 32px" : ""})`,
                    fontSize: "var(--label-font-size, 11px)",
                    lineHeight: 1.05,
                  }}
                >
                  <span
                    className="block whitespace-nowrap font-semibold tracking-tight text-foreground/90"
                    style={{ opacity: 0.96 }}
                  >
                    {label.title}
                  </span>
                </motion.div>
              ))
            : null}
          {skeletonLabels.map((skeleton, index) => (
            <motion.div
              key={`skeleton-${skeleton.nodeId}`}
              className="absolute pointer-events-none"
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 2 }}
              transition={{
                duration: 0.18,
                ease: [0.22, 1, 0.36, 1],
                delay: Math.min(index * 0.02, 0.1),
              }}
              style={{
                left: skeleton.x + 2,
                top: `calc(${skeleton.y}px - var(--label-font-size, 11px) * 1.5${skeleton.hasContext ? " - 32px" : ""})`,
              }}
            >
              <div
                className="h-[0.6em] w-24 rounded-sm bg-muted-foreground/15 animate-pulse"
                style={{ fontSize: "var(--label-font-size, 11px)" }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {isGeneratingGroups && groups.length === 0 && (
          <SkeletonGroupOverlays nodes={nodes} />
        )}
      </div>
    </div>
  );
}

const SKELETON_SHUFFLE_MS = 2500;

type SkeletonGroupBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function buildRandomPartition(rects: NodeRect[]): NodeRect[][] {
  const count = rects.length;
  if (count <= 3) return [rects];
  if (count === 4) return [rects.slice(0, 2), rects.slice(2)];

  const groups: NodeRect[][] = [];
  let i = 0;
  while (i < count) {
    const remaining = count - i;
    const maxChunk = remaining > 4 ? 3 : remaining <= 3 ? remaining : 2;
    const size = maxChunk <= 2 ? 2 : Math.random() < 0.5 ? 2 : 3;
    groups.push(rects.slice(i, i + size));
    i += size;
  }
  return groups;
}

function boundsFromRects(rects: NodeRect[]): SkeletonGroupBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.right);
    maxY = Math.max(maxY, r.bottom);
  }

  return {
    x: minX - GROUP_PADDING,
    y: minY - GROUP_PADDING,
    width: maxX - minX + GROUP_PADDING * 2,
    height: maxY - minY + GROUP_PADDING * 2,
  };
}

function SkeletonGroupOverlays({ nodes }: { nodes: Node[] }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), SKELETON_SHUFFLE_MS);
    return () => clearInterval(id);
  }, []);

  const rects = useMemo(
    () =>
      nodes
        .slice()
        .sort((a, b) => (a.position.x ?? 0) - (b.position.x ?? 0))
        .map(getNodeRect),
    [nodes],
  );

  const generate = useCallback((): {
    groups: SkeletonGroupBounds[];
    paletteStart: number;
  } => {
    if (rects.length === 0) return { groups: [], paletteStart: 0 };
    const partition = buildRandomPartition(rects);
    return {
      groups: partition.map(boundsFromRects),
      paletteStart: Math.floor(Math.random() * OVERLAY_PALETTE.length),
    };
  }, [rects]);

  const { groups: skeletonGroups, paletteStart } = useMemo(
    () => generate(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generate, tick],
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tick}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        {skeletonGroups.map((group, index) => {
          const palette = OVERLAY_PALETTE[(paletteStart + index) % OVERLAY_PALETTE.length];
          return (
            <motion.div
              key={index}
              className="absolute"
              animate={{ opacity: [0.5, 0.85, 0.5] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.3,
              }}
              style={{
                left: group.x,
                top: group.y,
                width: group.width,
                height: group.height,
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: palette.border,
                backgroundColor: palette.fill,
              }}
            />
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
