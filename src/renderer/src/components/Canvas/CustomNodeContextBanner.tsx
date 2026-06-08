import clsx from "clsx";
import { CornerDownRight } from "lucide-react";

type CustomNodeContextBannerProps = {
  addedContext?: string;
  isTemporary?: boolean;
};

export function CustomNodeContextBanner({
  addedContext,
  isTemporary,
}: CustomNodeContextBannerProps) {
  if (!addedContext) return null;

  return (
    <div
      className={clsx(
        "absolute -left-px -right-px top-0 -translate-y-full p-1 rounded-[10px] rounded-b-none border border-b-0 bg-card text-foreground max-h-32 overflow-y-auto",
        isTemporary ? "border-dashed border-amber-500/60" : "border-border",
      )}
      style={
        isTemporary
          ? {
              boxShadow:
                "0 0 22px 0 color-mix(in oklab, rgb(245 158 11) 35%, transparent)",
            }
          : undefined
      }
      aria-label="Copied context"
    >
      <div className="flex items-center gap-3 px-3 py-2 rounded-t-[6px] rounded-b-none bg-muted">
        <CornerDownRight
          size={10}
          className="shrink-0 text-muted-foreground"
        />
        <div className="text-[8px] leading-none tracking-tight font-medium line-clamp-1 text-muted-foreground">
          {addedContext}
        </div>
      </div>
    </div>
  );
}
