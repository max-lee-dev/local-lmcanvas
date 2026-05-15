import { motion } from "framer-motion";
import { Loader2, Plug2, Unplug } from "lucide-react";
import type { ProviderAuthStatus } from "@shared/ipc";

type Props = {
  status: ProviderAuthStatus | null;
  isLoading: boolean;
  isPolling: boolean;
  compact?: boolean;
};

type Variant = "loading" | "not-installed" | "not-signed-in" | "connected";

function classify(p: Props): { variant: Variant; label: string } {
  if (p.isLoading && !p.status) return { variant: "loading", label: "Checking" };
  if (p.isPolling && !p.status?.authenticated)
    return { variant: "loading", label: "Waiting" };
  if (!p.status) return { variant: "not-installed", label: "Unknown" };
  if (!p.status.installed) return { variant: "not-installed", label: "Not installed" };
  if (!p.status.authenticated)
    return { variant: "not-signed-in", label: "Not signed in" };
  return { variant: "connected", label: "Connected" };
}

const COMPACT_LABEL: Record<Variant, string> = {
  loading: "…",
  "not-installed": "Off",
  "not-signed-in": "Out",
  connected: "",
};

const STYLES: Record<Variant, string> = {
  loading: "bg-muted text-muted-foreground border-border",
  "not-installed": "bg-muted/60 text-muted-foreground border-border",
  "not-signed-in":
    "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  connected:
    "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
};

export function AuthStatusPill(props: Props) {
  const { variant, label } = classify(props);
  const compact = props.compact ?? false;
  const displayLabel = compact ? COMPACT_LABEL[variant] : label;
  const disconnected = variant === "not-installed" || variant === "not-signed-in";

  return (
    <motion.span
      layout
      key={variant}
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      title={compact ? label : undefined}
      className={`inline-flex items-center gap-1 border ${
        compact ? "px-1 py-0.5" : "px-1.5 py-0.5"
      } text-[9px] uppercase tracking-[0.12em] ${STYLES[variant]}`}
      style={{ fontFamily: "var(--font-geist-mono)" }}
    >
      {variant === "loading" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {variant === "connected" && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="inline-flex"
        >
          <Plug2 className="h-2.5 w-2.5" />
        </motion.span>
      )}
      {disconnected && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="inline-flex"
        >
          <Unplug className="h-2.5 w-2.5" />
        </motion.span>
      )}
      {displayLabel}
    </motion.span>
  );
}
