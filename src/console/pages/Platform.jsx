// Super-Admin (our company): tenants, health + global search, money, switches, models, roaming partners, content.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useApi, useInterval } from '../../lib/hooks.js';
import { dateOnly, dt, kwh, rs, titleCase } from '../../lib/format.js';
import { ActionButton, Badge, Card, ErrorBox, Field, Loading, Modal, ReasonModal, Stat, Status, Table, Tabs, useToast } from '../../components/ui.jsx';
import { PageHeader } from '../Console.jsx';

export function TenantsPage() {
  const toast = useToast();
  const { data, error, reload } = useApi('/api/admin/tenants');
  const [create, setCreate] = useState(false);
  const [f, setF] = useState({ type: 'company', owner: {} });
  const [sel, setSel] = useState(null);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(null);
  return (
    <>
      <PageHeader title="Tenants" sub="Charging companies and individual hosts on the platform"><button type="button" className="btn-primary" onClick={() => setCreate(true)}>Onboard tenant</button></PageHeader>
      <ErrorBox error={error} />
      <Card>{!data ? <Loading /> : <Table rows={data.tenants} onRow={setSel} columns={[
        { key: 'n', label: 'Tenant', render: (t) => <div><div className="font-medium">{t.name}</div><div className="text-xs muted">{t.slug} · {t.type}{t.ocpiPartyId ? ` · IN*${t.ocpiPartyId}` : ''}</div></div> },
        { key: 's', label: 'Status', render: (t) => <Status value={t.status} /> },
        { key: 'k', label: 'KYC', render: (t) => <Status value={t.kyc?.status === 'verified' ? 'active' : 'pending'} label={t.kyc?.status || 'pending'} /> },
        { key: 'c', label: 'Chargers', render: (t) => `${t.chargers.online}/${t.chargers.n}` },
        { key: 'p', label: 'Payouts', render: (t) => (t.payoutHold ? <Badge tone="red">On hold</Badge> : `T+${t.payoutDelayDays}`) },
        { key: 'x', label: '', render: (t) => <button type="button" className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setStatus(t); }}>{t.status === 'suspended' ? 'Activate' : 'Suspend'}</button> },
      ]} />}</Card>
      <Modal open={create} onClose={() => setCreate(false)} title="Onboard tenant" wide footer={<ActionButton onClick={async () => { try { await api('/api/admin/tenants', { method: 'POST', body: { ...f, energyPaisePerKwh: f.price ? Math.round(f.price * 100) : undefined, price: undefined } }); setCreate(false); reload(); toast('Tenant created — verify KYC to activate'); } catch (e) { setErr(e); } }}>Create</ActionButton>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company name"><input className="input" onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Slug"><input className="input" onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} /></Field>
          <Field label="GSTIN"><input className="input" onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} /></Field>
          <Field label="OCPI party id (3 letters)"><input className="input uppercase" maxLength={3} onChange={(e) => setF({ ...f, ocpiPartyId: e.target.value.toUpperCase() || undefined })} /></Field>
          <Field label="Default price ₹/kWh"><input className="input" onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></Field>
          <Field label="Payout delay (days)"><input className="input" defaultValue={2} onChange={(e) => setF({ ...f, payoutDelayDays: Number(e.target.value) })} /></Field>
          <div className="sm:col-span-2 text-sm font-semibold">Owner login</div>
          <Field label="Owner name"><input className="input" onChange={(e) => setF({ ...f, owner: { ...f.owner, name: e.target.value } })} /></Field>
          <Field label="Owner email"><input className="input" onChange={(e) => setF({ ...f, owner: { ...f.owner, email: e.target.value } })} /></Field>
          <Field label="Owner mobile"><input className="input" onChange={(e) => setF({ ...f, owner: { ...f.owner, phone: e.target.value } })} /></Field>
          <Field label="Temporary password"><input className="input" type="password" onChange={(e) => setF({ ...f, owner: { ...f.owner, password: e.target.value } })} /></Field>
        </div>
        <ErrorBox error={err} />
      </Modal>
      <TenantDrawer tenant={sel} onClose={() => setSel(null)} reload={reload} />
      <ReasonModal open={!!status} danger={status?.status !== 'suspended'} title={`${status?.status === 'suspended' ? 'Activate' : 'Suspend'} ${status?.name}`} onClose={() => setStatus(null)} onSubmit={async (reason) => { await api(`/api/admin/tenants/${status._id}/status`, { method: 'POST', body: { status: status.status === 'suspended' ? 'active' : 'suspended', reason } }); reload({ quiet: true }); }}>
        {status?.status !== 'suspended' && <p className="text-sm muted">Their chargers are hidden from drivers immediately. Data is kept.</p>}
      </ReasonModal>
    </>
  );
}

