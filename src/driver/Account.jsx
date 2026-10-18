import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useI18n } from '../lib/i18n.jsx';
import { dateOnly, rs } from '../lib/format.js';
import { ActionButton, Card, Empty, ErrorBox, Field, Icon, Loading, Modal, Status, useToast } from '../components/ui.jsx';
import { CONNECTOR_LABEL } from './ChargerBits.jsx';

function Row({ icon, title, sub, to, onClick }) {
  const inner = (
    <div className="flex items-center gap-3 p-4">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 dark:bg-ink-800"><Icon name={icon} className="h-4 w-4" /></div>
      <div className="flex-1"><div className="text-sm font-semibold">{title}</div>{sub && <div className="text-xs muted">{sub}</div>}</div>
      <Icon name="chev" className="h-4 w-4 text-ink-400" />
    </div>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : <button type="button" onClick={onClick} className="block w-full text-left">{inner}</button>;
}

export default function Account() {
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const logged = !!tokens.driver();
  const { data, loading, error, reload } = useApi(logged ? '/api/me' : null, { auth: 'driver' });
  const invoices = useApi(logged ? '/api/me/invoices' : null, { auth: 'driver' });
  const complaints = useApi(logged ? '/api/me/complaints' : null, { auth: 'driver' });
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState({});
  const u = data?.user;
  useEffect(() => {
    if (u) setForm({ name: u.name || '', email: u.email || '', gstin: u.gstin || '', businessName: u.businessName || '' });
  }, [u]);

  if (!logged) return <div className="p-4"><Empty icon="user" title="Your account">Log in with your phone number for history, favourites, vehicles and one-tap payments. <Link to="/login?next=/account" className="font-semibold text-brand-700">Log in</Link></Empty></div>;
  if (loading) return <Loading />;
  if (error) return <div className="p-4"><ErrorBox error={error} /></div>;

  const save = async (patch) => {
    await api('/api/me', { method: 'PATCH', auth: 'driver', body: patch });
    await reload({ quiet: true });
    toast('Saved');
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-xl font-bold text-brand-700 dark:bg-brand-950">{(u.name || u.phone || '?')[0]}</div>
        <div><div className="text-lg font-bold">{u.name || 'Driver'}</div><div className="text-sm muted">+91 {u.phone}</div></div>
      </div>
      <Card className="divide-y divide-ink-100 dark:divide-ink-800">
        <Row icon="user" title="Profile & GSTIN" sub={u.gstin ? `GSTIN ${u.gstin}` : 'Add GSTIN for business invoices'} onClick={() => setPanel('profile')} />
        <Row icon="car" title="Vehicles" sub={u.vehicles?.length ? u.vehicles.map((v) => v.label || v.model).join(', ') : 'Add your vehicle for smart suggestions'} onClick={() => setPanel('vehicles')} />
        <Row icon="money" title="Payments" sub={u.autopay?.status === 'active' ? `UPI Autopay on (up to ${rs(u.autopay.maxPaise, { decimals: 0 })})` : 'Saved methods, UPI Autopay'} onClick={() => setPanel('payments')} />
        <Row icon="doc" title="Invoices" sub={`${invoices.data?.invoices?.length || 0} invoices`} onClick={() => setPanel('invoices')} />
        <Row icon="alert" title="Complaints" sub={`${complaints.data?.complaints?.length || 0} reports`} onClick={() => setPanel('complaints')} />
        <Row icon="bell" title="Notifications" sub="Push, SMS, WhatsApp" onClick={() => setPanel('notifications')} />
      </Card>
      <Card className="divide-y divide-ink-100 dark:divide-ink-800">
        <Row icon="home" title="Host mode" sub={u.hostTenant ? 'Your charger, price and earnings' : 'Share your charger and earn'} to="/host" />
        <Row icon="users" title="Fleet" sub={u.fleet ? 'Your fleet account' : 'Manage company drivers and one monthly invoice'} to="/fleet" />
        <Row icon="globe" title={lang === 'en' ? 'भाषा: हिंदी' : 'Language: English'} sub="English / हिंदी" onClick={() => { setLang(lang === 'en' ? 'hi' : 'en'); save({ language: lang === 'en' ? 'hi' : 'en' }); }} />
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" onClick={() => { tokens.setDriver(null); nav('/'); }}>{t('logout')}</button>
        <button type="button" className="btn-ghost text-red-600" onClick={() => setPanel('delete')}>Delete account</button>
      </div>

      <Modal open={panel === 'profile'} onClose={() => setPanel(null)} title="Profile" footer={<ActionButton onClick={async () => { await save({ ...form, gstin: form.gstin || '' }); setPanel(null); }}>Save</ActionButton>}>
        <div className="space-y-3">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email (for invoices)"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Business name"><input className="input" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></Field>
          <Field label="GSTIN" hint="Business drivers get a B2B invoice with this GSTIN."><input className="input uppercase" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></Field>
        </div>
      </Modal>
      <VehiclesModal open={panel === 'vehicles'} onClose={() => setPanel(null)} user={u} reload={reload} />
      <PaymentsModal open={panel === 'payments'} onClose={() => setPanel(null)} user={u} reload={reload} />
      <Modal open={panel === 'invoices'} onClose={() => setPanel(null)} title="Invoices">
        {invoices.data?.invoices?.length ? invoices.data.invoices.map((i) => (
          <Link key={i._id} to={`/s/${i.session}`} className="flex justify-between border-b border-ink-100 py-2 text-sm dark:border-ink-800"><span>{i.number}<span className="block text-xs muted">{dateOnly(i.issuedAt)}</span></span><b>{rs(i.totalPaise)}</b></Link>
        )) : <Empty title="No invoices yet" />}
      </Modal>
      <Modal open={panel === 'complaints'} onClose={() => setPanel(null)} title="Complaints">
        {complaints.data?.complaints?.length ? complaints.data.complaints.map((c) => (
          <div key={c._id} className="flex items-center justify-between border-b border-ink-100 py-2 text-sm dark:border-ink-800"><span>{c.category.replace(/_/g, ' ')}<span className="block text-xs muted">{dateOnly(c.createdAt)}</span></span><Status value={c.status} /></div>
        )) : <Empty title="No complaints">Use "Report a problem" on any session.</Empty>}
      </Modal>
      <Modal open={panel === 'notifications'} onClose={() => setPanel(null)} title="Notifications">
        <div className="space-y-3">
          {['push', 'sms', 'whatsapp', 'email'].map((k) => (
            <label key={k} className="flex items-center justify-between text-sm capitalize">{k}<input type="checkbox" className="h-5 w-5 accent-brand-600" checked={!!u.notificationPrefs?.[k]} onChange={(e) => save({ notificationPrefs: { [k]: e.target.checked } })} /></label>
          ))}
          <p className="text-xs muted">Critical messages (started, completed, refunds) always reach you by SMS if push is off.</p>
        </div>
      </Modal>
      <Modal open={panel === 'delete'} onClose={() => setPanel(null)} title="Delete account" footer={<ActionButton className="btn-danger" onClick={async () => { await api('/api/me', { method: 'DELETE', auth: 'driver' }); tokens.setDriver(null); nav('/'); }}>Delete permanently</ActionButton>}>
        <p className="text-sm">Your profile, vehicles and favourites are deleted. Invoices are kept for the legal tax period, without your name.</p>
      </Modal>
    </div>
  );
}

function VehiclesModal({ open, onClose, user, reload }) {
  const [v, setV] = useState({ vehicleType: 'car', connectorTypes: ['Type2'] });
  const add = async () => {
    await api('/api/me/vehicles', { method: 'POST', auth: 'driver', body: { ...v, batteryKwh: v.batteryKwh ? Number(v.batteryKwh) : undefined } });
    setV({ vehicleType: 'car', connectorTypes: ['Type2'] });
    reload({ quiet: true });
  };
  return (
    <Modal open={open} onClose={onClose} title="Vehicles">
      <div className="space-y-2">
        {user.vehicles?.map((x) => (
          <div key={x._id} className="flex items-center justify-between rounded-xl bg-ink-50 p-3 text-sm dark:bg-ink-800">
            <span><b>{x.label || x.model}</b> · {x.vehicleType} · {x.batteryKwh ? `${x.batteryKwh} kWh` : ''}</span>
            <ActionButton className="btn-ghost btn-sm" onClick={async () => { await api(`/api/me/vehicles/${x._id}`, { method: 'DELETE', auth: 'driver' }); reload({ quiet: true }); }}>Remove</ActionButton>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <input className="input" placeholder="Name e.g. Nexon EV" value={v.label || ''} onChange={(e) => setV({ ...v, label: e.target.value })} />
          <select className="input" value={v.vehicleType} onChange={(e) => setV({ ...v, vehicleType: e.target.value })}><option value="car">Car</option><option value="2W">2-wheeler</option><option value="3W">3-wheeler</option></select>
          <input className="input" inputMode="decimal" placeholder="Battery kWh" value={v.batteryKwh || ''} onChange={(e) => setV({ ...v, batteryKwh: e.target.value })} />
          <select className="input" value={v.connectorTypes[0]} onChange={(e) => setV({ ...v, connectorTypes: [e.target.value] })}>{Object.entries(CONNECTOR_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
        <ActionButton className="btn-primary w-full" onClick={add}>Add vehicle</ActionButton>
      </div>
    </Modal>
  );
}

function PaymentsModal({ open, onClose, user, reload }) {
  const [max, setMax] = useState(1000);
  return (
    <Modal open={open} onClose={onClose} title="Payments">
      <div className="space-y-4 text-sm">
        <div>
          <div className="font-semibold">UPI Autopay</div>
          <p className="text-xs muted">Charge without prepaying: we charge your UPI mandate after the session for exactly the energy used. Needed for partner-network roaming.</p>
          {user.autopay?.status === 'active' ? (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-brand-50 p-3 dark:bg-brand-950">Active · up to {rs(user.autopay.maxPaise, { decimals: 0 })} per session<ActionButton className="btn-ghost btn-sm" onClick={async () => { await api('/api/me/autopay', { method: 'DELETE', auth: 'driver' }); reload({ quiet: true }); }}>Turn off</ActionButton></div>
          ) : (
            <div className="mt-2 flex gap-2"><input className="input" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} /><ActionButton onClick={async () => { await api('/api/me/autopay', { method: 'POST', auth: 'driver', body: { maxPaise: Number(max) * 100 } }); reload({ quiet: true }); }}>Set up</ActionButton></div>
          )}
        </div>
        <p className="text-xs muted">Card and UPI details are stored by the payment gateway as tokens — never by ChargeX.</p>
      </div>
    </Modal>
  );
}
