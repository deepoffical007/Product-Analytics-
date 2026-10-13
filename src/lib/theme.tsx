import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'cems.theme';

const Ctx = createContext<{ pref: ThemePref; resolved: 'light' | 'dark'; setPref: (p: ThemePref) => void; toggle: () => void } | null>(null);

const systemDark = () => {
  if (typeof window === 'undefined') return false;
  const host = document.documentElement.dataset.theme;
  if (host === 'dark' || host === 'light') return host === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => {
    try {
      return (localStorage.getItem(KEY) as ThemePref) || 'system';
    } catch {
      return 'system';
    }
  });
  const [sys, setSys] = useState(systemDark());
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => setSys(systemDark());
    mq.addEventListener('change', fn);
    const obs = new MutationObserver(fn);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', fn);
      obs.disconnect();
    };
  }, []);
  const resolved = pref === 'system' ? (sys ? 'dark' : 'light') : pref;
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);
  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try {
      p === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, p);
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = useCallback(() => setPref(resolved === 'dark' ? 'light' : 'dark'), [resolved, setPref]);
  return <Ctx.Provider value={{ pref, resolved, setPref, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme outside ThemeProvider');
  return c;
}
