/**
 * VenueVue 2.3 - light / dark theme provider.
 *
 * The palette itself lives in src/index.css. This only decides which half of it
 * is active by adding or removing `.dark` on <html>, because that is the hook
 * the `:root.dark` token block is keyed on.
 *
 * Resolution order:
 *   1. A previously chosen theme (localStorage, key VENUEVUE_THEME).
 *   2. Otherwise the operating system preference.
 *
 * index.html applies the same choice with a tiny inline script before the first
 * paint, so a dark tablet never flashes cream on startup; this provider takes
 * over from there and keeps every tab of the app in step.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/** localStorage key holding the operator's explicit choice. */
export const THEME_STORAGE_KEY = 'VENUEVUE_THEME';

const LIGHT = 'light';
const DARK = 'dark';

/** Keeps the browser's own chrome in step with the palette. */
const BROWSER_CHROME = { light: '#4A3325', dark: '#2B1F14' };

const ThemeContext = createContext(null);

function prefersDark() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === LIGHT || stored === DARK) {
      return stored;
    }
  } catch {
    /* Storage unavailable - fall through to the system preference. */
  }

  return prefersDark() ? DARK : LIGHT;
}

/**
 * Wraps the application and provides the active theme to every descendant.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  // Single source of truth for the side effects: the class on <html> is what
  // every token override keys off, so it is applied here rather than in the
  // setter, which also covers a theme restored on reload.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(DARK, theme === DARK);
    root.dataset.theme = theme;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', BROWSER_CHROME[theme]);
    }

    try {
      // Only write on an actual change: index.html pins the resolved theme
      // before the first paint, so a mount normally has nothing to store.
      if (localStorage.getItem(THEME_STORAGE_KEY) !== theme) {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      }
    } catch {
      /* Non-fatal: the choice simply will not survive a reload. */
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next === DARK ? DARK : LIGHT);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === DARK ? LIGHT : DARK));
  }, []);

  const value = useMemo(
    () => ({ theme, isDark: theme === DARK, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Consume the theme context. Must be rendered inside <ThemeProvider>. */
export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme() must be used inside a <ThemeProvider>.');
  }

  return context;
}
