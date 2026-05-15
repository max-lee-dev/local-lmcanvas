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
  isFirst?: boolean;
};

export function ProviderCard({ provider, onAuthChange, isFirst }: Props) {
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
      className={`flex items-center gap-4 border-b border-border bg-card/40 px-4 py-4 hover:bg-card/80 ${
        isFirst ? "border-t" : ""
      }`}
      whileHover={{ x: 1 }}
      transition={{ duration: 0.15 }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-background text-base text-foreground"
        style={{ fontFamily: "var(--font-geist-pixel-square)", fontWeight: 700 }}
      >
        {info.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[13px] tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-geist-pixel-square)", fontWeight: 700 }}
          >
            {info.name}
          </span>
          <AuthStatusPill
            status={auth.status}
            isLoading={auth.isLoading}
            isPolling={auth.isPolling}
          />
        </div>
        <p
          className="mt-0.5 text-[11px] text-muted-foreground"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          {info.tagline}
        </p>
        {auth.status?.detail && !authenticated && (
          <p
            className="mt-1 text-[10px] text-muted-foreground/70"
            style={{ fontFamily: "var(--font-geist-mono)" }}
          >
            {auth.status.detail}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {authenticated ? (
          <motion.button
            type="button"
            onClick={() => void auth.refresh()}
            className="inline-flex items-center gap-1 border border-border bg-background px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:bg-muted cursor-pointer"
            style={{ fontFamily: "var(--font-geist-mono)" }}
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
            className="border border-foreground bg-foreground px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-background hover:opacity-90 disabled:opacity-50 cursor-pointer"
            style={{ fontFamily: "var(--font-geist-mono)" }}
            whileTap={{ scale: 0.94 }}
            whileHover={{ y: -1 }}
          >
            {auth.isPolling ? "Waiting…" : "Sign in"}
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center gap-1 border border-border bg-background px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-foreground hover:bg-muted cursor-pointer"
            style={{ fontFamily: "var(--font-geist-mono)" }}
            whileTap={{ scale: 0.94 }}
            whileHover={{ y: -1 }}
          >
            Install
            <ArrowUpRight className="h-3 w-3" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
