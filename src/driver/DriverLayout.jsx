import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import { tx, useI18n } from '../lib/i18n.jsx';
import { useApi, useOnline } from '../lib/hooks.js';
import { tokens } from '../lib/api.js';
import { Icon, Loading, cx } from '../components/ui.jsx';
import { useBrand } from '../lib/brand.jsx';
import { useTheme } from '../lib/theme.js';

export function useDriver() {
  const has = !!tokens.driver();
  const { data, reload } = useApi(has ? '/api/me' : null, { auth: 'driver' });
  return { user: data?.user, loggedIn: has && !!data?.user, reload };
}

export function ThemeToggle({ className }) {
  const { isDark, toggle } = useTheme();
  return (
    <button type="button" className={cx('btn-ghost btn-sm', className)} onClick={toggle} aria-label={isDark ? 'Light mode' : 'Dark mode'}>
      <Icon name={isDark ? 'sun' : 'moon'} className="h-4 w-4" />
    </button>
  );
}

export default function DriverLayout() {
  const { t, lang, setLang } = useI18n();
  const { brand } = useBrand();
  const online = useOnline();
  const { data: cfg } = useApi('/api/public/config', { auth: 'none' });
  const loc = useLocation();
  const bare = loc.pathname.startsWith('/c/') || loc.pathname.startsWith('/s/');
  const nav = [
    { to: '/', icon: 'map', label: t('find'), end: true },
    { to: '/route', icon: 'route', label: t('trip') },
    { to: '/history', icon: 'clock', label: t('history') },
    { to: '/account', icon: 'user', label: t('account') },
  ];
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="sticky top-0 z-[500] flex items-center justify-between border-b border-ink-200/70 bg-white/85 px-4 py-2.5 backdrop-blur-lg dark:border-ink-800 dark:bg-ink-950/85">
        <NavLink to="/" className="flex items-center gap-2.5 font-extrabold tracking-tight">
          {brand.logoUrl ? <img src={brand.logoUrl} alt="" className="h-9 w-9 rounded-xl object-contain" /> : (
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-electric text-white shadow-glow"><Icon name="bolt" className="h-5 w-5" strokeWidth={2.5} /></span>
          )}
          <span className="leading-tight">{brand.name || 'ChargeX'}{brand.name && brand.name !== 'ChargeX' && <span className="block text-[10px] font-medium leading-none muted">{tx('powered by ChargeX')}</span>}</span>
        </NavLink>
        <div className="flex items-center gap-1">
          <button type="button" className="btn-ghost btn-sm font-bold" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} aria-label={tx('Change language')}>{lang === 'en' ? 'हिं' : 'EN'}</button>
          <ThemeToggle />
          {!bare && <NavLink to="/console" className="btn-ghost btn-sm hidden sm:inline-flex">{tx('Operator login')}</NavLink>}
        </div>
      </header>
      {!online && <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white"><Icon name="alert" className="h-4 w-4" />{t('offlineBanner')}</div>}
      {cfg?.maintenanceBanner && <div className="bg-sky-600 px-4 py-2 text-center text-sm text-white">{cfg.maintenanceBanner}</div>}
      {cfg?.paymentsPaused && <div className="bg-red-600 px-4 py-2 text-center text-sm font-medium text-white">{cfg.paymentsPausedReason || 'Payments are temporarily paused. Running sessions are not affected.'}</div>}
      <main className={cx('flex-1', !bare && 'pb-24')}>
        <Suspense fallback={<Loading />}><Outlet context={{ cfg }} /></Suspense>
      </main>
      {!bare && (
        <nav className="fixed inset-x-0 bottom-0 z-[500] px-3 pb-[max(env(safe-area-inset-bottom),10px)]">
          <div className="mx-auto grid max-w-md grid-cols-4 rounded-2xl border border-ink-200/80 bg-white/90 p-1.5 shadow-lift backdrop-blur-lg dark:border-ink-800 dark:bg-ink-900/90">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition', isActive ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30' : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100')}>
                <Icon name={n.icon} className="h-5 w-5" />{n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
