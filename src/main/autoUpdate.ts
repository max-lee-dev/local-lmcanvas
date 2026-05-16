import { app, Notification } from "electron";
// electron-updater is CommonJS; the main process is ESM ("type": "module"),
// so the named import fails at runtime in the packaged build. Default-import
// the whole module and destructure.
import electronUpdater from "electron-updater";
const { autoUpdater } = electronUpdater;

let manualCheckInFlight = false;

export function initAutoUpdate(): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (err) => {
    console.error("[autoUpdate]", err);
    if (manualCheckInFlight) {
      manualCheckInFlight = false;
      notify("Update check failed", err.message || "See console for details.");
    }
  });

  autoUpdater.on("update-not-available", () => {
    if (manualCheckInFlight) {
      manualCheckInFlight = false;
      notify("LMCanvas is up to date", `You're on v${app.getVersion()}.`);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    manualCheckInFlight = false;
    const version = info?.version ? `v${info.version}` : "A new version";
    const n = new Notification({
      title: `${version} is ready to install`,
      body: "Click to restart LMCanvas and finish updating.",
    });
    n.on("click", () => autoUpdater.quitAndInstall());
    n.show();
  });

  void autoUpdater.checkForUpdatesAndNotify();
}

export function checkForUpdatesNow(): void {
  if (!app.isPackaged) {
    notify("Updates disabled", "Auto-update only runs in packaged builds.");
    return;
  }
  manualCheckInFlight = true;
  void autoUpdater.checkForUpdates();
}

function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return;
  new Notification({ title, body }).show();
}
