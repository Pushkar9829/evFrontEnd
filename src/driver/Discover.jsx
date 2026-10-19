import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, store, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { tx, useI18n } from '../lib/i18n.jsx';
import { rs } from '../lib/format.js';
import { Badge, Card, Chip, Empty, ErrorBox, Icon, IconBubble, Loading, SkeletonCards, Spinner, StatusDot, cx } from '../components/ui.jsx';
import { CONNECTOR_LABEL, SiteCard, groupBySite } from './ChargerBits.jsx';
import { useBrand } from '../lib/brand.jsx';

const MapView = lazy(() => import('../components/MapView.jsx'));
const CACHE = 'cx.chargers.cache';

function ActiveBanner() {
  const { data } = useApi(tokens.driver() ? '/api/me/home' : null, { auth: 'driver' });
  const { t } = useI18n();
  if (!data) return null;
  if (data.active) {
    const a = data.active;
    return (
      <Link to={`/s/${a.id}`} className="relative block overflow-hidden rounded-3xl bg-electric p-4 text-white shadow-glow animate-rise">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/85"><StatusDot tone="green" pulse /> {tx('Session in progress')}</div>
            <div className="mt-1 text-2xl font-extrabold tabular-nums">{a.state === 'CHARGING' ? `${((a.energyWh || 0) / 1000).toFixed(2)} kWh` : a.state}</div>
            <div className="text-sm text-white/85">{a.charger?.label}{a.liveCostPaise !== undefined ? ` · ${rs(a.liveCostPaise)}` : ''}</div>
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20"><Icon name="chev" /></span>
        </div>
      </Link>
    );
  }
  if (!data.chargeAgain) return null;
  return (
    <Link to={`/charger/${encodeURIComponent(data.chargeAgain.charger.ocppId)}`} className="card card-hover flex items-center gap-3 p-3">
      <IconBubble name="refresh" tone="cyan" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wider muted">{t('chargeAgain')}</div>
        <div className="truncate font-semibold">{data.chargeAgain.charger.site?.name}</div>
      </div>
      {data.chargeAgain.lastAmountPaise && <span className="rounded-xl bg-ink-100 px-2.5 py-1 text-sm font-bold dark:bg-ink-800">{rs(data.chargeAgain.lastAmountPaise, { decimals: 0 })}</span>}
    </Link>
  );
}

const CONNECTOR_CHIPS = ['CCS2', 'Type2', 'Bharat_AC001', 'LEV_DC', 'CHAdeMO', '3PIN'];

