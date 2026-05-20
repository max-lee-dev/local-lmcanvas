import type { Message, NodeId } from "@shared/types";

export type GroupSummary = {
  id: string;
  title: string;
  nodeIds: NodeId[];
};

export type GeneratedNodeSummary = {
  id?: string;
  nodeId: NodeId;
  summary: string;
};

export type GroupSummaryCandidate = {
  nodeId: NodeId;
  prompt: string;
};

export type GeneratedGroupSummary = {
  title: string;
  nodeIds: NodeId[];
  metadata?: { confidence?: number };
};

const MAX_FIELD_LENGTH = 800;
const RAG_CONTEXT_PREFIX = "Context from previous messages:";

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clipText(value: string, maxLength = MAX_FIELD_LENGTH): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
}

function messageText(message: Message): string {
  const text = message.blocks
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n");
  return cleanText(text);
}

/** Mirrors avera's stripPromptPrefixes: peel off addedContext / RAG headers
 *  that may have been prepended before the prompt was sent to the model, so
 *  the summary reflects only what the user typed. */
function stripPromptPrefixes(text: string, addedContext?: string): string {
  let prompt = text;

  if (addedContext) {
    if (prompt.startsWith(addedContext)) {
      prompt = prompt.slice(addedContext.length).trim();
    } else {
      // lmcanvas prefixes addedContext as `> ${line}\n` blockquote
      const quoted = `> ${addedContext.replace(/\n/g, "\n> ")}`;
      if (prompt.startsWith(quoted)) {
        prompt = prompt.slice(quoted.length).trim();
      }
    }
  }

  if (prompt.startsWith(RAG_CONTEXT_PREFIX)) {
    const sep = "\n\n";
    const lastSepIdx = prompt.lastIndexOf(sep);
    prompt =
      lastSepIdx !== -1
        ? prompt.slice(lastSepIdx + sep.length)
        : prompt.slice(RAG_CONTEXT_PREFIX.length);
    prompt = prompt.trim();
  }

  return prompt;
}

function extractLatestOwnPrompt(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (!m || m.role !== "user") continue;
    const text = messageText(m);
    if (text) return text;
  }
  return null;
}

export type DraftNode = {
  id: NodeId;
  messages: Message[];
  addedContext?: string;
};

/** Avera's buildGroupSummaryInput, adapted to lmcanvas's per-node Message shape. */
export function buildGroupSummaryInput(
  nodes: DraftNode[],
): GroupSummaryCandidate[] {
  return nodes
    .map((node) => {
      const raw = extractLatestOwnPrompt(node.messages);
      if (!raw) return null;
      const prompt = stripPromptPrefixes(raw, node.addedContext);
      if (!prompt) return null;
      return { nodeId: node.id, prompt: clipText(prompt) };
    })
    .filter((c): c is GroupSummaryCandidate => c !== null);
}
