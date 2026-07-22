import { useEffect, useState } from "react";
import { ChevronDown, MessageSquareDashed, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  AppSettings,
  CodexRuntimeInfo,
  Provider,
  ProviderConfig,
} from "@shared/types";
import { PROVIDERS } from "@shared/types";
import {
  MinimapSetting,
  PanSpeedSetting,
  ThemeSetting,
  ProviderRow,
  KeybindingsSetting,
  KeybindingsPage,
  FinishSoundSetting,
  Toggle,
} from "./settings";

type View = "main" | "keybindings";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings>({});
  const [saving, setSaving] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [view, setView] = useState<View>("main");
  const [codexRuntime, setCodexRuntime] = useState<CodexRuntimeInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    void window.api.settings.read().then(setSettings);
    void window.api.providers
      .codexRuntime()
      .then(setCodexRuntime)
      .catch(() => setCodexRuntime(null));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setView("main");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view !== "main") {
        setView("main");
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose, view]);

  const handleSave = async () => {
    setSaving(true);
    await window.api.settings.write(settings);
    setSaving(false);
    onClose();
  };

  const handleReplayOnboarding = async () => {
    await window.api.settings.write({ ...settings, onboardingCompleted: false });
    onClose();
    window.location.hash = "/onboarding";
  };

  const updateProviderConfig = (
    provider: Provider,
    patch: Partial<ProviderConfig>,
  ) => {
    setSettings((s) => ({
      ...s,
      providers: {
        ...(s.providers ?? {}),
        [provider]: { ...(s.providers?.[provider] ?? {}), ...patch },
      },
    }));
  };

  const configuredCodexModel = settings.providers?.codex?.model;
  const codexModel = codexRuntime?.models.find(
    (model) => model.id === (configuredCodexModel ?? codexRuntime.defaultModelId),
  );
  const codexEfforts = codexModel?.supportedReasoningEfforts ?? ["low"];
  const codexFastAvailable =
    !codexModel ||
    codexModel.serviceTiers.some(
      (tier) => tier.id === "priority" || tier.id === "fast",
    );

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
            className="settings-modal w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-card text-foreground p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {view === "keybindings" ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex-1" />
                  <button
                    onClick={onClose}
                    className="rounded p-1 hover:bg-secondary cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
                <KeybindingsPage onBack={() => setView("main")} />
                <div className="mt-5 flex justify-end">
                  <button
                    onClick={() => setView("main")}
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary cursor-pointer"
                  >
                    done
                  </button>
                </div>
              </>
            ) : (
              <>
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
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  providers
                </h3>
                <p className="mb-2.5 text-[11px] text-muted-foreground">
                  Click to set the default provider for new canvases.
                </p>
                <div className="grid grid-cols-3 gap-1.5 items-start">
                  {PROVIDERS.map((p) => (
                    <ProviderRow
                      key={p}
                      provider={p}
                      isDefault={(settings.defaultProvider ?? "claude") === p}
                      onMakeDefault={() =>
                        setSettings((s) => ({ ...s, defaultProvider: p }))
                      }
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
                  <FinishSoundSetting />
                  <Toggle
                    enabled={settings.terseToolNarration ?? false}
                    onToggle={() =>
                      setSettings((s) => ({
                        ...s,
                        terseToolNarration: !(s.terseToolNarration ?? false),
                      }))
                    }
                    label="Terse tool narration"
                    description="Replace verbose play-by-play between tool calls with a single 1-2 sentence summary per batch."
                    icon={<MessageSquareDashed className="w-4 h-4" />}
                  />
                  <KeybindingsSetting onOpen={() => setView("keybindings")} />
                  <div className="flex items-center justify-between gap-2 rounded-md px-1 py-1">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-foreground">
                        welcome flow
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Walk through provider setup again.
                      </div>
                    </div>
                    <motion.button
                      type="button"
                      onClick={() => void handleReplayOnboarding()}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground hover:bg-secondary cursor-pointer"
                      whileTap={{ scale: 0.96 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <Sparkles className="h-3 w-3" />
                      Replay
                    </motion.button>
                  </div>
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
                        <div className="grid gap-1.5">
                          {PROVIDERS.map((provider) => (
                            <div key={provider} className="rounded-md border border-border p-2">
                              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {provider}
                              </div>
                              <div className="grid gap-1.5">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">
                                    binary path
                                  </label>
                                  <input
                                    value={settings.providers?.[provider]?.binPath ?? ""}
                                    onChange={(e) =>
                                      updateProviderConfig(provider, {
                                        binPath: e.target.value,
                                      })
                                    }
                                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                    placeholder={provider}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">
                                    model id
                                  </label>
                                  <input
                                    value={settings.providers?.[provider]?.model ?? ""}
                                    onChange={(e) =>
                                      updateProviderConfig(provider, {
                                        model: e.target.value,
                                      })
                                    }
                                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                    placeholder={
                                      provider === "codex"
                                        ? (codexRuntime?.defaultModelId ?? "Codex default")
                                        : provider === "cursor"
                                        ? "auto"
                                        : "claude-fable-5"
                                    }
                                    {...(provider === "codex"
                                      ? { list: "codex-models" }
                                      : {})}
                                  />
                                  {provider === "codex" &&
                                    codexRuntime &&
                                    codexRuntime.models.length > 0 && (
                                      <datalist id="codex-models">
                                        {codexRuntime.models.map((model) => (
                                          <option key={model.id} value={model.id}>
                                            {model.displayName}
                                          </option>
                                        ))}
                                      </datalist>
                                    )}
                                </div>
                                {provider === "codex" && (
                                  <>
                                    <div>
                                      <label className="text-xs font-medium text-muted-foreground">
                                        thinking effort
                                      </label>
                                      <select
                                        value={
                                          settings.providers?.codex?.reasoningEffort ??
                                          codexModel?.defaultReasoningEffort ??
                                          "low"
                                        }
                                        onChange={(e) =>
                                          updateProviderConfig("codex", {
                                            reasoningEffort: e.target.value as ProviderConfig["reasoningEffort"],
                                          })
                                        }
                                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                      >
                                        {codexEfforts.map((effort) => (
                                          <option key={effort} value={effort}>
                                            {effort}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-muted-foreground">
                                        processing speed
                                      </label>
                                      <select
                                        value={
                                          settings.providers?.codex?.serviceTier === "fast" &&
                                          codexFastAvailable
                                            ? "fast"
                                            : "standard"
                                        }
                                        onChange={(e) =>
                                          updateProviderConfig("codex", {
                                            serviceTier:
                                              e.target.value === "fast" ? "fast" : "standard",
                                          })
                                        }
                                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                      >
                                        <option value="standard">standard</option>
                                        {codexFastAvailable && (
                                          <option value="fast">fast (uses more credits)</option>
                                        )}
                                      </select>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
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
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
