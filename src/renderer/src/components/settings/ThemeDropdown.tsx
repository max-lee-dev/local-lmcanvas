import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Laptop, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "@/hooks/usePreferencesStore";

type Swatches = { bg: string; fg: string; accent: string };

type ThemeOption = {
  value: ThemeMode;
  label: string;
  swatches: Swatches;
  icon?: React.ReactNode;
};

const OPTIONS: ThemeOption[] = [
  {
    value: "auto",
    label: "Auto",
    swatches: { bg: "#ffffff", fg: "#171717", accent: "#737373" },
    icon: <Laptop className="h-3 w-3" />,
  },
  {
    value: "light",
    label: "Light",
    swatches: { bg: "#fafafa", fg: "#171717", accent: "#404040" },
    icon: <Sun className="h-3 w-3" />,
  },
  {
    value: "dark",
    label: "Dark",
    swatches: { bg: "#171717", fg: "#e5e5e5", accent: "#ffffff" },
    icon: <Moon className="h-3 w-3" />,
  },
  {
    value: "solarized-light",
    label: "Solarized Light",
    swatches: { bg: "#fdf6e3", fg: "#586e75", accent: "#268bd2" },
  },
  {
    value: "solarized-dark",
    label: "Solarized Dark",
    swatches: { bg: "#002b36", fg: "#93a1a1", accent: "#b58900" },
  },
  {
    value: "nord",
    label: "Nord",
    swatches: { bg: "#2e3440", fg: "#d8dee9", accent: "#88c0d0" },
  },
  {
    value: "dracula",
    label: "Dracula",
    swatches: { bg: "#282a36", fg: "#f8f8f2", accent: "#bd93f9" },
  },
  {
    value: "sepia",
    label: "Sepia",
    swatches: { bg: "#f4ecd8", fg: "#5b4636", accent: "#a0522d" },
  },
];

function SwatchTriple({ swatches }: { swatches: Swatches }) {
  return (
    <div className="inline-flex overflow-hidden rounded-sm border border-border">
      <span className="h-3.5 w-2" style={{ background: swatches.bg }} />
      <span className="h-3.5 w-2" style={{ background: swatches.fg }} />
      <span className="h-3.5 w-2" style={{ background: swatches.accent }} />
    </div>
  );
}

type Props = {
  value: ThemeMode;
  onChange: (next: ThemeMode) => void;
};

export function ThemeDropdown({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

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
        <SwatchTriple swatches={current.swatches} />
        <span>{current.label}</span>
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
            className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
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
                    <SwatchTriple swatches={option.swatches} />
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.icon && (
                      <span className="text-muted-foreground">{option.icon}</span>
                    )}
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
