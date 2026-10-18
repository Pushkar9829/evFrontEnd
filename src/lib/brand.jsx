// White-label theming: a tenant's colours, name and logo applied at runtime.
// Sources, in order: VITE_BRAND (a per-tenant build), ?brand=<slug> (remembered), or a QR page of a
// white-label operator (applied while that page is open).
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, store } from './api.js';

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const DEFAULT = { name: 'ChargeX', logoUrl: null, primaryColor: null, slug: null };

function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `${f(0)} ${f(8)} ${f(4)}`;
}

// Lightness per shade, anchored so the brand colour itself lands on 600 (buttons).
const LIGHT = { 50: 0.97, 100: 0.93, 200: 0.86, 300: 0.76, 400: 0.64, 500: 0.52, 700: 0.34, 800: 0.27, 900: 0.21, 950: 0.13 };

/** Set the --brand-* CSS variables from one hex colour (or reset to the default palette). */
export function applyPalette(hex) {
  const root = document.documentElement;
  const hsl = hexToHsl(hex);
  if (!hsl) {
    for (const k of SHADES) root.style.removeProperty(`--brand-${k}`);
    return;
  }
  const [h, s, l] = hsl;
  for (const k of SHADES) root.style.setProperty(`--brand-${k}`, hslToRgb(h, Math.min(1, s * (k <= 100 ? 0.9 : 1)), k === 600 ? Math.min(l, 0.5) : LIGHT[k]));
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', hex);
}

const Ctx = createContext({ brand: DEFAULT, setTemporary: () => {} });

export function BrandProvider({ children }) {
  const [base, setBase] = useState(DEFAULT);
  const [temp, setTemp] = useState(null);
  useEffect(() => {
    const url = new URLSearchParams(location.search).get('brand');
    if (url) store.set('cx.brand', url === 'none' ? null : url);
    const slug = import.meta.env.VITE_BRAND || store.get('cx.brand');
    if (!slug) return;
    api(`/api/public/branding/${encodeURIComponent(slug)}`, { auth: 'none' })
      .then((b) => setBase({ ...b, slug }))
      .catch(() => store.set('cx.brand', null));
  }, []);
  const brand = temp || base;
  useEffect(() => {
    applyPalette(brand.primaryColor);
    document.title = brand.name || 'ChargeX';
  }, [brand.primaryColor, brand.name]);
  const value = useMemo(() => ({ brand, base, setTemporary: setTemp }), [brand, base]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useBrand = () => useContext(Ctx);

/** Apply an operator's branding while a component is mounted (QR pages, console). */
export function useTemporaryBrand(b) {
  const { setTemporary, base } = useBrand();
  const key = b?.primaryColor || '';
  useEffect(() => {
    if (!b?.primaryColor || base.slug) return undefined; // a white-label build/link wins
    setTemporary(b);
    return () => setTemporary(null);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
