import { app } from "electron";
import { autoUpdater } from "electron-updater";

export function initAutoUpdate(): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (err) => {
    console.error("[autoUpdate]", err);
  });

  void autoUpdater.checkForUpdatesAndNotify();
}
