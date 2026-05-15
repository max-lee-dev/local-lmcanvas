import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AppSettings, Provider, ProviderConfig } from "@shared/types";
import { PROVIDERS } from "@shared/types";
import {
  MinimapSetting,
  PanSpeedSetting,
  ThemeSetting,
  ProviderRow,
  TelemetrySetting,
} from "./settings";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings>({});
  const [saving, setSaving] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void window.api.settings.read().then(setSettings);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const handleSave = async () => {
    setSaving(true);
    await window.api.settings.write(settings);
    setSaving(false);
    onClose();
  };

  const updateProviderConfig = (provider: Provider, next: ProviderConfig) => {
    setSettings((s) => ({
      ...s,
      providers: { ...(s.providers ?? {}), [provider]: next },
    }));
  };

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.div
          key="settings-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-card text-foreground p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">settings</h2>
              <button
                onClick={onClose}
                className="rounded p-1 hover:bg-secondary cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  system prompt
                </label>
                <textarea
                  value={settings.systemPrompt ?? ""}
                  onChange={(e) =>
                    setSettings({ ...settings, systemPrompt: e.target.value })
                  }
                  className="mt-1 min-h-[80px] w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  placeholder="optional system prompt passed to every turn"
                />
              </div>

              <div className="pt-2 border-t border-border">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  providers
                </h3>
                <p className="mb-2.5 text-[11px] text-muted-foreground">
                  The selected radio is the default for new canvases.
                </p>
                <div className="flex flex-col gap-2">
                  {PROVIDERS.map((p) => (
                    <ProviderRow
                      key={p}
                      provider={p}
                      isDefault={(settings.defaultProvider ?? "claude") === p}
                      config={settings.providers?.[p]}
                      onMakeDefault={() =>
                        setSettings((s) => ({ ...s, defaultProvider: p }))
                      }
                      onConfigChange={(next) => updateProviderConfig(p, next)}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 mt-1 border-t border-border">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  preferences
                </h3>
                <div className="flex flex-col gap-2">
                  <ThemeSetting />
                  <MinimapSetting />
                  <PanSpeedSetting />
                  <TelemetrySetting
                    enabled={settings.telemetryEnabled !== false}
                    onChange={(next) =>
                      setSettings({ ...settings, telemetryEnabled: next })
                    }
                  />
                </div>
              </div>

              <div className="pt-2 mt-1 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowLegacy((v) => !v)}
                  className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <span>advanced</span>
                  <motion.span
                    animate={{ rotate: showLegacy ? 180 : 0 }}
                    transition={{ duration: 0.15 }}
                    className="inline-flex"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {showLegacy && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 grid gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            claude binary path (legacy)
                          </label>
                          <input
                            value={settings.claudeBinPath ?? ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                claudeBinPath: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                            placeholder="claude"
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Prefer the per-provider binary path above. Kept for
                            back-compat.
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            claude model (legacy)
                          </label>
                          <input
                            value={settings.claudeModel ?? ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                claudeModel: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                            placeholder="e.g. claude-opus-4-7"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary cursor-pointer"
              >
                cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-foreground text-background px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-60 cursor-pointer"
              >
                {saving ? "saving…" : "save"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
