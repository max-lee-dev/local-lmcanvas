import { PROVIDERS, type Provider } from "@shared/types";
import { PROVIDER_INFO } from "@/components/Onboarding/providerInfo";
import { useProviderInfo } from "@/hooks/useProviderInfo";

type Props = {
  value: Provider;
  onChange: (next: Provider) => void;
};

export function ProviderPicker({ value, onChange }: Props) {
  const { labelsByProvider } = useProviderInfo();

  return (
    <div className="inline-flex w-full items-center rounded-md border border-border bg-card p-0.5">
      {PROVIDERS.map((p) => {
        const isActive = value === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-pressed={isActive}
            className={`flex-1 cursor-pointer rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              isActive
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={PROVIDER_INFO[p].tagline}
          >
            {labelsByProvider[p]}
          </button>
        );
      })}
    </div>
  );
}
