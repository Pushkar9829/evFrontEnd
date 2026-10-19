// Host mode: a shop owner / homeowner lists one charger in about 10 minutes (Phase 2).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { tx } from '../lib/i18n.jsx';
import { kwh, rs } from '../lib/format.js';
import { ActionButton, Card, Empty, ErrorBox, Field, Icon, IconBubble, Loading, Stat, Status, StatusDot } from '../components/ui.jsx';
import { CONNECTOR_LABEL } from './ChargerBits.jsx';

export function Hero({ icon, title, sub, children }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-electric p-5 text-white shadow-glow">
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur"><Icon name={icon} className="h-6 w-6" /></span>
        <div className="min-w-0"><h1 className="break-words text-xl font-extrabold leading-tight">{title}</h1>{sub && <p className="text-sm text-white/85">{sub}</p>}</div>
      </div>
      {children && <div className="relative mt-4">{children}</div>}
    </div>
  );
}

export default function HostMode() {
  const logged = !!tokens.driver();
  const { data, loading, reload } = useApi(logged ? '/api/me/host' : null, { auth: 'driver' });
  const [f, setF] = useState({ displayName: '', address: '', city: '', lat: '', lng: '', connectorType: '3PIN', maxPowerKw: 3.3, pricePaisePerKwh: 1800, protocol: 'ocpp1.6' });
  const [setup, setSetup] = useState(null);
  const [err, setErr] = useState(null);
  const [price, setPrice] = useState('');
  if (!logged) return <div className="p-4"><Card><Empty icon="home" title={tx('Host mode')}>{tx('Log in to share your charger.')} <Link className="font-semibold text-brand-700" to="/login?next=/host">{tx('Log in')}</Link></Empty></Card></div>;
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
        <Hero icon="check" title={tx('Your charger is registered')} sub={tx('Enter these in your charger or OCPP smart socket settings.')} />
        <Card className="space-y-3 p-4 text-sm">
          <div className="space-y-1 rounded-2xl bg-ink-900 p-4 font-mono text-xs text-brand-300">
            <div><span className="text-ink-400">{tx('Server URL')}:</span> {setup.serverUrl}</div>
            <div><span className="text-ink-400">{tx('Charger ID')}:</span> {setup.chargerId}</div>
            <div><span className="text-ink-400">{tx('Password')}:</span> {setup.password}</div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"><Icon name="alert" className="h-4 w-4 shrink-0" />{tx('The password is shown only once.')}</div>
          <p className="text-xs muted">{tx('When it connects, it appears online and drivers can find it.')} {tx('Suggested price')}: {rs(setup.suggested)}/kWh.</p>
        </Card>
        <button type="button" className="btn-electric btn-lg w-full" onClick={() => { setSetup(null); reload(); }}>{tx('Go to my host dashboard')}</button>
      </div>
    );
  }

  if (!data?.host) {
    return (
      <div className="space-y-4 p-4">
        <Hero icon="home" title={tx('Become a host')} sub={tx('List your charger, set a price (we suggest one) and get paid. Takes about 10 minutes.')} />
        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
          {[['pin', tx('Get found on the map')], ['money', tx('Paid to your bank')], ['shield', tx('UPI, GST invoices handled')]].map(([i, l]) => (
            <div key={l} className="flex flex-col items-center gap-1 rounded-2xl bg-white p-2 shadow-card dark:bg-ink-900"><IconBubble name={i} tone="green" size="sm" /><span className="font-semibold">{l}</span></div>
          ))}
        </div>
        <Card className="space-y-3 p-4">
          <Field label={tx('Name drivers see')}><input className="input" placeholder="Sharma General Store" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
          <Field label={tx('Address')}><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={tx('City')}><input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
            <Field label={tx('Location')}><button type="button" className={f.lat ? 'btn w-full border border-brand-300 bg-brand-50 text-xs text-brand-800 dark:bg-brand-950 dark:text-brand-300' : 'btn-secondary w-full'} onClick={useLocation}><Icon name="pin" className="h-4 w-4" />{f.lat ? `${f.lat}, ${f.lng}` : tx('Use my location')}</button></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={tx('Socket / connector')}><select className="input" value={f.connectorType} onChange={(e) => setF({ ...f, connectorType: e.target.value })}>{Object.entries(CONNECTOR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label={tx('Power (kW)')}><input className="input" inputMode="decimal" value={f.maxPowerKw} onChange={(e) => setF({ ...f, maxPowerKw: e.target.value })} /></Field>
          </div>
          <Field label={tx('Price per kWh (₹)')} hint={tx('Suggested ₹18. You can change it any time.')}><input className="input" inputMode="decimal" value={f.pricePaisePerKwh / 100} onChange={(e) => setF({ ...f, pricePaisePerKwh: Math.round(Number(e.target.value || 0) * 100) })} /></Field>
          <ErrorBox error={err} />
          <ActionButton className="btn-electric btn-lg w-full disabled:bg-none disabled:bg-ink-200 disabled:text-ink-500 disabled:shadow-none dark:disabled:bg-ink-800" disabled={!f.displayName || !f.address || !f.lat} onClick={async () => {
            try {
              const r = await api('/api/me/host', { method: 'POST', auth: 'driver', body: { ...f, lat: Number(f.lat), lng: Number(f.lng), maxPowerKw: Number(f.maxPowerKw) } });
              setSetup({ ...r.setup, suggested: r.suggestedPricePaisePerKwh });
            } catch (e) {
              setErr(e);
            }
          }}>{tx('Register my charger')}</ActionButton>
          {(!f.displayName || !f.address || !f.lat) && <div className="text-center text-xs muted">{tx('Fill in name, address and location to continue.')}</div>}
        </Card>
        <p className="text-xs muted">{tx('Use an EV-tariff electricity connection where your DISCOM requires one. Need hardware? Ask about the Host Starter Kit.')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <Hero icon="home" title={data.host.name} sub={tx('Your charger, price and earnings')}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/15 p-2"><div className="text-lg font-extrabold">{rs(data.last30.earningsPaise, { decimals: 0 })}</div><div className="text-[10px] text-white/80">{tx('Earnings 30d')}</div></div>
          <div className="rounded-2xl bg-white/15 p-2"><div className="text-lg font-extrabold">{data.last30.sessions}</div><div className="text-[10px] text-white/80">{tx('Sessions')}</div></div>
          <div className="rounded-2xl bg-white/15 p-2"><div className="text-lg font-extrabold">{kwh(data.last30.energyWh, 0)}</div><div className="text-[10px] text-white/80">{tx('Energy')}</div></div>
        </div>
      </Hero>
      {data.chargers.map((c) => (
        <Card key={c.id} className="flex items-center gap-3 p-4">
          <IconBubble name="plug" tone={c.online ? 'green' : 'gray'} />
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2 font-semibold"><StatusDot tone={c.online ? 'green' : 'gray'} pulse={c.online} />{c.ocppId}</div><div className="text-xs muted">{tx('Uptime')} {c.uptimePct ?? '—'}%</div></div>
          <div className="flex gap-1">{c.online ? c.connectors.map((x) => <Status key={x.number} value={x.status} />) : <Status value="Offline" />}</div>
        </Card>
      ))}
      <Card className="space-y-2 p-4">
        <div className="flex items-baseline justify-between"><div className="font-semibold">{tx('Your price')}</div><div className="text-xl font-extrabold">{rs(data.pricePaisePerKwh)}<span className="text-xs font-semibold muted">/kWh</span></div></div>
        <div className="flex gap-2"><input className="input" inputMode="decimal" placeholder={tx('New price ₹/kWh')} value={price} onChange={(e) => setPrice(e.target.value)} /><ActionButton disabled={!price} success={tx('Price updated — new sessions use it')} onClick={async () => { await api('/api/me/host/price', { method: 'PATCH', auth: 'driver', body: { pricePaisePerKwh: Math.round(Number(price) * 100) } }); setPrice(''); reload({ quiet: true }); }}>{tx('Update')}</ActionButton></div>
      </Card>
      <ActionButton className="btn-secondary w-full" onClick={openConsole}><Icon name="chart" className="h-4 w-4" />{tx('Open full host console (sessions, payouts, simulator)')}</ActionButton>
    </div>
  );
}
