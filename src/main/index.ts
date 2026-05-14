import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  listCanvases,
  createCanvas,
  readCanvas,
  writeCanvas,
  deleteCanvas,
} from "./storage/canvases";
import { readSettings, writeSettings } from "./storage/settings";
import { buildPromptWithHistory } from "./claude/history";
import { runClaude } from "./claude/runner";
import type { ChatEvent, ChatStartArgs, CanvasCreateArgs } from "@shared/ipc";
import type { AppSettings, Canvas } from "@shared/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 720,
    minHeight: 480,
    title: "local-lmcanvas",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#fafafa",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on("ready-to-show", () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

const activeChats = new Map<string, AbortController>();

function registerIpc(): void {
  ipcMain.handle("canvases:list", async () => listCanvases());
  ipcMain.handle("canvases:create", async (_e, args: CanvasCreateArgs) => createCanvas(args));
  ipcMain.handle("canvases:read", async (_e, id: string) => readCanvas(id));
  ipcMain.handle("canvases:write", async (_e, canvas: Canvas) => writeCanvas(canvas));
  ipcMain.handle("canvases:delete", async (_e, id: string) => deleteCanvas(id));

  ipcMain.handle("settings:read", async () => readSettings());
  ipcMain.handle("settings:write", async (_e, s: AppSettings) => writeSettings(s));

  ipcMain.handle("dialog:pickFolder", async (_e, defaultPath?: string) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      defaultPath,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("shell:openPath", async (_e, path: string) => {
    await shell.openPath(path);
  });

  ipcMain.handle("chat:start", async (_e, args: ChatStartArgs) => {
    const { chatId, canvasId, history, prompt, attachments, systemPromptOverride } = args;

    const send = (ev: ChatEvent) => {
      mainWindow?.webContents.send("chat:event", ev);
    };

    const canvas = await readCanvas(canvasId);
    if (!canvas) {
      send({ chatId, type: "error", message: `Canvas not found: ${canvasId}` });
      send({ chatId, type: "done", isError: true });
      return;
    }

    const settings = await readSettings();
    const combinedPrompt = buildPromptWithHistory(history, prompt);
    const systemPrompt = systemPromptOverride ?? settings.systemPrompt ?? undefined;

    const controller = new AbortController();
    activeChats.set(chatId, controller);

    send({ chatId, type: "start" });

    try {
      await runClaude(combinedPrompt, {
        cwd: canvas.cwd,
        model: settings.claudeModel,
        systemPrompt,
        attachments,
        signal: controller.signal,
        onEvent: (ev) => {
          switch (ev.kind) {
            case "text_delta":
              send({ chatId, type: "text_delta", text: ev.text });
              return;
            case "thinking_delta":
              send({ chatId, type: "thinking_delta", text: ev.text });
              return;
            case "tool_use":
              send({
                chatId,
                type: "tool_use",
                toolUseId: ev.toolUseId,
                name: ev.name,
                input: ev.input,
              });
              return;
            case "tool_result":
              send({
                chatId,
                type: "tool_result",
                toolUseId: ev.toolUseId,
                content: ev.content,
                isError: ev.isError,
              });
              return;
            case "error":
              send({ chatId, type: "error", message: ev.message });
              return;
            case "done":
              send({ chatId, type: "done", isError: ev.isError, result: ev.result });
              return;
          }
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      send({ chatId, type: "error", message });
      send({ chatId, type: "done", isError: true });
    } finally {
      activeChats.delete(chatId);
    }
  });

  ipcMain.handle("chat:cancel", async (_e, chatId: string) => {
    activeChats.get(chatId)?.abort();
    activeChats.delete(chatId);
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
