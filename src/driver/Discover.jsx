import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, store, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { tx, useI18n } from '../lib/i18n.jsx';
import { rs } from '../lib/format.js';
import { Badge, Card, Empty, ErrorBox, Icon, Loading, Spinner, cx } from '../components/ui.jsx';
import { ChargerCard, CONNECTOR_LABEL } from './ChargerBits.jsx';
import { useBrand } from '../lib/brand.jsx';

const MapView = lazy(() => import('../components/MapView.jsx'));
const CACHE = 'cx.chargers.cache';

function ActiveBanner() {
  const { data } = useApi(tokens.driver() ? '/api/me/home' : null, { auth: 'driver' });
  const { t } = useI18n();
  if (!data) return null;
  return (
    <div className="space-y-3">
      {data.active && (
        <Link to={`/s/${data.active.id}`} className="card flex items-center justify-between gap-3 border-brand-300 bg-brand-50 p-4 dark:bg-brand-950">
          <div>
            <div className="text-xs font-semibold uppercase text-brand-700 dark:text-brand-300">{tx("Session in progress")}</div>
            <div className="font-semibold">{data.active.charger?.label} · {data.active.state === 'CHARGING' ? `${(data.active.energyWh / 1000).toFixed(2)} kWh` : data.active.message}</div>
          </div>
          <Icon name="chev" />
        </Link>
      )}
      {!data.active && data.chargeAgain && (
        <Link to={`/charger/${encodeURIComponent(data.chargeAgain.charger.ocppId)}`} className="card flex items-center justify-between gap-3 p-4">
          <div>
            <div className="text-xs font-semibold uppercase muted">{t('chargeAgain')}</div>
            <div className="font-semibold">{data.chargeAgain.charger.site?.name}</div>
            {data.chargeAgain.lastAmountPaise && <div className="text-xs muted">Last time {rs(data.chargeAgain.lastAmountPaise, { decimals: 0 })}</div>}
          </div>
          <Icon name="refresh" />
        </Link>
      )}
    </div>
  );
}

