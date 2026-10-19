import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, download, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { tx } from '../lib/i18n.jsx';
import { dt, kwh, rs } from '../lib/format.js';
import { ActionButton, Card, Empty, ErrorBox, Field, IconBubble, Loading, Table } from '../components/ui.jsx';
import { Hero } from './HostMode.jsx';

export default function FleetPage() {
  const logged = !!tokens.driver();
  const { data, loading, reload } = useApi(logged ? '/api/me/fleet' : null, { auth: 'driver' });
  const [name, setName] = useState('');
  const [drv, setDrv] = useState({ phone: '', limit: '' });
  const [err, setErr] = useState(null);
  if (!logged) return <div className="p-4"><Card><Empty icon="users" title={tx('Fleet')}>{tx('Log in to create or join a fleet.')} <Link className="font-semibold text-brand-700" to="/login?next=/fleet">{tx('Log in')}</Link></Empty></Card></div>;
  if (loading) return <Loading />;
  if (!data?.fleet) {
    return (
      <div className="space-y-4 p-4">
        <Hero icon="users" title={tx('Create a fleet account')} sub={tx('Add your drivers and vehicles, set spending limits, and get one GST invoice a month.')} />
        <Card className="space-y-3 p-4">
          <Field label={tx('Company name')}><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <ErrorBox error={err} />
          <ActionButton disabled={name.length < 2} className="btn-electric w-full disabled:bg-none disabled:bg-ink-200 disabled:text-ink-500 disabled:shadow-none dark:disabled:bg-ink-800" onClick={async () => { try { await api('/api/me/fleet', { method: 'POST', auth: 'driver', body: { name } }); reload(); } catch (e) { setErr(e); } }}>{tx('Create fleet')}</ActionButton>
        </Card>
      </div>
    );
  }
  const f = data.fleet;
  const used = f.creditLimitPaise ? Math.min(100, Math.round((f.outstandingPaise / f.creditLimitPaise) * 100)) : 0;
  return (
    <div className="space-y-4 p-4">
      <Hero icon="users" title={f.name} sub={data.isManager ? tx('Fleet manager') : tx('Fleet driver')}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/15 p-2"><div className="text-lg font-extrabold">{rs(data.month?.totalPaise, { decimals: 0 })}</div><div className="text-[10px] text-white/80">{tx('This month')} · {data.month?.sessions || 0}</div></div>
          <div className="rounded-2xl bg-white/15 p-2"><div className="text-lg font-extrabold">{rs(f.outstandingPaise, { decimals: 0 })}</div><div className="text-[10px] text-white/80">{tx('Outstanding')}</div></div>
          <div className="rounded-2xl bg-white/15 p-2"><div className="text-lg font-extrabold">{rs(f.creditLimitPaise, { decimals: 0 })}</div><div className="text-[10px] text-white/80">{tx('Credit limit')}</div></div>
        </div>
        {f.creditLimitPaise > 0 && <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${used}%` }} /></div>}
      </Hero>
      {data.isManager ? (
        <>
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold"><IconBubble name="users" tone="violet" size="sm" />{tx('Drivers')}</div>
            <Table rows={f.drivers} rowKey={(d) => d.user?._id} columns={[
              { key: 'n', label: tx('Driver'), render: (d) => d.user?.name || d.user?.phone },
              { key: 'l', label: tx('Monthly limit'), render: (d) => (d.spendLimitPaise ? rs(d.spendLimitPaise, { decimals: 0 }) : tx('No limit')) },
              { key: 's', label: tx('Spent'), render: (d) => rs(d.monthSpentPaise || 0, { decimals: 0 }) },
              { key: 'a', label: '', render: (d) => <ActionButton className="btn-ghost btn-sm" onClick={async () => { await api(`/api/me/fleet/drivers/${d.user._id}`, { method: 'PATCH', auth: 'driver', body: { active: !d.active } }); reload({ quiet: true }); }}>{d.active ? tx('Pause') : tx('Resume')}</ActionButton> },
            ]} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <input className="input col-span-2" placeholder={tx('Driver phone')} inputMode="tel" value={drv.phone} onChange={(e) => setDrv({ ...drv, phone: e.target.value })} />
              <input className="input" placeholder={tx('Limit ₹')} inputMode="numeric" value={drv.limit} onChange={(e) => setDrv({ ...drv, limit: e.target.value })} />
            </div>
            <ActionButton className="btn-primary mt-2 w-full" onClick={async () => { await api('/api/me/fleet/drivers', { method: 'POST', auth: 'driver', body: { phone: drv.phone, spendLimitPaise: drv.limit ? Number(drv.limit) * 100 : undefined } }); setDrv({ phone: '', limit: '' }); reload({ quiet: true }); }}>{tx('Add driver')}</ActionButton>
          </Card>
          <FleetInvoices />
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold"><IconBubble name="bolt" tone="cyan" size="sm" />{tx('Recent sessions')}</div>
            <Table rows={data.recent} columns={[{ key: 'd', label: tx('Driver'), render: (r) => r.driver }, { key: 'e', label: tx('Energy'), render: (r) => kwh(r.energyWh) }, { key: 't', label: tx('Amount'), render: (r) => rs(r.totalPaise) }, { key: 'w', label: tx('When'), render: (r) => dt(r.endedAt) }]} />
          </Card>
        </>
      ) : (
        <Card className="flex items-start gap-3 p-4 text-sm"><IconBubble name="check" tone="green" size="sm" /><span>{tx('You charge on the fleet account: choose "Fleet account" when you start. The bill goes to {{name}}.', { name: f.name })}</span></Card>
      )}
    </div>
  );
}

function FleetInvoices() {
  const { data } = useApi('/api/me/fleet/invoices', { auth: 'driver' });
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-2 font-semibold"><IconBubble name="doc" tone="violet" size="sm" />{tx('Monthly invoices')}</div>
      <p className="mb-2 text-xs muted">{tx('One GST invoice per operator per month, issued on the 1st.')}</p>
      <Table rows={data?.invoices || []} empty={tx('No monthly invoices yet')} columns={[
        { key: 'm', label: tx('Month'), render: (i) => i.period },
        { key: 'n', label: tx('Invoice'), render: (i) => <span className="font-mono text-xs">{i.number}</span> },
        { key: 's', label: tx('Operator'), render: (i) => i.supplier?.name },
        { key: 'l', label: tx('Sessions'), render: (i) => i.lines?.length },
        { key: 't', label: tx('Total'), render: (i) => rs(i.totalPaise) },
        { key: 'p', label: '', render: (i) => <button type="button" className="btn-ghost btn-sm" onClick={() => download(`/api/me/fleet/invoices/${i._id}/pdf`, `${i.number.replace(/\//g, '-')}.pdf`, { auth: 'driver' })}>PDF</button> },
      ]} />
    </Card>
  );
}
