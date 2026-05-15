import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Play, Volume2, VolumeX } from "lucide-react";
import {
  FINISH_SOUNDS,
  usePreferencesStore,
  type FinishSound,
} from "@/hooks/usePreferencesStore";
import { FINISH_SOUND_LABELS, playFinishSound } from "@/lib/finishSound";

type Option = { value: "off" | FinishSound; label: string };

const OPTIONS: Option[] = [
  { value: "off", label: "Off" },
  ...FINISH_SOUNDS.map((v) => ({ value: v, label: FINISH_SOUND_LABELS[v] })),
];

export function FinishSoundSetting() {
  const enabled = usePreferencesStore((s) => s.finishSoundEnabled);
  const sound = usePreferencesStore((s) => s.finishSound);
  const setEnabled = usePreferencesStore((s) => s.setFinishSoundEnabled);
  const setSound = usePreferencesStore((s) => s.setFinishSound);

  const currentValue: "off" | FinishSound = enabled ? sound : "off";
  const currentLabel = enabled ? FINISH_SOUND_LABELS[sound] : "Off";

  const handleSelect = (value: "off" | FinishSound) => {
    if (value === "off") {
      setEnabled(false);
      return;
    }
    setSound(value);
    if (!enabled) setEnabled(true);
    playFinishSound(value);
  };

  const handlePreview = () => {
    if (!enabled) return;
    playFinishSound(sound);
  };

  return (
    <div className="flex items-center justify-between w-full px-3 py-3 rounded-xl border bg-card border-border">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">
          {enabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">Finish sound</div>
          <div className="text-xs mt-0.5 text-muted-foreground">
            Play a sound when a node finishes responding.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {enabled && (
          <button
            type="button"
            onClick={handlePreview}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
            title="preview"
          >
            <Play className="h-3 w-3" />
          </button>
        )}
        <FinishSoundDropdown
          value={currentValue}
          label={currentLabel}
          onChange={handleSelect}
        />
      </div>
    </div>
  );
}

type DropdownProps = {
  value: "off" | FinishSound;
  label: string;
  onChange: (value: "off" | FinishSound) => void;
};

function FinishSoundDropdown({ value, label, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/60"
      >
        <span>{label}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          className="inline-flex"
        >
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
          >
            {OPTIONS.map((option) => {
              const isActive = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-muted/60 ${
                      isActive ? "text-foreground" : "text-foreground/90"
                    }`}
                  >
                    <span className="flex-1 truncate">{option.label}</span>
                    {isActive && <Check className="h-3 w-3 text-foreground" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
