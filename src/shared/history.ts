import type {
  CanvasNode,
  ContentBlock,
  Message,
  NodeId,
  Provider,
  TextBlock,
  ToolUseBlock,
  UsageSummary,
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

const MERGE_CONTEXT_TRUNCATE = 200;

function lastTextForRole(messages: Message[], role: "user" | "assistant"): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== role) continue;
    const txt = blocksToPlainText(m.blocks);
    if (txt) return txt;
  }
  return "";
}

/**
 * Build a prompt-prefix that summarizes the last exchange from each merged-parent
 * conversation so the model can reference them when answering the merge node's
 * first prompt. Mirrors avera/app/features/canvas/lib/merge-context.ts.
 */
export function buildMergeContext(
  parentNodes: CanvasNode[],
): string {
  const blocks: string[] = [];
  parentNodes.forEach((n, i) => {
    const msgs = n.data.chat.messages;
    const userText = lastTextForRole(msgs, "user");
    let assistantText = lastTextForRole(msgs, "assistant");
    if (!userText && !assistantText) return;
    if (assistantText.length > MERGE_CONTEXT_TRUNCATE) {
      assistantText = `${assistantText.slice(0, MERGE_CONTEXT_TRUNCATE)}...`;
    }
    let block = `Conversation ${i + 1}:`;
    if (userText) block += `\nUser: "${userText}"`;
    if (assistantText) block += `\nAssistant: "${assistantText}"`;
    blocks.push(block);
  });
  if (blocks.length === 0) return "";
  return `This prompt is referencing these ${blocks.length} conversations and their responses. We have already discussed them, here are the messages:\n\n${blocks.join("\n\n")}`;
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
  const provider = isProvider(obj.provider) ? obj.provider : undefined;
  const usage = parseUsage(obj.usage);
  return {
    id: obj.id,
    role: obj.role,
    blocks,
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
    provider,
    usage,
    status,
    error: typeof obj.error === "string" ? obj.error : undefined,
  };
}

function isProvider(value: unknown): value is Provider {
  return value === "claude" || value === "codex" || value === "cursor";
}

function parseUsage(raw: unknown): UsageSummary | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const usage: UsageSummary = {};

  const inputTokens = num(obj.inputTokens);
  if (inputTokens !== undefined) usage.inputTokens = inputTokens;
  const outputTokens = num(obj.outputTokens);
  if (outputTokens !== undefined) usage.outputTokens = outputTokens;
  const cachedInputTokens = num(obj.cachedInputTokens);
  if (cachedInputTokens !== undefined) usage.cachedInputTokens = cachedInputTokens;
  const cacheReadInputTokens = num(obj.cacheReadInputTokens);
  if (cacheReadInputTokens !== undefined) usage.cacheReadInputTokens = cacheReadInputTokens;
  const cacheCreationInputTokens = num(obj.cacheCreationInputTokens);
  if (cacheCreationInputTokens !== undefined) {
    usage.cacheCreationInputTokens = cacheCreationInputTokens;
  }
  const reasoningOutputTokens = num(obj.reasoningOutputTokens);
  if (reasoningOutputTokens !== undefined) {
    usage.reasoningOutputTokens = reasoningOutputTokens;
  }
  const totalTokens = num(obj.totalTokens);
  if (totalTokens !== undefined) usage.totalTokens = totalTokens;
  const totalCostUsd = num(obj.totalCostUsd);
  if (totalCostUsd !== undefined) usage.totalCostUsd = totalCostUsd;

  return Object.keys(usage).length > 0 ? usage : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
