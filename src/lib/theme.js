// Light / dark / system theme. The initial class is set by an inline script in index.html (no flash).
import { useEffect, useState } from 'react';
import { store } from './api.js';

const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function applyTheme(pref) {
  const dark = pref === 'dark' || (pref !== 'light' && media()?.matches);
  document.documentElement.classList.toggle('dark', !!dark);
}

export function useTheme() {
  const [pref, setPref] = useState(() => store.get('cx.theme') || 'system');
  useEffect(() => {
    applyTheme(pref);
    if (pref !== 'system') return undefined;
    const m = media();
    const on = () => applyTheme('system');
    m?.addEventListener?.('change', on);
    return () => m?.removeEventListener?.('change', on);
  }, [pref]);
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return {
    pref,
    isDark,
    toggle: () => {
      const next = isDark ? 'light' : 'dark';
      store.set('cx.theme', next);
      setPref(next);
    },
  };
}
