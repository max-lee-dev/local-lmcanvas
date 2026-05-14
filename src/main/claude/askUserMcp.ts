import { z } from "zod";
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { requestAnswer } from "./askUserBridge";

const optionSchema = z.object({
  label: z.string().describe("Concise option label shown to the user (1–5 words)."),
  description: z
    .string()
    .describe("Explanation of what choosing this option means."),
  preview: z
    .string()
    .optional()
    .describe(
      "Optional markdown/code preview rendered when the option is focused.",
    ),
});

const questionSchema = z.object({
  question: z
    .string()
    .describe("The full question to ask the user. End with a question mark."),
  header: z
    .string()
    .describe("Short tag (max ~12 chars) summarizing the question topic."),
  multiSelect: z
    .boolean()
    .describe("Allow the user to pick multiple options instead of one."),
  options: z
    .array(optionSchema)
    .min(2)
    .max(4)
    .describe("2–4 mutually-exclusive options for the user to choose from."),
});

const inputSchema = {
  questions: z.array(questionSchema).min(1).max(4),
};

export function buildAskUserServer(
  abortSignal?: AbortSignal,
): McpSdkServerConfigWithInstance {
  return createSdkMcpServer({
    name: "lmc",
    version: "0.1.0",
    tools: [
      tool(
        "ask_user_question",
        "Ask the local user a structured multiple-choice question and wait for their answer. Use this in place of the built-in AskUserQuestion tool — it renders an interactive picker inside local-lmcanvas. Supports 1–4 questions, each with 2–4 options.",
        inputSchema,
        async (args) => {
          const response = await requestAnswer(args.questions, abortSignal);
          if (response.cancelled) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "The user cancelled the prompt without answering.",
                },
              ],
              isError: true,
            };
          }
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    answers: response.answers,
                    notes: response.notes ?? {},
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        },
      ),
    ],
    alwaysLoad: true,
  });
}
