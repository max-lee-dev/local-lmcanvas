import { useEffect } from "react";
import { X } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "@/components/Canvas/Canvas";
import {
  CanvasStoreProvider,
  makeBlankNode,
  useCanvasStore,
  useCanvasStoreApi,
} from "@/hooks/useCanvasStore";
import { PaneProvider, useActivePaneStore } from "@/hooks/useActivePane";
import { SearchButton } from "@/components/Canvas/SearchModal";
import { InProgressNodesIndicator } from "@/components/Canvas/InProgressNodesIndicator";
import { CanvasBreadcrumb } from "@/components/CanvasManager/CanvasBreadcrumb";
import { DeleteNodeModal } from "@/components/Canvas/DeleteNodeModal";
import { SearchModalProvider } from "@/providers/SearchModalProvider";
import { CommandPaletteProvider } from "@/providers/CommandPaletteProvider";
import { closePane } from "@/lib/canvasNavigation";
import { useFocusRequestStore } from "@/hooks/useFocusRequestStore";
import { useCenterOnNode } from "@/hooks/useCenterOnNode";
import { FALLBACK_NODE_HEIGHT, NODE_WIDTH } from "@/lib/canvasConstants";
import { useRegisterPaneStore } from "@/hooks/usePaneRegistry";
import { useBranchRequestStore } from "@/hooks/useBranchRequestStore";
import { useBranchFromNode } from "@/hooks/useBranchFromNode";

type CanvasPaneProps = {
  /** The canvas to load into this pane. Also serves as the pane's identity. */
  id: string;
  /** True when this pane is one of two panes in a split layout. */
  splitMode: boolean;
  /**
   * Which side of the pane the per-pane controls (search + close) anchor to.
   * Defaults to "right". In split mode the right pane uses "left" so the
   * controls frame the divider instead of crowding the global settings gear.
   */
  controlsSide?: "left" | "right";
};

/**
 * A single canvas pane. Owns its store + its search/palette providers so each
 * pane has independent modal state. Multiple panes can mount side-by-side for
 * split-screen. The pane registers as active on mousedown so global keyboard
 * shortcuts and the delete modal route to the focused pane.
 */
export function CanvasPane({ id, splitMode, controlsSide = "right" }: CanvasPaneProps) {
  return (
    <PaneProvider id={id}>
      <CanvasStoreProvider>
        <SearchModalProvider>
          <CommandPaletteProvider>
            <ReactFlowProvider>
              <CanvasPaneInner
                id={id}
                splitMode={splitMode}
                controlsSide={controlsSide}
              />
            </ReactFlowProvider>
          </CommandPaletteProvider>
        </SearchModalProvider>
      </CanvasStoreProvider>
    </PaneProvider>
  );
}

