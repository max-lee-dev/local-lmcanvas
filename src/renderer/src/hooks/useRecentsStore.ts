import { create } from "zustand";
import type { NodeSettings } from "@shared/types";

const MAX_RECENTS = 8;

type RecentsState = {
  folders: string[];
  branches: string[];
  /** Last node-level overrides applied anywhere; seeds new orphan nodes. */
  lastNodeSettings: NodeSettings | undefined;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addFolder: (path: string) => void;
  addBranch: (name: string) => void;
  removeFolder: (path: string) => void;
  removeBranch: (name: string) => void;
  setLastNodeSettings: (settings: NodeSettings | undefined) => void;
};

function bump(list: string[], value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return list;
  if (list[0] === trimmed) return list;
  const rest = list.filter((v) => v !== trimmed);
  return [trimmed, ...rest].slice(0, MAX_RECENTS);
}

type SettingsPatch = {
  recentFolders?: string[];
  recentBranches?: string[];
  lastNodeSettings?: NodeSettings | undefined;
};

let writeChain: Promise<unknown> = Promise.resolve();
function queueSettingsWrite(patch: SettingsPatch): void {
  writeChain = writeChain
    .catch(() => undefined)
    .then(async () => {
      const current = await window.api.settings.read();
      await window.api.settings.write({ ...current, ...patch });
    });
}

function sameNodeSettings(
  a: NodeSettings | undefined,
  b: NodeSettings | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.provider === b.provider && a.cwd === b.cwd && a.branch === b.branch;
}

export const useRecentsStore = create<RecentsState>((set, get) => ({
  folders: [],
  branches: [],
  lastNodeSettings: undefined,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    const s = await window.api.settings.read();
    set({
      folders: s.recentFolders ?? [],
      branches: s.recentBranches ?? [],
      lastNodeSettings: s.lastNodeSettings,
      hydrated: true,
    });
  },
  addFolder: (path) => {
    const next = bump(get().folders, path);
    if (next === get().folders) return;
    set({ folders: next });
    queueSettingsWrite({ recentFolders: next });
  },
  addBranch: (name) => {
    const next = bump(get().branches, name);
    if (next === get().branches) return;
    set({ branches: next });
    queueSettingsWrite({ recentBranches: next });
  },
  removeFolder: (path) => {
    const next = get().folders.filter((p) => p !== path);
    if (next.length === get().folders.length) return;
    set({ folders: next });
    queueSettingsWrite({ recentFolders: next });
  },
  removeBranch: (name) => {
    const next = get().branches.filter((b) => b !== name);
    if (next.length === get().branches.length) return;
    set({ branches: next });
    queueSettingsWrite({ recentBranches: next });
  },
  setLastNodeSettings: (settings) => {
    const cleaned =
      settings && (settings.provider || settings.cwd || settings.branch)
        ? { ...settings }
        : undefined;
    if (sameNodeSettings(get().lastNodeSettings, cleaned)) return;
    set({ lastNodeSettings: cleaned });
    queueSettingsWrite({ lastNodeSettings: cleaned });
  },
}));
