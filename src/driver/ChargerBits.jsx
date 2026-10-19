import { Link } from 'react-router-dom';
import { Badge, Icon, PowerBadge, Stars, Status, StatusDot, cx } from '../components/ui.jsx';
import { ago, rs } from '../lib/format.js';
import { tx, useI18n } from '../lib/i18n.jsx';

export const CONNECTOR_LABEL = { CCS2: 'CCS2', Type2: 'Type 2', Bharat_AC001: 'Bharat AC-001', Bharat_DC001: 'Bharat DC-001', LEV_DC: 'LEV DC', Type6: 'Type 6', CHAdeMO: 'CHAdeMO', GBT: 'GB/T', Type1: 'Type 1', '3PIN': '3-pin' };

/** "Price changes to ₹25/kWh at 6 pm" for time-of-day tariffs. */
export function nextChangeText(price) {
  if (!price?.nextChange) return null;
  const at = new Date(price.nextChange.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return tx('Changes to {{rate}}/kWh at {{at}}', { rate: rs(price.nextChange.energyPaisePerKwh), at });
}

export function priceLine(price, t) {
  if (!price) return '—';
  const parts = [`${rs(price.energyPaisePerKwh)}${t ? t('perKwh') : '/kWh'}${price.band && price.band !== 'Standard' ? ` (${price.band})` : ''}`];
  if (price.sessionFeePaise) parts.push(`+ ${rs(price.sessionFeePaise, { decimals: 0 })} ${t ? t('sessionFee') : 'session fee'}`);
  if (price.timePaisePerMin) parts.push(`+ ${rs(price.timePaisePerMin)}/min`);
  return `${parts.join(' ')}${price.gstIncluded ? ' (incl. GST)' : ` + ${price.gstRatePct}% GST`}`;
}

/** Group the per-charger API results into one station (site) each. */
export function groupBySite(chargers) {
  const map = new Map();
  for (const c of chargers) {
    const k = c.site?.id || c.ocppId;
    if (!map.has(k)) map.set(k, { key: k, site: c.site, operator: c.operator, distanceKm: c.distanceKm, chargers: [] });
    map.get(k).chargers.push(c);
  }
  return [...map.values()].map((g) => {
    const conns = g.chargers.flatMap((c) => c.connectors);
    const prices = g.chargers.map((c) => c.price?.energyPaisePerKwh).filter(Boolean);
    const rated = g.chargers.filter((c) => c.rating?.count);
    return {
      ...g,
      free: conns.filter((x) => x.status === 'Available').length,
      total: conns.length,
      working: g.chargers.some((c) => c.working),
      minPrice: prices.length ? Math.min(...prices) : null,
      priceVaries: new Set(prices).size > 1,
      band: g.chargers.find((c) => c.price?.band && c.price.band !== 'Standard')?.price.band,
      powers: [...new Map(conns.map((x) => [`${x.powerType}${x.maxPowerKw}`, x])).values()].sort((a, b) => b.maxPowerKw - a.maxPowerKw),
      rating: rated.length ? { avg: rated.reduce((s, c) => s + c.rating.avg * c.rating.count, 0) / rated.reduce((s, c) => s + c.rating.count, 0), count: rated.reduce((s, c) => s + c.rating.count, 0) } : null,
      lastCharged: g.chargers.map((c) => c.lastSuccessfulChargeAt).filter(Boolean).sort().pop(),
      uptime: Math.round(g.chargers.reduce((s, c) => s + (c.uptimePct ?? 100), 0) / g.chargers.length),
      types: [...new Set(conns.map((x) => CONNECTOR_LABEL[x.type] || x.type))],
      best: g.chargers.find((c) => c.connectors.some((x) => x.status === 'Available')) || g.chargers[0],
    };
  });
}

function Thumb({ site, working }) {
  const photo = site?.photos?.[0];
  return photo ? (
    <img src={photo} alt="" className={cx('h-20 w-20 shrink-0 rounded-2xl object-cover', !working && 'grayscale')} />
  ) : (
    <div className={cx('relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl text-white', working ? 'bg-electric' : 'bg-ink-300 dark:bg-ink-700')}>
      <Icon name="bolt" className="h-9 w-9 opacity-90" strokeWidth={2.2} />
      <div className="absolute -bottom-6 -right-6 h-14 w-14 rounded-full bg-white/15" />
    </div>
  );
}

/** One station on the Discover list (UX 1.3: price, free now, distance, last successful charge). */
export function SiteCard({ g }) {
  const { t } = useI18n();
  return (
    <Link to={`/charger/${encodeURIComponent(g.best.ocppId)}`} className={cx('card card-hover block p-3', !g.working && 'opacity-70')}>
      <div className="flex gap-3">
        <Thumb site={g.site} working={g.working} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold leading-tight">{g.site?.name}</div>
              <div className="truncate text-xs muted">{g.operator}{g.site?.city ? ` · ${g.site.city}` : ''}</div>
            </div>
            {g.distanceKm !== null && g.distanceKm !== undefined && <span className="shrink-0 rounded-lg bg-ink-100 px-2 py-0.5 text-[11px] font-bold dark:bg-ink-800">{g.distanceKm} km</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {g.working ? (
              <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold', g.free ? 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300' : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300')}>
                <StatusDot tone={g.free ? 'green' : 'blue'} pulse={!!g.free} />{g.free ? `${g.free}/${g.total} ${tx('free')}` : tx('In use')}
              </span>
            ) : <Badge tone="gray">{t('notWorking')}</Badge>}
            {g.powers.slice(0, 2).map((p) => <PowerBadge key={`${p.powerType}${p.maxPowerKw}`} kw={p.maxPowerKw} type={p.powerType} />)}
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              {g.minPrice && g.priceVaries && <span className="mr-1 text-[11px] font-semibold muted">{tx('from')}</span>}{g.minPrice && <span className="text-base font-extrabold tabular-nums">{rs(g.minPrice)}<span className="text-xs font-semibold muted">/kWh</span></span>}
              {g.band && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">{g.band}</span>}
            </div>
            <div className="flex items-center gap-2 text-[11px] muted">
              {g.rating && <Stars value={g.rating.avg} />}
              <span title={t('uptime')}>{g.uptime}% up</span>
              {g.lastCharged && <span>· {tx('charged')} {ago(g.lastCharged)}</span>}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1 border-t border-ink-100 pt-2 dark:border-ink-800">
        {g.types.map((x) => <span key={x} className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300">{x}</span>)}
        {g.chargers.length > 1 && <span className="ml-auto text-[10px] font-semibold muted">{g.chargers.length} {tx('chargers')}</span>}
      </div>
    </Link>
  );
}

// Kept for other lists (favourites etc.)
export function ChargerCard({ c }) {
  return <SiteCard g={groupBySite([c])[0]} />;
}

const TONE = { Available: 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40', Occupied: 'border-sky-400 bg-sky-50/60 dark:bg-sky-950/30' };

export function ConnectorTile({ conn, selected, onSelect }) {
  const usable = conn.status === 'Available' || conn.status === 'Occupied';
  return (
    <button type="button" disabled={!usable} onClick={() => onSelect?.(conn.number)} className={cx('card flex min-h-[76px] w-full items-center justify-between gap-3 border-2 p-3 text-left transition disabled:opacity-50', selected ? 'border-brand-600 shadow-glow' : `border-transparent hover:border-brand-200 ${usable ? '' : ''}`, !selected && usable && TONE[conn.status] ? '' : '')}>
      <div className="flex items-center gap-3">
        <div className={cx('grid h-12 w-12 place-items-center rounded-2xl text-lg font-black', selected ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200')}>{conn.number}</div>
        <div>
          <div className="font-bold">{CONNECTOR_LABEL[conn.type] || conn.type}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs muted"><PowerBadge kw={conn.maxPowerKw} type={conn.powerType} /><span>{(conn.vehicleTypes || []).join(' / ')}</span></div>
        </div>
      </div>
      <Status value={conn.status} />
    </button>
  );
}

export const directionsUrl = (loc) => (loc?.lat !== undefined ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}` : null);

export function MetaRow({ icon, children }) {
  return <div className="flex items-start gap-2.5 text-sm"><Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><div className="min-w-0">{children}</div></div>;
}
