import { CornerDownRight } from "lucide-react";

type CustomNodeContextBannerProps = {
  addedContext?: string;
};

export function CustomNodeContextBanner({
  addedContext,
}: CustomNodeContextBannerProps) {
  if (!addedContext) return null;

  return (
    <div
      className="absolute left-0 right-0 top-0 -translate-y-full p-1 rounded-lg rounded-b-none border border-b-0 border-border bg-card text-foreground max-h-32 overflow-y-auto"
      aria-label="Copied context"
    >
      <div className="flex items-center gap-3 px-3 py-2 rounded-t-[6px] rounded-b-none bg-muted">
        <CornerDownRight
          size={10}
          className="shrink-0 text-muted-foreground"
        />
        <div
          className="font-medium line-clamp-1 text-muted-foreground"
          style={{ fontSize: "8px" }}
        >
          {addedContext}
        </div>
      </div>
    </div>
  );
}
