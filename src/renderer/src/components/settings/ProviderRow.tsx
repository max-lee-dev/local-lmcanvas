import { motion } from "framer-motion";
import { ArrowUpRight, Check, RotateCw } from "lucide-react";
import clsx from "clsx";
import type { Provider } from "@shared/types";
import { useProviderAuth } from "@/hooks/useProviderAuth";
import { AuthStatusPill } from "@/components/Onboarding/AuthStatusPill";
import { PROVIDER_INFO } from "@/components/Onboarding/providerInfo";
import { ProviderLogo } from "@/components/Canvas/ProviderLogo";

type Props = {
  provider: Provider;
  isDefault: boolean;
  onMakeDefault: () => void;
};

export function ProviderRow({ provider, isDefault, onMakeDefault }: Props) {
  const info = PROVIDER_INFO[provider];
  const auth = useProviderAuth(provider);

  const authenticated = auth.status?.authenticated ?? false;
  const installed = auth.status?.installed ?? false;

  const handleSignIn = async () => {
    try {
      await window.api.providers.openLoginTerminal(provider);
    } finally {
      auth.startPolling();
    }
  };

  const stop = (e: React.MouseEvent | React.KeyboardEvent) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isDefault}
      title={info.tagline}
      onClick={onMakeDefault}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onMakeDefault();
        }
      }}
      className={clsx(
        "rounded-md border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground/30",
        isDefault
          ? "border-foreground/40 bg-foreground/[0.06]"
          : "border-border bg-background hover:bg-muted/40"
      )}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <ProviderLogo provider={provider} size={14} className="shrink-0" />
        <span className="text-xs font-medium text-foreground truncate">{info.name}</span>
        {isDefault && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
            className="inline-flex shrink-0"
          >
            <Check className="h-3 w-3 text-foreground/70" />
          </motion.span>
        )}
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          <AuthStatusPill
            status={auth.status}
            isLoading={auth.isLoading}
            isPolling={auth.isPolling}
            compact
          />
          {authenticated ? (
            <motion.button
              type="button"
              onClick={(e) => {
                stop(e);
                void handleSignIn();
              }}
              onMouseDown={stop}
              whileTap={{ scale: 0.9 }}
              title="Re-sign in"
              aria-label="Re-sign in"
              className="inline-flex items-center justify-center rounded-md border border-border bg-card p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
            >
              <RotateCw className="h-3 w-3" />
            </motion.button>
          ) : installed ? (
            <motion.button
              type="button"
              onClick={(e) => {
                stop(e);
                void handleSignIn();
              }}
              onMouseDown={stop}
              disabled={auth.isPolling}
              whileTap={{ scale: 0.95 }}
              className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {auth.isPolling ? "Wait…" : "Sign in"}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={(e) => {
                stop(e);
                window.open(info.installUrl, "_blank", "noopener");
              }}
              onMouseDown={stop}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted cursor-pointer"
            >
              Install
              <ArrowUpRight className="h-2.5 w-2.5" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