function TenantDrawer({ tenant, onClose, reload }) {
  const toast = useToast();
  const [flags, setFlags] = useState({});
  const [hold, setHold] = useState(null);
  useEffect(() => setFlags(tenant?.featureFlags || {}), [tenant]);
  if (!tenant) return null;
  return (
    <Modal open onClose={onClose} title={tenant.name} wide>
      <div className="space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <Stat label="Status" value={titleCase(tenant.status)} /><Stat label="KYC" value={titleCase(tenant.kyc?.status || 'pending')} /><Stat label="Chargers" value={`${tenant.chargers.online}/${tenant.chargers.n}`} />
        </div>
        <div className="flex flex-wrap gap-2">
          {tenant.kyc?.status !== 'verified' && <ActionButton onClick={async () => { await api(`/api/admin/tenants/${tenant._id}`, { method: 'PATCH', body: { kyc: { status: 'verified' } } }); toast('KYC verified — tenant active'); reload(); onClose(); }}>Mark KYC verified</ActionButton>}
          <button type="button" className="btn-secondary" onClick={() => setHold(!tenant.payoutHold)}>{tenant.payoutHold ? 'Release payouts' : 'Hold payouts'}</button>
        </div>
        <div>
          <div className="mb-1 font-semibold">Feature flags (tenant-first rollout)</div>
          {['roaming', 'idle_fee', 'promo', 'white_label', 'autopay'].map((k) => (
            <label key={k} className="mr-4 inline-flex items-center gap-2"><input type="checkbox" className="accent-brand-600" checked={!!flags[k]} onChange={(e) => setFlags({ ...flags, [k]: e.target.checked })} />{k}</label>
          ))}
          <ActionButton className="btn-secondary btn-sm ml-2" success="Flags saved" onClick={async () => { await api(`/api/admin/tenants/${tenant._id}`, { method: 'PATCH', body: { featureFlags: flags } }); reload({ quiet: true }); }}>Save flags</ActionButton>
        </div>
      </div>
      <ReasonModal open={hold !== null} title={hold ? 'Hold all payouts' : 'Release payouts'} submitLabel="Request approval" onClose={() => setHold(null)} onSubmit={async (reason) => { await api(`/api/admin/tenants/${tenant._id}/payout-hold`, { method: 'POST', body: { hold, reason } }); toast('Sent for second approval'); }} />
    </Modal>
  );
}

export function HealthPage() {
  const { data, reload } = useApi('/api/admin/health');
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  useInterval(() => reload({ quiet: true }), 5000);
  const search = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      setRes(await api(`/api/admin/search?q=${encodeURIComponent(q)}`));
    } catch (x) {
      setErr(x);
    }
  };
  return (
    <>
      <PageHeader title="Health & global search" sub="Gateway, payments, queues · refreshes every 5 s" />
      {!data ? <Loading /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Charger connections" value={data.gateway.connections} sub={`${data.gateway.messagesPerSecond} msg/s · in ${data.gateway.messagesIn} / out ${data.gateway.messagesOut}`} icon="cpu" />
          <Stat label="Payment success (1h)" value={data.lastHour.paymentSuccessRatePct === null ? '—' : `${data.lastHour.paymentSuccessRatePct}%`} sub={`${data.lastHour.payments} payments`} icon="money" />
          <Stat label="Failed starts (1h)" value={data.lastHour.failedStarts} icon="alert" tone="red" />
          <Stat label="Queues" value={data.queues.refunds} sub={`refunds · finance queue ${data.queues.financeQueue} · CDRs ${data.queues.cdrs} · alerts ${data.queues.openAlerts}`} icon="list" />
          <Stat label="Switches" value={data.switches.pauseNewPayments ? 'Payments paused' : 'Normal'} sub={`${data.switches.gatewayDown ? 'gateway down · ' : ''}${data.switches.maintenance ? 'maintenance banner on' : ''}`} icon="cog" />
          <Stat label="API process" value={`${data.process.memoryMb} MB`} sub={`${data.process.node} · up ${Math.round(data.gateway.uptimeSec / 60)} min`} icon="chart" />
          <Stat label="Providers" value={Object.values(data.providers || {}).every((v) => v === 'mock') ? 'All mock' : 'Live'} sub={Object.entries(data.providers || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')} icon="bell" />
          <Stat label="Cluster" value={data.cluster?.enabled ? 'Redis' : 'Single node'} sub={`${data.cluster?.nodeId}${data.cluster?.leader ? ' · leader' : ''} · Profile 3 listener ${data.tls?.profile3Listener ? 'on' : 'off'} · CCP ${data.tls?.ccp ? 'on' : 'off'}`} icon="layers" />
        </div>
      )}
      <Card className="mt-4 p-4">
        <form onSubmit={search} className="flex gap-2"><input className="input" placeholder="Phone, session id, charger id, payment id or invoice number" value={q} onChange={(e) => setQ(e.target.value)} /><button type="submit" className="btn-primary">Search</button></form>
        <ErrorBox error={err} />
        {res && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2 text-sm">
            <div><div className="mb-1 font-semibold">Sessions</div>{res.sessions.map((s) => <Link key={s._id} to={`/console/sessions/${s._id}`} className="flex justify-between border-b border-ink-100 py-1 dark:border-ink-800"><span className="font-mono">{String(s._id).slice(-8)} · {s.ocppId}</span><span>{s.tenant?.name} · <Status value={s.state} /></span></Link>)}{!res.sessions.length && <div className="muted">None</div>}</div>
            <div><div className="mb-1 font-semibold">Chargers</div>{res.chargers.map((c) => <Link key={c._id} to={`/console/chargers/${c._id}`} className="flex justify-between border-b border-ink-100 py-1 dark:border-ink-800"><span className="font-mono">{c.ocppId}</span><span>{c.tenant?.name}</span></Link>)}{!res.chargers.length && <div className="muted">None</div>}</div>
            <div><div className="mb-1 font-semibold">Drivers</div>{res.users.map((u) => <div key={u._id} className="border-b border-ink-100 py-1 dark:border-ink-800">{u.name || 'Driver'} · {u.phone} · {u.status}</div>)}{!res.users.length && <div className="muted">None</div>}</div>
            <div><div className="mb-1 font-semibold">Payments & invoices</div>{res.payments.map((p) => <Link key={p._id} to={`/console/sessions/${p.session}`} className="block border-b border-ink-100 py-1 font-mono dark:border-ink-800">{p.orderId} · {rs(p.amountPaise)} · {p.status}</Link>)}{res.invoices.map((i) => <Link key={i._id} to={`/console/sessions/${i.session}`} className="block border-b border-ink-100 py-1 font-mono dark:border-ink-800">{i.number} · {rs(i.totalPaise)}</Link>)}</div>
          </div>
        )}
      </Card>
    </>
  );
}

