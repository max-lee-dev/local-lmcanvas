import { useCallback } from "react";
import { Search } from "lucide-react";
import { useSearchModal } from "@/providers/SearchModalProvider";

export function SearchButton() {
  const { showSearchModal } = useSearchModal();

  const handleClick = useCallback(() => {
    showSearchModal();
  }, [showSearchModal]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="CMD+F to search"
      title="CMD+F to search"
      className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-muted cursor-pointer"
    >
      <Search size={14} aria-hidden="true" />
    </button>
  );
}
