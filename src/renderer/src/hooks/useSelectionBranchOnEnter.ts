import { useEffect } from "react";
import type { SelectionSnapshot } from "@/hooks/useSelection";
import type { BranchFn } from "@/hooks/useBranchFromNode";

// When a text selection inside the node is active, pressing Enter (no
// modifiers, not focused inside a text input) branches off with the selected
// text attached as context — same gesture as clicking the selection action.
export function useSelectionBranchOnEnter(
  selection: SelectionSnapshot | null,
  branch: BranchFn,
): void {
  useEffect(() => {
    if (!selection) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== "Enter") return;
      if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      const text = selection.text;
      const viewportY = selection.position.y;
      selection.clear({ removeRange: true });
      branch({ addedContext: text, selectionViewportY: viewportY });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selection, branch]);
}
