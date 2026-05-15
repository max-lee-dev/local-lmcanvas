import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

type Props = {
  onContinue: () => void;
};

export function WelcomeStep({ onContinue }: Props) {
  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col items-center text-center"
    >
      <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        local-lmcanvas
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Branch your AI conversations.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        A local canvas for parallel chats with Claude, Codex, and Cursor.
        Connect one or more providers to get started.
      </p>
      <motion.button
        onClick={onContinue}
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.02 }}
        className="mt-7 inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 cursor-pointer"
      >
        Get started
        <ArrowRight className="h-4 w-4" />
      </motion.button>
    </motion.div>
  );
}
