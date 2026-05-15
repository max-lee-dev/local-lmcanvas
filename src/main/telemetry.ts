import { app } from "electron";
import { randomUUID } from "node:crypto";
import { readSettings, writeSettings } from "./storage/settings";

// PostHog public project API key. This is intentionally embedded — PostHog
// project keys are designed for client-side use and authorize event writes
// only, never reads. Swap this for your own project's key.
const POSTHOG_API_KEY = "phc_PLACEHOLDER_SWAP_FOR_REAL_KEY";
const POSTHOG_HOST = "https://us.i.posthog.com";

const APP_VERSION = app.getVersion();

function isOptedOutByEnv(): boolean {
  const v = process.env["LMCANVAS_TELEMETRY"];
  if (!v) return false;
  const lower = v.trim().toLowerCase();
  return lower === "0" || lower === "false" || lower === "off" || lower === "no";
}

function hasRealKey(): boolean {
  return POSTHOG_API_KEY.startsWith("phc_") && !POSTHOG_API_KEY.includes("PLACEHOLDER");
}

async function capture(distinctId: string, event: string, props: Record<string, unknown>): Promise<void> {
  const body = JSON.stringify({
    api_key: POSTHOG_API_KEY,
    event,
    distinct_id: distinctId,
    properties: {
      ...props,
      $lib: "local-lmcanvas",
      $lib_version: APP_VERSION,
    },
    timestamp: new Date().toISOString(),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function sendLaunchPing(): Promise<void> {
  if (isOptedOutByEnv()) return;
  if (!hasRealKey()) return;

  const settings = await readSettings();
  if (settings.telemetryEnabled === false) return;

  let uuid = settings.telemetryUuid;
  if (!uuid) {
    uuid = randomUUID();
    await writeSettings({ ...settings, telemetryUuid: uuid });
  }

  try {
    await capture(uuid, "launch", {
      os: process.platform,
      arch: process.arch,
      app_version: APP_VERSION,
    });
  } catch {
    // fire-and-forget; never block startup or surface errors
  }
}
