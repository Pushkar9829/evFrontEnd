import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, download, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { tx, useI18n } from '../lib/i18n.jsx';
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

  if (!logged) return <div className="p-4"><Empty icon="user" title={tx("Your account")}>{tx("Log in with your phone number for history, favourites, vehicles and one-tap payments.")} <Link to="/login?next=/account" className="font-semibold text-brand-700">{tx("Log in")}</Link></Empty></div>;
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
        <Row icon="user" title={tx("Profile & GSTIN")} sub={u.gstin ? `GSTIN ${u.gstin}` : 'Add GSTIN for business invoices'} onClick={() => setPanel('profile')} />
        <Row icon="car" title={tx("Vehicles")} sub={u.vehicles?.length ? u.vehicles.map((v) => v.label || v.model).join(', ') : 'Add your vehicle for smart suggestions'} onClick={() => setPanel('vehicles')} />
        <Row icon="money" title={tx("Payments")} sub={u.autopay?.status === 'active' ? `UPI Autopay on (up to ${rs(u.autopay.maxPaise, { decimals: 0 })})` : 'Saved methods, UPI Autopay'} onClick={() => setPanel('payments')} />
        <Row icon="doc" title={tx("Invoices")} sub={`${invoices.data?.invoices?.length || 0} invoices`} onClick={() => setPanel('invoices')} />
        <Row icon="alert" title={tx("Complaints")} sub={`${complaints.data?.complaints?.length || 0} reports`} onClick={() => setPanel('complaints')} />
        <Row icon="heart" title={tx('Favourites')} sub={`${u.favourites?.length || 0}`} onClick={() => setPanel('favourites')} />
        <Row icon="bell" title={tx('Inbox')} sub={tx('Charging updates and refunds')} onClick={() => setPanel('inbox')} />
        <Row icon="tag" title={tx('RFID cards')} sub={u.rfidCards?.length ? u.rfidCards.map((c) => `••${c.uid.slice(-4)}${c.blocked ? ' (blocked)' : ''}`).join(', ') : tx('Tap a card on the charger instead of scanning')} onClick={() => setPanel('rfid')} />
        <Row icon="cog" title={tx("Notifications")} sub="Push, SMS, WhatsApp, email" onClick={() => setPanel('notifications')} />
        <Row icon="doc" title={tx("Download my data")} sub="Everything we hold about you (JSON)" onClick={() => download('/api/me/data-export', 'chargex-my-data.json', { auth: 'driver' }).catch((e) => toast(e.message, 'red'))} />
      </Card>
      <Card className="divide-y divide-ink-100 dark:divide-ink-800">
        <Row icon="home" title={tx("Host mode")} sub={u.hostTenant ? 'Your charger, price and earnings' : 'Share your charger and earn'} to="/host" />
        <Row icon="users" title={tx("Fleet")} sub={u.fleet ? 'Your fleet account' : 'Manage company drivers and one monthly invoice'} to="/fleet" />
        <Row icon="globe" title={lang === 'en' ? 'भाषा: हिंदी' : 'Language: English'} sub="English / हिंदी" onClick={() => { setLang(lang === 'en' ? 'hi' : 'en'); save({ language: lang === 'en' ? 'hi' : 'en' }); }} />
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" onClick={() => { tokens.setDriver(null); nav('/'); }}>{t('logout')}</button>
        <button type="button" className="btn-ghost text-red-600" onClick={() => setPanel('delete')}>{tx("Delete account")}</button>
      </div>

      <Modal open={panel === 'profile'} onClose={() => setPanel(null)} title={tx("Profile")} footer={<ActionButton onClick={async () => { await save({ ...form, gstin: form.gstin || '' }); setPanel(null); }}>{tx("Save")}</ActionButton>}>
        <div className="space-y-3">
          <Field label={tx("Name")}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label={tx("Email (for invoices)")}><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={tx("Business name")}><input className="input" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></Field>
          <Field label={tx("GSTIN")} hint="Business drivers get a B2B invoice with this GSTIN."><input className="input uppercase" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></Field>
        </div>
      </Modal>
      <FavouritesModal open={panel === 'favourites'} onClose={() => setPanel(null)} />
      <InboxModal open={panel === 'inbox'} onClose={() => setPanel(null)} />
      <RfidModal open={panel === 'rfid'} onClose={() => setPanel(null)} user={u} reload={reload} />
      <VehiclesModal open={panel === 'vehicles'} onClose={() => setPanel(null)} user={u} reload={reload} />
      <PaymentsModal open={panel === 'payments'} onClose={() => setPanel(null)} user={u} reload={reload} />
      <Modal open={panel === 'invoices'} onClose={() => setPanel(null)} title={tx("Invoices")}>
        {invoices.data?.invoices?.length ? invoices.data.invoices.map((i) => (
          <Link key={i._id} to={`/s/${i.session}`} className="flex justify-between border-b border-ink-100 py-2 text-sm dark:border-ink-800"><span>{i.number}<span className="block text-xs muted">{dateOnly(i.issuedAt)}</span></span><b>{rs(i.totalPaise)}</b></Link>
        )) : <Empty title={tx("No invoices yet")} />}
      </Modal>
      <Modal open={panel === 'complaints'} onClose={() => setPanel(null)} title={tx("Complaints")}>
        {complaints.data?.complaints?.length ? complaints.data.complaints.map((c) => (
          <div key={c._id} className="flex items-center justify-between border-b border-ink-100 py-2 text-sm dark:border-ink-800"><span>{c.category.replace(/_/g, ' ')}<span className="block text-xs muted">{dateOnly(c.createdAt)}</span></span><Status value={c.status} /></div>
        )) : <Empty title={tx("No complaints")}>{tx("Use \"Report a problem\" on any session.")}</Empty>}
      </Modal>
      <Modal open={panel === 'notifications'} onClose={() => setPanel(null)} title={tx("Notifications")}>
        <div className="space-y-3">
          {['push', 'sms', 'whatsapp', 'email'].map((k) => (
            <label key={k} className="flex items-center justify-between text-sm capitalize">{k}<input type="checkbox" className="h-5 w-5 accent-brand-600" checked={!!u.notificationPrefs?.[k]} onChange={(e) => save({ notificationPrefs: { [k]: e.target.checked } })} /></label>
          ))}
          <p className="text-xs muted">{tx("Critical messages (started, completed, refunds) always reach you by SMS if push is off.")}</p>
        </div>
      </Modal>
      <Modal open={panel === 'delete'} onClose={() => setPanel(null)} title={tx("Delete account")} footer={<ActionButton className="btn-danger" onClick={async () => { await api('/api/me', { method: 'DELETE', auth: 'driver' }); tokens.setDriver(null); nav('/'); }}>{tx("Delete permanently")}</ActionButton>}>
        <p className="text-sm">{tx("Your profile, vehicles and favourites are deleted. Invoices are kept for the legal tax period, without your name.")}</p>
      </Modal>
    </div>
  );
}

