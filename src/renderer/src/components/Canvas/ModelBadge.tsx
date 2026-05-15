import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, Check, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { PROVIDERS, type Provider } from "@shared/types";
import { useProviderInfo } from "@/hooks/useProviderInfo";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { PROVIDER_INFO } from "@/components/Onboarding/providerInfo";
import { ProviderLogo } from "./ProviderLogo";

export function ModelBadge() {
  const { provider, label, labelsByProvider } = useProviderInfo();
  const setProvider = useCanvasStore((s) => s.setProvider);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent): void => {
      const root = wrapperRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickProvider = (p: Provider): void => {
    setProvider(p);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="nodrag relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          "flex items-center gap-1 rounded-sm border border-border bg-card text-foreground px-1.5 py-[5px] text-xs font-medium cursor-pointer transition-colors",
          "hover:bg-muted",
          open && "bg-muted"
        )}
        style={{ fontFamily: "var(--font-geist-pixel-square)" }}
        title={`Provider: ${PROVIDER_INFO[provider].name} · click to switch`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ProviderLogo provider={provider} size={10} />
        <span className="tracking-tight text-[8px]">{label}</span>
        {provider === "claude" && (
          <Brain className="w-[10px] h-[10px] text-amber-500 opacity-90" />
        )}
        <ChevronDown
          className={clsx(
            "w-[8px] h-[8px] text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-border bg-card shadow-lg overflow-hidden"
            role="listbox"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className="px-2.5 pt-2 pb-1 text-[8px] uppercase tracking-[0.14em] text-muted-foreground"
              style={{ fontFamily: "var(--font-geist-mono)" }}
            >
              Canvas model
            </div>
            {PROVIDERS.map((p) => {
              const isActive = p === provider;
              return (
                <button
                  key={p}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => pickProvider(p)}
                  className={clsx(
                    "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors cursor-pointer",
                    isActive
                      ? "bg-accent/15 text-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <ProviderLogo provider={p} size={12} />
                  <span className="flex-1">{labelsByProvider[p]}</span>
                  {isActive && (
                    <Check className="h-3 w-3 text-foreground/70" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