export function PlatformMoneyPage() {
  const toast = useToast();
  const [tab, setTab] = useState('revenue');
  const tenants = useApi('/api/admin/tenants');
  const revenue = useApi(tab === 'revenue' ? '/api/admin/revenue' : null);
  const rules = useApi(tab === 'commission' ? '/api/admin/commission' : null);
  const payouts = useApi(tab === 'payouts' ? '/api/cms/finance/payouts' : null);
  const recon = useApi(tab === 'recon' ? '/api/admin/reconciliation' : null);
  const adjustments = useApi(tab === 'adjust' ? '/api/cms/finance/adjustments' : null);
  const [rule, setRule] = useState({ kind: 'percent', value: 10 });
  const [adj, setAdj] = useState({ amount: '' });
  const [holdFor, setHoldFor] = useState(null);
  const opts = tenants.data?.tenants?.map((t) => <option key={t._id} value={t._id}>{t.name}</option>);
  return (
    <>
      <PageHeader title="Payouts & commission" sub="Commission rules, payout runs, holds, manual adjustments and reconciliation (maker-checker)">
        <ActionButton className="btn-secondary" success={(r) => `${r.payouts.length} payout(s) created`} onClick={() => api('/api/admin/payouts/run', { method: 'POST', body: {} })}>Run payouts now</ActionButton>
        <ActionButton className="btn-secondary" success={(r) => `${r.month}: ${r.fleetInvoices} fleet invoice(s), ${r.planFees} plan fee(s)`} onClick={() => api('/api/admin/billing/monthly', { method: 'POST', body: {} })}>Run monthly billing</ActionButton>
        <ActionButton className="btn-secondary" success={(r) => `Reconciliation: ${r.run.status} (${r.run.mismatches.length} mismatches)`} onClick={() => api('/api/admin/reconciliation/run', { method: 'POST', body: {} })}>Run reconciliation</ActionButton>
      </PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'revenue', label: 'Revenue by tenant' }, { value: 'commission', label: 'Commission rules' }, { value: 'payouts', label: 'Payouts' }, { value: 'adjust', label: 'Adjustments' }, { value: 'recon', label: 'Reconciliation' }]} />
      <div className="mt-3 space-y-3">
        {tab === 'revenue' && <Card>{!revenue.data ? <Loading /> : <Table rows={revenue.data.rows} rowKey={(r) => r._id} columns={[{ key: 't', label: 'Tenant', render: (r) => r.tenant }, { key: 's', label: 'Sessions (30d)', render: (r) => r.sessions }, { key: 'e', label: 'Energy', render: (r) => kwh(r.energyWh, 0) }, { key: 'g', label: 'Gross', render: (r) => rs(r.grossPaise) }, { key: 'c', label: 'Our commission', render: (r) => <b>{rs(r.commissionPaise)}</b> }]} />}</Card>}
        {tab === 'commission' && (
          <>
            <Card className="grid gap-2 p-4 sm:grid-cols-5">
              <select className="input" onChange={(e) => setRule({ ...rule, tenant: e.target.value })}><option>Tenant</option>{opts}</select>
              <select className="input" value={rule.kind} onChange={(e) => setRule({ ...rule, kind: e.target.value })}><option value="percent">% of taxable</option><option value="per_kwh">₹ per kWh</option><option value="fixed">₹ per session</option></select>
              <input className="input" value={rule.value} onChange={(e) => setRule({ ...rule, value: e.target.value })} aria-label="Value" />
              <input className="input" type="date" onChange={(e) => setRule({ ...rule, effectiveFrom: e.target.value })} />
              <ActionButton success="Sent for second approval" onClick={() => api('/api/admin/commission', { method: 'POST', body: { tenant: rule.tenant, kind: rule.kind, value: Math.round(Number(rule.value) * 100), effectiveFrom: rule.effectiveFrom || new Date().toISOString(), reason: 'commission change' } })}>Request change</ActionButton>
            </Card>
            <Card>{!rules.data ? <Loading /> : <Table rows={rules.data.rules} columns={[{ key: 't', label: 'Tenant', render: (r) => r.tenant?.name }, { key: 'k', label: 'Rule', render: (r) => (r.kind === 'percent' ? `${r.value / 100}% of taxable` : r.kind === 'per_kwh' ? `${rs(r.value)}/kWh` : `${rs(r.value)}/session`) }, { key: 'f', label: 'Effective from', render: (r) => dateOnly(r.effectiveFrom) }, { key: 'n', label: 'Note', render: (r) => r.note }]} />}</Card>
          </>
        )}
        {tab === 'payouts' && <Card>{!payouts.data ? <Loading /> : <Table rows={payouts.data.payouts} columns={[
          { key: 't', label: 'Tenant', render: (p) => p.tenant?.name }, { key: 'p', label: 'Period', render: (p) => `${dateOnly(p.periodStart)} – ${dateOnly(p.periodEnd)}` }, { key: 'n', label: 'Net', render: (p) => <b>{rs(p.netPaise)}</b> }, { key: 's', label: 'Status', render: (p) => <Status value={p.status} /> },
          { key: 'x', label: '', render: (p) => p.status !== 'paid' && <button type="button" className="btn-ghost btn-sm" onClick={() => setHoldFor(p)}>{p.status === 'held' ? 'Release' : 'Hold'}</button> },
        ]} />}</Card>}
        {tab === 'adjust' && (
          <>
            <Card className="grid gap-2 p-4 sm:grid-cols-4">
              <select className="input" onChange={(e) => setAdj({ ...adj, tenant: e.target.value })}><option>Tenant</option>{opts}</select>
              <input className="input" placeholder="₹ (+credit / -debit)" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} />
              <input className="input" placeholder="Reason" onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />
              <ActionButton success="Sent for second approval" onClick={async () => { await api('/api/admin/adjustments', { method: 'POST', body: { tenant: adj.tenant, amountPaise: Math.round(Number(adj.amount) * 100), reason: adj.reason } }); adjustments.reload({ quiet: true }); }}>Request adjustment</ActionButton>
            </Card>
            <Card>{!adjustments.data ? <Loading /> : <Table rows={adjustments.data.adjustments} columns={[{ key: 'a', label: 'Amount', render: (a) => rs(a.amountPaise) }, { key: 'r', label: 'Reason', render: (a) => a.reason }, { key: 's', label: 'Status', render: (a) => <Status value={a.status === 'pending_approval' ? 'pending' : a.status} label={a.status} /> }, { key: 'w', label: 'When', render: (a) => dt(a.createdAt) }]} />}</Card>
          </>
        )}
        {tab === 'recon' && <Card>{!recon.data ? <Loading /> : <Table rows={recon.data.runs} columns={[{ key: 'd', label: 'Date', render: (r) => r.date }, { key: 's', label: 'Status', render: (r) => <Status value={r.status} /> }, { key: 'p', label: 'Paid', render: (r) => rs(r.totals?.paidPaise) }, { key: 'b', label: 'Billed', render: (r) => rs(r.totals?.billedPaise) }, { key: 'r', label: 'Refunded', render: (r) => rs(r.totals?.refundedPaise) }, { key: 'm', label: 'Mismatches', render: (r) => r.mismatches.length }]} />}</Card>}
      </div>
      <ReasonModal open={!!holdFor} title={`${holdFor?.status === 'held' ? 'Release' : 'Hold'} payout ${rs(holdFor?.netPaise)}`} submitLabel="Request approval" onClose={() => setHoldFor(null)} onSubmit={async (reason) => { await api(`/api/admin/payouts/${holdFor._id}/hold`, { method: 'POST', body: { hold: holdFor.status !== 'held', reason } }); toast('Sent for second approval'); }} />
    </>
  );
}

