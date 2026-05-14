import { app, BrowserWindow, ipcMain, nativeImage, shell, dialog } from "electron";
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
import { listFiles } from "./files";
import {
  cancelAllForWebContents,
  completeRequest as completeAskUser,
} from "./claude/askUserBridge";
import type {
  AskUserResponsePayload,
  ChatEvent,
  ChatStartArgs,
  CanvasCreateArgs,
} from "@shared/ipc";
import type { AppSettings, Canvas } from "@shared/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dev: __dirname is .../out/main → ../../resources is the project resources/.
// Packaged: electron-builder copies resources/ to process.resourcesPath/resources.
const APP_ICON_PATH = app.isPackaged
  ? join(process.resourcesPath, "resources/icon.png")
  : join(__dirname, "../../resources/icon.png");

function createWindow(hash?: string): BrowserWindow {
  const icon = nativeImage.createFromPath(APP_ICON_PATH);

  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 360,
    minHeight: 480,
    title: "local-lmcanvas",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#fafafa",
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === "darwin" && app.dock && !icon.isEmpty()) {
    app.dock.setIcon(icon);
  }

  win.on("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  const suffix = hash ? `#${hash.replace(/^#/, "")}` : "";
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    void win.loadURL(devUrl + suffix);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"), {
      hash: hash?.replace(/^#/, ""),
    });
  }

  return win;
}

const activeChats = new Map<string, AbortController>();

const FILES_CACHE_TTL_MS = 10_000;
const filesCache = new Map<string, { at: number; files: string[] }>();

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

  ipcMain.handle("files:list", async (_e, cwd: string): Promise<string[]> => {
    if (!cwd) return [];
    const now = Date.now();
    const cached = filesCache.get(cwd);
    if (cached && now - cached.at < FILES_CACHE_TTL_MS) return cached.files;
    const files = await listFiles(cwd);
    filesCache.set(cwd, { at: now, files });
    return files;
  });

  ipcMain.handle("chat:start", async (e, args: ChatStartArgs) => {
    const { chatId, nodeId, canvasId, history, prompt, attachments, systemPromptOverride } = args;
    const sender = e.sender;

    const send = (ev: ChatEvent) => {
      if (sender.isDestroyed()) return;
      sender.send("chat:event", ev);
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
        webContents: sender,
        nodeId,
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

  ipcMain.handle("chat:cancel", async (e, chatId: string) => {
    activeChats.get(chatId)?.abort();
    activeChats.delete(chatId);
    cancelAllForWebContents(e.sender);
  });

  ipcMain.handle("askUser:respond", async (_e, payload: AskUserResponsePayload) => {
    completeAskUser(payload);
  });

  ipcMain.handle("window:openCanvas", async (_e, canvasId?: string) => {
    const hash = canvasId ? `/canvas/${canvasId}` : "/";
    createWindow(hash);
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
