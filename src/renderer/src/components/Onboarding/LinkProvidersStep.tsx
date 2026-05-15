import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PROVIDERS, type Provider } from "@shared/types";
import { ProviderCard } from "./ProviderCard";

type Props = {
  onContinue: (authedProviders: Provider[]) => void;
  onSkip: () => void;
};

export function LinkProvidersStep({ onContinue, onSkip }: Props) {
  const [authed, setAuthed] = useState<Record<Provider, boolean>>({
    claude: false,
    codex: false,
    cursor: false,
  });

  const handleAuthChange = useCallback((provider: Provider, ok: boolean) => {
    setAuthed((prev) => (prev[provider] === ok ? prev : { ...prev, [provider]: ok }));
  }, []);

  const authedList = PROVIDERS.filter((p) => authed[p]);
  const canContinue = authedList.length > 0;

  return (
    <motion.div
      key="providers"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col"
    >
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Connect a provider
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Link at least one to enable conversations. You can add more later.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p}
            provider={p}
            onAuthChange={handleAuthChange}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <motion.button
          onClick={() => onContinue(authedList)}
          disabled={!canContinue}
          whileTap={canContinue ? { scale: 0.96 } : {}}
          whileHover={canContinue ? { scale: 1.02 } : {}}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </motion.button>
        <button
          onClick={onSkip}
          className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline cursor-pointer"
        >
          Skip for now
        </button>
      </div>
    </motion.div>
  );
}
