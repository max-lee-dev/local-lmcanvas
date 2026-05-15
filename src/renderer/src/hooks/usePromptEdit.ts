import { useCallback, useEffect, useState, type RefObject } from "react";
import type { Attachment } from "@shared/ipc";
import { useCanvasStore } from "@/hooks/useCanvasStore";

type Options = {
  nodeId: string;
  canEdit: boolean;
  rootRef: RefObject<HTMLElement | null>;
  submit: (text: string, attachments?: Attachment[]) => unknown;
  stop: () => void;
};

// Manages the "edit my prompt" mode for an already-submitted node:
//   - begin(): enter edit mode unless the user has a text selection active
//     (so highlighting assistant text doesn't accidentally trigger edit)
//   - commit(text, attachments): stop any in-flight stream, clear messages,
//     resubmit
//   - cancel(): exit edit mode
//   - closes on outside-click (pointerdown outside rootRef)
export function usePromptEdit({
  nodeId,
  canEdit,
  rootRef,
  submit,
  stop,
}: Options) {
  const clearMessages = useCanvasStore((s) => s.clearMessages);
  const [isEditing, setIsEditing] = useState(false);

  const begin = useCallback(() => {
    if (!canEdit) return;
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
    setIsEditing(true);
  }, [canEdit]);

  const commit = useCallback(
    (text: string, attachments?: Attachment[]) => {
      stop();
      clearMessages(nodeId);
      setIsEditing(false);
      void submit(text, attachments);
    },
    [nodeId, stop, clearMessages, submit],
  );

  const cancel = useCallback(() => setIsEditing(false), []);

  useEffect(() => {
    if (!isEditing) return;
    const onPointerDown = (e: PointerEvent): void => {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      setIsEditing(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isEditing, rootRef]);

  return { isEditing, begin, commit, cancel, setIsEditing };
}
