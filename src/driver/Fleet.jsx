import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, download, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { dt, kwh, rs } from '../lib/format.js';
import { ActionButton, Card, Empty, ErrorBox, Field, Loading, Stat, Table } from '../components/ui.jsx';

export default function FleetPage() {
  const logged = !!tokens.driver();
  const { data, loading, reload } = useApi(logged ? '/api/me/fleet' : null, { auth: 'driver' });
  const [name, setName] = useState('');
  const [drv, setDrv] = useState({ phone: '', limit: '' });
  const [err, setErr] = useState(null);
  if (!logged) return <div className="p-4"><Empty icon="users" title="Fleet">Log in to create or join a fleet. <Link className="font-semibold text-brand-700" to="/login?next=/fleet">Log in</Link></Empty></div>;
  if (loading) return <Loading />;
  if (!data?.fleet) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-xl font-bold">Create a fleet account</h1>
        <p className="text-sm muted">Add your drivers and vehicles, set spending limits, and get one GST invoice a month.</p>
        <Card className="space-y-3 p-4">
          <Field label="Company name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <ErrorBox error={err} />
          <ActionButton disabled={name.length < 2} className="btn-primary w-full" onClick={async () => { try { await api('/api/me/fleet', { method: 'POST', auth: 'driver', body: { name } }); reload(); } catch (e) { setErr(e); } }}>Create fleet</ActionButton>
        </Card>
      </div>
    );
  }
  const f = data.fleet;
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">{f.name}</h1>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="This month" value={rs(data.month?.totalPaise, { decimals: 0 })} sub={`${data.month?.sessions || 0} sessions`} />
        <Stat label="Outstanding" value={rs(f.outstandingPaise, { decimals: 0 })} />
        <Stat label="Credit limit" value={rs(f.creditLimitPaise, { decimals: 0 })} />
      </div>
      {data.isManager ? (
        <>
          <Card className="p-4">
            <div className="mb-2 font-semibold">Drivers</div>
            <Table rows={f.drivers} rowKey={(d) => d.user?._id} columns={[
              { key: 'n', label: 'Driver', render: (d) => d.user?.name || d.user?.phone },
              { key: 'l', label: 'Monthly limit', render: (d) => (d.spendLimitPaise ? rs(d.spendLimitPaise, { decimals: 0 }) : 'No limit') },
              { key: 's', label: 'Spent', render: (d) => rs(d.monthSpentPaise || 0, { decimals: 0 }) },
              { key: 'a', label: '', render: (d) => <ActionButton className="btn-ghost btn-sm" onClick={async () => { await api(`/api/me/fleet/drivers/${d.user._id}`, { method: 'PATCH', auth: 'driver', body: { active: !d.active } }); reload({ quiet: true }); }}>{d.active ? 'Pause' : 'Resume'}</ActionButton> },
            ]} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <input className="input col-span-2" placeholder="Driver phone" value={drv.phone} onChange={(e) => setDrv({ ...drv, phone: e.target.value })} />
              <input className="input" placeholder="Limit ₹" inputMode="numeric" value={drv.limit} onChange={(e) => setDrv({ ...drv, limit: e.target.value })} />
            </div>
            <ActionButton className="btn-primary mt-2 w-full" onClick={async () => { await api('/api/me/fleet/drivers', { method: 'POST', auth: 'driver', body: { phone: drv.phone, spendLimitPaise: drv.limit ? Number(drv.limit) * 100 : undefined } }); setDrv({ phone: '', limit: '' }); reload({ quiet: true }); }}>Add driver</ActionButton>
          </Card>
          <FleetInvoices />
          <Card className="p-4">
            <div className="mb-2 font-semibold">Recent sessions</div>
            <Table rows={data.recent} columns={[{ key: 'd', label: 'Driver', render: (r) => r.driver }, { key: 'e', label: 'Energy', render: (r) => kwh(r.energyWh) }, { key: 't', label: 'Amount', render: (r) => rs(r.totalPaise) }, { key: 'w', label: 'When', render: (r) => dt(r.endedAt) }]} />
          </Card>
        </>
      ) : (
        <Card className="p-4 text-sm">You charge on the fleet account: choose "Fleet account" when you start. The bill goes to {f.name}.</Card>
      )}
    </div>
  );
}

function FleetInvoices() {
  const { data } = useApi('/api/me/fleet/invoices', { auth: 'driver' });
  return (
    <Card className="p-4">
      <div className="mb-2 font-semibold">Monthly invoices</div>
      <p className="mb-2 text-xs muted">One GST invoice per operator per month, issued on the 1st.</p>
      <Table rows={data?.invoices || []} empty="No monthly invoices yet" columns={[
        { key: 'm', label: 'Month', render: (i) => i.period },
        { key: 'n', label: 'Invoice', render: (i) => <span className="font-mono text-xs">{i.number}</span> },
        { key: 's', label: 'Operator', render: (i) => i.supplier?.name },
        { key: 'l', label: 'Sessions', render: (i) => i.lines?.length },
        { key: 't', label: 'Total', render: (i) => rs(i.totalPaise) },
        { key: 'p', label: '', render: (i) => <button type="button" className="btn-ghost btn-sm" onClick={() => download(`/api/me/fleet/invoices/${i._id}/pdf`, `${i.number.replace(/\//g, '-')}.pdf`, { auth: 'driver' })}>PDF</button> },
      ]} />
    </Card>
  );
}
