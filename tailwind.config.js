/** @type {import('tailwindcss').Config} */
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{js,jsx}'] },
  // Manual light/dark toggle (falls back to the system setting) — see src/lib/theme.js
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((k) => [k, `rgb(var(--brand-${k}) / <alpha-value>)`])),
        ink: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617' },
        // Semantic accents used across both apps
        volt: { 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2' }, // electric cyan (charging / live)
        fast: { 50: '#fff7ed', 100: '#ffedd5', 500: '#f97316', 600: '#ea580c', 700: '#c2410c' }, // DC fast
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans Devanagari', 'sans-serif'] },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,.05), 0 2px 8px rgba(15,23,42,.06)',
        lift: '0 10px 30px -10px rgba(15,23,42,.25)',
        glow: '0 0 0 4px rgb(var(--brand-500) / .15), 0 8px 24px -6px rgb(var(--brand-600) / .45)',
      },
      backgroundImage: {
        electric: 'linear-gradient(135deg, rgb(var(--brand-600)) 0%, rgb(var(--brand-500)) 45%, #06b6d4 100%)',
        'electric-soft': 'linear-gradient(135deg, rgb(var(--brand-50)) 0%, #ecfeff 100%)',
        night: 'linear-gradient(160deg, #0f172a 0%, #020617 60%, rgb(var(--brand-950)) 100%)',
      },
      keyframes: {
        pulseRing: { '0%': { transform: 'scale(.9)', opacity: '.7' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        flow: { '0%': { backgroundPosition: '0% 50%' }, '100%': { backgroundPosition: '200% 50%' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '60%': { transform: 'scale(1.08)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        rise: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        'pulse-ring': 'pulseRing 1.8s cubic-bezier(.2,.6,.4,1) infinite',
        shimmer: 'shimmer 1.4s linear infinite',
        flow: 'flow 2.5s linear infinite',
        pop: 'pop .45s ease-out both',
        rise: 'rise .35s ease-out both',
      },
    },
  },
  plugins: [],
};
