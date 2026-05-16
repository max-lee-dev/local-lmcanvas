import { motion } from "framer-motion";
import { Check } from "lucide-react";
import clsx from "clsx";
import { PROVIDERS, type Provider } from "@shared/types";
import { PROVIDER_INFO } from "@/components/Onboarding/providerInfo";
import { ProviderLogo } from "@/components/Canvas/ProviderLogo";

type Props = {
  value: Provider;
  onChange: (next: Provider) => void;
};

export function ProviderPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {PROVIDERS.map((p) => {
        const isActive = value === p;
        const info = PROVIDER_INFO[p];
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-pressed={isActive}
            title={info.tagline}
            className={clsx(
              "flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground/30",
              isActive
                ? "border-foreground/40 bg-foreground/[0.06]"
                : "border-border bg-background hover:bg-muted/40"
            )}
          >
            <ProviderLogo provider={p} size={14} className="shrink-0" />
            <span className="min-w-0 truncate text-xs font-medium text-foreground">
              {info.name}
            </span>
            {isActive && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 20 }}
                className="ml-auto inline-flex shrink-0"
              >
                <Check className="h-3 w-3 text-foreground/70" />
              </motion.span>
            )}
          </button>
        );
      })}
    </div>
  );
}
