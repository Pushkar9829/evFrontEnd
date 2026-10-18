import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, useInterval } from '../../lib/hooks.js';
import { dt, duration, kwh, kw, rs } from '../../lib/format.js';
import { Card, ErrorBox, Loading, Stat, Status, Table } from '../../components/ui.jsx';
import { PageHeader, useConsole } from '../Console.jsx';

const MapView = lazy(() => import('../../components/MapView.jsx'));

function markerKind(statuses, online, charging) {
  if (!online) return 'down';
  if (statuses.includes('Faulted')) return 'fault';
  if (charging || statuses.every((s) => s === 'Occupied')) return 'busy';
  return 'available';
}

/** Platform live operations centre: every charger and every active session (Admin 3.2). */
function OpsCentre() {
  const nav = useNavigate();
  const [filter, setFilter] = useState({ tenant: '', model: '', city: '' });
  const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();
  const { data, error, reload } = useApi(`/api/admin/ops?${q}`);
  const health = useApi('/api/admin/health');
  const tenants = useApi('/api/admin/tenants');
  useInterval(() => { reload({ quiet: true }); health.reload({ quiet: true }); }, 10000);
  if (!data) return <Loading />;
  const ch = data.chargers;
  const cities = [...new Set(ch.map((c) => c.city).filter(Boolean))];
  const models = [...new Set(ch.map((c) => c.model).filter(Boolean))];
  const h = health.data;
  return (
    <>
      <PageHeader title="Live operations" sub="All tenants · refreshes every 10 s">
        <select className="input min-h-[36px] w-auto py-1 text-xs" value={filter.tenant} onChange={(e) => setFilter({ ...filter, tenant: e.target.value })}><option value="">All tenants</option>{tenants.data?.tenants?.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select>
        <select className="input min-h-[36px] w-auto py-1 text-xs" value={filter.city} onChange={(e) => setFilter({ ...filter, city: e.target.value })}><option value="">All cities</option>{cities.map((c) => <option key={c}>{c}</option>)}</select>
        <select className="input min-h-[36px] w-auto py-1 text-xs" value={filter.model} onChange={(e) => setFilter({ ...filter, model: e.target.value })}><option value="">All models</option>{models.map((c) => <option key={c}>{c}</option>)}</select>
      </PageHeader>
      <ErrorBox error={error} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Chargers" value={ch.length} sub={`${ch.filter((c) => c.online).length} online`} icon="plug" />
        <Stat label="Offline" value={ch.filter((c) => !c.online).length} icon="alert" tone="red" />
        <Stat label="Faulted" value={ch.filter((c) => c.statuses.includes('Faulted')).length} icon="alert" tone="red" />
        <Stat label="Active sessions" value={data.sessions.length} icon="bolt" />
        <Stat label="Connections" value={h?.gateway.connections ?? '—'} sub={`${h?.gateway.messagesPerSecond ?? 0} msg/s`} icon="cpu" />
        <Stat label="Payments 1h" value={h?.lastHour.paymentSuccessRatePct === null ? '—' : `${h?.lastHour.paymentSuccessRatePct}%`} sub={`${h?.lastHour.failedStarts ?? 0} failed starts · refund queue ${h?.queues.refunds ?? 0}`} icon="money" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Suspense fallback={<Loading />}>
            <MapView height={440} markers={ch.map((c) => ({ id: c.id, lat: c.location?.lat, lng: c.location?.lng, kind: markerKind(c.statuses, c.online, c.charging), label: c.statuses.length, popup: <Link to={`/console/chargers/${c.id}`} className="font-semibold">{c.ocppId} · {c.tenant}</Link> }))} />
          </Suspense>
        </div>
        <Card className="xl:col-span-2">
          <div className="border-b border-ink-100 px-4 py-3 font-semibold dark:border-ink-800">Live session board</div>
          <Table rows={data.sessions} empty="No active sessions" onRow={(r) => nav(`/console/sessions/${r.id}`)} columns={[
            { key: 'c', label: 'Charger', render: (r) => <div><div className="font-medium">{r.ocppId}#{r.connector}</div><div className="text-xs muted">{r.tenant}</div></div> },
            { key: 's', label: 'State', render: (r) => <Status value={r.state} /> },
            { key: 'e', label: 'Energy', render: (r) => kwh(r.energyWh) },
            { key: 'a', label: 'Amount', render: (r) => <span>{rs(r.liveCostPaise)} <span className="text-xs muted">/ {rs(r.amountPaise, { decimals: 0 })}</span></span> },
            { key: 't', label: 'Time', render: (r) => duration(r.startedAt) },
          ]} />
        </Card>
      </div>
    </>
  );
}

function SiteHostSummary() {
  const { data } = useApi('/api/cms/site-host/summary?days=30');
  if (!data) return null;
  return (
    <Card className="mb-4 p-4">
      <div className="mb-2 font-semibold">Your site{data.sites.length > 1 ? 's' : ''} · last 30 days</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.sites.map((s) => (
          <div key={s._id} className="rounded-xl bg-brand-50 p-3 dark:bg-brand-950">
            <div className="text-sm font-semibold">{s.name}</div>
            <div className="mt-1 text-2xl font-bold">{rs(s.sharePaise, { decimals: 0 })}</div>
            <div className="text-xs muted">your share ({(s.revenueShareBps || 0) / 100}%) of {rs(s.taxablePaise, { decimals: 0 })} · {s.sessions} sessions · {kwh(s.energyWh, 0)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TenantDashboard() {
  const nav = useNavigate();
  const { can } = useConsole();
  const { data, error, reload } = useApi('/api/cms/dashboard');
  const sessions = useApi(can('session.view') ? '/api/cms/sessions?active=true&limit=20' : null);
  const alerts = useApi(can('alert.view') ? '/api/cms/alerts' : null);
  useInterval(() => { reload({ quiet: true }); sessions.reload({ quiet: true }); }, 10000);
  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  return (
    <>
      <PageHeader title="Dashboard" sub="Live · refreshes every 10 s" />
      {can('site.revenue_share') && <SiteHostSummary />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <Stat label="Online" value={`${data.chargers.online}/${data.chargers.total}`} icon="plug" />
        <Stat label="Offline" value={data.chargers.offline} icon="alert" tone="red" />
        <Stat label="Faulted" value={data.chargers.faulted} icon="alert" tone="red" />
        <Stat label="Charging now" value={data.activeSessions} icon="bolt" />
        {can('finance.view') && <Stat label="Today revenue" value={rs(data.today.revenuePaise, { decimals: 0 })} sub={`${data.today.sessions} sessions`} icon="money" />}
        <Stat label="Today energy" value={kwh(data.today.energyWh, 1)} icon="bolt" />
        <Stat label="Open issues" value={data.openComplaints + data.openAlerts} sub={`${data.openComplaints} complaints · ${data.openAlerts} alerts · ${data.reviewQueue} to review`} icon="bell" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Suspense fallback={<Loading />}>
            <MapView height={400} markers={data.map.map((c) => ({ id: c.id, lat: c.location?.lat, lng: c.location?.lng, kind: markerKind(c.statuses, c.online, c.charging), label: c.statuses.length, popup: <Link to={`/console/chargers/${c.id}`} className="font-semibold">{c.ocppId} · {c.site}</Link> }))} />
          </Suspense>
        </div>
        <div className="space-y-4 xl:col-span-2">
          {sessions.data && (
            <Card>
              <div className="border-b border-ink-100 px-4 py-3 font-semibold dark:border-ink-800">Active sessions</div>
              <Table rows={sessions.data.sessions} empty="No active sessions" onRow={(r) => nav(`/console/sessions/${r.id}`)} columns={[
                { key: 'c', label: 'Charger', render: (r) => `${r.ocppId}#${r.connector}` },
                { key: 's', label: 'State', render: (r) => <Status value={r.state} /> },
                { key: 'e', label: 'Energy', render: (r) => kwh(r.energyWh) },
                { key: 'p', label: 'Power', render: (r) => kw(r.powerW) },
              ]} />
            </Card>
          )}
          {alerts.data && (
            <Card>
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800"><span className="font-semibold">Alerts</span><Link to="/console/alerts" className="text-xs font-semibold text-brand-700">All →</Link></div>
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {alerts.data.alerts.slice(0, 6).map((a) => <div key={a._id} className="flex items-start justify-between gap-2 px-4 py-2 text-sm"><span>{a.message}<span className="block text-xs muted">{dt(a.lastAt)}{a.count > 1 ? ` · ×${a.count}` : ''}</span></span><Status value={a.severity} /></div>)}
                {!alerts.data.alerts.length && <div className="px-4 py-6 text-center text-sm muted">All clear</div>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { isPlatform } = useConsole();
  return isPlatform ? <OpsCentre /> : <TenantDashboard />;
}
