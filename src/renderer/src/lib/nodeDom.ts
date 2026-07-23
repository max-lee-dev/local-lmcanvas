import { FALLBACK_NODE_HEIGHT } from "./canvasConstants";

export function measureNodeHeight(nodeId: string, zoom: number): number {
  const el = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`);
  if (!el) return FALLBACK_NODE_HEIGHT;
  const rect = (el as HTMLElement).getBoundingClientRect();
  if (!zoom || zoom <= 0) return rect.height || FALLBACK_NODE_HEIGHT;
  return rect.height / zoom;
}

export function findMessageTextViewportY(
  nodeId: string,
  messageId: string | undefined,
  selectedText: string,
): number | undefined {
  if (!messageId) return undefined;

  const nodeElement = Array.from(
    document.querySelectorAll<HTMLElement>(".react-flow__node[data-id]"),
  ).find((element) => element.dataset.id === nodeId);
  const messageElement = nodeElement
    ? Array.from(
        nodeElement.querySelectorAll<HTMLElement>("[data-canvas-message-id]"),
      ).find((element) => element.dataset.canvasMessageId === messageId)
    : undefined;
  if (!messageElement) return undefined;

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    messageElement,
    NodeFilter.SHOW_TEXT,
  );
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  const fullText = textNodes.map((node) => node.data).join("");
  const trimmedSelection = selectedText.trim();
  const selectionStart = fullText.indexOf(selectedText) >= 0
    ? fullText.indexOf(selectedText)
    : fullText.indexOf(trimmedSelection);
  const matchedText = fullText.indexOf(selectedText) >= 0
    ? selectedText
    : trimmedSelection;

  if (selectionStart >= 0 && matchedText) {
    const selectionEnd = selectionStart + matchedText.length;
    let cursor = 0;
    let startNode: Text | undefined;
    let endNode: Text | undefined;
    let startOffset = 0;
    let endOffset = 0;

    for (const textNode of textNodes) {
      const nextCursor = cursor + textNode.length;
      if (!startNode && selectionStart <= nextCursor) {
        startNode = textNode;
        startOffset = Math.max(0, selectionStart - cursor);
      }
      if (selectionEnd <= nextCursor) {
        endNode = textNode;
        endOffset = Math.max(0, selectionEnd - cursor);
        break;
      }
      cursor = nextCursor;
    }

    if (startNode && endNode) {
      const range = document.createRange();
      range.setStart(startNode, Math.min(startOffset, startNode.length));
      range.setEnd(endNode, Math.min(endOffset, endNode.length));
      const rects = range.getClientRects();
      const endRect = rects.length > 0 ? rects[rects.length - 1] : undefined;
      if (endRect && (endRect.height || endRect.width)) {
        return (endRect.top + endRect.bottom) / 2;
      }
    }
  }

  const messageRect = messageElement.getBoundingClientRect();
  return messageRect.height > 0
    ? (messageRect.top + messageRect.bottom) / 2
    : undefined;
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
