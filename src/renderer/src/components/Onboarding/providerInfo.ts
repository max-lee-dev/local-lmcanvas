import type { Provider } from "@shared/types";

export type ProviderInfo = {
  id: Provider;
  name: string;
  tagline: string;
  installUrl: string;
};

export const PROVIDER_INFO: Record<Provider, ProviderInfo> = {
  claude: {
    id: "claude",
    name: "Claude",
    tagline: "Anthropic. Set up via Claude Code CLI.",
    installUrl: "https://docs.anthropic.com/en/docs/claude-code",
  },
  codex: {
    id: "codex",
    name: "Codex",
    tagline: "OpenAI. Sign in with your ChatGPT account.",
    installUrl: "https://developers.openai.com/codex",
  },
  cursor: {
    id: "cursor",
    name: "Cursor",
    tagline: "Cursor. Sign in with your Cursor account.",
    installUrl: "https://cursor.com/cli",
  },
};