export function SwitchesPage() {
  const toast = useToast();
  const { data, reload } = useApi('/api/admin/settings');
  const [f, setF] = useState(null);
  const [confirm, setConfirm] = useState(null);
  useEffect(() => {
    if (data) setF({ ...data.settings, featureFlags: data.settings.featureFlags || {} });
  }, [data]);
  if (!f) return <Loading />;
  const apply = (patch, label) => setConfirm({ patch, label });
  return (
    <>
      <PageHeader title="Platform switches" sub="Super Admin only. Every change needs a reason and is audit-logged." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between"><div><div className="font-semibold">Pause new payments</div><div className="text-xs muted">Gateway incident: stops new sessions safely; running sessions continue.</div></div><Status value={f.pauseNewPayments ? 'held' : 'active'} label={f.pauseNewPayments ? 'Paused' : 'Normal'} /></div>
          <input className="input" placeholder="Message shown to drivers" value={f.pauseReason || ''} onChange={(e) => setF({ ...f, pauseReason: e.target.value })} />
          <button type="button" className={f.pauseNewPayments ? 'btn-primary' : 'btn-danger'} onClick={() => apply({ pauseNewPayments: !f.pauseNewPayments, pauseReason: f.pauseReason }, f.pauseNewPayments ? 'Resume payments' : 'Pause new payments')}>{f.pauseNewPayments ? 'Resume payments' : 'Pause new payments'}</button>
          {f.gatewayDown && <div className="flex items-center justify-between rounded-xl bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">Gateway marked down by monitoring<button type="button" className="btn-secondary btn-sm" onClick={() => apply({ gatewayDown: false }, 'Clear gateway-down flag')}>Clear</button></div>}
        </Card>
        <Card className="space-y-3 p-4">
          <div className="font-semibold">Maintenance banner</div>
          <input className="input" placeholder="Planned downtime 2-3 AM tonight…" value={f.maintenanceBanner?.message || ''} onChange={(e) => setF({ ...f, maintenanceBanner: { ...f.maintenanceBanner, message: e.target.value } })} />
          <button type="button" className="btn-secondary" onClick={() => apply({ maintenanceBanner: { active: !f.maintenanceBanner?.active, message: f.maintenanceBanner?.message || '' } }, f.maintenanceBanner?.active ? 'Hide banner' : 'Show banner')}>{f.maintenanceBanner?.active ? 'Hide banner' : 'Show banner in app & QR pages'}</button>
        </Card>
        <Card className="space-y-3 p-4">
          <div className="font-semibold">App & support</div>
          <Field label="Minimum supported app version (force update)"><input className="input" value={f.minAppVersion} onChange={(e) => setF({ ...f, minAppVersion: e.target.value })} /></Field>
          <Field label="Support phone"><input className="input" value={f.supportPhone} onChange={(e) => setF({ ...f, supportPhone: e.target.value })} /></Field>
          <Field label="Admin session timeout (minutes)"><input className="input" value={f.adminSessionTimeoutMin} onChange={(e) => setF({ ...f, adminSessionTimeoutMin: Number(e.target.value) })} /></Field>
          <Field label="Admin IP allow-list (comma separated, empty = any)"><input className="input" value={(f.adminIpAllowList || []).join(', ')} onChange={(e) => setF({ ...f, adminIpAllowList: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
          <button type="button" className="btn-secondary" onClick={() => apply({ minAppVersion: f.minAppVersion, supportPhone: f.supportPhone, adminSessionTimeoutMin: f.adminSessionTimeoutMin, adminIpAllowList: f.adminIpAllowList }, 'Save app & support settings')}>Save</button>
        </Card>
        <Card className="space-y-3 p-4">
          <div className="font-semibold">Global feature flags</div>
          <p className="text-xs muted">Tenant flags override these (turn a feature on for one tenant first).</p>
          {['roaming', 'idle_fee', 'promo', 'white_label', 'autopay'].map((k) => <label key={k} className="mr-4 inline-flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={!!f.featureFlags[k]} onChange={(e) => setF({ ...f, featureFlags: { ...f.featureFlags, [k]: e.target.checked } })} />{k}</label>)}
          <Field label="Host suggested price ₹/kWh"><input className="input" value={(f.hostSuggestedPricePaisePerKwh || 0) / 100} onChange={(e) => setF({ ...f, hostSuggestedPricePaisePerKwh: Math.round(Number(e.target.value) * 100) })} /></Field>
          <button type="button" className="btn-secondary" onClick={() => apply({ featureFlags: f.featureFlags, hostSuggestedPricePaisePerKwh: f.hostSuggestedPricePaisePerKwh }, 'Save flags')}>Save</button>
        </Card>
      </div>
      <ReasonModal open={!!confirm} title={confirm?.label} onClose={() => setConfirm(null)} onSubmit={async (reason) => { await api('/api/admin/settings', { method: 'PATCH', body: { ...confirm.patch, reason } }); toast('Saved'); reload({ quiet: true }); }} />
    </>
  );
}

export function ModelsPage() {
  const { data, reload } = useApi('/api/admin/models');
  const [act, setAct] = useState(null);
  const blocked = (s) => data.models.find((m) => m.vendor === s.vendor && m.model === s.model);
  return (
    <>
      <PageHeader title="Charger models & firmware" sub="Disable a model or a known-bad firmware: starts are blocked on those chargers" />
      <Card>{!data ? <Loading /> : <Table rows={data.seen} rowKey={(s) => `${s.vendor}${s.model}${s.firmware}`} columns={[
        { key: 'v', label: 'Vendor / model', render: (s) => `${s.vendor} ${s.model}` },
        { key: 'f', label: 'Firmware', render: (s) => <span className="font-mono">{s.firmware}</span> },
        { key: 'n', label: 'Chargers', render: (s) => s.chargers },
        { key: 's', label: 'State', render: (s) => { const m = blocked(s); return m?.blocked ? <Badge tone="red">Model blocked</Badge> : m?.blockedFirmware?.includes(s.firmware) ? <Badge tone="red">Firmware blocked</Badge> : <Badge tone="green">Allowed</Badge>; } },
        { key: 'x', label: '', render: (s) => { const m = blocked(s); const fwBlocked = m?.blockedFirmware?.includes(s.firmware); return <button type="button" className="btn-ghost btn-sm" onClick={() => setAct({ s, m, fwBlocked })}>{fwBlocked ? 'Unblock firmware' : 'Block firmware'}</button>; } },
      ]} />}</Card>
      <ReasonModal open={!!act} danger={!act?.fwBlocked} title={act?.fwBlocked ? 'Unblock firmware' : `Block ${act?.s.model} firmware ${act?.s.firmware}`} onClose={() => setAct(null)} onSubmit={async (reason) => {
        const current = act.m?.blockedFirmware || [];
        await api('/api/admin/models', { method: 'PUT', body: { vendor: act.s.vendor, model: act.s.model, blockedFirmware: act.fwBlocked ? current.filter((f) => f !== act.s.firmware) : [...current, act.s.firmware], reason } });
        reload({ quiet: true });
      }} />
    </>
  );
}

export function PartnersPage() {
  const toast = useToast();
  const { data, reload } = useApi('/api/admin/roaming/partners');
  const cdrs = useApi('/api/admin/roaming/cdrs');
  const settlements = useApi('/api/admin/roaming/settlements');
  const [tab, setTab] = useState('partners');
  const [f, setF] = useState({ protocol: 'ocpi', roles: ['EMSP'] });
  const [created, setCreated] = useState(null);
  const [open, setOpen] = useState(false);
  const [toggle, setToggle] = useState(null);
  const [st, setSt] = useState({});
  return (
    <>
      <PageHeader title="Roaming partners" sub="OCPI 2.2.1 (credentials handshake) and UEI / Beckn participants"><button type="button" className="btn-primary" onClick={() => setOpen(true)}>Add partner</button></PageHeader>
      {data && <Card className="mb-3 p-4 text-xs"><div className="font-semibold">Our endpoints</div><div className="font-mono">OCPI versions: {data.ours.ocpiVersionsUrl}</div><div className="font-mono">UEI: {data.ours.ueiUrl} · subscriber {data.ours.ueiSubscriberId}</div><div className="break-all font-mono muted">UEI signing public key (ed25519): {data.ours.ueiPublicKey}</div></Card>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'partners', label: 'Partners' }, { value: 'cdrs', label: 'CDRs' }, { value: 'settle', label: 'Settlement' }]} />
      <Card className="mt-3">
        {tab === 'partners' && (!data ? <Loading /> : <Table rows={data.partners} columns={[
          { key: 'n', label: 'Partner', render: (p) => <div><div className="font-medium">{p.name}</div><div className="text-xs muted">{p.protocol.toUpperCase()} · {p.countryCode}*{p.partyId || p.subscriberId || '—'}</div></div> },
          { key: 'r', label: 'Roles', render: (p) => p.roles.join(', ') },
          { key: 's', label: 'Status', render: (p) => <Status value={p.status} /> },
          { key: 'e', label: 'Enabled', render: (p) => (p.enabled ? <Badge tone="green">On</Badge> : <Badge tone="red">Off</Badge>) },
          { key: 'x', label: '', render: (p) => <div className="flex gap-1"><button type="button" className="btn-ghost btn-sm" onClick={() => setToggle(p)}>{p.enabled ? 'Switch off' : 'Switch on'}</button>{p.protocol === 'ocpi' && p.status === 'registered' && p.roles.includes('CPO') && <ActionButton className="btn-ghost btn-sm" success={(r) => `${r.imported} locations imported`} onClick={() => api(`/api/admin/roaming/partners/${p._id}/pull-locations`, { method: 'POST' })}>Pull locations</ActionButton>}</div> },
        ]} />)}
        {tab === 'cdrs' && (!cdrs.data ? <Loading /> : <Table rows={cdrs.data.cdrs} empty="No CDRs" columns={[
          { key: 'i', label: 'CDR', render: (c) => <span className="font-mono text-xs">{c.cdrId}</span> }, { key: 'p', label: 'Partner', render: (c) => c.partner?.name }, { key: 'd', label: 'Direction', render: (c) => (c.direction === 'out' ? 'We bill them' : 'They bill us') },
          { key: 't', label: 'Total', render: (c) => rs(c.totalCostPaise) }, { key: 's', label: 'Status', render: (c) => <Status value={c.status} /> }, { key: 'a', label: 'Attempts', render: (c) => `${c.attempts}${c.lastError ? ` · ${c.lastError}` : ''}` },
          { key: 'x', label: '', render: (c) => c.status === 'failed' && <ActionButton className="btn-ghost btn-sm" onClick={async () => { await api(`/api/admin/roaming/cdrs/${c._id}/retry`, { method: 'POST' }); cdrs.reload({ quiet: true }); }}>Retry</ActionButton> },
        ]} />)}
        {tab === 'settle' && (
          <div className="space-y-3 p-4">
            <div className="grid gap-2 sm:grid-cols-4">
              <select className="input" onChange={(e) => setSt({ ...st, partner: e.target.value })}><option>Partner</option>{data?.partners?.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
              <input className="input" type="month" onChange={(e) => setSt({ ...st, month: e.target.value })} />
              <input className="input" placeholder="Their total ₹" onChange={(e) => setSt({ ...st, total: e.target.value })} />
              <ActionButton onClick={async () => { const r = await api('/api/admin/roaming/settlements', { method: 'POST', body: { partner: st.partner, month: st.month, theirTotalPaise: Math.round(Number(st.total) * 100) } }); toast(`Settlement ${r.settlement.status}`, r.settlement.status === 'matched' ? 'green' : 'amber'); settlements.reload({ quiet: true }); }}>Match month</ActionButton>
            </div>
            <Table rows={settlements.data?.settlements || []} empty="No settlements yet" columns={[{ key: 'p', label: 'Partner', render: (s) => s.partner?.name }, { key: 'm', label: 'Month', render: (s) => s.month }, { key: 'o', label: 'Our CDRs', render: (s) => `${s.ourCdrCount} · ${rs(s.ourTotalPaise)}` }, { key: 't', label: 'Theirs', render: (s) => rs(s.theirTotalPaise) }, { key: 's', label: 'Status', render: (s) => <Status value={s.status} /> }, { key: 'd', label: 'Disputed', render: (s) => s.disputedCdrIds?.length || 0 }]} />
          </div>
        )}
      </Card>
      <Modal open={open} onClose={() => { setOpen(false); setCreated(null); }} title="Add roaming partner" footer={!created && <ActionButton onClick={async () => { const r = await api('/api/admin/roaming/partners', { method: 'POST', body: f }); setCreated(r); reload({ quiet: true }); }}>Create</ActionButton>}>
        {created ? (
          <div className="space-y-2 text-sm">{created.tokenA ? <><p>Give the partner this registration token (token A) and our versions URL. It works once, for the credentials handshake.</p><div className="rounded-xl bg-ink-900 p-3 font-mono text-xs text-brand-200">Token A: {created.tokenA}<br />Versions: {created.ourVersionsUrl}</div></> : <p>UEI participant registered.</p>}</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input className="input" onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Protocol"><select className="input" value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value })}><option value="ocpi">OCPI 2.2.1</option><option value="uei">UEI (Beckn)</option></select></Field>
            {f.protocol === 'ocpi' ? (
              <>
                <Field label="Their role"><select className="input" onChange={(e) => setF({ ...f, roles: e.target.value.split(',') })}><option value="EMSP">eMSP (their drivers use our chargers)</option><option value="CPO">CPO (our drivers use their chargers)</option><option value="EMSP,CPO">Both</option></select></Field>
                <Field label="Party id"><input className="input uppercase" maxLength={3} onChange={(e) => setF({ ...f, partyId: e.target.value.toUpperCase() })} /></Field>
              </>
            ) : (
              <>
                <Field label="Subscriber id"><input className="input" onChange={(e) => setF({ ...f, subscriberId: e.target.value })} /></Field>
                <Field label="Subscriber URL (BAP)"><input className="input" onChange={(e) => setF({ ...f, subscriberUrl: e.target.value })} /></Field>
                <Field label="Signing public key (ed25519, base64 DER)" className="sm:col-span-2"><input className="input font-mono text-xs" onChange={(e) => setF({ ...f, signingPublicKey: e.target.value })} /></Field>
              </>
            )}
          </div>
        )}
      </Modal>
      <ReasonModal open={!!toggle} danger={toggle?.enabled} title={`${toggle?.enabled ? 'Switch off' : 'Switch on'} ${toggle?.name}`} onClose={() => setToggle(null)} onSubmit={async (reason) => { await api(`/api/admin/roaming/partners/${toggle._id}`, { method: 'PATCH', body: { enabled: !toggle.enabled, reason } }); reload({ quiet: true }); }}>
        {toggle?.enabled && <p className="text-sm muted">They lose access immediately: our chargers stop being shared and their calls are refused.</p>}
      </ReasonModal>
    </>
  );
}

export function ContentPage() {
  const [tab, setTab] = useState('content');
  const content = useApi('/api/admin/content');
  const templates = useApi('/api/admin/templates');
  const [edit, setEdit] = useState(null);
  const [tpl, setTpl] = useState(null);
  return (
    <>
      <PageHeader title="Content & templates" sub="Banners, FAQs, terms without an app release; SMS/WhatsApp/push templates per language with DLT ids">
        {tab === 'content' ? <button type="button" className="btn-primary" onClick={() => setEdit({ kind: 'faq', lang: 'en', title: '', body: '', active: true })}>New item</button> : <button type="button" className="btn-primary" onClick={() => setTpl({ key: '', channel: 'sms', lang: 'en', body: '', approved: false })}>New template</button>}
      </PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'content', label: 'App content' }, { value: 'templates', label: 'Notification templates' }]} />
      <Card className="mt-3">
        {tab === 'content' ? (!content.data ? <Loading /> : <Table rows={content.data.items} onRow={setEdit} columns={[{ key: 'k', label: 'Kind', render: (c) => <Badge>{c.kind}</Badge> }, { key: 't', label: 'Title', render: (c) => c.title }, { key: 'l', label: 'Lang', render: (c) => c.lang }, { key: 'a', label: 'Active', render: (c) => (c.active ? 'Yes' : 'No') }]} />)
          : (!templates.data ? <Loading /> : <Table rows={templates.data.templates} onRow={setTpl} columns={[{ key: 'k', label: 'Key', render: (t) => <span className="font-mono">{t.key}</span> }, { key: 'c', label: 'Channel', render: (t) => t.channel }, { key: 'l', label: 'Lang', render: (t) => t.lang }, { key: 'd', label: 'DLT id', render: (t) => t.dltTemplateId || '—' }, { key: 'a', label: 'Approved', render: (t) => (t.approved ? <Badge tone="green">Yes</Badge> : <Badge tone="red">No — blocked for SMS</Badge>) }]} />)}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="App content" footer={<ActionButton onClick={async () => { const { _id, createdAt, updatedAt, __v, ...b } = edit; if (_id) await api(`/api/admin/content/${_id}`, { method: 'PATCH', body: b }); else await api('/api/admin/content', { method: 'POST', body: b }); setEdit(null); content.reload(); }}>Save</ActionButton>}>
        {edit && <div className="space-y-3"><div className="grid grid-cols-2 gap-2"><select className="input" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>{['banner', 'faq', 'terms', 'privacy', 'support'].map((k) => <option key={k}>{k}</option>)}</select><select className="input" value={edit.lang} onChange={(e) => setEdit({ ...edit, lang: e.target.value })}><option value="en">English</option><option value="hi">Hindi</option></select></div><input className="input" placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /><textarea className="input min-h-[140px] py-2" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active</label></div>}
      </Modal>
      <Modal open={!!tpl} onClose={() => setTpl(null)} title="Notification template" footer={<ActionButton onClick={async () => { const { _id, createdAt, updatedAt, __v, ...b } = tpl; await api('/api/admin/templates', { method: 'PUT', body: { ...b, dltTemplateId: b.dltTemplateId || undefined } }); setTpl(null); templates.reload(); }}>Save</ActionButton>}>
        {tpl && <div className="space-y-3"><div className="grid grid-cols-3 gap-2"><input className="input font-mono" placeholder="key" value={tpl.key} onChange={(e) => setTpl({ ...tpl, key: e.target.value })} /><select className="input" value={tpl.channel} onChange={(e) => setTpl({ ...tpl, channel: e.target.value })}>{['sms', 'whatsapp', 'push', 'email'].map((k) => <option key={k}>{k}</option>)}</select><select className="input" value={tpl.lang} onChange={(e) => setTpl({ ...tpl, lang: e.target.value })}><option value="en">en</option><option value="hi">hi</option></select></div><textarea className="input min-h-[100px] py-2" value={tpl.body} onChange={(e) => setTpl({ ...tpl, body: e.target.value })} /><input className="input" placeholder="DLT template id" value={tpl.dltTemplateId || ''} onChange={(e) => setTpl({ ...tpl, dltTemplateId: e.target.value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!tpl.approved} onChange={(e) => setTpl({ ...tpl, approved: e.target.checked })} /> DLT approved</label><p className="text-xs muted">{'Variables: {{amount}} {{kwh}} {{total}} {{refund}} {{link}} {{charger}} {{code}}'}</p></div>}
      </Modal>
    </>
  );
}

export function SecurityPage() {
  const [type, setType] = useState('');
  const { data } = useApi(`/api/admin/security-events${type ? `?type=${type}` : ''}`);
  return (
    <>
      <PageHeader title="Security events" sub="Failed logins, bad webhooks, cross-tenant attempts, charger auth failures">
        <select className="input min-h-[36px] w-auto py-1 text-sm" value={type} onChange={(e) => setType(e.target.value)}><option value="">All</option>{['cross_tenant_access', 'permission_denied', 'webhook_rejected', 'ocpp_auth_failed', 'staff_login_failed', 'payment_amount_mismatch', 'ocpi_bad_token', 'uei_bad_signature'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select>
      </PageHeader>
      <Card>{!data ? <Loading /> : <Table rows={data.events} columns={[{ key: 'w', label: 'When', render: (e) => dt(e.at) }, { key: 't', label: 'Type', render: (e) => <Badge tone="red">{e.type}</Badge> }, { key: 'd', label: 'Details', render: (e) => <span className="font-mono text-xs">{JSON.stringify(e.details)}</span> }, { key: 'i', label: 'IP', render: (e) => <span className="font-mono text-xs">{e.ip}</span> }]} />}</Card>
    </>
  );
}

export function DataRequestsPage() {
  const toast = useToast();
  const [status, setStatus] = useState('received,in_progress');
  const { data, reload } = useApi(`/api/admin/data-requests?status=${status}`);
  const [act, setAct] = useState(null);
  return (
    <>
      <PageHeader title="Data requests" sub="DPDP data-rights requests: export or deletion, tracked to completion (30-day target)">
        <select className="input min-h-[36px] w-auto py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="received,in_progress">Open</option><option value="completed,rejected">Closed</option><option value="received,in_progress,completed,rejected">All</option></select>
      </PageHeader>
      <Card>{!data ? <Loading /> : <Table rows={data.requests} empty="No requests" columns={[
        { key: 'w', label: 'Received', render: (r) => dt(r.createdAt) },
        { key: 'k', label: 'Type', render: (r) => <Badge tone={r.kind === 'delete' ? 'red' : 'blue'}>{r.kind}</Badge> },
        { key: 'p', label: 'Person', render: (r) => (r.user ? `${r.user.name || 'Driver'} · ${r.phone || ''}` : `Guest · ${r.phone || '—'}`) },
        { key: 'src', label: 'Source', render: (r) => titleCase(r.source) },
        { key: 'd', label: 'Due', render: (r) => (r.overdue ? <Badge tone="red">Overdue · {dt(r.dueAt)}</Badge> : dt(r.dueAt)) },
        { key: 's', label: 'Status', render: (r) => <Status value={r.status === 'received' ? 'pending' : r.status === 'completed' ? 'executed' : r.status} label={titleCase(r.status)} /> },
        { key: 'x', label: '', render: (r) => ['received', 'in_progress'].includes(r.status) && <div className="flex gap-1">{r.status === 'received' && <button type="button" className="btn-ghost btn-sm" onClick={() => setAct({ r, kind: 'in_progress' })}>Start</button>}<button type="button" className="btn-primary btn-sm" onClick={() => setAct({ r, kind: 'execute' })}>{r.kind === 'delete' ? 'Delete data' : 'Export'}</button><button type="button" className="btn-ghost btn-sm" onClick={() => setAct({ r, kind: 'rejected' })}>Reject</button></div> },
      ]} />}</Card>
      <ReasonModal open={!!act} danger={act?.kind === 'execute' && act?.r.kind === 'delete'} title={act ? (act.kind === 'execute' ? (act.r.kind === 'delete' ? 'Delete personal data' : 'Export personal data') : act.kind === 'rejected' ? 'Reject request' : 'Start working on request') : ''} onClose={() => setAct(null)} onSubmit={async (note) => {
        if (act.kind === 'execute') {
          const r = await api(`/api/admin/data-requests/${act.r._id}/execute`, { method: 'POST', body: { note } });
          if (r.data) {
            const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `data-export-${act.r._id}.json`;
            a.click();
          }
          toast('Request completed');
        } else {
          await api(`/api/admin/data-requests/${act.r._id}`, { method: 'POST', body: { status: act.kind, note } });
        }
        reload({ quiet: true });
      }}>
        {act?.kind === 'execute' && act.r.kind === 'delete' && <p className="text-sm muted">Name and phone are removed from the profile, sessions, complaints and notifications. Invoices are kept for the legal tax period without identity. This cannot be undone.</p>}
      </ReasonModal>
    </>
  );
}
