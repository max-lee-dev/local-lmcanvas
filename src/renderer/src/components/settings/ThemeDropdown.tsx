import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Laptop, Moon, Sun } from "lucide-react";
import type { ThemeMode } from "@/hooks/usePreferencesStore";

type ThemeOption = {
  value: ThemeMode;
  label: string;
  color: string;
  icon?: React.ReactNode;
};

const OPTIONS: ThemeOption[] = [
  {
    value: "auto",
    label: "Auto",
    color: "#737373",
    icon: <Laptop className="h-3 w-3" />,
  },
  {
    value: "light",
    label: "Light",
    color: "#fafafa",
    icon: <Sun className="h-3 w-3" />,
  },
  {
    value: "dark",
    label: "Dark",
    color: "#171717",
    icon: <Moon className="h-3 w-3" />,
  },
  {
    value: "solarized-light",
    label: "Solarized Light",
    color: "#268bd2",
  },
  {
    value: "solarized-dark",
    label: "Solarized Dark",
    color: "#b58900",
  },
  {
    value: "nord",
    label: "Nord",
    color: "#88c0d0",
  },
  {
    value: "dracula",
    label: "Dracula",
    color: "#bd93f9",
  },
  {
    value: "sepia",
    label: "Sepia",
    color: "#a0522d",
  },
];

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-sm border border-border"
      style={{ background: color }}
    />
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
        <Swatch color={current.color} />
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
                    <Swatch color={option.color} />
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
