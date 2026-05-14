import { useEffect, useRef } from "react";

const MAX_LINES = 8;

export function useTextareaAutoResize(query: string) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineHeightRef = useRef<number | null>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    if (lineHeightRef.current === null) {
      const cs = window.getComputedStyle(ta);
      const fontSize = parseFloat(cs.fontSize) || 10;
      const lhRaw = cs.lineHeight;
      let lh: number;
      if (lhRaw === "normal") {
        lh = fontSize * 1.4;
      } else if (lhRaw.endsWith("px")) {
        lh = parseFloat(lhRaw);
      } else {
        const factor = parseFloat(lhRaw);
        lh = Number.isFinite(factor) ? fontSize * factor : fontSize * 1.4;
      }
      lineHeightRef.current = lh > 0 ? lh : fontSize * 1.4;
    }

    const maxHeight = lineHeightRef.current * MAX_LINES;

    ta.style.height = "auto";
    const scrollHeight = ta.scrollHeight;
    const newHeight = Math.min(scrollHeight, maxHeight);

    ta.style.height = `${newHeight}px`;
    ta.style.maxHeight = `${maxHeight}px`;
    ta.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
  }, [query]);

  return { textareaRef };
}
