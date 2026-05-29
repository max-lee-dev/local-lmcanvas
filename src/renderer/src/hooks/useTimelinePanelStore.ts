import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TimelinePanelState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

export const useTimelinePanelStore = create<TimelinePanelState>()(
  persist(
    (set) => ({
      open: false,
      setOpen: (open) => set({ open }),
      toggle: () => set((s) => ({ open: !s.open })),
    }),
    {
      name: "lmcanvas:timelinePanel",
      version: 1,
    },
  ),
);

export const TIMELINE_PANEL_WIDTH = 320;
