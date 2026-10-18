import { useEffect, useState } from 'react';
import { api, download } from '../../lib/api.js';
import { useApi } from '../../lib/hooks.js';
import { dt, rs, titleCase } from '../../lib/format.js';
import { ActionButton, Badge, Card, ErrorBox, Field, Loading, Modal, Status, Table, Tabs, useToast } from '../../components/ui.jsx';
import { PageHeader, useConsole } from '../Console.jsx';

export function StaffPage() {
  const { data, error, reload } = useApi('/api/cms/staff');
  const sites = useApi('/api/cms/sites');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ role: 'technician', siteIds: [] });
  const [err, setErr] = useState(null);
  return (
    <>
      <PageHeader title="Staff & roles" sub="Fixed roles at launch. Money roles always use two-factor login."><button type="button" className="btn-primary" onClick={() => setOpen(true)}>Invite staff</button></PageHeader>
      <ErrorBox error={error} />
      <Card>{!data ? <Loading /> : <Table rows={data.staff} columns={[
        { key: 'n', label: 'Name', render: (u) => <div><div className="font-medium">{u.name}</div><div className="text-xs muted">{u.email}</div></div> },
        { key: 'r', label: 'Role', render: (u) => (
          <select className="input min-h-[34px] w-auto py-1 text-xs" value={u.membership?.role} onChange={async (e) => { try { await api(`/api/cms/staff/${u._id}`, { method: 'PATCH', body: { role: e.target.value } }); reload({ quiet: true }); } catch (x) { alert(x.message); } }}>
            {data.roles.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
          </select>
        ) },
        { key: '2', label: '2FA', render: (u) => (u.twoFactorEnabled ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>) },
        { key: 'l', label: 'Last login', render: (u) => dt(u.lastLoginAt) },
        { key: 'x', label: '', render: (u) => <ActionButton className="btn-ghost btn-sm" confirm={`Remove ${u.name}?`} onClick={async () => { await api(`/api/cms/staff/${u._id}`, { method: 'DELETE' }); reload({ quiet: true }); }}>Remove</ActionButton> },
      ]} />}</Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Invite staff" footer={<ActionButton onClick={async () => { try { await api('/api/cms/staff', { method: 'POST', body: f }); setOpen(false); reload(); } catch (e) { setErr(e); } }}>Invite</ActionButton>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className="input" onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email"><input className="input" type="email" onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Mobile (for 2FA)"><input className="input" onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Temporary password"><input className="input" type="password" onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Role"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{data?.roles.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select></Field>
          {f.role === 'site_host' && <Field label="Site"><select className="input" onChange={(e) => setF({ ...f, siteIds: [e.target.value] })}><option>Choose</option>{sites.data?.sites?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>}
        </div>
        <ErrorBox error={err} />
      </Modal>
    </>
  );
}

export function AlertsPage() {
  const [status, setStatus] = useState('open,acknowledged');
  const { data, error, reload } = useApi(`/api/cms/alerts?status=${status}`);
  const act = async (a, s) => { await api(`/api/cms/alerts/${a._id}`, { method: 'POST', body: { status: s } }); reload({ quiet: true }); };
  return (
    <>
      <PageHeader title="Alerts" sub="Offline, faults, failed sessions, payment and refund failures, reconciliation">
        <select className="input min-h-[36px] w-auto py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="open,acknowledged">Open</option><option value="resolved">Resolved</option></select>
      </PageHeader>
      <ErrorBox error={error} />
      <Card>{!data ? <Loading /> : <Table rows={data.alerts} empty="All clear" columns={[
        { key: 's', label: 'Severity', render: (a) => <Status value={a.severity} /> },
        { key: 't', label: 'Type', render: (a) => titleCase(a.type) },
        { key: 'm', label: 'Message', render: (a) => <span className="whitespace-normal">{a.message}{a.count > 1 && <Badge className="ml-1">×{a.count}</Badge>}</span> },
        { key: 'w', label: 'Last', render: (a) => dt(a.lastAt) },
        { key: 'st', label: 'Status', render: (a) => <Status value={a.status} /> },
        { key: 'x', label: '', render: (a) => a.status !== 'resolved' && <div className="flex gap-1">{a.status === 'open' && <ActionButton className="btn-ghost btn-sm" onClick={() => act(a, 'acknowledged')}>Ack</ActionButton>}<ActionButton className="btn-ghost btn-sm" onClick={() => act(a, 'resolved')}>Resolve</ActionButton></div> },
      ]} />}</Card>
    </>
  );
}

export function ApprovalsPage() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const { data, error, reload } = useApi(`/api/cms/approvals?status=${status}`);
  const decide = async (a, approve) => {
    const note = approve ? '' : window.prompt('Reason for rejecting?') || '';
    const r = await api(`/api/cms/approvals/${a._id}/decide`, { method: 'POST', body: { approve, note } });
    toast(`Request ${r.approval.status}`);
    reload({ quiet: true });
  };
  return (
    <>
      <PageHeader title="Approvals" sub="Maker-checker: refunds above limits, payout holds, adjustments, bulk firmware, commission, critical config">
        <select className="input min-h-[36px] w-auto py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="pending">Pending</option><option value="executed,rejected,failed,approved">Decided</option></select>
      </PageHeader>
      <ErrorBox error={error} />
      <Card>{!data ? <Loading /> : <Table rows={data.approvals} empty="Nothing waiting for approval" columns={[
        { key: 't', label: 'Type', render: (a) => <Badge tone="violet">{titleCase(a.type)}</Badge> },
        { key: 's', label: 'Request', render: (a) => <div className="whitespace-normal"><div className="font-medium">{a.summary}</div><div className="text-xs muted">Reason: {a.reason}{a.tenant?.name ? ` · ${a.tenant.name}` : ''}</div></div> },
        { key: 'a', label: 'Amount', render: (a) => (a.amountPaise ? rs(a.amountPaise) : '—') },
        { key: 'b', label: 'Requested by', render: (a) => `${a.requestedBy?.name || ''} · ${dt(a.createdAt)}` },
        { key: 'st', label: 'Status', render: (a) => <div><Status value={a.status} />{a.decidedBy && <div className="text-xs muted">{a.decidedBy.name}</div>}</div> },
        { key: 'x', label: '', render: (a) => a.status === 'pending' && (a.canDecide ? <div className="flex gap-1"><ActionButton className="btn-primary btn-sm" onClick={() => decide(a, true)}>Approve</ActionButton><ActionButton className="btn-secondary btn-sm" onClick={() => decide(a, false)}>Reject</ActionButton></div> : <span className="text-xs muted">Needs another person</span>) },
      ]} />}</Card>
    </>
  );
}