function CanvasPaneInner({ id, splitMode, controlsSide = "right" }: CanvasPaneProps) {
  const storeApi = useCanvasStoreApi();
  useRegisterPaneStore(id, storeApi);
  const loadCanvas = useCanvasStore((s) => s.loadCanvas);
  const loaded = useCanvasStore((s) => s.loaded);
  const canvasId = useCanvasStore((s) => s.canvasId);
  const cwd = useCanvasStore((s) => s.cwd);
  const error = useCanvasStore((s) => s.error);
  const saving = useCanvasStore((s) => s.saving);
  const nodes = useCanvasStore((s) => s.nodes);
  const nodeCount = Object.keys(nodes).length;
  const addNode = useCanvasStore((s) => s.addNode);
  const setActive = useActivePaneStore((s) => s.setActive);
  const activePaneId = useActivePaneStore((s) => s.activePaneId);
  const focusRequest = useFocusRequestStore((s) => s.request);
  const consumeFocus = useFocusRequestStore((s) => s.consume);
  const centerOnNode = useCenterOnNode();

  const isActive = activePaneId === id;

  useEffect(() => {
    if (id && canvasId !== id) void loadCanvas(id);
  }, [id, canvasId, loadCanvas]);

  // Empty canvas → drop a single starter node automatically so users land
  // directly in the prompt input instead of an empty-state screen.
  useEffect(() => {
    if (!loaded || error || canvasId !== id) return;
    if (nodeCount !== 0) return;
    addNode(makeBlankNode({ x: 0, y: 0 }));
  }, [loaded, error, canvasId, id, nodeCount, addNode]);

  // Auto-claim active in single-pane mode so keyboard shortcuts have a target
  // before any user interaction.
  useEffect(() => {
    if (!splitMode) setActive(id);
  }, [id, splitMode, setActive]);

  useEffect(() => {
    if (!focusRequest) return;
    if (!loaded || canvasId !== id) return;
    if (focusRequest.canvasId !== id) return;
    const node = nodes[focusRequest.nodeId];
    if (!node) return;
    centerOnNode(node.position.x, node.position.y, NODE_WIDTH, FALLBACK_NODE_HEIGHT);
    consumeFocus(focusRequest.canvasId, focusRequest.nodeId, focusRequest.requestedAt);
  }, [focusRequest, loaded, canvasId, id, nodes, centerOnNode, consumeFocus]);

  return (
    <div
      className="group relative h-full w-full overflow-hidden"
      onMouseDownCapture={() => setActive(id)}
    >
      {/* Active-pane outline (only meaningful in split mode) */}
      {splitMode && isActive && (
        <div className="pointer-events-none absolute inset-0 z-40 ring-2 ring-inset ring-primary/40" />
      )}

      {/* Top-center breadcrumb */}
      {(cwd || saving) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 no-drag">
          <CanvasBreadcrumb
            cwd={cwd}
            currentCanvasId={id}
            saving={saving}
            splitMode={splitMode}
          />
        </div>
      )}

      {/* Per-pane controls (search + close-pane in split). Anchored to whichever
          side keeps it away from the globe + settings cluster in the viewport's
          top-right corner. In single-pane mode that cluster sits at right-3
          and is ~72px wide (two 28px buttons + gap), so we shift right-anchored
          controls past it. */}
      <div
        className={`absolute top-3 ${controlsSide === "left" ? "left-3" : splitMode ? "right-3" : "right-20"} z-30 no-drag flex items-center gap-1.5`}
      >
        <InProgressNodesIndicator />
        <SearchButton />
        {splitMode && (
          <button
            onClick={() => closePane(id)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-muted cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            title="close pane"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Canvas */}
      <div className="absolute inset-0">
        {!loaded && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            loading…
          </div>
        )}
        {loaded && error && (
          <div className="flex h-full items-center justify-center text-sm text-destructive">
            {error}
          </div>
        )}
        {loaded && !error && <Canvas />}
      </div>

      <DeleteNodeModal />
      <BranchRequestListener paneId={id} />
    </div>
  );
}

/**
 * Watches the global branch-request store and, when a request targets this
 * pane, calls `useBranchFromNode` to spawn a child node and select it so the
 * right-side node drawer follows the conversation forward. This indirection
 * lets the drawer (which lives outside any pane / ReactFlow context) trigger
 * the same branching path the canvas uses internally.
 */
function BranchRequestListener({ paneId }: { paneId: string }) {
  const pending = useBranchRequestStore((s) => s.pending);
  const consume = useBranchRequestStore((s) => s.consume);
  const setSelectedNodeId = useCanvasStore((s) => s.setSelectedNodeId);

  const matches = pending?.paneId === paneId;
  const parentId = matches ? pending!.parentId : "";
  const branch = useBranchFromNode(parentId);

  useEffect(() => {
    if (!pending || !matches || !parentId) return;
    const requestId = pending.requestId;
    branch({
      prefill: pending.prefill,
      autoSubmit: true,
      onCreated: (childId) => {
        // Move canvas selection onto the new child so the drawer
        // auto-switches to it and keeps streaming visible.
        setSelectedNodeId(childId);
      },
    });
    consume(requestId);
  }, [pending, matches, parentId, branch, consume, setSelectedNodeId]);

  return null;
}
