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
      <span
        className="self-start text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
        style={{ fontFamily: "var(--font-geist-mono)" }}
      >
        Step 02 — Connect
      </span>

      <h2
        className="mt-5 text-4xl leading-[1.05] text-foreground sm:text-5xl"
        style={{ fontFamily: "var(--font-geist-pixel-square)", fontWeight: 700 }}
      >
        Plug in a provider.
      </h2>

      <p
        className="mt-4 max-w-xl text-[14px] leading-[1.7] text-muted-foreground"
        style={{ fontFamily: "var(--font-geist-mono)" }}
      >
        local-lmcanvas runs your local CLIs — nothing routes through us. Sign
        in to at least one to enable conversations. You can add more later.
      </p>

      <div className="mt-8 flex flex-col">
        {PROVIDERS.map((p, i) => (
          <ProviderCard
            key={p}
            provider={p}
            onAuthChange={handleAuthChange}
            isFirst={i === 0}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <button
          onClick={onSkip}
          className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline cursor-pointer"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          Skip for now
        </button>
        <motion.button
          onClick={() => onContinue(authedList)}
          disabled={!canContinue}
          whileTap={canContinue ? { scale: 0.97 } : {}}
          whileHover={canContinue ? { y: -1 } : {}}
          className="inline-flex items-center gap-2 border border-foreground bg-foreground px-5 py-2.5 text-[12px] uppercase tracking-[0.16em] text-background hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          Continue
          <ArrowRight className="h-3.5 w-3.5" />
        </motion.button>
      </div>
    </motion.div>
  );
}
