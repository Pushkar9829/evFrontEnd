// Host mode: a shop owner / homeowner lists one charger in about 10 minutes (Phase 2).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { kwh, rs } from '../lib/format.js';
import { ActionButton, Card, Empty, ErrorBox, Field, Loading, Stat, Status } from '../components/ui.jsx';
import { CONNECTOR_LABEL } from './ChargerBits.jsx';

export default function HostMode() {
  const logged = !!tokens.driver();
  const { data, loading, reload } = useApi(logged ? '/api/me/host' : null, { auth: 'driver' });
  const [f, setF] = useState({ displayName: '', address: '', city: '', lat: '', lng: '', connectorType: '3PIN', maxPowerKw: 3.3, pricePaisePerKwh: 1800, protocol: 'ocpp1.6' });
  const [setup, setSetup] = useState(null);
  const [err, setErr] = useState(null);
  const [price, setPrice] = useState('');
  if (!logged) return <div className="p-4"><Empty icon="home" title="Host mode">Log in to share your charger. <Link className="font-semibold text-brand-700" to="/login?next=/host">Log in</Link></Empty></div>;
  if (loading) return <Loading />;

  const useLocation = () => navigator.geolocation?.getCurrentPosition((p) => setF((x) => ({ ...x, lat: p.coords.latitude.toFixed(5), lng: p.coords.longitude.toFixed(5) })));
  const openConsole = async () => {
    const r = await api('/api/auth/host-session', { method: 'POST', auth: 'driver' });
    tokens.setStaff(r.token);
    location.href = '/console';
  };

  if (setup) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-xl font-bold">Your charger is registered</h1>
        <Card className="space-y-2 p-4 text-sm">
          <p>Enter these in your charger or OCPP smart socket settings. The password is shown only once.</p>
          <div className="rounded-xl bg-ink-50 p-3 font-mono text-xs dark:bg-ink-800">
            <div>Server URL: {setup.serverUrl}</div><div>Charger ID: {setup.chargerId}</div><div>Password: {setup.password}</div>
          </div>
          <p className="text-xs muted">When it connects, it appears online and drivers can find it. Platform-suggested price was {rs(setup.suggested)}/kWh.</p>
        </Card>
        <button type="button" className="btn-primary w-full" onClick={() => { setSetup(null); reload(); }}>Go to my host dashboard</button>
      </div>
    );
  }

  if (!data?.host) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-xl font-bold">Become a host</h1>
        <p className="text-sm muted">List your charger, set a price (we suggest one) and get paid. Takes about 10 minutes.</p>
        <Card className="space-y-3 p-4">
          <Field label="Name drivers see"><input className="input" placeholder="Sharma General Store" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
          <Field label="Address"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="City"><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
            <Field label="Location"><button type="button" className="btn-secondary w-full" onClick={useLocation}>{f.lat ? `${f.lat}, ${f.lng}` : 'Use my location'}</button></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Socket / connector"><select className="input" value={f.connectorType} onChange={(e) => setF({ ...f, connectorType: e.target.value })}>{Object.entries(CONNECTOR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Power (kW)"><input className="input" inputMode="decimal" value={f.maxPowerKw} onChange={(e) => setF({ ...f, maxPowerKw: e.target.value })} /></Field>
          </div>
          <Field label="Price per kWh (₹)" hint="Suggested ₹18. You can change it any time."><input className="input" inputMode="decimal" value={f.pricePaisePerKwh / 100} onChange={(e) => setF({ ...f, pricePaisePerKwh: Math.round(Number(e.target.value || 0) * 100) })} /></Field>
          <ErrorBox error={err} />
          <ActionButton className="btn-primary btn-lg w-full" disabled={!f.displayName || !f.address || !f.lat} onClick={async () => {
            try {
              const r = await api('/api/me/host', { method: 'POST', auth: 'driver', body: { ...f, lat: Number(f.lat), lng: Number(f.lng), maxPowerKw: Number(f.maxPowerKw) } });
              setSetup({ ...r.setup, suggested: r.suggestedPricePaisePerKwh });
            } catch (e) {
              setErr(e);
            }
          }}>Register my charger</ActionButton>
        </Card>
        <p className="text-xs muted">Use an EV-tariff electricity connection where your DISCOM requires one. Need hardware? Ask about the Host Starter Kit.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">{data.host.name}</h1>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Earnings 30d" value={rs(data.last30.earningsPaise, { decimals: 0 })} />
        <Stat label="Sessions" value={data.last30.sessions} />
        <Stat label="Energy" value={kwh(data.last30.energyWh, 0)} />
      </div>
      {data.chargers.map((c) => (
        <Card key={c.id} className="flex items-center justify-between p-4">
          <div><div className="font-semibold">{c.ocppId}</div><div className="text-xs muted">Uptime {c.uptimePct ?? '—'}%</div></div>
          <div className="flex gap-1">{c.online ? c.connectors.map((x) => <Status key={x.number} value={x.status} />) : <Status value="Offline" />}</div>
        </Card>
      ))}
      <Card className="space-y-2 p-4">
        <div className="text-sm font-semibold">Price: {rs(data.pricePaisePerKwh)}/kWh</div>
        <div className="flex gap-2"><input className="input" inputMode="decimal" placeholder="New price ₹/kWh" value={price} onChange={(e) => setPrice(e.target.value)} /><ActionButton disabled={!price} success="Price updated — new sessions use it" onClick={async () => { await api('/api/me/host/price', { method: 'PATCH', auth: 'driver', body: { pricePaisePerKwh: Math.round(Number(price) * 100) } }); setPrice(''); reload({ quiet: true }); }}>Update</ActionButton></div>
      </Card>
      <ActionButton className="btn-secondary w-full" onClick={openConsole}>Open full host console (sessions, payouts, simulator)</ActionButton>
    </div>
  );
}
