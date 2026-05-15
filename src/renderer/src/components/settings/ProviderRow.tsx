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
    <div className="rounded-md border border-border bg-background">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="default-provider"
            checked={isDefault}
            onChange={onMakeDefault}
            className="cursor-pointer accent-foreground"
          />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{info.name}</span>
            <AuthStatusPill
              status={auth.status}
              isLoading={auth.isLoading}
              isPolling={auth.isPolling}
            />
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
            {info.tagline}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {authenticated ? (
            <motion.button
              type="button"
              onClick={() => void handleSignIn()}
              whileTap={{ scale: 0.95 }}
              className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted cursor-pointer"
            >
              Re-sign in
            </motion.button>
          ) : installed ? (
            <motion.button
              type="button"
              onClick={() => void handleSignIn()}
              disabled={auth.isPolling}
              whileTap={{ scale: 0.95 }}
              className="rounded-md bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {auth.isPolling ? "Waiting…" : "Sign in"}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={() => window.open(info.installUrl, "_blank", "noopener")}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] text-foreground hover:bg-muted cursor-pointer"
            >
              Install
              <ArrowUpRight className="h-3 w-3" />
            </motion.button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label="advanced"
            className="rounded p-1 text-muted-foreground hover:bg-muted cursor-pointer"
          >
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.15 }}
              className="inline-flex"
            >
              <ChevronDown className="h-3.5 w-3.5" />
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
