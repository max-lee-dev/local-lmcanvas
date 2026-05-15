import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type WheelEvent,
} from "react";
import type { FileEntry } from "@shared/ipc";

// A single piece of editor content. Mentions are first-class so that callers
// can serialize them back to `@path` tokens at submit time.
export type Segment =
  | { kind: "text"; text: string }
  | { kind: "mention"; entry: FileEntry };

// Information about an in-progress `@` mention under the caret. Reported via
// `onTriggerChange` whenever the user types so the parent can drive the picker.
export type MentionTrigger = {
  query: string;
};

export type MentionEditorHandle = {
  focus: (placeCaretAtEnd?: boolean) => void;
  // Replace the active `@query` (caret to nearest preceding `@`) with a chip
  // and a trailing space. No-op if there's no active trigger.
  insertMentionAtTrigger: (entry: FileEntry) => void;
  getActiveTrigger: () => MentionTrigger | null;
  getSegments: () => Segment[];
  setSegments: (segs: Segment[]) => void;
  clear: () => void;
  isEmpty: () => boolean;
};

type Props = {
  initialSegments?: Segment[];
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
  onChange?: (segments: Segment[]) => void;
  onTriggerChange?: (trigger: MentionTrigger | null) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  onPaste?: (e: ClipboardEvent<HTMLDivElement>) => void;
  onWheel?: (e: WheelEvent<HTMLDivElement>) => void;
  // Return true to indicate the parent fully handled the key (skip default).
  onKeyDownExtra?: (e: KeyboardEvent<HTMLDivElement>) => boolean;
};

// Inlined SVGs from lucide-react so chip elements can be built imperatively
// without spinning up a React render per chip.
const FOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';
const FILE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

function chipLabel(entry: FileEntry): string {
  const suffix = entry.type === "dir" && !entry.path.endsWith("/") ? "/" : "";
  return `@${entry.path}${suffix}`;
}

function buildChipElement(entry: FileEntry): HTMLSpanElement {
  const span = document.createElement("span");
  // contentEditable=false makes the chip behave as an indivisible unit:
  // backspace next to it selects the chip, a second backspace deletes it.
  span.contentEditable = "false";
  span.setAttribute("data-mention", entry.path);
  span.setAttribute("data-mention-type", entry.type);
  span.setAttribute("title", chipLabel(entry));

  const isDir = entry.type === "dir";
  Object.assign(span.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "2px",
    padding: "0 3px",
    margin: "0 1px",
    borderRadius: "3px",
    fontSize: "9px",
    lineHeight: "1.4",
    verticalAlign: "baseline",
    backgroundColor: isDir
      ? "color-mix(in oklab, var(--foreground) 18%, transparent)"
      : "color-mix(in oklab, var(--foreground) 9%, transparent)",
    color: "var(--foreground)",
    userSelect: "none",
    cursor: "default",
    fontFamily: "inherit",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } as Partial<CSSStyleDeclaration>);
  const path = entry.path;
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const suffix = isDir && !path.endsWith("/") ? "/" : "";

  span.innerHTML = `${isDir ? FOLDER_SVG : FILE_SVG}<span style="font-family:inherit"><span style="opacity:.75">@${escapeHtml(dir)}</span><span>${escapeHtml(base)}</span><span style="opacity:.75">${escapeHtml(suffix)}</span></span>`;

  return span;
}

function parseDom(root: HTMLElement): Segment[] {
  const segs: Segment[] = [];

  const pushText = (text: string): void => {
    if (!text) return;
    const last = segs[segs.length - 1];
    if (last && last.kind === "text") last.text += text;
    else segs.push({ kind: "text", text });
  };

  const walk = (node: Node, isBlockBoundary: boolean): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        pushText(child.textContent ?? "");
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as HTMLElement;
      const path = el.getAttribute("data-mention");
      if (path) {
        const type = el.getAttribute("data-mention-type") === "dir" ? "dir" : "file";
        segs.push({ kind: "mention", entry: { path, type } });
      } else if (el.tagName === "BR") {
        pushText("\n");
      } else if (el.tagName === "DIV" || el.tagName === "P") {
        // Browsers wrap new lines in block elements when the user presses
        // Enter inside contenteditable. Treat the boundary as a newline.
        if (segs.length > 0) pushText("\n");
        walk(el, true);
      } else {
        walk(el, isBlockBoundary);
      }
    }
  };
  walk(root, false);

  // Trim a single trailing newline introduced purely by the implicit final
  // block wrapper (so "hello\n" doesn't become "hello\n\n" round-tripping).
  const last = segs[segs.length - 1];
  if (last && last.kind === "text" && last.text === "\n") segs.pop();
  return segs;
}

