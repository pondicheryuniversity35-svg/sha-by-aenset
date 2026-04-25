import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "GBP", symbol: "£", label: "GBP (£)" },
  { code: "INR", symbol: "₹", label: "INR (₹)" },
  { code: "SGD", symbol: "S$", label: "SGD (S$)" },
  { code: "AED", symbol: "د.إ", label: "AED (د.إ)" },
  { code: "CAD", symbol: "C$", label: "CAD (C$)" },
  { code: "AUD", symbol: "A$", label: "AUD (A$)" },
  { code: "JPY", symbol: "¥", label: "JPY (¥)" },
];

// Actor interface for currency sync — minimal shape to avoid circular imports
interface CurrencySyncActor {
  updatePreferences(
    language: string,
    darkMode: boolean,
    geminiApiKey: string,
    currency: string,
  ): Promise<void>;
  getCallerUserProfile(): Promise<{
    preferences: {
      language: string;
      darkMode: boolean;
      geminiApiKey: string;
      currency: string;
    };
  } | null>;
}

interface CurrencyContextType {
  currencyCode: string;
  currencySymbol: string;
  setCurrency: (code: string, actor?: CurrencySyncActor | null) => void;
  /** Call once after auth to seed currency from ICP backend */
  syncFromBackend: (actor: CurrencySyncActor) => Promise<void>;
  formatAmount: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currencyCode: "USD",
  currencySymbol: "$",
  setCurrency: () => {},
  syncFromBackend: async () => {},
  formatAmount: (n) => `$${n.toFixed(2)}`,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState(() => {
    return (
      (typeof window !== "undefined"
        ? localStorage.getItem("sha_currency")
        : null) ?? "USD"
    );
  });
  // Track whether we've already synced from backend to avoid re-entrancy
  const syncedRef = useRef(false);

  // Listen for storage changes from other browser tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "sha_currency" && e.newValue) {
        setCurrencyCode(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  /**
   * Sets currency locally (localStorage + state) and optionally persists to
   * ICP backend when an actor is provided. The actor is optional so that
   * ProfileTab can call this without needing to thread additional context.
   */
  const setCurrency = useCallback(
    (code: string, actor?: CurrencySyncActor | null) => {
      setCurrencyCode(code);
      if (typeof window !== "undefined") {
        localStorage.setItem("sha_currency", code);
        // Dispatch a StorageEvent so same-tab consumers (like FinanceTab) re-render
        window.dispatchEvent(
          new StorageEvent("storage", { key: "sha_currency", newValue: code }),
        );
      }
      // Persist to ICP backend if actor is available, fire-and-forget
      if (actor) {
        actor
          .getCallerUserProfile()
          .then((profile) => {
            if (!profile) return;
            const prefs = profile.preferences;
            return actor.updatePreferences(
              prefs.language,
              prefs.darkMode,
              prefs.geminiApiKey,
              code,
            );
          })
          .catch(() => {
            // Silently fail — localStorage is still updated, ICP will sync on next save
          });
      }
    },
    [],
  );

  /**
   * Called once after the user authenticates to seed currency from ICP.
   * ICP backend is authoritative; localStorage is the offline/instant cache.
   */
  const syncFromBackend = useCallback(async (actor: CurrencySyncActor) => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    try {
      const profile = await actor.getCallerUserProfile();
      if (profile?.preferences?.currency) {
        const backendCurrency = profile.preferences.currency;
        setCurrencyCode(backendCurrency);
        if (typeof window !== "undefined") {
          localStorage.setItem("sha_currency", backendCurrency);
        }
      }
    } catch {
      // Silently fall back to localStorage value
    }
  }, []);

  const currency =
    CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];

  const formatAmount = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(amount || 0);
    } catch {
      return `${currency.symbol}${(amount || 0).toFixed(2)}`;
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        currencyCode,
        currencySymbol: currency.symbol,
        setCurrency,
        syncFromBackend,
        formatAmount,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
