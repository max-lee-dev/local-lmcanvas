import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import type { ProviderAuthStatus } from "@shared/ipc";

type Props = {
  status: ProviderAuthStatus | null;
  isLoading: boolean;
  isPolling: boolean;
};

type Variant = "loading" | "not-installed" | "not-signed-in" | "connected";

function classify(p: Props): { variant: Variant; label: string } {
  if (p.isLoading && !p.status) return { variant: "loading", label: "Checking…" };
  if (p.isPolling && !p.status?.authenticated)
    return { variant: "loading", label: "Waiting for sign-in…" };
  if (!p.status) return { variant: "not-installed", label: "Unknown" };
  if (!p.status.installed) return { variant: "not-installed", label: "Not installed" };
  if (!p.status.authenticated)
    return { variant: "not-signed-in", label: "Not signed in" };
  return { variant: "connected", label: "Connected" };
}

const STYLES: Record<Variant, string> = {
  loading: "bg-muted text-muted-foreground border-border",
  "not-installed": "bg-muted text-muted-foreground border-border",
  "not-signed-in":
    "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
  connected:
    "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
};

export function AuthStatusPill(props: Props) {
  const { variant, label } = classify(props);

  return (
    <motion.span
      layout
      key={variant}
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STYLES[variant]}`}
    >
      {variant === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
      {variant === "connected" && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="inline-flex"
        >
          <Check className="h-3 w-3" />
        </motion.span>
      )}
      {label}
    </motion.span>
  );
}
