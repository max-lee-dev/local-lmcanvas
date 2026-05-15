import {
  useEffect,
  useRef,
  useState,
  type DragEventHandler,
  type RefObject,
} from "react";
import type { NodePromptInputHandle } from "@/components/Canvas/NodePromptInput";

type Options = {
  promptInputRef: RefObject<NodePromptInputHandle | null>;
  promptInputMounted: boolean;
  // Whether dropping on a submitted node should re-enter edit mode.
  canEnterEdit: boolean;
  enterEdit: () => void;
};

// Drag-drop handling for a canvas node card:
//   - hover state for visual feedback (dragOver)
//   - drop while prompt input is mounted: pipe files straight into it
//   - drop while submitted/closed: queue files, enter edit mode, drain into
//     the prompt input on next mount
export function useNodeFileDrop({
  promptInputRef,
  promptInputMounted,
  canEnterEdit,
  enterEdit,
}: Options) {
  const [dragOver, setDragOver] = useState(false);
  const pendingFilesRef = useRef<File[] | null>(null);

  useEffect(() => {
    if (!promptInputMounted) return;
    const pending = pendingFilesRef.current;
    if (!pending) return;
    pendingFilesRef.current = null;
    requestAnimationFrame(() => {
      void promptInputRef.current?.addFiles(pending);
    });
  }, [promptInputMounted, promptInputRef]);

  const onDragOver: DragEventHandler<HTMLElement> = (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const onDragLeave: DragEventHandler<HTMLElement> = (e) => {
    // Ignore leaves into descendants — only react when leaving the card.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  };

  const onDrop: DragEventHandler<HTMLElement> = (e) => {
    if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (promptInputMounted) {
      void promptInputRef.current?.addFiles(files);
    } else if (canEnterEdit) {
      pendingFilesRef.current = files;
      enterEdit();
    }
  };

  return { dragOver, onDragOver, onDragLeave, onDrop };
}
