import { PROVIDERS, type Provider } from "@shared/types";
import { PROVIDER_INFO } from "@/components/Onboarding/providerInfo";
import { ProviderLogo } from "@/components/Canvas/ProviderLogo";
import { useProviderInfo } from "@/hooks/useProviderInfo";

type Props = {
  value: Provider;
  onChange: (next: Provider) => void;
};

export function ProviderPicker({ value, onChange }: Props) {
  const { labelsByProvider } = useProviderInfo();

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {PROVIDERS.map((p) => {
        const isActive = value === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-pressed={isActive}
            className={`flex flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 transition-colors cursor-pointer ${
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
            title={PROVIDER_INFO[p].tagline}
          >
            <div
              className={`flex h-7 w-7 items-center justify-center border ${
                isActive
                  ? "border-background/20 bg-background/10"
                  : "border-border bg-background"
              }`}
            >
              <ProviderLogo provider={p} size={16} className="opacity-90" />
            </div>
            <span
              className="text-[11px] leading-none tracking-tight"
              style={{
                fontFamily: "var(--font-geist-pixel-square)",
                fontWeight: 700,
              }}
            >
              {PROVIDER_INFO[p].name}
            </span>
            <span
              className={`max-w-full truncate text-[9px] leading-none ${
                isActive ? "text-background/70" : "text-muted-foreground"
              }`}
              style={{ fontFamily: "var(--font-geist-mono)" }}
            >
              {labelsByProvider[p]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
