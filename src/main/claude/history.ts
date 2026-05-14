import type { Message } from "@shared/types";
import { blocksToPlainText } from "@shared/history";

export function buildPromptWithHistory(
  history: Message[],
  newUserPrompt: string
): string {
  if (history.length === 0) return newUserPrompt;

  const sections: string[] = [];
  for (const m of history) {
    const role = m.role === "user" ? "User" : "Assistant";
    const text = blocksToPlainText(m.blocks);
    if (!text) continue;
    sections.push(`[${role}]\n${text}`);
  }
  sections.push(`[User]\n${newUserPrompt}`);
  sections.push(`[Assistant]`);
  return sections.join("\n\n");
}
