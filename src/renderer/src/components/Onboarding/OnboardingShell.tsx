import type { ReactNode } from "react";
import { motion } from "framer-motion";

type Step = "welcome" | "providers" | "done";

const ORDER: Step[] = ["welcome", "providers", "done"];

type Props = {
  step: Step;
  children: ReactNode;
};

export function OnboardingShell({ step, children }: Props) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background app-drag overflow-hidden">
      {/* Canvas-style grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Soft edge fade so the grid recedes at the corners */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 40%, transparent 40%, var(--background) 95%)",
        }}
      />

      <motion.div
        layout
        className="no-drag relative z-10 mx-auto flex w-full max-w-2xl flex-col items-stretch px-10 py-12"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {children}

        <div className="mt-10 flex items-center justify-center gap-1.5">
          {ORDER.map((s) => {
            const isActive = s === step;
            const isPast = ORDER.indexOf(s) < ORDER.indexOf(step);
            return (
              <motion.span
                key={s}
                layout
                className={`h-[3px] transition-colors ${
                  isActive
                    ? "w-8 bg-foreground"
                    : isPast
                      ? "w-3 bg-foreground/60"
                      : "w-3 bg-border"
                }`}
              />
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
