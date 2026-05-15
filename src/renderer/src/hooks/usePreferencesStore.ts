import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode =
  | "light"
  | "dark"
  | "auto"
  | "solarized-light"
  | "solarized-dark"
  | "nord"
  | "dracula"
  | "sepia";

export type KeybindingId = "splitPanePicker";

export type Keybindings = Record<KeybindingId, string>;

export const DEFAULT_KEYBINDINGS: Keybindings = {
  splitPanePicker: "Mod+s",
};

export type FinishSound = "chime" | "pop" | "ding" | "bloop";

export const FINISH_SOUNDS: FinishSound[] = ["chime", "pop", "ding", "bloop"];

export type PreferencesState = {
  showMinimap: boolean;
  panOnScrollSpeed: number;
  theme: ThemeMode;
  keybindings: Keybindings;
  finishSoundEnabled: boolean;
  finishSound: FinishSound;
  setShowMinimap: (v: boolean) => void;
  setPanOnScrollSpeed: (v: number) => void;
  setTheme: (v: ThemeMode) => void;
  setKeybinding: (id: KeybindingId, shortcut: string) => void;
  resetKeybinding: (id: KeybindingId) => void;
  setFinishSoundEnabled: (v: boolean) => void;
  setFinishSound: (v: FinishSound) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      showMinimap: true,
      panOnScrollSpeed: 0.5,
      theme: "auto",
      keybindings: { ...DEFAULT_KEYBINDINGS },
      finishSoundEnabled: true,
      finishSound: "chime",
      setShowMinimap: (v) => set({ showMinimap: v }),
      setPanOnScrollSpeed: (v) => set({ panOnScrollSpeed: v }),
      setTheme: (v) => set({ theme: v }),
      setKeybinding: (id, shortcut) =>
        set((s) => ({ keybindings: { ...s.keybindings, [id]: shortcut } })),
      resetKeybinding: (id) =>
        set((s) => ({
          keybindings: { ...s.keybindings, [id]: DEFAULT_KEYBINDINGS[id] },
        })),
      setFinishSoundEnabled: (v) => set({ finishSoundEnabled: v }),
      setFinishSound: (v) => set({ finishSound: v }),
    }),
    {
      name: "lmcanvas:preferences",
      version: 3,
      migrate: (persisted: unknown, version) => {
        const p = (persisted ?? {}) as Partial<PreferencesState>;
        if (version < 2 || !p.keybindings) {
          p.keybindings = { ...DEFAULT_KEYBINDINGS };
        }
        if (version < 3) {
          p.finishSoundEnabled = p.finishSoundEnabled ?? true;
          p.finishSound = p.finishSound ?? "chime";
        }
        return p as PreferencesState;
      },
    },
  ),
);
