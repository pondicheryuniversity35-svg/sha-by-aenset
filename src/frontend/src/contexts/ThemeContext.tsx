import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface ThemeContextType {
  isDark: boolean;
  setIsDark: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  setIsDark: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDarkState] = useState(
    () => localStorage.getItem("sha_dark_mode") !== "false",
  );

  // useCallback gives setIsDark a stable reference so it never re-triggers
  // the profile-load useEffect in App.tsx (which lists setIsDark as a dep).
  const setIsDark = useCallback((v: boolean) => {
    localStorage.setItem("sha_dark_mode", String(v));
    setIsDarkState(v);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, setIsDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