export default function Discover() {
  const { t } = useI18n();
  const [view, setView] = useState('list');
  const [q, setQ] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [connector, setConnector] = useState('');
  const [powerType, setPowerType] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [me, setMe] = useState(null);
  const [locDenied, setLocDenied] = useState(false);
  const [radius, setRadius] = useState(50);
  const [data, setData] = useState(() => {
    try {
      return JSON.parse(store.get(CACHE) || 'null');
    } catch {
      return null;
    }
  });
  const [stale, setStale] = useState(!!data);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const partners = useApi('/api/public/partner-locations', { auth: 'none' });
  const { base } = useBrand();

  useEffect(() => {
    if (!navigator.geolocation) return setLocDenied(true);
    navigator.geolocation.getCurrentPosition((p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }), () => setLocDenied(true), { timeout: 8000, maximumAge: 300000 });
    return undefined;
  }, []);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (!onlyAvailable) p.set('available', 'false');
    if (connector) p.set('connector', connector);
    if (powerType) p.set('powerType', powerType);
    if (vehicle) p.set('vehicle', vehicle);
    if (q.trim()) p.set('q', q.trim());
    if (base.slug) p.set('brand', base.slug); // white-label: only the operators this brand shows
    if (me) {
      p.set('lat', me.lat);
      p.set('lng', me.lng);
      p.set('radiusKm', radius);
    }
    return p.toString();
  }, [onlyAvailable, connector, powerType, vehicle, q, me, radius, base.slug]);

  useEffect(() => {
    let cancel = false;
    const h = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await api(`/api/public/chargers?${query}`, { auth: 'none' });
        if (cancel) return;
        setData(d);
        setStale(false);
        setError(null);
        store.set(CACHE, JSON.stringify(d)); // cached map shown instantly next time (DIS-08)
      } catch (e) {
        if (!cancel) setError(e);
      } finally {
        if (!cancel) setLoading(false);
      }
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(h);
    };
  }, [query]);

  const chargers = data?.chargers || [];
  const markers = [
    ...chargers.map((c) => ({
      id: c.ocppId,
      lat: c.site?.location?.lat,
      lng: c.site?.location?.lng,
      kind: !c.working ? 'down' : c.connectors.some((x) => x.status === 'Available') ? 'available' : 'busy',
      label: String(c.connectors.filter((x) => x.status === 'Available').length),
      popup: <Link to={`/charger/${encodeURIComponent(c.ocppId)}`} className="font-semibold text-brand-700">{c.site?.name} →</Link>,
    })),
    ...(partners.data?.locations || []).map((l) => ({ id: `p-${l.id}`, lat: l.coordinates?.lat, lng: l.coordinates?.lng, kind: 'partner', label: 'P', popup: <div><div className="font-semibold">{l.name}</div><div className="text-xs">Partner network · {l.partner}</div></div> })),
  ];

  return (
    <div className="space-y-4 p-4">
      <ActiveBanner />
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input className="input pl-9" placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tx("Search chargers")} />
      </div>
      {locDenied && !me && <div className="rounded-xl bg-ink-100 px-3 py-2 text-xs muted dark:bg-ink-900">{tx("Location is off — showing all chargers. Search by area or city.")}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOnlyAvailable(!onlyAvailable)} className={cx('btn-sm btn', onlyAvailable ? 'bg-brand-600 text-white' : 'btn-secondary')}>{onlyAvailable ? t('availableNow') : t('allChargers')}</button>
        <select className="input w-auto min-h-[34px] py-1 text-xs" value={connector} onChange={(e) => setConnector(e.target.value)} aria-label={tx("Connector type")}>
          <option value="">{tx("All connectors")}</option>
          {Object.entries(CONNECTOR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input w-auto min-h-[34px] py-1 text-xs" value={powerType} onChange={(e) => setPowerType(e.target.value)} aria-label={tx("AC or DC")}>
          <option value="">AC + DC</option><option value="AC">AC</option><option value="DC">{tx("DC fast")}</option>
        </select>
        <select className="input w-auto min-h-[34px] py-1 text-xs" value={vehicle} onChange={(e) => setVehicle(e.target.value)} aria-label={tx("Vehicle type")}>
          <option value="">{tx("Any vehicle")}</option><option value="car">{tx("Car")}</option><option value="2W">{tx("2-wheeler")}</option><option value="3W">{tx("3-wheeler")}</option>
        </select>
        <div className="ml-auto flex rounded-xl border border-ink-200 p-0.5 dark:border-ink-700">
          {['list', 'map'].map((v) => <button key={v} type="button" onClick={() => setView(v)} className={cx('btn-sm btn', view === v ? 'bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900' : 'muted')}><Icon name={v} className="h-4 w-4" /></button>)}
        </div>
      </div>
      {stale && <div className="flex items-center gap-2 text-xs muted"><Spinner className="h-3 w-3" /> {tx("Showing saved results, refreshing…")}</div>}
      <ErrorBox error={error} />
      {view === 'map' && <Suspense fallback={<Loading />}><MapView markers={markers} me={me} center={me ? [me.lat, me.lng] : undefined} height={420} /></Suspense>}
      {loading && !data ? <Loading /> : chargers.length === 0 ? (
        <Empty icon="pin" title={t('noChargers')}>{tx("Try turning off filters or search another area.")}</Empty>
      ) : (
        <div className="space-y-3">
          {data?.nearestOnly && (
            <Card className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>{t('noChargers')} — nearest is {chargers[0].distanceKm} km away.</span>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setRadius(radius * 4)}>{t('widen')}</button>
            </Card>
          )}
          {chargers.map((c) => <ChargerCard key={c.ocppId} c={c} />)}
          {(partners.data?.locations || []).length > 0 && (
            <div className="pt-2">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">{tx("Partner network")} <Badge tone="violet">{tx("roaming")}</Badge></div>
              {partners.data.locations.map((l) => (
                <Card key={l.id} className="mb-2 p-3 text-sm"><div className="font-semibold">{l.name}</div><div className="text-xs muted">{l.partner} · {l.city}</div></Card>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="pt-4 text-center text-xs muted">{tx("Scan the QR on any ChargeX charger to pay by UPI — no app or account needed. ·")} <Link to="/privacy" className="underline">{tx("Your data")}</Link></div>
    </div>
  );
}
