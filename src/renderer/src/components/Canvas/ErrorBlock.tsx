import { KeyRound } from "lucide-react";
import { motion } from "framer-motion";
import type { Message } from "@shared/types";
import { openSettings } from "@/lib/openSettings";
import { PROVIDER_INFO } from "@/components/Onboarding/providerInfo";

type Props = { message: Message };

export function ErrorBlock({ message }: Props) {
  if (!message.error) return null;
  const authRequired = message.errorCode === "auth_required";
  const providerName = message.errorProvider
    ? PROVIDER_INFO[message.errorProvider]?.name ?? message.errorProvider
    : null;

  return (
    <div className="mt-1 rounded-[6px] border border-destructive/30 bg-destructive/5 px-2 py-1.5">
      <div className="text-[10px] text-destructive whitespace-pre-wrap">
        {authRequired && providerName
          ? `${providerName} authentication required. Sign in again to continue.`
          : message.error}
      </div>
      {authRequired && (
        <motion.button
          type="button"
          onClick={() => openSettings()}
          className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-background px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/10 cursor-pointer"
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
        >
          <KeyRound className="h-3 w-3" />
          Re-authenticate in Settings
        </motion.button>
      )}
      {authRequired && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] text-destructive/70 hover:text-destructive">
            details
          </summary>
          <pre className="mt-1 whitespace-pre-wrap text-[10px] text-destructive/80">
            {message.error}
          </pre>
        </details>
      )}
    </div>
  );
}
