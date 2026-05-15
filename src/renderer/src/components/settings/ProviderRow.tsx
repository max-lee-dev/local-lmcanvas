import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { Provider, ProviderConfig } from "@shared/types";
import { useProviderAuth } from "@/hooks/useProviderAuth";
import { AuthStatusPill } from "@/components/Onboarding/AuthStatusPill";
import { PROVIDER_INFO } from "@/components/Onboarding/providerInfo";

type Props = {
  provider: Provider;
  isDefault: boolean;
  config: ProviderConfig | undefined;
  onMakeDefault: () => void;
  onConfigChange: (next: ProviderConfig) => void;
};

export function ProviderRow({
  provider,
  isDefault,
  config,
  onMakeDefault,
  onConfigChange,
}: Props) {
  const info = PROVIDER_INFO[provider];
  const auth = useProviderAuth(provider);
  const [expanded, setExpanded] = useState(false);

  const authenticated = auth.status?.authenticated ?? false;
  const installed = auth.status?.installed ?? false;

  const handleSignIn = async () => {
    try {
      await window.api.providers.openLoginTerminal(provider);
    } finally {
      auth.startPolling();
    }
  };

  return (
    <div
      className="rounded-md border border-border bg-background"
      title={info.tagline}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <input
          type="radio"
          name="default-provider"
          checked={isDefault}
          onChange={onMakeDefault}
          aria-label={`make ${info.name} default`}
          className="cursor-pointer accent-foreground shrink-0"
        />
        <span className="text-xs font-medium text-foreground truncate">
          {info.name}
        </span>
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
              onClick={() => void handleSignIn()}
              whileTap={{ scale: 0.95 }}
              title="Re-sign in"
              className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted cursor-pointer"
            >
              Re-sign
            </motion.button>
          ) : installed ? (
            <motion.button
              type="button"
              onClick={() => void handleSignIn()}
              disabled={auth.isPolling}
              whileTap={{ scale: 0.95 }}
              className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {auth.isPolling ? "Wait…" : "Sign in"}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={() => window.open(info.installUrl, "_blank", "noopener")}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted cursor-pointer"
            >
              Install
              <ArrowUpRight className="h-2.5 w-2.5" />
            </motion.button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label="advanced"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted cursor-pointer"
          >
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.15 }}
              className="inline-flex"
            >
              <ChevronDown className="h-3 w-3" />
            </motion.span>
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="grid gap-2 border-t border-border px-3 py-2.5">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  binary path
                </label>
                <input
                  value={config?.binPath ?? ""}
                  onChange={(e) =>
                    onConfigChange({ ...(config ?? {}), binPath: e.target.value })
                  }
                  placeholder={`default: "${provider}"`}
                  className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  model (optional)
                </label>
                <input
                  value={config?.model ?? ""}
                  onChange={(e) =>
                    onConfigChange({ ...(config ?? {}), model: e.target.value })
                  }
                  placeholder="leave blank for provider default"
                  className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1 text-xs"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