export default function Discover() {
  const { t } = useI18n();
  const [mapOpen, setMapOpen] = useState(() => store.get('cx.mapOpen') !== '0');
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
  const stations = useMemo(() => groupBySite(chargers), [chargers]);
  const freeNow = stations.filter((s) => s.free > 0).length;
  const markers = [
    ...stations.map((g) => ({
      id: g.key,
      lat: g.site?.location?.lat,
      lng: g.site?.location?.lng,
      kind: !g.working ? 'down' : g.free ? 'available' : 'busy',
      label: String(g.free),
      popup: <Link to={`/charger/${encodeURIComponent(g.best.ocppId)}`} className="font-semibold">{g.site?.name} · {g.free}/{g.total} {tx('free')} →</Link>,
    })),
    ...(partners.data?.locations || []).map((l) => ({ id: `p-${l.id}`, lat: l.coordinates?.lat, lng: l.coordinates?.lng, kind: 'partner', label: 'P', popup: <div><div className="font-semibold">{l.name}</div><div className="text-xs">{tx('Partner network')} · {l.partner}</div></div> })),
  ];
  const toggleMap = () => {
    store.set('cx.mapOpen', mapOpen ? '0' : '1');
    setMapOpen(!mapOpen);
  };

  return (
    <div className="space-y-4 px-4 pb-4 pt-3">
      <ActiveBanner />

      <div className="sticky top-[57px] z-[400] -mx-4 space-y-2.5 bg-ink-50/90 px-4 pb-2 pt-1 backdrop-blur-lg dark:bg-ink-950/90">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input className="input h-12 rounded-2xl pl-10 pr-12 text-[15px] shadow-card" placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tx('Search chargers')} />
          <button type="button" onClick={toggleMap} className={cx('absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl transition', mapOpen ? 'bg-brand-600 text-white' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800')} aria-label={mapOpen ? 'Hide map' : 'Show map'}>
            <Icon name="map" className="h-4 w-4" />
          </button>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip on={onlyAvailable} onClick={() => setOnlyAvailable(!onlyAvailable)} icon="check">{onlyAvailable ? t('availableNow') : t('allChargers')}</Chip>
          <Chip on={powerType === 'DC'} onClick={() => setPowerType(powerType === 'DC' ? '' : 'DC')} icon="bolt">{tx('DC fast')}</Chip>
          <Chip on={powerType === 'AC'} onClick={() => setPowerType(powerType === 'AC' ? '' : 'AC')}>AC</Chip>
          <Chip on={vehicle === '2W'} onClick={() => setVehicle(vehicle === '2W' ? '' : '2W')}>{tx('2-wheeler')}</Chip>
          <Chip on={vehicle === '3W'} onClick={() => setVehicle(vehicle === '3W' ? '' : '3W')}>{tx('3-wheeler')}</Chip>
          {CONNECTOR_CHIPS.map((c) => <Chip key={c} on={connector === c} onClick={() => setConnector(connector === c ? '' : c)}>{CONNECTOR_LABEL[c]}</Chip>)}
        </div>
      </div>

      {locDenied && !me && <div className="flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-950 dark:text-sky-200"><Icon name="pin" className="h-4 w-4 shrink-0" />{tx('Location is off — showing all chargers. Search by area or city.')}</div>}
      {mapOpen && (
        <Suspense fallback={<div className="skeleton h-[260px] rounded-3xl" />}>
          <div className="overflow-hidden rounded-3xl shadow-card"><MapView markers={markers} me={me} center={me ? [me.lat, me.lng] : undefined} height={260} /></div>
        </Suspense>
      )}

      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold tracking-tight">{me ? tx('Near you') : tx('Charging stations')}</h2>
        <span className="text-xs font-semibold muted">{stale ? <span className="inline-flex items-center gap-1"><Spinner className="h-3 w-3" />{tx('Refreshing…')}</span> : `${stations.length} ${tx('stations')} · ${freeNow} ${tx('free now')}`}</span>
      </div>
      <ErrorBox error={error} />

      {loading && !data ? <SkeletonCards n={3} /> : stations.length === 0 ? (
        <Card><Empty icon="pin" title={t('noChargers')}>{tx('Try turning off filters or search another area.')}</Empty></Card>
      ) : (
        <div className="space-y-3">
          {data?.nearestOnly && (
            <Card className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>{t('noChargers')} — {tx('nearest is')} {chargers[0].distanceKm} km.</span>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setRadius(radius * 4)}>{t('widen')}</button>
            </Card>
          )}
          {stations.map((g, i) => <div key={g.key} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}><SiteCard g={g} /></div>)}
          {(partners.data?.locations || []).length > 0 && (
            <div className="pt-2">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">{tx('Partner network')} <Badge tone="violet">{tx('roaming')}</Badge></div>
              {partners.data.locations.map((l) => (
                <Card key={l.id} className="mb-2 flex items-center gap-3 p-3 text-sm"><IconBubble name="globe" tone="violet" size="sm" /><div><div className="font-semibold">{l.name}</div><div className="text-xs muted">{l.partner} · {l.city}</div></div></Card>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 rounded-3xl bg-electric-soft p-4 dark:bg-none dark:bg-ink-900">
        <IconBubble name="qr" tone="green" />
        <div className="text-xs">
          <div className="font-bold">{tx('No app needed')}</div>
          <div className="muted">{tx('Scan the QR on any ChargeX charger to pay by UPI — no app or account needed.')} <Link to="/privacy" className="font-semibold underline">{tx('Your data')}</Link></div>
        </div>
      </div>
    </div>
  );
}
