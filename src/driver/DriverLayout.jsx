import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import { useI18n } from '../lib/i18n.jsx';
import { useApi, useOnline } from '../lib/hooks.js';
import { tokens } from '../lib/api.js';
import { Icon, Loading, cx } from '../components/ui.jsx';

export function useDriver() {
  const has = !!tokens.driver();
  const { data, reload } = useApi(has ? '/api/me' : null, { auth: 'driver' });
  return { user: data?.user, loggedIn: has && !!data?.user, reload };
}

export default function DriverLayout() {
  const { t, lang, setLang } = useI18n();
  const online = useOnline();
  const { data: cfg } = useApi('/api/public/config', { auth: 'none' });
  const loc = useLocation();
  const bare = loc.pathname.startsWith('/c/') || loc.pathname.startsWith('/s/');
  const nav = [
    { to: '/', icon: 'map', label: t('find'), end: true },
    { to: '/history', icon: 'clock', label: t('history') },
    { to: '/account', icon: 'user', label: t('account') },
  ];
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="sticky top-0 z-[500] flex items-center justify-between border-b border-ink-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-ink-800 dark:bg-ink-950/90">
        <NavLink to="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"><Icon name="bolt" className="h-5 w-5" /></span>
          ChargeX
        </NavLink>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} aria-label="Change language">{lang === 'en' ? 'हिंदी' : 'English'}</button>
          {!bare && <NavLink to="/console" className="btn-ghost btn-sm hidden sm:inline-flex">Operator login</NavLink>}
        </div>
      </header>
      {!online && <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">{t('offlineBanner')}</div>}
      {cfg?.maintenanceBanner && <div className="bg-sky-600 px-4 py-2 text-center text-sm text-white">{cfg.maintenanceBanner}</div>}
      {cfg?.paymentsPaused && <div className="bg-red-600 px-4 py-2 text-center text-sm text-white">{cfg.paymentsPausedReason || 'Payments are temporarily paused. Running sessions are not affected.'}</div>}
      <main className={cx('flex-1', !bare && 'pb-20')}>
        <Suspense fallback={<Loading />}><Outlet context={{ cfg }} /></Suspense>
      </main>
      {!bare && (
        <nav className="fixed inset-x-0 bottom-0 z-[500] border-t border-ink-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-ink-800 dark:bg-ink-950/95">
          <div className="mx-auto grid max-w-3xl grid-cols-3">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-xs font-medium', isActive ? 'text-brand-600' : 'muted')}>
                <Icon name={n.icon} className="h-5 w-5" />{n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
