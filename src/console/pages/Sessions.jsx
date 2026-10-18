import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, download } from '../../lib/api.js';
import { useApi, useInterval } from '../../lib/hooks.js';
import { dt, duration, kwh, rs, titleCase } from '../../lib/format.js';
import { ActionButton, Badge, Card, ErrorBox, Field, Loading, Modal, ReasonModal, Status, Table, Tabs, useToast } from '../../components/ui.jsx';
import { PageHeader, useConsole } from '../Console.jsx';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function SessionsPage() {
  const nav = useNavigate();
  const { isPlatform } = useConsole();
  const [tab, setTab] = useState('all');
  const [phone, setPhone] = useState('');
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page, limit: 50 });
  if (tab === 'active') qs.set('active', 'true');
  if (tab === 'review') qs.set('review', 'true');
  if (tab === 'failed') qs.set('state', 'FAILED,CANCELLED');
  if (phone.length >= 4) qs.set('phone', phone);
  const { data, error, reload } = useApi(`/api/cms/sessions?${qs}`);
  useInterval(() => tab === 'active' && reload({ quiet: true }), 8000);
  return (
    <>
      <PageHeader title="Sessions" sub="Live and past sessions; review queue for flagged ones">
        <input className="input min-h-[36px] w-44 py-1 text-sm" placeholder="Search phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
      </PageHeader>
      <Tabs value={tab} onChange={(v) => { setTab(v); setPage(1); }} tabs={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Live' }, { value: 'review', label: 'Review queue' }, { value: 'failed', label: 'Failed' }]} />
      <ErrorBox error={error} />
      <Card className="mt-3">
        {!data ? <Loading /> : (
          <>
            <Table rows={data.sessions} onRow={(s) => nav(`/console/sessions/${s.id}`)} columns={[
              { key: 'w', label: 'Started', render: (s) => dt(s.createdAt) },
              ...(isPlatform ? [{ key: 't', label: 'Tenant', render: (s) => s.tenant }] : []),
              { key: 'c', label: 'Charger', render: (s) => <span className="font-mono">{s.ocppId}#{s.connector}</span> },
              { key: 'd', label: 'Driver', render: (s) => s.driver },
              { key: 'ch', label: 'Channel', render: (s) => <Badge>{s.channel}</Badge> },
              { key: 's', label: 'State', render: (s) => <div className="flex items-center gap-1"><Status value={s.state} />{s.reviewNeeded && <Badge tone="amber">review</Badge>}</div> },
              { key: 'e', label: 'Energy', render: (s) => kwh(s.energyWh) },
              { key: 'a', label: 'Amount', render: (s) => (s.totalPaise !== undefined && s.totalPaise !== null && s.state === 'BILLED' ? rs(s.totalPaise) : s.liveCostPaise !== undefined ? `${rs(s.liveCostPaise)} live` : rs(s.prepaidPaise)) },
              { key: 'r', label: 'Refund', render: (s) => (s.refundPaise ? rs(s.refundPaise) : '—') },
              { key: 'f', label: 'Reason', render: (s) => <span className="text-xs muted">{s.failureReason ? titleCase(s.failureReason) : (s.flags || []).join(', ')}</span> },
            ]} />
            <div className="flex items-center justify-between border-t border-ink-100 p-3 text-sm dark:border-ink-800">
              <span className="muted">{data.total} sessions</span>
              <div className="flex gap-2"><button type="button" className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button><button type="button" className="btn-secondary btn-sm" disabled={page * 50 >= data.total} onClick={() => setPage(page + 1)}>Next</button></div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

export function SessionDetailPage() {
  const { id } = useParams();
  const { can } = useConsole();
  const toast = useToast();
  const { data, error, reload } = useApi(`/api/cms/sessions/${id}`);
  const [modal, setModal] = useState(null);
  const [amount, setAmount] = useState('');
  const [finalWh, setFinalWh] = useState('');
  const [note, setNote] = useState('');
  const [asDriver, setAsDriver] = useState(null);
  useInterval(() => data && ['CHARGING', 'STARTING', 'STOPPING', 'INTERRUPTED', 'PAID'].includes(data.session.state) && reload({ quiet: true }), 5000);
  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  const s = data.session;
  const open = ['CHARGING', 'STOPPING', 'INTERRUPTED', 'STARTING'].includes(s.state);
  const pay = data.payments.find((p) => p.status === 'captured');
  const refundable = pay ? (pay.paidPaise ?? pay.amountPaise) - (pay.refundedPaise || 0) : 0;
  return (
    <>
      <PageHeader title={`Session ${String(s._id).slice(-8).toUpperCase()}`} sub={`${s.charger?.ocppId}#${s.connectorNumber} · ${s.site?.name || ''} · ${s.channel} · ${dt(s.createdAt)}`}>
        <Status value={s.state} />
        {s.reviewNeeded && <Badge tone="amber">Review needed</Badge>}
        {can('session.view_as_driver') && <ActionButton className="btn-secondary btn-sm" onClick={async () => setAsDriver(await api(`/api/cms/sessions/${id}/as-driver`))}>View as driver</ActionButton>}
        {open && can('session.remote') && <button type="button" className="btn-secondary btn-sm" onClick={() => setModal('stop')}>Remote stop</button>}
        {open && can('session.force_close') && <button type="button" className="btn-secondary btn-sm" onClick={() => setModal('force')}>Force close</button>}
        {pay && refundable > 0 && can('session.refund') && <button type="button" className="btn-primary btn-sm" onClick={() => setModal('refund')}>Refund</button>}
      </PageHeader>
      {s.flags?.length > 0 && <div className="mb-3 flex flex-wrap gap-1">{s.flags.map((f) => <Badge key={f} tone="amber">{f}</Badge>)}</div>}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-2 p-4 text-sm xl:col-span-1">
          <div className="font-semibold">Driver</div>
          <div>{s.driver ? `${s.driver.name || 'Driver'} · ${s.driver.phone}` : `Guest · ${s.guestPhone || '—'}`}</div>
          <div className="pt-2 font-semibold">Energy & time</div>
          <div>{kwh(s.energyWh, 3)} · {duration(s.startedAt, s.endedAt || Date.now())}</div>
          <div className="text-xs muted">Meter start {s.meter?.startWh ?? '—'} Wh · last {s.meter?.lastWh ?? '—'} Wh at {dt(s.meter?.lastAt)}{s.rejectedReadings ? ` · ${s.rejectedReadings} rejected readings` : ''}</div>
          <div className="text-xs muted">Tariff {s.tariff?.name} v{s.tariff?.version} · {rs(s.tariff?.energyPaisePerKwh)}/kWh</div>
          <div className="text-xs muted">Transaction {s.transactionId || '—'} · stop reason {s.stopReason || '—'}{s.failureReason ? ` · failure ${s.failureReason}` : ''}</div>
          {s.chargerTime?.startedAt && <div className="text-xs muted">Charger clock: started {dt(s.chargerTime.startedAt)}</div>}
        </Card>
        <Card className="p-4 xl:col-span-2">
          <div className="mb-2 font-semibold">Bill {open ? '(live)' : ''}</div>
          <Table rows={data.bill.lines} empty="No energy delivered — nothing charged" columns={[
            { key: 'd', label: 'Line', render: (l) => l.description },
            { key: 't', label: 'Taxable', render: (l) => rs(l.taxablePaise) },
            { key: 'g', label: 'GST', render: (l) => rs(l.gstPaise) },
            { key: 'x', label: 'Total', render: (l) => rs(l.totalPaise) },
          ]} />
          <div className="mt-2 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
            <span>Prepaid <b>{rs(s.prepaidPaise)}</b></span><span>Total <b>{rs(data.bill.totalPaise)}</b></span>{data.bill.absorbedPaise > 0 && <span className="text-amber-600">Absorbed overrun {rs(data.bill.absorbedPaise)}</span>}<span>Refund <b>{rs(s.refundPaise)}</b></span><span>Commission {rs(s.commissionPaise)}</span>
          </div>
          {data.invoice && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              Invoice <b>{data.invoice.number || '(pending)'}</b> <Status value={data.invoice.status} />
              {data.invoice.status === 'issued' && <ActionButton className="btn-ghost btn-sm" onClick={() => download(`/api/cms/invoices/${data.invoice._id}/pdf`, `${data.invoice.number.replace(/\//g, '-')}.pdf`)}>PDF</ActionButton>}
              <ActionButton className="btn-ghost btn-sm" success="Invoice re-sent" onClick={() => api(`/api/cms/sessions/${id}/resend-invoice`, { method: 'POST' })}>Re-send</ActionButton>
            </div>
          )}
        </Card>
        <Card className="xl:col-span-2">
          <div className="border-b border-ink-100 px-4 py-3 font-semibold dark:border-ink-800">Money</div>
          <Table rows={[...data.payments.map((p) => ({ ...p, kind: 'payment' })), ...data.refunds.map((r) => ({ ...r, kind: 'refund' }))]} columns={[
            { key: 'k', label: 'Type', render: (r) => (r.kind === 'payment' ? `Payment (${r.method || r.provider})` : `Refund · ${r.reasonCode || r.kind}`) },
            { key: 'a', label: 'Amount', render: (r) => rs(r.kind === 'payment' ? r.paidPaise ?? r.amountPaise : r.amountPaise) },
            { key: 's', label: 'Status', render: (r) => <Status value={r.status} /> },
            { key: 'i', label: 'Reference', render: (r) => <span className="font-mono text-xs">{r.orderId || r.gatewayRefundId || '—'}</span> },
            { key: 'w', label: 'When', render: (r) => dt(r.createdAt) },
          ]} />
        </Card>
        <Card className="p-4">
          <div className="mb-2 font-semibold">Timeline</div>
          <ol className="space-y-1 text-xs">{s.history.map((h, i) => <li key={i} className="flex justify-between gap-2"><span><Status value={h.state} /> {h.note}</span><span className="muted">{new Date(h.at).toLocaleTimeString()}</span></li>)}</ol>
          <div className="mt-3 border-t border-ink-100 pt-3 dark:border-ink-800">
            <div className="mb-1 text-sm font-semibold">Notes</div>
            {s.notes?.map((n, i) => <div key={i} className="mb-1 rounded-lg bg-ink-50 p-2 text-xs dark:bg-ink-800">{n.text}<span className="block muted">{dt(n.at)}</span></div>)}
            <div className="flex gap-2"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" /><ActionButton className="btn-secondary" disabled={!note} onClick={async () => { await api(`/api/cms/sessions/${id}/notes`, { method: 'POST', body: { text: note, resolveReview: s.reviewNeeded } }); setNote(''); reload({ quiet: true }); }}>Add</ActionButton></div>
            {s.reviewNeeded && <div className="mt-1 text-xs muted">Adding a note clears the review flag.</div>}
          </div>
        </Card>
      </div>
      {s.meterPoints?.length > 1 && (
        <Card className="mt-4 p-4">
          <div className="mb-2 font-semibold">Meter graph</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={s.meterPoints.map((p) => ({ t: new Date(p.t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), kWh: Math.round(p.wh) / 1000, kW: p.w !== undefined && p.w !== null ? Math.round(p.w / 100) / 10 : null }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} minTickGap={30} />
                <YAxis yAxisId="e" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="p" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line yAxisId="e" type="monotone" dataKey="kWh" stroke="rgb(var(--brand-600))" strokeWidth={2} dot={false} />
                <Line yAxisId="p" type="stepAfter" dataKey="kW" stroke="#0ea5e9" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs muted">Energy (kWh, left) and power (kW, right) from the charger's meter values.</div>
        </Card>
      )}
      {data.complaints.length > 0 && <Card className="mt-4 p-4 text-sm"><div className="mb-1 font-semibold">Complaints</div>{data.complaints.map((c) => <div key={c._id}>{titleCase(c.category)} · <Status value={c.status} /> · {c.description}</div>)}</Card>}

      <ReasonModal open={modal === 'stop'} title="Remote stop" onClose={() => setModal(null)} onSubmit={async (reason) => { const r = await api(`/api/cms/sessions/${id}/stop`, { method: 'POST', body: { reason } }); toast(r.message || 'Stop sent'); reload({ quiet: true }); }} />
      <ReasonModal open={modal === 'refund'} title="Refund" submitLabel="Refund" onClose={() => setModal(null)} onSubmit={async (reason) => {
        const r = await api(`/api/cms/sessions/${id}/refund`, { method: 'POST', body: { amountPaise: Math.round(Number(amount) * 100), reason } });
        toast(r.status === 'PendingApproval' ? 'Above your limit — sent for approval' : 'Refund initiated', r.status === 'PendingApproval' ? 'amber' : 'green');
        reload({ quiet: true });
      }}>
        <Field label={`Amount (₹) — refundable now ${rs(refundable)}`} hint="Refunds above your role's limit go to a second person for approval."><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      </ReasonModal>
      <ReasonModal open={modal === 'force'} title="Force-close session" danger onClose={() => setModal(null)} onSubmit={async (reason) => {
        const r = await api(`/api/cms/sessions/${id}/force-close`, { method: 'POST', body: { reason, finalWh: finalWh ? Number(finalWh) : undefined } });
        toast(r.status === 'PendingApproval' ? 'Sent for approval (amount above limit)' : 'Session closed', r.status === 'PendingApproval' ? 'amber' : 'green');
        reload({ quiet: true });
      }}>
        <Field label="Final meter reading (Wh, optional)" hint={`Last reading ${s.meter?.lastWh ?? '—'} Wh. Leave empty to bill on the last reading.`}><input className="input" inputMode="numeric" value={finalWh} onChange={(e) => setFinalWh(e.target.value)} /></Field>
      </ReasonModal>
      <Modal open={!!asDriver} onClose={() => setAsDriver(null)} title="What the driver sees (read-only, logged)">
        {asDriver && <div className="space-y-2 text-sm"><Status value={asDriver.state} /><p className="rounded-xl bg-brand-50 p-3 dark:bg-brand-950">{asDriver.message || '—'}</p><div>Energy {kwh(asDriver.energyWh)} · cost {rs(asDriver.liveCostPaise ?? asDriver.costs?.totalPaise)} · refund {rs(asDriver.refundPaise)}</div><div className="text-xs muted">Steps: {asDriver.steps.slice(0, asDriver.step + 1).join(' → ')}</div></div>}
      </Modal>
    </>
  );
}

export function CustomersPage() {
  const { can } = useConsole();
  const { data, error, reload } = useApi('/api/cms/customers');
  const [block, setBlock] = useState(null);
  return (
    <>
      <PageHeader title="Customers" sub="Drivers who charged with you. Phone numbers are masked unless your role needs them." />
      <ErrorBox error={error} />
      <Card>{!data ? <Loading /> : <Table rows={data.customers} rowKey={(c, i) => c.userId || i} columns={[
        { key: 'n', label: 'Driver', render: (c) => <div><div className="font-medium">{c.name}</div><div className="text-xs muted">{c.phone}</div></div> },
        { key: 's', label: 'Status', render: (c) => <Status value={c.status === 'guest' ? 'draft' : c.status} label={c.status} /> },
        { key: 'n2', label: 'Sessions', render: (c) => c.sessions },
        { key: 'e', label: 'Energy', render: (c) => kwh(c.energyWh, 1) },
        { key: 'm', label: 'Spent', render: (c) => rs(c.spentPaise) },
        { key: 'l', label: 'Last', render: (c) => dt(c.lastAt) },
        { key: 'a', label: '', render: (c) => c.userId && can('customer.block') && <button type="button" className="btn-ghost btn-sm" onClick={() => setBlock(c)}>{c.status === 'blocked' ? 'Unblock' : 'Block'}</button> },
      ]} />}</Card>
      <ReasonModal open={!!block} danger={block?.status !== 'blocked'} title={`${block?.status === 'blocked' ? 'Unblock' : 'Block'} ${block?.name}`} onClose={() => setBlock(null)} onSubmit={async (reason) => { await api(`/api/cms/customers/${block.userId}/block`, { method: 'POST', body: { blocked: block.status !== 'blocked', reason } }); reload({ quiet: true }); }} />
    </>
  );
}

export function ComplaintsPage() {
  const { can } = useConsole();
  const [status, setStatus] = useState('open,in_progress');
  const { data, error, reload } = useApi(`/api/cms/complaints?status=${status}`);
  const [sel, setSel] = useState(null);
  const [f, setF] = useState({});
  return (
    <>
      <PageHeader title="Complaints" sub="Session-linked, with SLA timers">
        <select className="input min-h-[36px] w-auto py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="open,in_progress">Open</option><option value="resolved,closed">Resolved</option><option value="open,in_progress,resolved,closed">All</option></select>
      </PageHeader>
      <ErrorBox error={error} />
      <Card>{!data ? <Loading /> : <Table rows={data.complaints} onRow={(c) => { setSel(c); setF({ status: c.status }); }} columns={[
        { key: 'w', label: 'Raised', render: (c) => dt(c.createdAt) },
        { key: 'c', label: 'Category', render: (c) => titleCase(c.category) },
        { key: 'd', label: 'Driver', render: (c) => c.phone },
        { key: 'ch', label: 'Charger', render: (c) => c.charger?.ocppId },
        { key: 's', label: 'Status', render: (c) => <Status value={c.status} /> },
        { key: 'sla', label: 'SLA', render: (c) => (['resolved', 'closed'].includes(c.status) ? '—' : c.slaRemainingMin < 0 ? <Badge tone="red">Breached {Math.abs(Math.round(c.slaRemainingMin / 60))}h</Badge> : <Badge tone={c.slaRemainingMin < 120 ? 'amber' : 'gray'}>{Math.round(c.slaRemainingMin / 60)}h left</Badge>) },
      ]} />}</Card>
      <Modal open={!!sel} onClose={() => setSel(null)} title="Complaint" footer={can('complaint.manage') && <ActionButton onClick={async () => { await api(`/api/cms/complaints/${sel._id}`, { method: 'PATCH', body: f }); setSel(null); reload(); }}>Save</ActionButton>}>
        {sel && (
          <div className="space-y-3 text-sm">
            <div><b>{titleCase(sel.category)}</b> · {sel.description || 'No description'}</div>
            {sel.session && <Link className="font-semibold text-brand-700" to={`/console/sessions/${sel.session}`}>Open session (refund from there) →</Link>}
            {sel.notes?.map((n, i) => <div key={i} className="rounded-lg bg-ink-50 p-2 text-xs dark:bg-ink-800">{n.text} · {dt(n.at)}</div>)}
            <Field label="Status"><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></Field>
            <Field label="Add note"><input className="input" value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
            <Field label="Resolution"><input className="input" value={f.resolution ?? sel.resolution ?? ''} onChange={(e) => setF({ ...f, resolution: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
