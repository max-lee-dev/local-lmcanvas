import { app } from "electron";
// electron-updater is CommonJS; the main process is ESM ("type": "module"),
// so the named import fails at runtime in the packaged build. Default-import
// the whole module and destructure.
import electronUpdater from "electron-updater";
const { autoUpdater } = electronUpdater;

export function initAutoUpdate(): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (err) => {
    console.error("[autoUpdate]", err);
  });

  void autoUpdater.checkForUpdatesAndNotify();
}