export function AuditPage() {
  const [action, setAction] = useState('');
  const { data, error } = useApi(`/api/cms/audit?action=${encodeURIComponent(action)}`);
  const [sel, setSel] = useState(null);
  return (
    <>
      <PageHeader title="Audit log" sub="Every admin action: who, what, before/after, reason, IP, time. Permanent.">
        <input className="input min-h-[36px] w-48 py-1 text-sm" placeholder="Filter action e.g. refund" value={action} onChange={(e) => setAction(e.target.value)} />
        <ActionButton className="btn-secondary" onClick={() => download(`/api/cms/audit?format=csv&limit=2000&action=${encodeURIComponent(action)}`, 'audit-log.csv')}>Export CSV</ActionButton>
      </PageHeader>
      <ErrorBox error={error} />
      <Card>{!data ? <Loading /> : <Table rows={data.logs} onRow={setSel} columns={[
        { key: 'w', label: 'When', render: (l) => dt(l.at) },
        { key: 'a', label: 'Who', render: (l) => <div><div>{l.actorName || 'system'}</div><div className="text-xs muted">{titleCase(l.actorRole)}</div></div> },
        { key: 'x', label: 'Action', render: (l) => <span className="font-mono text-xs">{l.action}</span> },
        { key: 'e', label: 'Entity', render: (l) => <span className="text-xs">{l.entity} {l.entityId?.slice(-8)}</span> },
        { key: 'r', label: 'Reason', render: (l) => <span className="text-xs">{l.reason}</span> },
        { key: 'ip', label: 'IP', render: (l) => <span className="font-mono text-xs">{l.ip}</span> },
      ]} />}</Card>
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.action} wide>
        {sel && <div className="grid gap-3 text-xs sm:grid-cols-2"><div><div className="mb-1 font-semibold">Before</div><pre className="max-h-80 overflow-auto rounded-xl bg-ink-50 p-3 dark:bg-ink-800">{JSON.stringify(sel.before, null, 2)}</pre></div><div><div className="mb-1 font-semibold">After</div><pre className="max-h-80 overflow-auto rounded-xl bg-ink-50 p-3 dark:bg-ink-800">{JSON.stringify(sel.after, null, 2)}</pre></div></div>}
      </Modal>
    </>
  );
}

