import type { Message } from "@/lib/graph/types";

export function buildPromptWithHistory(
  history: Message[],
  newUserPrompt: string
): string {
  const sections: string[] = [];
  for (const m of history) {
    const role = m.role === "user" ? "User" : "Assistant";
    if (!m.content.trim()) continue;
    sections.push(`[${role}]\n${m.content}`);
  }
  sections.push(`[User]\n${newUserPrompt}`);
  sections.push(`[Assistant]`);
  return sections.join("\n\n");
}
