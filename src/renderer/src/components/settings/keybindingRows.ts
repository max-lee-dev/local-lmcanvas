import type { KeybindingId } from "@/hooks/usePreferencesStore";

export type KeybindingRow = {
  id: KeybindingId;
  label: string;
  description: string;
};

export const KEYBINDING_ROWS: KeybindingRow[] = [
  {
    id: "splitPanePicker",
    label: "Open split-pane picker",
    description: "Open a search to load another canvas alongside the current one.",
  },
];