export function CompanyPage() {
  const { can } = useConsole();
  const toast = useToast();
  const { data, reload } = useApi('/api/cms/company');
  const [f, setF] = useState(null);
  const [bank, setBank] = useState({ accountName: '', accountNumber: '', ifsc: '' });
  useEffect(() => {
    if (data?.tenant) setF({ branding: data.tenant.branding || {}, complaintSlaHours: data.tenant.complaintSlaHours, pricesIncludeGst: data.tenant.pricesIncludeGst, gstin: data.tenant.gstin || '', legalName: data.tenant.legalName || '', address: data.tenant.address || '', emails: (data.tenant.alertContacts?.emails || []).join(', ') });
  }, [data]);
  if (!f) return <Loading />;
  const save = async () => {
    await api('/api/cms/company', { method: 'PATCH', body: { branding: Object.fromEntries(Object.entries(f.branding).filter(([k, v]) => ['appName', 'logoUrl', 'primaryColor', 'accentColor'].includes(k) && v)), complaintSlaHours: Number(f.complaintSlaHours), pricesIncludeGst: f.pricesIncludeGst, gstin: f.gstin, legalName: f.legalName, address: f.address, alertContacts: { emails: f.emails.split(',').map((s) => s.trim()).filter(Boolean) } } });
    toast('Saved');
    reload({ quiet: true });
  };
  return (
    <>
      <PageHeader title="Company & branding" sub={data.tenant.name}><ActionButton onClick={save}>Save</ActionButton></PageHeader>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <div className="font-semibold">Invoice details</div>
          <Field label="Legal name"><input className="input" value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} /></Field>
          <Field label="GSTIN"><input className="input uppercase" value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} /></Field>
          <Field label="Address"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!f.pricesIncludeGst} onChange={(e) => setF({ ...f, pricesIncludeGst: e.target.checked })} /> My tariff prices already include GST</label>
        </Card>
        <Card className="space-y-3 p-4">
          <div className="font-semibold">White-label branding</div>
          <Field label="App name"><input className="input" value={f.branding.appName || ''} onChange={(e) => setF({ ...f, branding: { ...f.branding, appName: e.target.value } })} /></Field>
          <Field label="Logo URL"><input className="input" value={f.branding.logoUrl || ''} onChange={(e) => setF({ ...f, branding: { ...f.branding, logoUrl: e.target.value } })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Primary colour"><input className="input h-11 p-1" type="color" value={f.branding.primaryColor || '#059669'} onChange={(e) => setF({ ...f, branding: { ...f.branding, primaryColor: e.target.value } })} /></Field>
            <Field label="Accent colour"><input className="input h-11 p-1" type="color" value={f.branding.accentColor || '#0ea5e9'} onChange={(e) => setF({ ...f, branding: { ...f.branding, accentColor: e.target.value } })} /></Field>
          </div>
        </Card>
        <Card className="space-y-3 p-4">
          <div className="font-semibold">Operations</div>
          <Field label="Complaint SLA (hours)"><input className="input" value={f.complaintSlaHours} onChange={(e) => setF({ ...f, complaintSlaHours: e.target.value })} /></Field>
          <Field label="Alert emails (comma separated)"><input className="input" value={f.emails} onChange={(e) => setF({ ...f, emails: e.target.value })} /></Field>
        </Card>
        {can('bank.manage') && (
          <Card className="space-y-3 p-4">
            <div className="font-semibold">Payout bank account</div>
            {data.tenant.bank?.accountNumberLast4 && <div className="text-sm">Current: {data.tenant.bank.accountName} · ****{data.tenant.bank.accountNumberLast4} · {data.tenant.bank.ifsc}</div>}
            <div className="grid gap-2 sm:grid-cols-3">
              <input className="input" placeholder="Account name" value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })} />
              <input className="input" placeholder="Account number" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value.replace(/\D/g, '') })} />
              <input className="input uppercase" placeholder="IFSC" value={bank.ifsc} onChange={(e) => setBank({ ...bank, ifsc: e.target.value.toUpperCase() })} />
            </div>
            <ActionButton className="btn-secondary" success="Bank details updated" onClick={async () => { await api('/api/cms/company', { method: 'PATCH', body: { bank } }); setBank({ accountName: '', accountNumber: '', ifsc: '' }); reload({ quiet: true }); }}>Update bank details</ActionButton>
          </Card>
        )}
      </div>
    </>
  );
}

