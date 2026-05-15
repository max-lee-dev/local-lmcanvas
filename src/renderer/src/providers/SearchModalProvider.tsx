import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

type SearchModalContextType = {
  showSearchModal: () => void;
  hideSearchModal: () => void;
  isSearchModalOpen: boolean;
  setInputRef: (ref: RefObject<HTMLInputElement | null> | null) => void;
  inputRef: RefObject<HTMLInputElement | null> | null;
};

const SearchModalContext = createContext<SearchModalContextType | undefined>(
  undefined,
);

export const useSearchModal = (): SearchModalContextType => {
  const ctx = useContext(SearchModalContext);
  if (!ctx) {
    throw new Error("useSearchModal must be used within SearchModalProvider");
  }
  return ctx;
};

export function SearchModalProvider({ children }: { children: ReactNode }) {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [inputRef, setInputRefState] =
    useState<RefObject<HTMLInputElement | null> | null>(null);

  const showSearchModal = useCallback(() => setIsSearchModalOpen(true), []);
  const hideSearchModal = useCallback(() => setIsSearchModalOpen(false), []);
  const setInputRef = useCallback(
    (ref: RefObject<HTMLInputElement | null> | null) => setInputRefState(ref),
    [],
  );

  return (
    <SearchModalContext.Provider
      value={{
        showSearchModal,
        hideSearchModal,
        isSearchModalOpen,
        setInputRef,
        inputRef,
      }}
    >
      {children}
    </SearchModalContext.Provider>
  );
}
