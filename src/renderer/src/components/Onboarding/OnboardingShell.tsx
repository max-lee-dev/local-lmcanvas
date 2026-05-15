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
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background app-drag">
      {/* Subtle radial gradient — onboarding-only flourish */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, oklch(0.7 0.05 230 / 0.08), transparent 70%)",
        }}
      />
      <motion.div
        layout
        className="no-drag relative z-10 mx-auto flex w-full max-w-xl flex-col items-stretch rounded-2xl border border-border bg-card/80 p-8 shadow-xl backdrop-blur"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {children}
        <div className="mt-8 flex items-center justify-center gap-1.5">
          {ORDER.map((s) => {
            const isActive = s === step;
            const isPast = ORDER.indexOf(s) < ORDER.indexOf(step);
            return (
              <motion.span
                key={s}
                layout
                className={`h-1.5 rounded-full transition-colors ${
                  isActive
                    ? "w-6 bg-foreground"
                    : isPast
                      ? "w-1.5 bg-foreground/60"
                      : "w-1.5 bg-border"
                }`}
              />
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