function renderSegmentsToRoot(root: HTMLElement, segs: Segment[]): void {
  while (root.firstChild) root.removeChild(root.firstChild);
  for (const seg of segs) {
    if (seg.kind === "text") {
      root.appendChild(document.createTextNode(seg.text));
    } else {
      root.appendChild(buildChipElement(seg.entry));
    }
  }
}

function detectTrigger(root: HTMLElement): MentionTrigger | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return null;
  if (!root.contains(range.startContainer)) return null;

  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent ?? "";
  const offset = range.startOffset;

  for (let i = offset - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "@") {
      let isStart = false;
      if (i > 0) {
        if (/\s/.test(text[i - 1])) isStart = true;
      } else {
        const prev = node.previousSibling;
        if (!prev) {
          isStart = true;
        } else if (prev.nodeType === Node.ELEMENT_NODE) {
          // Right after a chip — treat as boundary.
          isStart = true;
        } else if (prev.nodeType === Node.TEXT_NODE) {
          const prevText = prev.textContent ?? "";
          if (prevText.length === 0 || /\s/.test(prevText[prevText.length - 1])) {
            isStart = true;
          }
        }
      }
      if (!isStart) return null;
      return { query: text.slice(i + 1, offset) };
    }
    if (/\s/.test(ch)) return null;
  }
  return null;
}

function placeCaretAtEnd(root: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

export const MentionEditor = forwardRef<MentionEditorHandle, Props>(
  function MentionEditor(
    {
      initialSegments,
      placeholder,
      className,
      style,
      autoFocus,
      onChange,
      onTriggerChange,
      onSubmit,
      onCancel,
      onPaste,
      onWheel,
      onKeyDownExtra,
    },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const initializedRef = useRef(false);

    useEffect(() => {
      if (initializedRef.current) return;
      initializedRef.current = true;
      const el = editorRef.current;
      if (!el) return;
      if (initialSegments && initialSegments.length > 0) {
        renderSegmentsToRoot(el, initialSegments);
      }
      if (autoFocus) {
        el.focus();
        placeCaretAtEnd(el);
      }
      // Intentionally only on mount — content is uncontrolled afterwards.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focus(placeAtEnd) {
          const el = editorRef.current;
          if (!el) return;
          el.focus();
          if (placeAtEnd) placeCaretAtEnd(el);
        },
        insertMentionAtTrigger(entry) {
          const el = editorRef.current;
          if (!el) return;
          const sel = window.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          const range = sel.getRangeAt(0);
          if (!el.contains(range.startContainer)) return;
          const node = range.startContainer;
          if (node.nodeType !== Node.TEXT_NODE) return;
          const textNode = node as Text;
          const text = textNode.textContent ?? "";
          const offset = range.startOffset;

          let atIdx = -1;
          for (let i = offset - 1; i >= 0; i--) {
            if (text[i] === "@") {
              atIdx = i;
              break;
            }
            if (/\s/.test(text[i])) return;
          }
          if (atIdx < 0) return;

          const before = text.slice(0, atIdx);
          const after = text.slice(offset);

          textNode.textContent = before;
          const chip = buildChipElement(entry);
          // Always keep a leading space in the tail node so the caret has a
          // home immediately after the chip and subsequent typing starts on a
          // word boundary. If the remaining tail already begins with
          // whitespace, don't double up.
          const tailText = after.startsWith(" ") ? after : ` ${after}`;
          const tailNode = document.createTextNode(tailText);

          const parent = textNode.parentNode!;
          const next = textNode.nextSibling;
          parent.insertBefore(chip, next);
          parent.insertBefore(tailNode, next);

          // Drop the now-empty "before" text node so the chip isn't preceded
          // by a phantom node (which can break selection at start-of-line).
          if ((textNode.textContent ?? "") === "") parent.removeChild(textNode);

          // Caret lands right after the leading space.
          const newRange = document.createRange();
          newRange.setStart(tailNode, 1);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);

          onChange?.(parseDom(el));
          onTriggerChange?.(null);
        },
        getActiveTrigger() {
          const el = editorRef.current;
          return el ? detectTrigger(el) : null;
        },
        getSegments() {
          const el = editorRef.current;
          return el ? parseDom(el) : [];
        },
        setSegments(segs) {
          const el = editorRef.current;
          if (!el) return;
          renderSegmentsToRoot(el, segs);
          onChange?.(segs);
        },
        clear() {
          const el = editorRef.current;
          if (!el) return;
          while (el.firstChild) el.removeChild(el.firstChild);
          onChange?.([]);
          onTriggerChange?.(null);
        },
        isEmpty() {
          const el = editorRef.current;
          if (!el) return true;
          if (el.childNodes.length === 0) return true;
          if (
            el.childNodes.length === 1 &&
            el.firstChild?.nodeType === Node.TEXT_NODE &&
            (el.firstChild.textContent ?? "").trim() === ""
          ) {
            return true;
          }
          return false;
        },
      }),
      [onChange, onTriggerChange],
    );

    const reportState = (): void => {
      const el = editorRef.current;
      if (!el) return;
      onChange?.(parseDom(el));
      onTriggerChange?.(detectTrigger(el));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
      if (onKeyDownExtra && onKeyDownExtra(e)) return;
      if (e.defaultPrevented) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit?.();
        return;
      }
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        document.execCommand("insertText", false, "\n");
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
        return;
      }
    };

    const handlePaste = (e: ClipboardEvent<HTMLDivElement>): void => {
      if (onPaste) {
        onPaste(e);
        if (e.defaultPrevented) return;
      }
      const text = e.clipboardData.getData("text/plain");
      if (text) {
        e.preventDefault();
        document.execCommand("insertText", false, text);
      }
    };

    return (
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-mention-editor
        data-placeholder={placeholder ?? ""}
        className={className}
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          outline: "none",
          ...style,
        }}
        onInput={reportState}
        onKeyUp={(e) => {
          if (
            e.key === "ArrowLeft" ||
            e.key === "ArrowRight" ||
            e.key === "ArrowUp" ||
            e.key === "ArrowDown" ||
            e.key === "Home" ||
            e.key === "End"
          ) {
            const el = editorRef.current;
            if (el) onTriggerChange?.(detectTrigger(el));
          }
        }}
        onClick={() => {
          const el = editorRef.current;
          if (el) onTriggerChange?.(detectTrigger(el));
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onWheel={onWheel}
        aria-label="Prompt input"
      />
    );
  },
);

