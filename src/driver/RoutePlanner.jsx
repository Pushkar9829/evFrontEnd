// Route planner with charging stops (Phase 2). Place search uses OpenStreetMap Nominatim.
import { tx } from '../lib/i18n.jsx';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { rs } from '../lib/format.js';
import { ActionButton, Badge, Card, ErrorBox, Field, Icon, Loading } from '../components/ui.jsx';
import { Hero } from './HostMode.jsx';

const MapView = lazy(() => import('../components/MapView.jsx'));

function PlaceInput({ label, value, onChange, allowMe }) {
  const [q, setQ] = useState(value?.label || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || q.trim().length < 3) return undefined;
    const h = setTimeout(async () => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
        setResults(await r.json());
      } catch {
        setResults([]);
      }
    }, 450);
    return () => clearTimeout(h);
  }, [q, open]);
  return (
    <Field label={label} className="relative">
      <div className="flex gap-2">
        <input className="input" value={q} placeholder={tx("Search a place")} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
        {allowMe && (
          <button type="button" className="btn-secondary" aria-label={tx("Use my location")} onClick={() => navigator.geolocation?.getCurrentPosition((p) => { const v = { lat: p.coords.latitude, lng: p.coords.longitude, label: 'My location' }; setQ(v.label); onChange(v); })}>
            <Icon name="pin" className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="card absolute z-[600] mt-1 w-full overflow-hidden">
          {results.map((r) => (
            <button key={r.place_id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-ink-50 dark:hover:bg-ink-800" onClick={() => { const v = { lat: Number(r.lat), lng: Number(r.lon), label: r.display_name.split(',').slice(0, 3).join(',') }; setQ(v.label); setResults([]); setOpen(false); onChange(v); }}>
              {r.display_name}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}

export default function RoutePlanner() {
  const me = useApi(tokens.driver() ? '/api/me' : null, { auth: 'driver' });
  const v = me.data?.user?.vehicles?.[0];
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [f, setF] = useState({ rangeKm: 250, socPct: 80, chargeToPct: 80, batteryKwh: 40 });
  const [plan, setPlan] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (v?.batteryKwh) setF((x) => ({ ...x, batteryKwh: v.batteryKwh, rangeKm: Math.round(v.batteryKwh * 6) }));
  }, [v?.batteryKwh]);

  const run = async () => {
    setErr(null);
    try {
      setPlan(await api('/api/public/route-plan', { method: 'POST', auth: 'none', body: { from, to, rangeKm: Number(f.rangeKm), socPct: Number(f.socPct), chargeToPct: Number(f.chargeToPct), batteryKwh: Number(f.batteryKwh), connectorTypes: v?.connectorTypes?.length ? v.connectorTypes : undefined, vehicleType: v?.vehicleType } }));
    } catch (e) {
      setErr(e);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Hero icon="route" title={tx("Plan a trip")} sub={tx("Charging stops along your route, with time and cost.")} />
      <Card className="space-y-3 p-4">
        <PlaceInput label={tx("From")} value={from} onChange={setFrom} allowMe />
        <PlaceInput label={tx("To")} value={to} onChange={setTo} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label={tx("Full-battery range (km)")}><input className="input" inputMode="numeric" value={f.rangeKm} onChange={(e) => setF({ ...f, rangeKm: e.target.value })} /></Field>
          <Field label={tx("Battery now (%)")}><input className="input" inputMode="numeric" value={f.socPct} onChange={(e) => setF({ ...f, socPct: e.target.value })} /></Field>
          <Field label={tx("Charge stops to (%)")}><input className="input" inputMode="numeric" value={f.chargeToPct} onChange={(e) => setF({ ...f, chargeToPct: e.target.value })} /></Field>
          <Field label={tx("Battery (kWh)")}><input className="input" inputMode="decimal" value={f.batteryKwh} onChange={(e) => setF({ ...f, batteryKwh: e.target.value })} /></Field>
        </div>
        {v && <div className="text-xs muted">Using your {v.label || v.model}{v.connectorTypes?.length ? ` · ${v.connectorTypes.join(', ')}` : ''}</div>}
        <ActionButton className="btn-electric btn-lg w-full disabled:bg-none disabled:bg-ink-200 disabled:text-ink-500 disabled:shadow-none dark:disabled:bg-ink-800" disabled={!from || !to} onClick={run}>{tx("Find charging stops")}</ActionButton>
        <ErrorBox error={err} />
      </Card>
      {plan && (
        <>
          <Card className={`border-l-4 p-4 text-sm ${plan.feasible ? 'border-l-brand-500' : 'border-l-red-500'}`}>
            <div className="flex items-center justify-between"><div className="font-semibold">{plan.message}</div><Badge tone={plan.feasible ? 'green' : 'red'}>{plan.totalKm} km</Badge></div>
            <div className="mt-1 text-xs muted">About {Math.floor(plan.driveMin / 60)}h {plan.driveMin % 60}m driving{plan.feasible && plan.arriveSocPct !== null ? ` · arrive with ~${plan.arriveSocPct}%` : ''}{plan.routeSource === 'straight_line' ? ' · distances estimated' : ''}</div>
            <a className="btn-secondary btn-sm mt-3 w-full" href={plan.navigationUrl} target="_blank" rel="noreferrer">{tx("Open in Google Maps with stops")}</a>
          </Card>
          <Suspense fallback={<Loading />}>
            <MapView height={320} markers={[
              { id: 'from', lat: from.lat, lng: from.lng, kind: 'busy', label: 'A' },
              { id: 'to', lat: to.lat, lng: to.lng, kind: 'busy', label: 'B' },
              ...plan.chargersOnRoute.map((c) => ({ id: c.ocppId, lat: c.location?.lat, lng: c.location?.lng, kind: plan.stops.some((s) => s.ocppId === c.ocppId) ? 'available' : c.working ? 'partner' : 'down', label: '' })),
            ]} />
          </Suspense>
          {plan.stops.map((s, i) => (
            <Card key={s.ocppId} className="relative p-4 pl-14">
              <span className="absolute left-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-electric text-sm font-extrabold text-white shadow-glow">{i + 1}</span>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase muted">Stop {i + 1} · km {s.atKm}{s.detourKm ? ` · ${s.detourKm} km detour` : ''}</div>
                  <div className="font-semibold">{s.site.name}</div>
                  <div className="text-xs muted">{s.label} · up to {s.maxPowerKw} kW</div>
                </div>
                {s.availableNow ? <Badge tone="green">{tx("Free now")}</Badge> : <Badge tone="blue">{tx("In use now")}</Badge>}
              </div>
              <div className="mt-2 text-sm">Arrive ~{s.arriveSocPct}% → charge to {s.leaveSocPct}%: {s.kwh} kWh, ~{s.minutes} min{s.estCostPaise ? `, about ${rs(s.estCostPaise, { decimals: 0 })}` : ''}</div>
              <Link to={`/charger/${encodeURIComponent(s.ocppId)}`} className="mt-2 inline-block text-xs font-semibold text-brand-700">{tx("Charger details →")}</Link>
            </Card>
          ))}
        </>
      )}
      <p className="text-center text-xs muted">{tx("Place search © OpenStreetMap contributors.")}</p>
    </div>
  );
}
