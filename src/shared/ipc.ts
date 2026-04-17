import type { AppSettings, Canvas, CanvasSummary, Message } from "./types";

/**
 * Shape of the IPC surface the preload exposes on window.api.
 * Used by both main (implements) and renderer (calls).
 */
export type ChatStartArgs = {
  chatId: string;
  history: Message[];
  prompt: string;
  systemPromptOverride?: string;
};

export type ChatEvent =
  | { chatId: string; type: "start" }
  | { chatId: string; type: "delta"; text: string }
  | { chatId: string; type: "done"; fullText: string }
  | { chatId: string; type: "error"; message: string };

export type LmcApi = {
  canvases: {
    list(): Promise<CanvasSummary[]>;
    create(name: string): Promise<Canvas>;
    read(id: string): Promise<Canvas | null>;
    write(canvas: Canvas): Promise<void>;
    delete(id: string): Promise<void>;
  };
  settings: {
    read(): Promise<AppSettings>;
    write(s: AppSettings): Promise<AppSettings>;
  };
  chat: {
    start(args: ChatStartArgs): Promise<void>;
    cancel(chatId: string): Promise<void>;
    onEvent(handler: (ev: ChatEvent) => void): () => void;
  };
};

declare global {
  interface Window {
    api: LmcApi;
  }
}
