import { app, BrowserWindow, ipcMain, shell } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { nanoid } from "nanoid";
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
import type { ChatEvent, ChatStartArgs } from "@shared/ipc";
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

  // open external links in system browser
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

// — IPC —
const activeChats = new Map<string, AbortController>();

function registerIpc(): void {
  ipcMain.handle("canvases:list", async () => listCanvases());
  ipcMain.handle("canvases:create", async (_e, name: string) => createCanvas(name));
  ipcMain.handle("canvases:read", async (_e, id: string) => readCanvas(id));
  ipcMain.handle("canvases:write", async (_e, canvas: Canvas) => writeCanvas(canvas));
  ipcMain.handle("canvases:delete", async (_e, id: string) => deleteCanvas(id));

  ipcMain.handle("settings:read", async () => readSettings());
  ipcMain.handle("settings:write", async (_e, s: AppSettings) => writeSettings(s));

  ipcMain.handle("chat:start", async (_e, args: ChatStartArgs) => {
    const { chatId, history, prompt, systemPromptOverride } = args;
    const settings = await readSettings();
    const combinedPrompt = buildPromptWithHistory(history, prompt);
    const systemPrompt = systemPromptOverride ?? settings.systemPrompt ?? undefined;

    const controller = new AbortController();
    activeChats.set(chatId, controller);

    const send = (ev: ChatEvent) => {
      mainWindow?.webContents.send("chat:event", ev);
    };

    (async () => {
      try {
        send({ chatId, type: "start" });
        let full = "";
        for await (const ev of runClaude(combinedPrompt, {
          claudeBin: settings.claudeBinPath,
          model: settings.claudeModel,
          systemPrompt,
          signal: controller.signal,
        })) {
          if (ev.kind === "delta") {
            full += ev.text;
            send({ chatId, type: "delta", text: ev.text });
          } else if (ev.kind === "done") {
            send({ chatId, type: "done", fullText: ev.fullText || full });
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        send({ chatId, type: "error", message });
      } finally {
        activeChats.delete(chatId);
      }
    })();
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

// satisfy unused nanoid import for future use (keeps tree-shake off the nanoid require)
void nanoid;
