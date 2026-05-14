import type {
  CanvasNode,
  ContentBlock,
  Message,
  NodeId,
  TextBlock,
  ToolUseBlock,
} from "./types";

export function getMessageHistoryForNode(
  nodeId: NodeId,
  nodesById: Record<NodeId, CanvasNode>
): Message[] {
  const chain: CanvasNode[] = [];
  const seen = new Set<NodeId>();
  let current: CanvasNode | undefined = nodesById[nodeId];
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    const parentId: NodeId | undefined = current.data.chat.parentIds[0];
    current = parentId ? nodesById[parentId] : undefined;
  }
  return chain.flatMap((n) => n.data.chat.messages);
}

export function blocksToPlainText(blocks: ContentBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === "text") {
      parts.push(b.text);
    } else if (b.type === "tool_use") {
      const tu = b as ToolUseBlock;
      const inputStr = safeStringify(tu.input);
      const resultStr = tu.result
        ? `\n  -> ${tu.result.isError ? "ERROR: " : ""}${truncate(tu.result.content, 800)}`
        : "";
      parts.push(`[tool: ${tu.name}(${truncate(inputStr, 400)})${resultStr}]`);
    } else if (b.type === "thinking") {
      // omit thinking from history to keep prompts small
    } else if (b.type === "image") {
      parts.push("[image]");
    }
  }
  return parts.join("\n").trim();
}

function safeStringify(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function messageTextForTitle(m: Message): string {
  for (const b of m.blocks) {
    if (b.type === "text" && b.text.trim()) return b.text.trim();
  }
  return "";
}

// ensure a message that came from an older schema (content: string) is converted to blocks
export function migrateMessage(raw: unknown): Message | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== "string" || (obj.role !== "user" && obj.role !== "assistant")) {
    return null;
  }
  let blocks: ContentBlock[];
  if (Array.isArray(obj.blocks)) {
    blocks = obj.blocks as ContentBlock[];
  } else if (typeof obj.content === "string") {
    blocks = [{ type: "text", text: obj.content } satisfies TextBlock];
  } else {
    blocks = [];
  }
  const status =
    obj.status === "streaming" || obj.status === "complete" || obj.status === "error"
      ? obj.status
      : undefined;
  return {
    id: obj.id,
    role: obj.role,
    blocks,
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
    status,
    error: typeof obj.error === "string" ? obj.error : undefined,
  };
}