// Helpers callers use to convert between segments and the wire format the
// chat handler expects (a single string with `@path` tokens preserved).

export function segmentsToText(segs: Segment[]): string {
  return segs
    .map((s) =>
      s.kind === "text"
        ? s.text
        : `@${s.entry.path}${s.entry.type === "dir" && !s.entry.path.endsWith("/") ? "/" : ""}`,
    )
    .join("");
}

export function segmentsAreEmpty(segs: Segment[]): boolean {
  return segs.every((s) => s.kind === "text" && s.text.trim() === "");
}

// Parses a string back into segments for editing existing prompts. Tokens of
// the form `@<non-whitespace>` are converted to mention chips; a trailing `/`
// marks them as folders.
export function textToSegments(value: string): Segment[] {
  if (!value) return [];
  const segs: Segment[] = [];
  let i = 0;
  while (i < value.length) {
    let atIdx = -1;
    for (let j = i; j < value.length; j++) {
      if (value[j] === "@" && (j === 0 || /\s/.test(value[j - 1]))) {
        atIdx = j;
        break;
      }
    }
    if (atIdx < 0) {
      segs.push({ kind: "text", text: value.slice(i) });
      break;
    }
    if (atIdx > i) segs.push({ kind: "text", text: value.slice(i, atIdx) });
    let end = atIdx + 1;
    while (end < value.length && !/\s/.test(value[end])) end++;
    const raw = value.slice(atIdx + 1, end);
    if (raw.length === 0) {
      segs.push({ kind: "text", text: "@" });
    } else {
      const isDir = raw.endsWith("/");
      const path = isDir ? raw.slice(0, -1) : raw;
      segs.push({ kind: "mention", entry: { path, type: isDir ? "dir" : "file" } });
    }
    i = end;
  }
  return segs;
}
