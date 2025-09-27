"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (value: Theme) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "theme-preference";

const ThemeContext = createContext<ThemeContextValue | null>(null);

const getPreferredTheme = (): Theme => {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch (_error) {
    // Ignore storage access errors and fall back to media query.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const COLOR_TRANSITION_DURATION_MS = 300;
const TRANSITION_CLASS = "theme-transitioning";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getPreferredTheme());
  const transitionTimeoutRef = useRef<number | undefined>(undefined);

  const startThemeTransition = useCallback(
    (next: Theme) => {
      if (next === theme) {
        return;
      }

      if (typeof window === "undefined" || typeof document === "undefined") {
        setThemeState(next);
        return;
      }

      const root = document.documentElement;

      if (transitionTimeoutRef.current !== undefined) {
        window.clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = undefined;
      }

      root.classList.add(TRANSITION_CLASS);
      // Force the browser to register the new class before theme variables change.
      void root.offsetWidth;

      transitionTimeoutRef.current = window.setTimeout(() => {
        root.classList.remove(TRANSITION_CLASS);
        transitionTimeoutRef.current = undefined;
      }, COLOR_TRANSITION_DURATION_MS);

      setThemeState(next);
    },
    [theme],
  );

  useEffect(() => {
    return () => {
      if (typeof window === "undefined" || typeof document === "undefined") {
        return;
      }

      if (transitionTimeoutRef.current !== undefined) {
        window.clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = undefined;
      }

      document.documentElement.classList.remove(TRANSITION_CLASS);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    document.documentElement.dataset.theme = theme;

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (_error) {
      // Ignore storage write failures.
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") {
          return;
        }
      } catch (_error) {
        // Ignore storage access errors.
      }

      startThemeTransition(media.matches ? "dark" : "light");
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [startThemeTransition]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: Theme) => startThemeTransition(next),
      toggleTheme: () =>
        startThemeTransition(theme === "light" ? "dark" : "light"),
    }),
    [theme, startThemeTransition],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
};
