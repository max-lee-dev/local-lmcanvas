import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import type { Provider } from "@shared/types";
import { PROVIDER_INFO } from "./providerInfo";

type Props = {
  authedProviders: Provider[];
  isFinishing: boolean;
  onEnter: () => void;
};

export function DoneStep({ authedProviders, isFinishing, onEnter }: Props) {
  return (
    <motion.div
      key="done"
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
        Step 03 — Ready
      </span>

      <div className="mt-6 flex items-center gap-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
          className="flex h-10 w-10 items-center justify-center border border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
        >
          <Check className="h-5 w-5" />
        </motion.div>
        <h2
          className="text-4xl leading-[1.05] text-foreground sm:text-5xl"
          style={{ fontFamily: "var(--font-geist-pixel-square)", fontWeight: 700 }}
        >
          You&apos;re wired in.
        </h2>
      </div>

      <p
        className="mt-6 max-w-xl text-[14px] leading-[1.7] text-muted-foreground"
        style={{ fontFamily: "var(--font-geist-mono)" }}
      >
        {authedProviders.length > 0
          ? `Connected: ${authedProviders.map((p) => PROVIDER_INFO[p].name).join(", ")}. Open a canvas and start branching.`
          : "No providers connected — you can add them anytime from settings."}
      </p>

      <motion.button
        onClick={onEnter}
        disabled={isFinishing}
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -1 }}
        className="mt-10 inline-flex w-fit items-center gap-2 border border-foreground bg-foreground px-5 py-2.5 text-[12px] uppercase tracking-[0.16em] text-background hover:opacity-90 disabled:opacity-60 cursor-pointer"
        style={{ fontFamily: "var(--font-geist-mono)" }}
      >
        {isFinishing ? "Entering…" : "Enter local-lmcanvas"}
        {!isFinishing && <ArrowRight className="h-3.5 w-3.5" />}
      </motion.button>
    </motion.div>
  );
}
