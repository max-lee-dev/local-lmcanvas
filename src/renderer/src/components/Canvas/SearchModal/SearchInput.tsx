import { Search, User, MessageSquare } from "lucide-react";

type SearchInputProps = {
  searchQuery: string;
  searchMode: "user" | "both";
  onQueryChange: (query: string) => void;
  onToggleMode: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

export function SearchInput({
  searchQuery,
  searchMode,
  onQueryChange,
  onToggleMode,
  onKeyDown,
  inputRef,
}: SearchInputProps) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search your queries..."
        className="w-full px-12 py-4 pr-24 text-lg focus:outline-none bg-popover/50 text-foreground"
      />
      <button
        type="button"
        onClick={onToggleMode}
        className="cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-xs px-2.5 py-1 hover:opacity-90"
        title={
          searchMode === "user"
            ? "Searching user messages only (Tab to toggle)"
            : "Searching user + assistant messages (Tab to toggle)"
        }
      >
        {searchMode === "user" ? (
          <>
            <User className="w-4 h-4" />
            <span>User</span>
          </>
        ) : (
          <>
            <MessageSquare className="w-4 h-4" />
            <span>Both</span>
          </>
        )}
      </button>
    </div>
  );
}
