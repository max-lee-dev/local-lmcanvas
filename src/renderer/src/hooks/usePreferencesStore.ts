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

export type PreferencesState = {
  showMinimap: boolean;
  panOnScrollSpeed: number;
  theme: ThemeMode;
  setShowMinimap: (v: boolean) => void;
  setPanOnScrollSpeed: (v: number) => void;
  setTheme: (v: ThemeMode) => void;
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      showMinimap: true,
      panOnScrollSpeed: 0.5,
      theme: "auto",
      setShowMinimap: (v) => set({ showMinimap: v }),
      setPanOnScrollSpeed: (v) => set({ panOnScrollSpeed: v }),
      setTheme: (v) => set({ theme: v }),
    }),
    {
      name: "lmcanvas:preferences",
      version: 1,
    },
  ),
);
