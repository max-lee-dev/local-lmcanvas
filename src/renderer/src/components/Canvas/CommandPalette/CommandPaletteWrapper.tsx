import { useEffect, useMemo, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useCommandPalette } from "@/providers/CommandPaletteProvider";
import { useIsActivePane } from "@/hooks/useActivePane";
import { CommandPalette, type CommandPaletteAction } from "./CommandPalette";

export function CommandPaletteWrapper() {
  const isActive = useIsActivePane();
  const inputRef = useRef<HTMLInputElement>(null);
  const { setInputRef } = useCommandPalette();
  const rf = useReactFlow();

  useEffect(() => {
    if (!isActive) return;
    setInputRef(inputRef);
  }, [isActive, setInputRef]);

  const actions = useMemo<CommandPaletteAction[]>(
    () => [
      {
        id: "fit-view",
        label: "Zoom out and center",
        description: "Fit all nodes into view and recenter the canvas.",
        keywords: [
          "fit",
          "view",
          "center",
          "zoom",
          "out",
          "recenter",
          "all",
          "viewport",
          "camera",
          "focus",
        ],
        run: () => {
          rf.fitView({ padding: 0.25, duration: 400 });
        },
      },
    ],
    [rf],
  );

  if (!isActive) return null;

  return <CommandPalette actions={actions} inputRef={inputRef} />;
}
