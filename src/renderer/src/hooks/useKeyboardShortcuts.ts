import { useEffect } from "react";
import { useCanvasStore, makeBlankNode } from "./useCanvasStore";

export function useKeyboardShortcuts() {
  const addNode = useCanvasStore((s) => s.addNode);
  const connectEdge = useCanvasStore((s) => s.connectEdge);
  const removeNode = useCanvasStore((s) => s.removeNode);

  useEffect(() => {
    const getSelectedNodeId = (): string | null => {
      const active = document.activeElement;
      if (active && (active as HTMLElement).closest?.(".react-flow__node")) {
        const el = (active as HTMLElement).closest<HTMLElement>(".react-flow__node");
        return el?.getAttribute("data-id") ?? null;
      }
      const selected = document.querySelector<HTMLElement>(".react-flow__node.selected");
      return selected?.getAttribute("data-id") ?? null;
    };

    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        el.isContentEditable === true
      );
    };

    const onKey = (e: KeyboardEvent) => {
      // ⌘+B → branch from currently selected node
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        if (isEditable(e.target)) return;
        const id = getSelectedNodeId();
        if (!id) return;
        e.preventDefault();
        const state = useCanvasStore.getState();
        const parent = state.nodes[id];
        if (!parent) return;
        const offsetY = (parent.data.chat.childIds.length ?? 0) * 40;
        const child = makeBlankNode(
          { x: parent.position.x + 480, y: parent.position.y + offsetY },
          id
        );
        addNode(child);
        connectEdge(id, child.id);
      }

      // Backspace / Delete → remove selected node (but NOT when typing)
      if ((e.key === "Backspace" || e.key === "Delete") && !isEditable(e.target)) {
        const id = getSelectedNodeId();
        if (!id) return;
        e.preventDefault();
        if (confirm("delete this node?")) removeNode(id);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addNode, connectEdge, removeNode]);
}
