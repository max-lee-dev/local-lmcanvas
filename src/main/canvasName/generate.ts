import { homedir } from "node:os";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKAssistantMessage, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { BetaContentBlock, BetaTextBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import { cleanCanvasName } from "@shared/canvasName";
import { CLAUDE_BIN_PATH } from "../claude/runner";

type GenerateCanvasNameArgs = {
  prompt: string;
  model?: string;
  signal?: AbortSignal;
};

const SYSTEM_PROMPT =
  "You output one short plain-text title only. No prose, no markdown, no quotes.";

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

export async function generateCanvasName({
  prompt,
  model,
  signal,
}: GenerateCanvasNameArgs): Promise<string | null> {
  const trimmed = prompt.trim();
  if (!trimmed) return null;

  const controller = new AbortController();
  if (signal) {
    if (signal.aborted) return null;
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const generationPrompt = `Generate a short, descriptive name for a canvas based on this first user prompt.

Rules:
- Maximum 50 characters.
- Capture the specific subject or task.
- Return only the name.
- Do not wrap the name in quotes.

First prompt:
${trimmed}`;

  let collected = "";
  try {
    const q = query({
      prompt: generationPrompt,
      options: {
        cwd: homedir(),
        model,
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
      if (msg.type === "assistant") collected += assistantText(msg);
      if (msg.type === "result") break;
    }
  } catch (err) {
    console.warn("[canvasName] LLM generation failed:", err);
    return null;
  }

  if (controller.signal.aborted) return null;

  const name = cleanCanvasName(collected);
  return name.length > 0 ? name : null;
}
