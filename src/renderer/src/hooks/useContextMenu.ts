import { useCallback, useState } from "react";
import { useReactFlow, type Node } from "@xyflow/react";
import { makeBlankNode, useCanvasStore } from "./useCanvasStore";
import { focusNodeTextarea } from "@/components/Canvas/CustomNode";

export type MenuOption = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export function useContextMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rightClickedNodeId, setRightClickedNodeId] = useState<string | null>(null);

  const addNode = useCanvasStore((s) => s.addNode);
  const connectEdge = useCanvasStore((s) => s.connectEdge);
  const removeNode = useCanvasStore((s) => s.removeNode);

  const { screenToFlowPosition } = useReactFlow();

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setRightClickedNodeId(null);
      setPosition({ x: event.clientX, y: event.clientY });
      setIsOpen(true);
    },
    []
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setRightClickedNodeId(node.id);
      setPosition({ x: event.clientX, y: event.clientY });
      setIsOpen(true);
    },
    []
  );

  const createNodeAtPointer = useCallback(() => {
    const flowPos = screenToFlowPosition({ x: position.x, y: position.y });
    const parentId = rightClickedNodeId ?? undefined;
    const child = makeBlankNode(flowPos, parentId);
    addNode(child);
    if (parentId) {
      connectEdge(parentId, child.id);
    }
    focusNodeTextarea(child.id);
  }, [addNode, connectEdge, position.x, position.y, rightClickedNodeId, screenToFlowPosition]);

  const deleteNodeAtPointer = useCallback(() => {
    if (!rightClickedNodeId) return;
    removeNode(rightClickedNodeId);
  }, [removeNode, rightClickedNodeId]);

  const close = useCallback(() => {
    setIsOpen(false);
    setRightClickedNodeId(null);
  }, []);

  return {
    isOpen,
    position,
    rightClickedNodeId,
    handlePaneContextMenu,
    handleNodeContextMenu,
    createNodeAtPointer,
    deleteNodeAtPointer,
    close,
  };
}
