import { createContext, useContext, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { api, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { titleCase } from '../lib/format.js';
import { Icon, Loading, cx } from '../components/ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { ChargersPage, ChargerDetailPage, SitesPage } from './pages/Chargers.jsx';
import { SessionsPage, SessionDetailPage, CustomersPage, ComplaintsPage } from './pages/Sessions.jsx';
import { TariffsPage, FinancePage, PromosPage } from './pages/Money.jsx';
import { StaffPage, AlertsPage, ApprovalsPage, AuditPage, CompanyPage, ReportsPage, RoamingPage } from './pages/Org.jsx';
import SimulatorPage from './pages/Simulator.jsx';
import AccessPage from './pages/Access.jsx';
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
  const ctxLabel = value.isPlatform ? 'Platform' : me.contexts.find((c) => c.tenant === me.ctx.tenant)?.tenantName;
  return (
    <Ctx.Provider value={value}>
      <div className="flex min-h-dvh">
        <aside className={cx('fixed inset-y-0 left-0 z-[900] w-64 shrink-0 overflow-y-auto border-r border-ink-200 bg-white p-3 transition-transform dark:border-ink-800 dark:bg-ink-900 lg:static lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
          <div className="mb-4 flex items-center gap-2 px-2 pt-1">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"><Icon name="bolt" className="h-5 w-5" /></span>
            <div className="min-w-0"><div className="truncate text-sm font-bold">{ctxLabel}</div><div className="truncate text-xs muted">{me.contexts.find((c) => c.role === me.ctx.role && c.tenant === me.ctx.tenant)?.roleName || titleCase(me.ctx.role)}</div></div>
          </div>
          <nav className="space-y-0.5">
            {items.map((n) => (n.group ? <div key={n.group} className="px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider muted">{n.group}</div> : (
              <NavLink key={n.to} to={`/console/${n.to}`} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => cx('flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm', isActive ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'text-ink-700 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800')}>
                <Icon name={n.icon} className="h-4 w-4" />{n.label}
              </NavLink>
            )))}
          </nav>
        </aside>
        {open && <div className="fixed inset-0 z-[800] bg-ink-950/40 lg:hidden" onClick={() => setOpen(false)} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-[700] flex items-center gap-3 border-b border-ink-200 bg-white/90 px-4 py-2.5 backdrop-blur dark:border-ink-800 dark:bg-ink-950/90">
            <button type="button" className="btn-ghost btn-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Icon name="list" /></button>
            <div className="flex-1" />
            <Workspace me={me} />
            <span className="hidden text-sm muted sm:inline">{me.user.name || me.user.email}</span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => { tokens.setStaff(null); location.href = '/console/login'; }}><Icon name="out" className="h-4 w-4" /> Sign out</button>
          </header>
          <main className="min-w-0 flex-1 p-4 lg:p-6">
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
      <div><h1 className="text-xl font-bold">{title}</h1>{sub && <p className="text-sm muted">{sub}</p>}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
