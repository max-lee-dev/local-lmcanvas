import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { Provider } from "@shared/types";
import { navigate } from "@/App";
import { OnboardingShell } from "@/components/Onboarding/OnboardingShell";
import { WelcomeStep } from "@/components/Onboarding/WelcomeStep";
import { LinkProvidersStep } from "@/components/Onboarding/LinkProvidersStep";
import { DoneStep } from "@/components/Onboarding/DoneStep";

type Step = "welcome" | "providers" | "done";

export function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [authedProviders, setAuthedProviders] = useState<Provider[]>([]);
  const [isFinishing, setIsFinishing] = useState(false);

  const finishOnboarding = async () => {
    setIsFinishing(true);
    try {
      const current = await window.api.settings.read();
      const next = {
        ...current,
        onboardingCompleted: true,
        defaultProvider: authedProviders[0] ?? current.defaultProvider,
      };
      await window.api.settings.write(next);
      const canvas = await window.api.canvases.create({});
      navigate(`/canvas/${canvas.id}`);
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <OnboardingShell step={step}>
      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <WelcomeStep onContinue={() => setStep("providers")} />
        )}
        {step === "providers" && (
          <LinkProvidersStep
            onContinue={(authed) => {
              setAuthedProviders(authed);
              setStep("done");
            }}
            onSkip={() => {
              setAuthedProviders([]);
              setStep("done");
            }}
          />
        )}
        {step === "done" && (
          <DoneStep
            authedProviders={authedProviders}
            isFinishing={isFinishing}
            onEnter={() => void finishOnboarding()}
          />
        )}
      </AnimatePresence>
    </OnboardingShell>
  );
}
