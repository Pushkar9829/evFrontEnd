import { createContext, useContext, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { titleCase } from '../lib/format.js';
import { Icon, Loading, cx } from '../components/ui.jsx';
import { useTemporaryBrand } from '../lib/brand.jsx';
import { ThemeToggle } from '../driver/DriverLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { ChargersPage, ChargerDetailPage, SitesPage } from './pages/Chargers.jsx';
import { SessionsPage, SessionDetailPage, CustomersPage, ComplaintsPage } from './pages/Sessions.jsx';
import { TariffsPage, FinancePage, PromosPage } from './pages/Money.jsx';
import { StaffPage, AlertsPage, ApprovalsPage, AuditPage, CompanyPage, ReportsPage, RoamingPage } from './pages/Org.jsx';
import SimulatorPage from './pages/Simulator.jsx';
import AccessPage from './pages/Access.jsx';
import QrStickersPage from './pages/QrStickers.jsx';
import { TenantsPage, HealthPage, PlatformMoneyPage, SwitchesPage, ModelsPage, PartnersPage, ContentPage, SecurityPage, DataRequestsPage } from './pages/Platform.jsx';

const Ctx = createContext(null);
export const useConsole = () => useContext(Ctx);

const NAV = [
  { group: 'Operate' },
  { to: '', label: 'Dashboard', icon: 'home', end: true },
  { to: 'chargers', label: 'Chargers', icon: 'plug', perm: 'charger.view' },
  { to: 'sites', label: 'Sites', icon: 'pin', perm: 'site.view' },
  { to: 'sessions', label: 'Sessions', icon: 'bolt', perm: 'session.view' },
  { to: 'customers', label: 'Customers', icon: 'users', perm: 'customer.view' },
  { to: 'complaints', label: 'Complaints', icon: 'alert', perm: 'complaint.view' },
  { to: 'alerts', label: 'Alerts', icon: 'bell', perm: 'alert.view' },
  { to: 'simulator', label: 'Simulator', icon: 'cpu', perm: 'simulator.use' },
  { group: 'Money' },
  { to: 'tariffs', label: 'Tariffs', icon: 'tag', perm: 'tariff.view' },
  { to: 'finance', label: 'Finance', icon: 'money', perm: 'finance.view' },
  { to: 'promos', label: 'Promo codes', icon: 'tag', perm: 'tariff.manage' },
  { to: 'reports', label: 'Reports', icon: 'chart', perm: 'report.view' },
  { group: 'Company' },
  { to: 'approvals', label: 'Approvals', icon: 'check', perm: 'approval.decide' },
  { to: 'roaming', label: 'Roaming', icon: 'globe', perm: 'roaming.view' },
  { to: 'staff', label: 'Staff & roles', icon: 'users', perm: 'staff.manage', tenantOnly: true },
  { to: 'company', label: 'Company & branding', icon: 'cog', perm: 'branding.manage', tenantOnly: true },
  { to: 'access', label: 'Roles & API keys', icon: 'shield', perm: 'staff.manage', tenantOnly: true },
  { to: 'audit', label: 'Audit log', icon: 'shield', perm: 'audit.view' },
  { group: 'Platform', platform: true },
  { to: 'p/tenants', label: 'Tenants', icon: 'layers', perm: 'tenant.view_all', platform: true },
  { to: 'p/health', label: 'Health & search', icon: 'chart', perm: 'tenant.view_all', platform: true },
  { to: 'p/money', label: 'Payouts & commission', icon: 'money', perm: 'finance.view', platform: true },
  { to: 'p/switches', label: 'Platform switches', icon: 'cog', perm: 'platform.switches', platform: true },
  { to: 'p/models', label: 'Charger models', icon: 'cpu', perm: 'tenant.view_all', platform: true },
  { to: 'p/partners', label: 'Roaming partners', icon: 'globe', perm: 'roaming.view', platform: true },
  { to: 'p/content', label: 'Content & templates', icon: 'doc', perm: 'content.manage', platform: true },
  { to: 'p/security', label: 'Security events', icon: 'shield', perm: 'audit.view', platform: true },
  { to: 'p/privacy', label: 'Data requests', icon: 'doc', perm: 'tenant.view_all', platform: true },
];

function Workspace({ me }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  if ((me.contexts || []).length < 2) return null;
  const cur = `${me.ctx.tenant || 'platform'}|${me.ctx.role}`;
  return (
    <select className="input min-h-[36px] py-1 text-xs" disabled={busy} value={cur} aria-label="Switch workspace" onChange={async (e) => {
      const [tenant, role] = e.target.value.split('|');
      setBusy(true);
      try {
        const r = await api('/api/auth/staff/switch', { method: 'POST', auth: 'staff', body: { tenant: tenant === 'platform' ? null : tenant, role } });
        tokens.setStaff(r.token);
        nav('/console');
        location.reload();
      } catch (err) {
        alert(err.message);
        setBusy(false);
      }
    }}>
      {me.contexts.map((c) => <option key={`${c.tenant}|${c.role}`} value={`${c.tenant || 'platform'}|${c.role}`}>{c.tenantName || 'Platform'} · {titleCase(c.role)}</option>)}
    </select>
  );
}

export default function Console() {
  const has = !!tokens.staff();
  const { data: me, error, loading } = useApi(has ? '/api/auth/me' : null, { auth: 'staff' });
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useTemporaryBrand(me?.branding);
  const value = useMemo(() => me && ({
    me,
    can: (...p) => p.some((x) => me.permissions.includes(x)),
    isPlatform: ['super_admin', 'platform_support', 'platform_finance'].includes(me.ctx.role),
    tenantId: me.ctx.tenant,
  }), [me]);
  if (!has) return <Navigate to={`/console/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (loading) return <Loading />;
  if (error || me?.kind !== 'staff') return <Navigate to="/console/login" replace />;
  const items = NAV.filter((n) => {
    if (n.platform && !value.isPlatform) return false;
    if (n.tenantOnly && value.isPlatform) return false;
    return !n.perm || value.can(n.perm);
  }).filter((n, i, arr) => !n.group || (arr[i + 1] && !arr[i + 1].group));
  const sub = loc.pathname.replace(/^\/console\/?/, '');
  const current = NAV.filter((n) => !n.group && n.to && sub.startsWith(n.to)).sort((a, b) => b.to.length - a.to.length)[0] || NAV[1];
  const ctxLabel = value.isPlatform ? 'Platform' : me.contexts.find((c) => c.tenant === me.ctx.tenant)?.tenantName;
  return (
    <Ctx.Provider value={value}>
      <div className="flex min-h-dvh">
        <aside className={cx('print:hidden fixed inset-y-0 left-0 z-[900] flex w-64 shrink-0 flex-col overflow-y-auto bg-night p-3 text-ink-300 transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
          <div className="mb-4 flex items-center gap-2 px-2 pt-1">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-electric text-white shadow-glow"><Icon name="bolt" className="h-5 w-5" strokeWidth={2.5} /></span>
            <div className="min-w-0"><div className="truncate text-sm font-bold text-white">{ctxLabel}</div><div className="truncate text-xs text-ink-400">{me.contexts.find((c) => c.role === me.ctx.role && c.tenant === me.ctx.tenant)?.roleName || titleCase(me.ctx.role)}</div></div>
          </div>
          <nav className="space-y-0.5">
            {items.map((n) => (n.group ? <div key={n.group} className="px-2 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-ink-500">{n.group}</div> : (
              <NavLink key={n.to} to={`/console/${n.to}`} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => cx('relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition', isActive ? 'bg-white/10 font-semibold text-white before:absolute before:-left-3 before:top-1.5 before:h-6 before:w-1 before:rounded-r-full before:bg-brand-400' : 'text-ink-300 hover:bg-white/5 hover:text-white')}>
                {({ isActive }) => <><Icon name={n.icon} className={cx('h-4 w-4', isActive && 'text-brand-400')} />{n.label}</>}
              </NavLink>
            )))}
          </nav>
          <div className="mt-auto px-2 pt-6 text-[10px] text-ink-500">ChargeX CMS · OCPP 1.6J / 2.0.1 / 2.1</div>
        </aside>
        {open && <div className="fixed inset-0 z-[800] bg-ink-950/40 lg:hidden" onClick={() => setOpen(false)} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="print:hidden sticky top-0 z-[700] flex items-center gap-3 border-b border-ink-200 bg-white/90 px-4 py-2.5 backdrop-blur dark:border-ink-800 dark:bg-ink-950/90">
            <button type="button" className="btn-ghost btn-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Icon name="list" /></button>
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm"><span className="hidden muted sm:inline">{ctxLabel}</span><Icon name="chev" className="hidden h-3.5 w-3.5 muted sm:inline" /><span className="truncate font-semibold">{current.label}</span></div>
            <Workspace me={me} />
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-bold uppercase text-brand-700 dark:bg-brand-950 dark:text-brand-300">{(me.user.name || me.user.email || '?')[0]}</span><span className="max-w-[160px] truncate text-sm font-medium">{me.user.name || me.user.email}</span></div>
            <button type="button" className="btn-ghost btn-sm" onClick={() => { tokens.setStaff(null); location.href = '/console/login'; }} aria-label="Sign out"><Icon name="out" className="h-4 w-4" /><span className="hidden md:inline">Sign out</span></button>
          </header>
          <main className="min-w-0 flex-1 p-4 lg:p-6 print:p-0">
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="chargers" element={<ChargersPage />} />
              <Route path="chargers/:id" element={<ChargerDetailPage />} />
              <Route path="sites" element={<SitesPage />} />
              <Route path="sessions" element={<SessionsPage />} />
              <Route path="sessions/:id" element={<SessionDetailPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="complaints" element={<ComplaintsPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="simulator" element={<SimulatorPage />} />
              <Route path="tariffs" element={<TariffsPage />} />
              <Route path="finance" element={<FinancePage />} />
              <Route path="promos" element={<PromosPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="roaming" element={<RoamingPage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="company" element={<CompanyPage />} />
              <Route path="access" element={<AccessPage />} />
              <Route path="qr" element={<QrStickersPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="p/tenants" element={<TenantsPage />} />
              <Route path="p/health" element={<HealthPage />} />
              <Route path="p/money" element={<PlatformMoneyPage />} />
              <Route path="p/switches" element={<SwitchesPage />} />
              <Route path="p/models" element={<ModelsPage />} />
              <Route path="p/partners" element={<PartnersPage />} />
              <Route path="p/content" element={<ContentPage />} />
              <Route path="p/security" element={<SecurityPage />} />
              <Route path="p/privacy" element={<DataRequestsPage />} />
              <Route path="*" element={<Navigate to="/console" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </Ctx.Provider>
  );
}

export function PageHeader({ title, sub, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>{sub && <p className="text-sm muted">{sub}</p>}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
