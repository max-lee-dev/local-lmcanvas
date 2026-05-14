import { CanvasManager } from "@/components/CanvasManager/CanvasManager";

export function HomePage() {
  return (
    <div className="min-h-screen w-full bg-background app-drag">
      <CanvasManager defaultOpen />
    </div>
  );
}
