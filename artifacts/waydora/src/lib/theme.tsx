import { createContext, useContext, useEffect, type ReactNode } from "react";

type Theme = "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

// Waydora è solo dark-mode. ThemeContext rimane per compatibilità API,
// ma toggle è no-op e theme è sempre "dark".
const ThemeContext = createContext<ThemeContextValue>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    try { localStorage.setItem("waydora-theme", "dark"); } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "dark", toggle: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
