// Adapted from avera/app/features/canvas/lib/group-summary/summarize-groups.ts.
// avera uses Gemini 2.5 Flash via Vercel AI SDK; here we drive the user's
// Claude Code install through the agent SDK so generation reuses the same auth
// as regular chat. The prompt itself is kept close to avera's v9 — that's
// what produces the lowercase, specific titles instead of "Foo and Bar Want".

import { homedir } from "node:os";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKMessage,
  SDKAssistantMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  BetaContentBlock,
  BetaTextBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import { CLAUDE_BIN_PATH } from "../claude/runner";

export const GROUP_SUMMARY_PROMPT_VERSION = "lmc-group-summary-v1";
const MAX_CANDIDATES = 80;

export type GroupSummaryCandidate = { nodeId: string; prompt: string };

export type GeneratedGroupSummary = {
  title: string;
  nodeIds: string[];
  metadata?: {
    confidence?: number;
    promptVersion?: string;
    generationModel?: string;
  };
};

export type GenerateGroupSummaryArgs = {
  candidates: GroupSummaryCandidate[];
  existingGroupTitles?: string[];
  model?: string;
  signal?: AbortSignal;
};

type OrderedCandidate = {
  idx: number;
  nodeId: string;
  prompt: string;
};

function groupCountBounds(total: number): { min: number; max: number } {
  if (total <= 1) return { min: 1, max: 1 };
  const min = 2;
  const max = Math.max(min, Math.ceil(total / 2));
  return { min, max };
}

function buildPrompt(
  ordered: OrderedCandidate[],
  existingGroupTitles: string[] = [],
): string {
  const { min, max } = groupCountBounds(ordered.length);

  const existingTitlesSection =
    existingGroupTitles.length > 0
      ? `\nExisting groups on this canvas (your new titles must be clearly distinct from these):\n${existingGroupTitles
          .map((t) => `- "${t}"`)
          .join("\n")}\n`
      : "";

  return `You will segment ordered conversation items into contiguous groups and give each group a specific, descriptive title that captures exactly what those conversations are about.
${existingTitlesSection}

Each item includes:
- idx (1-based position in strict order)
- nodeId
- prompt (the actual user message)

Return strict JSON only with this shape:
{
  "breakAfter": [4, 7, 9],
  "titles": ["title one", "title two", "title three"],
  "confidences": [0.0, 0.0, 0.0]
}

Interpretation example:
- breakAfter [4,7,9] means groups are 1-4, 5-7, 8-9.

Hard Rules:
- breakAfter must be strictly increasing.
- breakAfter must end at ${ordered.length}.
- EVERY node must be in a group. No node may be left out. Every idx 1..${ordered.length} must belong to exactly one group.
- Groups must be contiguous adjacent ranges only. No sub-groups, no overlaps, no gaps.
- Create between ${min} and ${max} groups.
- Do not output one single group covering the entire list when more than one item exists.
- Keep groups topically distinct.
- Titles must be 4-10 words.
- Be SPECIFIC: if the conversations involve a particular person, project, product, technology, codebase, or concept — use that name directly in the title.
- Capture the actual substance of what was discussed, not a generic category.
- Banned filler phrases: "overview", "exploration", "discussion of", "various", "strategies for", "thoughts on", "analysis of", "topics", "questions about".
- Avoid vague abstractions like "technical topics" or "general conversation" — name the specific thing.
- Titles should be distinct from one another — no repeating the same keywords across groups.
- Do NOT title-case. Keep it lowercase.
- No markdown, prose, or extra keys.

Good title examples:
- "debugging the checkout flow rate limit bug" (specific problem)
- "designing the onboarding wizard ui" (specific feature)
- "gpt-5 pricing and context window limits" (specific technology + details)
- "refactoring the canvas state management" (specific codebase area)
- "writing the series finale cold open" (specific creative task)

Bad title examples:
- "technical discussion" (too vague)
- "coding topics" (too generic)
- "various questions" (useless)
- "AI and technology" (too broad)
- "overview of recent work" (meaningless filler)

Items:
${JSON.stringify(ordered, null, 2)}`;
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1).trim();
}

function normalizeTitle(value: string): string {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return "related conversation group";

  const cleaned = words
    .join(" ")
    .replace(/^overview(\s+of)?\s+/i, "")
    .trim();

  const clipped = (cleaned || "related conversation group")
    .split(" ")
    .filter(Boolean)
    .slice(0, 10)
    .join(" ")
    .trim();

  return clipped || "related conversation group";
}

function titleKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureDistinctTitles(
  summaries: GeneratedGroupSummary[],
): GeneratedGroupSummary[] {
  const seen = new Map<string, number>();
  return summaries.map((summary, index) => {
    const normalized = normalizeTitle(summary.title);
    const key = titleKey(normalized);
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1
      ? { ...summary, title: normalized }
      : {
          ...summary,
          title: normalizeTitle(`${normalized} topic ${index + 1}`),
        };
  });
}

type ValidatedPayload = {
  breakAfter: number[];
  titles: string[];
  confidences?: number[];
};

function validatePayload(
  parsed: unknown,
  total: number,
): ValidatedPayload | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const breakAfter = obj.breakAfter;
  const titles = obj.titles;
  const confidences = obj.confidences;

  if (!Array.isArray(breakAfter) || !Array.isArray(titles)) return null;
  if (breakAfter.length === 0 || breakAfter.length !== titles.length) return null;

  const { min, max } = groupCountBounds(total);
  if (breakAfter.length < min || breakAfter.length > max) return null;

  const numeric: number[] = [];
  let prev = 0;
  for (const v of breakAfter) {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const n = Math.trunc(v);
    if (n <= prev || n < 1 || n > total) return null;
    numeric.push(n);
    prev = n;
  }
  if (numeric[numeric.length - 1] !== total) return null;
  if (total > 1 && numeric.length === 1) return null;

  for (const t of titles) {
    if (typeof t !== "string" || t.trim().length === 0) return null;
  }

  let confArr: number[] | undefined;
  if (Array.isArray(confidences)) {
    if (confidences.length !== numeric.length) return null;
    const c: number[] = [];
    for (const v of confidences) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
        return null;
      }
      c.push(v);
    }
    confArr = c;
  }

  return { breakAfter: numeric, titles: titles as string[], confidences: confArr };
}

function buildSummaries(
  ordered: OrderedCandidate[],
  payload: ValidatedPayload,
  generationModel: string,
): GeneratedGroupSummary[] {
  const out: GeneratedGroupSummary[] = [];
  let start = 0;
  for (let i = 0; i < payload.breakAfter.length; i += 1) {
    const end = payload.breakAfter[i];
    const range = ordered.slice(start, end);
    start = end;
    if (range.length === 0) continue;
    out.push({
      title: payload.titles[i],
      nodeIds: range.map((c) => c.nodeId),
      metadata: {
        confidence: payload.confidences?.[i],
        promptVersion: GROUP_SUMMARY_PROMPT_VERSION,
        generationModel,
      },
    });
  }
  return ensureDistinctTitles(out);
}

function assistantText(msg: SDKAssistantMessage): string {
  const content = msg.message.content as BetaContentBlock[];
  let text = "";
  for (const block of content) {
    if (block.type === "text") {
      text += (block as BetaTextBlock).text;
    }
  }
  return text;
}

const SYSTEM_PROMPT =
  "You output strict JSON only. No prose, no markdown, no code fences, no preamble.";

export async function generateGroupSummaries(
  args: GenerateGroupSummaryArgs,
): Promise<GeneratedGroupSummary[]> {
  const capped = args.candidates.slice(0, MAX_CANDIDATES);
  if (capped.length < 2) return [];

  const ordered: OrderedCandidate[] = capped.map((c, i) => ({
    idx: i + 1,
    nodeId: c.nodeId,
    prompt: c.prompt,
  }));

  const prompt = buildPrompt(ordered, args.existingGroupTitles);

  const controller = new AbortController();
  if (args.signal) {
    if (args.signal.aborted) return [];
    args.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let collected = "";
  try {
    const q = query({
      prompt,
      options: {
        cwd: homedir(),
        model: args.model,
        pathToClaudeCodeExecutable: CLAUDE_BIN_PATH,
        systemPrompt: SYSTEM_PROMPT,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        settingSources: [],
        allowedTools: [],
        includePartialMessages: false,
        abortController: controller,
      },
    });

    for await (const msg of q as AsyncIterable<SDKMessage>) {
      if (msg.type === "assistant") {
        collected += assistantText(msg);
      }
      if (msg.type === "result") break;
    }
  } catch (err) {
    console.warn("[groupSummary] LLM generation failed:", err);
    return [];
  }

  if (controller.signal.aborted) return [];

  const json = extractJsonObject(collected);
  if (!json) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  const validated = validatePayload(parsed, ordered.length);
  if (!validated) return [];

  return buildSummaries(ordered, validated, args.model ?? "claude");
}
