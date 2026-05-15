import { motion } from "framer-motion";
import { Check } from "lucide-react";
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
      className="flex flex-col items-center text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
      >
        <Check className="h-6 w-6" />
      </motion.div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
        You&apos;re all set.
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {authedProviders.length > 0
          ? `Connected: ${authedProviders.map((p) => PROVIDER_INFO[p].name).join(", ")}.`
          : "No providers connected — you can add them anytime from settings."}
      </p>
      <motion.button
        onClick={onEnter}
        disabled={isFinishing}
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.02 }}
        className="mt-7 inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60 cursor-pointer"
      >
        {isFinishing ? "Entering…" : "Enter local-lmcanvas"}
      </motion.button>
    </motion.div>
  );
}
