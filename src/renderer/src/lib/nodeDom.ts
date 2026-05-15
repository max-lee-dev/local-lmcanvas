import { FALLBACK_NODE_HEIGHT } from "./canvasConstants";

export function measureNodeHeight(nodeId: string, zoom: number): number {
  const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
  if (!el) return FALLBACK_NODE_HEIGHT;
  const rect = (el as HTMLElement).getBoundingClientRect();
  if (!zoom || zoom <= 0) return rect.height || FALLBACK_NODE_HEIGHT;
  return rect.height / zoom;
}

export function focusNodeTextarea(nodeId: string): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const editor = document.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${nodeId}"] [contenteditable="true"], .react-flow__node[data-id="${nodeId}"] textarea`,
      );
      if (!editor) return;
      editor.focus({ preventScroll: true });
      if (editor.isContentEditable) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  });
}