export function ReportsPage() {
  const [tab, setTab] = useState('chargers');
  const [days, setDays] = useState(30);
  const ch = useApi(tab === 'chargers' ? `/api/cms/reports/chargers?days=${days}` : null);
  const fail = useApi(tab === 'failures' ? `/api/cms/reports/failures?days=${days}` : null);
  return (
    <>
      <PageHeader title="Reports" sub="Uptime, utilisation, energy, revenue and failed-session reasons">
        <select className="input min-h-[36px] w-auto py-1 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select>
        <ActionButton className="btn-secondary" onClick={() => download(`/api/cms/reports/${tab}?days=${days}&format=csv`, `${tab}-report.csv`)}>CSV</ActionButton>
        <ActionButton className="btn-secondary" onClick={() => download(`/api/cms/reports/sessions.csv?days=${days}`, 'sessions.csv')}>All sessions CSV</ActionButton>
      </PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'chargers', label: 'Per charger' }, { value: 'failures', label: 'Failed sessions' }]} />
      <Card className="mt-3">
        {tab === 'chargers' && (!ch.data ? <Loading /> : <Table rows={ch.data.rows} rowKey={(r) => r.ocppId} columns={[
          { key: 'o', label: 'Charger', render: (r) => <span className="font-mono">{r.ocppId}</span> }, { key: 's', label: 'Site', render: (r) => r.site }, { key: 'u', label: 'Uptime', render: (r) => `${r.uptimePct}%` },
          { key: 'ut', label: 'Utilisation', render: (r) => `${r.utilisationPct}%` }, { key: 'n', label: 'Sessions', render: (r) => r.sessions }, { key: 'f', label: 'Failed', render: (r) => r.failedSessions },
          { key: 'e', label: 'Energy', render: (r) => `${r.energyKwh} kWh` }, { key: 'r', label: 'Revenue', render: (r) => `₹${r.revenueRs.toFixed(2)}` }, { key: 'fw', label: 'Firmware', render: (r) => r.firmware },
        ]} />)}
        {tab === 'failures' && (!fail.data ? <Loading /> : <Table rows={fail.data.rows} rowKey={(r) => r.reason} empty="No failed sessions" columns={[{ key: 'r', label: 'Reason', render: (r) => titleCase(r.reason) }, { key: 'c', label: 'Count', render: (r) => r.count }]} />)}
      </Card>
    </>
  );
}

export function RoamingPage() {
  const { can } = useConsole();
  const { data, error, reload } = useApi('/api/cms/roaming');
  const [tab, setTab] = useState('chargers');
  return (
    <>
      <PageHeader title="Roaming" sub="Publish chargers to OCPI partners and the UEI network; follow CDRs" />
      <ErrorBox error={error} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'chargers', label: 'Chargers' }, { value: 'cdrs', label: 'CDRs' }, { value: 'partners', label: 'Partners' }]} />
      <Card className="mt-3">
        {!data ? <Loading /> : tab === 'chargers' ? <Table rows={data.chargers} columns={[
          { key: 'o', label: 'Charger', render: (c) => <span className="font-mono">{c.ocppId}</span> }, { key: 'u', label: 'Uptime', render: (c) => `${c.uptime?.scorePct ?? 100}%` },
          { key: 's', label: 'Since', render: (c) => (c.roamingEnabled ? dt(c.roamingEnabledAt) : '—') },
          { key: 'r', label: 'Roaming', render: (c) => (can('roaming.manage') ? <ActionButton className={c.roamingEnabled ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'} onClick={async () => { await api(`/api/cms/chargers/${c._id}/roaming`, { method: 'POST', body: { enabled: !c.roamingEnabled, reason: 'roaming page' } }); reload({ quiet: true }); }}>{c.roamingEnabled ? 'On — turn off' : 'Off — turn on'}</ActionButton> : c.roamingEnabled ? 'On' : 'Off') },
        ]} /> : tab === 'cdrs' ? <Table rows={data.cdrs} empty="No roaming sessions yet" columns={[
          { key: 'i', label: 'CDR', render: (c) => <span className="font-mono text-xs">{c.cdrId}</span> }, { key: 'p', label: 'Partner', render: (c) => c.partner?.name }, { key: 'e', label: 'Energy', render: (c) => `${(c.energyWh / 1000).toFixed(2)} kWh` },
          { key: 't', label: 'Total', render: (c) => rs(c.totalCostPaise) }, { key: 's', label: 'Status', render: (c) => <Status value={c.status} /> }, { key: 'm', label: 'Month', render: (c) => c.month },
        ]} /> : <Table rows={data.partners} columns={[{ key: 'n', label: 'Partner', render: (p) => p.name }, { key: 'p', label: 'Protocol', render: (p) => p.protocol.toUpperCase() }, { key: 'r', label: 'Roles', render: (p) => p.roles?.join(', ') }, { key: 's', label: 'Status', render: (p) => <Status value={p.status} /> }]} />}
      </Card>
    </>
  );
}
