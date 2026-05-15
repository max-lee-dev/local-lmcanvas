import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

type CommandPaletteContextType = {
  showCommandPalette: () => void;
  hideCommandPalette: () => void;
  isCommandPaletteOpen: boolean;
  setInputRef: (ref: RefObject<HTMLInputElement | null> | null) => void;
  inputRef: RefObject<HTMLInputElement | null> | null;
};

const CommandPaletteContext = createContext<
  CommandPaletteContextType | undefined
>(undefined);

export const useCommandPalette = (): CommandPaletteContextType => {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error(
      "useCommandPalette must be used within CommandPaletteProvider",
    );
  }
  return ctx;
};

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [inputRef, setInputRefState] =
    useState<RefObject<HTMLInputElement | null> | null>(null);

  const showCommandPalette = useCallback(
    () => setIsCommandPaletteOpen(true),
    [],
  );
  const hideCommandPalette = useCallback(
    () => setIsCommandPaletteOpen(false),
    [],
  );
  const setInputRef = useCallback(
    (ref: RefObject<HTMLInputElement | null> | null) => setInputRefState(ref),
    [],
  );

  return (
    <CommandPaletteContext.Provider
      value={{
        showCommandPalette,
        hideCommandPalette,
        isCommandPaletteOpen,
        setInputRef,
        inputRef,
      }}
    >
      {children}
    </CommandPaletteContext.Provider>
  );
}
