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
      className="flex flex-col"
    >
      <span
        className="self-start text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
        style={{ fontFamily: "var(--font-geist-mono)" }}
      >
        local-lmcanvas
      </span>

      <h1
        className="mt-6 text-5xl leading-[1.05] text-foreground sm:text-6xl"
        style={{ fontFamily: "var(--font-geist-pixel-square)", fontWeight: 700 }}
      >
        Chat is a dead end.
      </h1>

      <p
        className="mt-6 max-w-xl text-[15px] leading-[1.7] text-muted-foreground"
        style={{ fontFamily: "var(--font-geist-mono)" }}
      >
        Every AI chat works the same way: one thread, one path, one direction.
        local-lmcanvas gives you a canvas — branch a conversation the moment
        you want to try a different angle, keep every approach in view.
      </p>

      <div className="mt-10 flex items-center gap-4">
        <motion.button
          onClick={onContinue}
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -1 }}
          className="inline-flex items-center gap-2 border border-foreground bg-foreground px-5 py-2.5 text-[12px] uppercase tracking-[0.16em] text-background hover:opacity-90 cursor-pointer"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          Get started
          <ArrowRight className="h-3.5 w-3.5" />
        </motion.button>
        <span
          className="text-[11px] text-muted-foreground/80"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          three steps · about a minute
        </span>
      </div>
    </motion.div>
  );
}
