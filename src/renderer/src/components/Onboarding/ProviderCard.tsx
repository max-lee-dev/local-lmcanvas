import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import type { Provider } from "@shared/types";
import { useProviderAuth } from "@/hooks/useProviderAuth";
import { AuthStatusPill } from "./AuthStatusPill";
import { PROVIDER_INFO } from "./providerInfo";

type Props = {
  provider: Provider;
  onAuthChange?: (provider: Provider, authenticated: boolean) => void;
};

export function ProviderCard({ provider, onAuthChange }: Props) {
  const info = PROVIDER_INFO[provider];
  const auth = useProviderAuth(provider);

  const authenticated = auth.status?.authenticated ?? false;
  const installed = auth.status?.installed ?? false;

  useEffect(() => {
    onAuthChange?.(provider, authenticated);
  }, [authenticated, provider, onAuthChange]);

  const handleSignIn = async () => {
    try {
      await window.api.providers.openLoginTerminal(provider);
    } finally {
      auth.startPolling();
    }
  };

  const handleInstall = () => {
    window.open(info.installUrl, "_blank", "noopener");
  };

  return (
    <motion.div
      layout
      className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-foreground">
        {info.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{info.name}</span>
          <AuthStatusPill
            status={auth.status}
            isLoading={auth.isLoading}
            isPolling={auth.isPolling}
          />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{info.tagline}</p>
        {auth.status?.detail && !authenticated && (
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            {auth.status.detail}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {authenticated ? (
          <motion.button
            type="button"
            onClick={() => void auth.refresh()}
            className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-muted cursor-pointer inline-flex items-center gap-1"
            whileTap={{ scale: 0.96 }}
            title="Re-check auth status"
          >
            <RefreshCw className="h-3 w-3" />
            Re-check
          </motion.button>
        ) : installed ? (
          <motion.button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={auth.isPolling}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-60 cursor-pointer"
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
          >
            {auth.isPolling ? "Waiting…" : "Sign in"}
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={handleInstall}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer inline-flex items-center gap-1"
            whileTap={{ scale: 0.94 }}
            whileHover={{ scale: 1.02 }}
          >
            Install
            <ArrowUpRight className="h-3 w-3" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