function VehiclesModal({ open, onClose, user, reload }) {
  const [v, setV] = useState({ vehicleType: 'car', connectorTypes: ['Type2'] });
  const [pnc, setPnc] = useState(null);
  const add = async () => {
    await api('/api/me/vehicles', { method: 'POST', auth: 'driver', body: { ...v, batteryKwh: v.batteryKwh ? Number(v.batteryKwh) : undefined } });
    setV({ vehicleType: 'car', connectorTypes: ['Type2'] });
    reload({ quiet: true });
  };
  return (
    <Modal open={open} onClose={onClose} title={tx("Vehicles")}>
      <div className="space-y-2">
        {user.vehicles?.map((x) => (
          <div key={x._id} className="space-y-2 rounded-xl bg-ink-50 p-3 text-sm dark:bg-ink-800">
            <div className="flex items-center justify-between">
              <span><b>{x.label || x.model}</b> · {x.vehicleType} · {x.batteryKwh ? `${x.batteryKwh} kWh` : ''}</span>
              <ActionButton className="btn-ghost btn-sm" onClick={async () => { await api(`/api/me/vehicles/${x._id}`, { method: 'DELETE', auth: 'driver' }); reload({ quiet: true }); }}>{tx("Remove")}</ActionButton>
            </div>
            {x.pnc?.emaid && !x.pnc.revokedAt ? (
              <div className="flex items-center justify-between text-xs">
                <span>{tx("Plug & Charge on · eMAID")} <span className="font-mono">{x.pnc.emaid}</span></span>
                <ActionButton className="btn-ghost btn-sm" confirm={tx("Turn off Plug & Charge? The contract certificate is revoked.")} onClick={async () => { await api(`/api/me/vehicles/${x._id}/pnc`, { method: 'DELETE', auth: 'driver' }); reload({ quiet: true }); }}>{tx("Turn off")}</ActionButton>
              </div>
            ) : (
              <ActionButton className="btn-secondary btn-sm" onClick={async () => { const r = await api(`/api/me/vehicles/${x._id}/pnc`, { method: 'POST', auth: 'driver' }); setPnc(r); reload({ quiet: true }); }}>{tx("Enable Plug & Charge (ISO 15118)")}</ActionButton>
            )}
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <input className="input" placeholder={tx("Name e.g. Nexon EV")} value={v.label || ''} onChange={(e) => setV({ ...v, label: e.target.value })} />
          <select className="input" value={v.vehicleType} onChange={(e) => setV({ ...v, vehicleType: e.target.value })}><option value="car">{tx("Car")}</option><option value="2W">{tx("2-wheeler")}</option><option value="3W">{tx("3-wheeler")}</option></select>
          <input className="input" inputMode="decimal" placeholder={tx("Battery kWh")} value={v.batteryKwh || ''} onChange={(e) => setV({ ...v, batteryKwh: e.target.value })} />
          <select className="input" value={v.connectorTypes[0]} onChange={(e) => setV({ ...v, connectorTypes: [e.target.value] })}>{Object.entries(CONNECTOR_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
        <ActionButton className="btn-primary w-full" onClick={add}>{tx("Add vehicle")}</ActionButton>
        {pnc && (
          <div className="space-y-1 rounded-xl border border-brand-300 p-3 text-xs">
            <div className="font-semibold">{tx("Plug & Charge contract issued:")} <span className="font-mono">{pnc.emaid}</span></div>
            <p className="muted">{pnc.note} Billing uses your UPI Autopay / fleet account after each session.</p>
            <button type="button" className="btn-secondary btn-sm" onClick={() => { const blob = new Blob([`${pnc.certificateChain}
${pnc.privateKey}`], { type: 'application/x-pem-file' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${pnc.emaid}.pem`; a.click(); }}>{tx("Download contract certificate")}</button>
          </div>
        )}
        <p className="text-xs muted">{tx("Plug & Charge needs a car that supports ISO 15118 and UPI Autopay or a fleet account: plug in and charging starts by itself.")}</p>
      </div>
    </Modal>
  );
}

function PaymentsModal({ open, onClose, user, reload }) {
  const [max, setMax] = useState(1000);
  return (
    <Modal open={open} onClose={onClose} title={tx("Payments")}>
      <div className="space-y-4 text-sm">
        <div>
          <div className="font-semibold">{tx("UPI Autopay")}</div>
          <p className="text-xs muted">{tx("Charge without prepaying: we charge your UPI mandate after the session for exactly the energy used. Needed for partner-network roaming.")}</p>
          {user.autopay?.status === 'active' ? (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-brand-50 p-3 dark:bg-brand-950">Active · up to {rs(user.autopay.maxPaise, { decimals: 0 })} per session<ActionButton className="btn-ghost btn-sm" onClick={async () => { await api('/api/me/autopay', { method: 'DELETE', auth: 'driver' }); reload({ quiet: true }); }}>{tx("Turn off")}</ActionButton></div>
          ) : (
            <div className="mt-2 flex gap-2"><input className="input" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} /><ActionButton onClick={async () => { await api('/api/me/autopay', { method: 'POST', auth: 'driver', body: { maxPaise: Number(max) * 100 } }); reload({ quiet: true }); }}>{tx("Set up")}</ActionButton></div>
          )}
        </div>
        <p className="text-xs muted">{tx("Card and UPI details are stored by the payment gateway as tokens — never by ChargeX.")}</p>
      </div>
    </Modal>
  );
}

function FavouritesModal({ open, onClose }) {
  const { data, reload } = useApi(open ? '/api/me/favourites' : null, { auth: 'driver' });
  return (
    <Modal open={open} onClose={onClose} title={tx('Favourites')}>
      {!data ? <Loading /> : data.chargers.length === 0 ? <Empty icon="heart" title={tx('No favourites yet')}>{tx('Tap the heart on a charger to save it here.')}</Empty> : (
        <div className="space-y-2">
          {data.chargers.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 p-3 text-sm dark:bg-ink-800">
              <Link to={`/charger/${encodeURIComponent(c.ocppId)}`} onClick={onClose} className="min-w-0"><div className="truncate font-semibold">{c.site?.name}</div><div className="text-xs muted">{c.label} · {c.connectors.filter((x) => x.status === 'Available').length} {tx('free')}</div></Link>
              <ActionButton className="btn-ghost btn-sm" onClick={async () => { await api(`/api/me/favourites/${c.id}`, { method: 'DELETE', auth: 'driver' }); reload({ quiet: true }); }}>{tx('Remove')}</ActionButton>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function InboxModal({ open, onClose }) {
  const { data } = useApi(open ? '/api/me/notifications' : null, { auth: 'driver' });
  return (
    <Modal open={open} onClose={onClose} title={tx('Inbox')}>
      {!data ? <Loading /> : data.notifications.length === 0 ? <Empty icon="bell" title={tx('No messages yet')} /> : (
        <div className="divide-y divide-ink-100 dark:divide-ink-800">
          {data.notifications.map((n) => (
            <Link key={n._id} to={n.session ? `/s/${n.session}` : '#'} onClick={onClose} className="block py-2 text-sm">
              <div>{n.body}</div>
              <div className="text-xs muted">{dateOnly(n.createdAt)} · {new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</div>
            </Link>
          ))}
        </div>
      )}
    </Modal>
  );
}

function RfidModal({ open, onClose, user, reload }) {
  const [uid, setUid] = useState('');
  const [err, setErr] = useState(null);
  return (
    <Modal open={open} onClose={onClose} title={tx('RFID cards')}>
      <div className="space-y-3 text-sm">
        {(user.rfidCards || []).map((c) => <div key={c.uid} className="flex justify-between rounded-xl bg-ink-50 p-3 dark:bg-ink-800"><span className="font-mono">{c.uid}</span>{c.blocked ? <Status value="blocked" label="Blocked" /> : <Status value="active" label="Active" />}</div>)}
        <p className="text-xs muted">{tx('RFID charging bills after the session, so it needs UPI Autopay or a fleet account.')}</p>
        <div className="flex gap-2"><input className="input font-mono uppercase" placeholder={tx('Card number on the back (UID)')} value={uid} onChange={(e) => setUid(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ''))} /><ActionButton disabled={uid.length < 4} onClick={async () => { try { await api('/api/me/rfid', { method: 'POST', auth: 'driver', body: { uid } }); setUid(''); setErr(null); reload({ quiet: true }); } catch (e) { setErr(e); } }}>{tx('Link card')}</ActionButton></div>
        <ErrorBox error={err} />
      </div>
    </Modal>
  );
}
