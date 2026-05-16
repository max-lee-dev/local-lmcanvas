import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BrowserPanelState = {
  open: boolean;
  url: string;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setUrl: (url: string) => void;
};

const DEFAULT_URL = "about:blank";

export const useBrowserPanelStore = create<BrowserPanelState>()(
  persist(
    (set) => ({
      open: false,
      url: DEFAULT_URL,
      setOpen: (open) => set({ open }),
      toggle: () => set((s) => ({ open: !s.open })),
      setUrl: (url) => set({ url }),
    }),
    {
      name: "lmcanvas:browserPanel",
      version: 1,
    },
  ),
);
