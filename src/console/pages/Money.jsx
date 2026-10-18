import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, download } from '../../lib/api.js';
import { useApi } from '../../lib/hooks.js';
import { dateOnly, dt, kwh, month, rs } from '../../lib/format.js';
import { ActionButton, Badge, Card, Empty, ErrorBox, Field, Loading, Modal, ReasonModal, Stat, Status, Table, Tabs, useToast } from '../../components/ui.jsx';
import { PageHeader, useConsole } from '../Console.jsx';

const blankTariff = { key: '', name: '', energyPaisePerKwh: 1800, sessionFeePaise: 0, timePaisePerMin: 0, minFeePaise: 0, idle: { paisePerMin: 0, graceMin: 15, capPaise: 0 }, tod: [], memberDiscountBps: 0, fleetDiscountBps: 0 };

function TariffForm({ value, onChange, lockKey }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const rsIn = (k, label, nested) => (
    <Field label={label}><input className="input" inputMode="decimal" value={((nested ? value.idle?.[k] : value[k]) ?? 0) / 100} onChange={(e) => {
      const p = Math.round(Number(e.target.value || 0) * 100);
      if (nested) onChange({ ...value, idle: { ...value.idle, [k]: p } });
      else set(k, p);
    }} /></Field>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Key (shared by all versions)"><input className="input font-mono" disabled={lockKey} value={value.key} onChange={(e) => set('key', e.target.value.toLowerCase())} placeholder="dc-fast" /></Field>
      <Field label="Name"><input className="input" value={value.name} onChange={(e) => set('name', e.target.value)} /></Field>
      {rsIn('energyPaisePerKwh', 'Energy ₹/kWh')}
      {rsIn('sessionFeePaise', 'Session fee ₹')}
      {rsIn('timePaisePerMin', 'Time ₹/min (DC, optional)')}
      {rsIn('minFeePaise', 'Minimum fee ₹')}
      {rsIn('paisePerMin', 'Idle fee ₹/min', true)}
      <Field label="Idle grace (min)"><input className="input" inputMode="numeric" value={value.idle?.graceMin ?? 15} onChange={(e) => onChange({ ...value, idle: { ...value.idle, graceMin: Number(e.target.value || 0) } })} /></Field>
      {rsIn('capPaise', 'Idle fee cap ₹', true)}
      <Field label="Fleet discount %"><input className="input" inputMode="decimal" value={(value.fleetDiscountBps || 0) / 100} onChange={(e) => set('fleetDiscountBps', Math.round(Number(e.target.value || 0) * 100))} /></Field>
      <div className="sm:col-span-2">
        <div className="label">Time-of-day bands (IST)</div>
        {(value.tod || []).map((b, i) => (
          <div key={i} className="mb-2 grid grid-cols-4 gap-2">
            <input className="input" value={b.startHour} onChange={(e) => set('tod', value.tod.map((x, j) => (j === i ? { ...x, startHour: Number(e.target.value) } : x)))} aria-label="From hour" />
            <input className="input" value={b.endHour} onChange={(e) => set('tod', value.tod.map((x, j) => (j === i ? { ...x, endHour: Number(e.target.value) } : x)))} aria-label="To hour" />
            <input className="input" value={b.energyPaisePerKwh / 100} onChange={(e) => set('tod', value.tod.map((x, j) => (j === i ? { ...x, energyPaisePerKwh: Math.round(Number(e.target.value) * 100) } : x)))} aria-label="₹/kWh" />
            <button type="button" className="btn-ghost btn-sm" onClick={() => set('tod', value.tod.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn-ghost btn-sm" onClick={() => set('tod', [...(value.tod || []), { startHour: 18, endHour: 22, energyPaisePerKwh: value.energyPaisePerKwh + 300 }])}>+ Add band</button>
      </div>
    </div>
  );
}

export function TariffsPage() {
  const { can, isPlatform } = useConsole();
  const toast = useToast();
  const { data, error, reload } = useApi('/api/cms/tariffs');
  const [edit, setEdit] = useState(null);
  const [preview, setPreview] = useState(null);
  const [publish, setPublish] = useState(null);
  const groups = {};
  for (const t of data?.tariffs || []) (groups[`${t.tenant?.name || ''}|${t.key}`] ||= []).push(t);
  const save = async () => {
    const r = edit.baseId
      ? await api(`/api/cms/tariffs/${edit.baseId}/new-version`, { method: 'POST', body: strip(edit.form) })
      : await api('/api/cms/tariffs', { method: 'POST', body: strip(edit.form) });
    setPreview(r.preview);
    setEdit(null);
    reload({ quiet: true });
    toast(`Draft v${r.tariff.version} created — review the preview and publish`);
  };
  return (
    <>
      <PageHeader title="Tariffs" sub="Versioned: a session always uses the version active when it started">
        {can('tariff.manage') && !isPlatform && <button type="button" className="btn-primary" onClick={() => setEdit({ form: { ...blankTariff } })}>New tariff</button>}
      </PageHeader>
      <ErrorBox error={error} />
      {!data ? <Loading /> : (
        <div className="space-y-4">
          {Object.entries(groups).map(([k, versions]) => (
            <Card key={k}>
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
                <div><span className="font-mono font-semibold">{versions[0].key}</span> · {versions[0].name}{isPlatform && <span className="text-xs muted"> · {versions[0].tenant?.name}</span>}</div>
                {can('tariff.manage') && <button type="button" className="btn-secondary btn-sm" onClick={() => setEdit({ baseId: versions[0]._id, form: { ...blankTariff, ...versions[0] } })}>New version</button>}
              </div>
              <Table rows={versions} columns={[
                { key: 'v', label: 'Version', render: (t) => `v${t.version}` },
                { key: 's', label: 'Status', render: (t) => <Status value={t.status} /> },
                { key: 'e', label: 'Energy', render: (t) => `${rs(t.energyPaisePerKwh)}/kWh` },
                { key: 'f', label: 'Fees', render: (t) => [t.sessionFeePaise && `${rs(t.sessionFeePaise)} session`, t.timePaisePerMin && `${rs(t.timePaisePerMin)}/min`, t.idle?.paisePerMin && `idle ${rs(t.idle.paisePerMin)}/min`].filter(Boolean).join(' · ') || '—' },
                { key: 'tod', label: 'ToD', render: (t) => (t.tod?.length ? t.tod.map((b) => `${b.startHour}-${b.endHour}h ${rs(b.energyPaisePerKwh)}`).join(', ') : '—') },
                { key: 'a', label: 'Active from', render: (t) => (t.status === 'draft' ? '—' : dt(t.activeFrom)) },
                { key: 'x', label: '', render: (t) => <div className="flex gap-1"><ActionButton className="btn-ghost btn-sm" onClick={async () => setPreview((await api(`/api/cms/tariffs/${t._id}/preview`)).preview)}>Preview</ActionButton>{t.status === 'draft' && can('tariff.manage') && <button type="button" className="btn-primary btn-sm" onClick={() => setPublish(t)}>Publish</button>}</div> },
              ]} />
            </Card>
          ))}
          {!Object.keys(groups).length && <Empty title="No tariffs yet" />}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.baseId ? 'New version (draft)' : 'New tariff (draft)'} wide footer={<ActionButton onClick={save}>Save draft</ActionButton>}>
        {edit && <TariffForm value={edit.form} lockKey={!!edit.baseId} onChange={(form) => setEdit({ ...edit, form })} />}
      </Modal>
      <Modal open={!!preview} onClose={() => setPreview(null)} title="Cost preview for sample sessions">
        {preview && <Table rows={preview} rowKey={(r) => r.kwh} columns={[{ key: 'k', label: 'Energy', render: (r) => `${r.kwh} kWh` }, { key: 't', label: 'Taxable', render: (r) => rs(r.taxablePaise) }, { key: 'g', label: 'GST', render: (r) => rs(r.gstPaise) }, { key: 'x', label: 'Driver pays', render: (r) => <b>{rs(r.totalPaise)}</b> }]} />}
      </Modal>
      <ReasonModal open={!!publish} title={`Publish ${publish?.key} v${publish?.version}`} submitLabel="Publish" onClose={() => setPublish(null)} onSubmit={async (reason) => { await api(`/api/cms/tariffs/${publish._id}/publish`, { method: 'POST', body: { reason } }); reload({ quiet: true }); }}>
        <p className="text-sm muted">New sessions use this price immediately; running sessions keep their version.</p>
      </ReasonModal>
    </>
  );
}

function strip(t) {
  const { _id, tenant, version, status, createdAt, updatedAt, publishedAt, publishReason, activeFrom, createdBy, __v, currency, ...rest } = t;
  rest.tod = (rest.tod || []).map(({ _id: x, ...b }) => b);
  if (!rest.roamingEnergyPaisePerKwh) delete rest.roamingEnergyPaisePerKwh;
  return rest;
}

export function FinancePage() {
  const { can } = useConsole();
  const toast = useToast();
  const [tab, setTab] = useState('summary');
  const [days, setDays] = useState(30);
  const sum = useApi(`/api/cms/finance/summary?days=${days}`);
  const payouts = useApi(tab === 'payouts' ? '/api/cms/finance/payouts' : null);
  const invoices = useApi(tab === 'invoices' ? '/api/cms/invoices' : null);
  const refunds = useApi(tab === 'refunds' ? '/api/cms/refunds?status=failed,finance_queue,pending,processing' : null);
  const gst = useApi(tab === 'gst' ? '/api/cms/finance/gst' : null);
  const recon = useApi(tab === 'recon' ? '/api/cms/finance/reconciliation' : null);
  const [gstin, setGstin] = useState(null);
  const [gstinVal, setGstinVal] = useState('');
  const [payout, setPayout] = useState(null);
  const t = sum.data?.total;
  return (
    <>
      <PageHeader title="Finance" sub="Revenue, payouts, invoices, refunds, GST and reconciliation">
        {tab === 'summary' && <select className="input min-h-[36px] w-auto py-1 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select>}
      </PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'summary', label: 'Revenue' }, { value: 'payouts', label: 'Payouts' }, { value: 'invoices', label: 'Invoices' }, { value: 'refunds', label: 'Refund queue' }, { value: 'gst', label: 'GST report' }, { value: 'recon', label: 'Reconciliation' }]} />
      <div className="mt-4">
        {tab === 'summary' && (!sum.data ? <Loading /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat label="Revenue" value={rs(t.revenuePaise, { decimals: 0 })} sub={`${t.sessions} sessions`} icon="money" />
              <Stat label="GST collected" value={rs(t.gstPaise, { decimals: 0 })} />
              <Stat label="Platform commission" value={rs(t.commissionPaise, { decimals: 0 })} />
              <Stat label="Your share" value={rs(t.tenantSharePaise, { decimals: 0 })} />
              <Stat label="Energy" value={kwh(t.energyWh, 0)} />
            </div>
            <Card className="p-4">
              <div className="mb-2 text-sm font-semibold">Daily revenue (₹)</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={sum.data.days.map((d) => ({ day: d._id.slice(5), revenue: d.revenuePaise / 100, sessions: d.sessions }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => (n === 'revenue' ? `₹${v.toFixed(2)}` : v)} />
                    <Bar dataKey="revenue" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4 text-sm"><div className="mb-1 font-semibold">Refunds in period</div>{sum.data.refunds.map((r) => <span key={r._id} className="mr-4"><Status value={r._id} /> {r.n} · {rs(r.amountPaise)}</span>)}{!sum.data.refunds.length && <span className="muted">None</span>}</Card>
          </div>
        ))}
        {tab === 'payouts' && <Card>{!payouts.data ? <Loading /> : <Table rows={payouts.data.payouts} onRow={async (p) => setPayout((await api(`/api/cms/finance/payouts/${p._id}`)).payout)} columns={[
          { key: 'p', label: 'Period', render: (p) => `${dateOnly(p.periodStart)} – ${dateOnly(p.periodEnd)}` },
          { key: 't', label: 'Tenant', render: (p) => p.tenant?.name },
          { key: 'n', label: 'Sessions', render: (p) => p.sessionCount },
          { key: 'g', label: 'Gross', render: (p) => rs(p.grossPaise) },
          { key: 'c', label: 'Commission + GST', render: (p) => rs(p.commissionPaise + p.gstOnCommissionPaise) },
          { key: 'a', label: 'Adjustments', render: (p) => rs(p.adjustmentsPaise) },
          { key: 'x', label: 'Net payout', render: (p) => <b>{rs(p.netPaise)}</b> },
          { key: 's', label: 'Status', render: (p) => <Status value={p.status} /> },
        ]} empty="No payouts yet. Payouts run daily after the settlement delay (T+2 by default)." />}</Card>}
        {tab === 'invoices' && <Card>{!invoices.data ? <Loading /> : <Table rows={invoices.data.invoices} columns={[
          { key: 'n', label: 'Number', render: (i) => <span className="font-mono">{i.number || '(pending)'}</span> },
          { key: 'k', label: 'Kind', render: (i) => <Badge>{i.kind}</Badge> },
          { key: 'b', label: 'Buyer', render: (i) => `${i.buyer?.name || ''}${i.buyer?.gstin ? ` · ${i.buyer.gstin}` : ''}` },
          { key: 't', label: 'Total', render: (i) => rs(i.totalPaise) },
          { key: 's', label: 'Status', render: (i) => <Status value={i.status} /> },
          { key: 'd', label: 'Date', render: (i) => dateOnly(i.issuedAt || i.createdAt) },
          { key: 'a', label: '', render: (i) => i.status === 'issued' && <div className="flex gap-1"><ActionButton className="btn-ghost btn-sm" onClick={() => download(`/api/cms/invoices/${i._id}/pdf`, `${i.number.replace(/\//g, '-')}.pdf`)}>PDF</ActionButton>{i.kind === 'driver' && can('invoice.manage') && <button type="button" className="btn-ghost btn-sm" onClick={() => { setGstin(i); setGstinVal(i.buyer?.gstin || ''); }}>Correct GSTIN</button>}</div> },
        ]} />}</Card>}
        {tab === 'refunds' && <Card>{!refunds.data ? <Loading /> : <Table rows={refunds.data.refunds} empty="No refunds waiting" columns={[
          { key: 'a', label: 'Amount', render: (r) => rs(r.amountPaise) },
          { key: 'r', label: 'Reason', render: (r) => r.reasonCode },
          { key: 's', label: 'Status', render: (r) => <Status value={r.status} /> },
          { key: 'n', label: 'Attempts', render: (r) => r.attempts },
          { key: 'e', label: 'Last error', render: (r) => <span className="text-xs text-red-600">{r.lastError}</span> },
          { key: 'g', label: 'Ageing', render: (r) => `${r.ageingHours} h` },
          { key: 'x', label: '', render: (r) => ['failed', 'finance_queue'].includes(r.status) && <ActionButton className="btn-secondary btn-sm" onClick={async () => { const x = await api(`/api/cms/refunds/${r._id}/retry`, { method: 'POST' }); toast(`Refund ${x.refund.status}`); refunds.reload({ quiet: true }); }}>Retry</ActionButton> },
        ]} />}</Card>}
        {tab === 'gst' && <Card>{!gst.data ? <Loading /> : <Table rows={gst.data.months} rowKey={(m) => m._id} columns={[
          { key: 'm', label: 'Month', render: (m) => month(m._id) }, { key: 'i', label: 'Invoices', render: (m) => m.invoices }, { key: 't', label: 'Taxable value', render: (m) => rs(m.taxablePaise) }, { key: 'g', label: 'GST', render: (m) => rs(m.gstPaise) }, { key: 'x', label: 'Total', render: (m) => rs(m.totalPaise) },
        ]} />}</Card>}
        {tab === 'recon' && <Card>{!recon.data ? <Loading /> : <Table rows={recon.data.runs} empty="No reconciliation runs yet (daily)" columns={[
          { key: 'd', label: 'Date', render: (r) => r.date }, { key: 's', label: 'Status', render: (r) => <Status value={r.status} /> },
          { key: 'p', label: 'Payments', render: (r) => `${r.totals?.payments} · ${rs(r.totals?.paidPaise)}` }, { key: 'b', label: 'Billed', render: (r) => rs(r.totals?.billedPaise) }, { key: 'rf', label: 'Refunded', render: (r) => rs(r.totals?.refundedPaise) },
          { key: 'm', label: 'Mismatches', render: (r) => (r.mismatches.length ? <div className="space-y-0.5 text-xs">{r.mismatches.slice(0, 5).map((m, i) => <div key={i}><Badge tone="red">{m.kind}</Badge> {m.ref} {m.detail}</div>)}</div> : '—') },
        ]} />}</Card>}
      </div>
      <Modal open={!!gstin} onClose={() => setGstin(null)} title={`Correct GSTIN · ${gstin?.number}`} footer={<ActionButton onClick={async () => { const r = await api(`/api/cms/invoices/${gstin._id}/correct-gstin`, { method: 'POST', body: { gstin: gstinVal, reason: 'GSTIN correction' } }); toast(`Credit note ${r.creditNote.number} + new invoice ${r.invoice.number}`); setGstin(null); invoices.reload({ quiet: true }); }}>Issue credit note + new invoice</ActionButton>}>
        <Field label="Correct GSTIN" hint="Invoices are never edited: we issue a credit note against the original and a new invoice."><input className="input uppercase" value={gstinVal} onChange={(e) => setGstinVal(e.target.value.toUpperCase())} /></Field>
      </Modal>
      <Modal open={!!payout} onClose={() => setPayout(null)} title="Payout statement" wide>
        {payout && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Gross" value={rs(payout.grossPaise)} /><Stat label="Commission" value={rs(payout.commissionPaise)} /><Stat label="GST on commission" value={rs(payout.gstOnCommissionPaise)} /><Stat label="Net" value={rs(payout.netPaise)} />
            </div>
            <Table rows={payout.lines} rowKey={(l) => l.session} columns={[{ key: 's', label: 'Session', render: (l) => <span className="font-mono text-xs">{String(l.session).slice(-8)}</span> }, { key: 't', label: 'Billed', render: (l) => rs(l.totalPaise) }, { key: 'c', label: 'Commission', render: (l) => rs(l.commissionPaise) }, { key: 'x', label: 'Your share', render: (l) => rs(l.tenantSharePaise) }]} />
          </div>
        )}
      </Modal>
    </>
  );
}

export function PromosPage() {
  const { data, error, reload } = useApi('/api/cms/promos');
  const [f, setF] = useState({ code: '', kind: 'percent', value: 10, perUserLimit: 1 });
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader title="Promo codes" sub="Limits per user, budget caps and expiry"><button type="button" className="btn-primary" onClick={() => setOpen(true)}>New promo</button></PageHeader>
      <ErrorBox error={error} />
      <Card>{!data ? <Loading /> : <Table rows={data.promos} columns={[
        { key: 'c', label: 'Code', render: (p) => <span className="font-mono font-semibold">{p.code}</span> },
        { key: 'v', label: 'Value', render: (p) => (p.kind === 'percent' ? `${p.value / 100}%` : rs(p.value)) },
        { key: 'u', label: 'Used', render: (p) => `${p.uses?.length || 0} · ${rs(p.usedPaise)}${p.budgetPaise ? ` of ${rs(p.budgetPaise)}` : ''}` },
        { key: 'e', label: 'Expires', render: (p) => dateOnly(p.expiresAt) },
        { key: 'a', label: 'Active', render: (p) => <ActionButton className="btn-ghost btn-sm" onClick={async () => { await api(`/api/cms/promos/${p._id}`, { method: 'PATCH', body: { active: !p.active } }); reload({ quiet: true }); }}>{p.active ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}</ActionButton> },
      ]} />}</Card>
      <Modal open={open} onClose={() => setOpen(false)} title="New promo code" footer={<ActionButton onClick={async () => { await api('/api/cms/promos', { method: 'POST', body: { ...f, value: f.kind === 'percent' ? Math.round(f.value * 100) : Math.round(f.value * 100), budgetPaise: f.budget ? Math.round(f.budget * 100) : undefined, budget: undefined } }); setOpen(false); reload(); }}>Create</ActionButton>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code"><input className="input uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Type"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="percent">Percent</option><option value="flat">Flat ₹</option></select></Field>
          <Field label={f.kind === 'percent' ? 'Percent' : 'Amount ₹'}><input className="input" value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} /></Field>
          <Field label="Uses per user"><input className="input" value={f.perUserLimit} onChange={(e) => setF({ ...f, perUserLimit: Number(e.target.value) })} /></Field>
          <Field label="Budget cap ₹"><input className="input" value={f.budget || ''} onChange={(e) => setF({ ...f, budget: Number(e.target.value) })} /></Field>
          <Field label="Expires"><input className="input" type="date" onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  );
}
