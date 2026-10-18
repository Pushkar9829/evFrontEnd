import { Link } from 'react-router-dom';
import { Badge, Icon, Status, cx } from '../components/ui.jsx';
import { ago, rs } from '../lib/format.js';
import { useI18n } from '../lib/i18n.jsx';

export const CONNECTOR_LABEL = { CCS2: 'CCS2', Type2: 'Type 2', Bharat_AC001: 'Bharat AC-001', Bharat_DC001: 'Bharat DC-001', LEV_DC: 'LEV DC', Type6: 'Type 6', CHAdeMO: 'CHAdeMO', GBT: 'GB/T', Type1: 'Type 1', '3PIN': '3-pin' };

export function priceLine(price, t) {
  if (!price) return '—';
  const parts = [`${rs(price.energyPaisePerKwh)}${t ? t('perKwh') : '/kWh'}`];
  if (price.sessionFeePaise) parts.push(`+ ${rs(price.sessionFeePaise, { decimals: 0 })} ${t ? t('sessionFee') : 'session fee'}`);
  if (price.timePaisePerMin) parts.push(`+ ${rs(price.timePaisePerMin)}/min`);
  return `${parts.join(' ')}${price.gstIncluded ? ' (incl. GST)' : ` + ${price.gstRatePct}% GST`}`;
}

export function ChargerCard({ c, onClick }) {
  const { t } = useI18n();
  const avail = c.connectors.filter((x) => x.status === 'Available').length;
  return (
    <Link to={`/charger/${encodeURIComponent(c.ocppId)}`} onClick={onClick} className={cx('card block p-4 transition hover:border-brand-300', !c.working && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{c.site?.name}</div>
          <div className="truncate text-xs muted">{c.label} · {c.operator}{c.distanceKm !== null && c.distanceKm !== undefined ? ` · ${c.distanceKm} km` : ''}</div>
        </div>
        {c.working ? <Badge tone={avail ? 'green' : 'blue'}>{avail ? `${avail} free` : 'In use'}</Badge> : <Badge tone="gray">{t('notWorking')}</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.connectors.map((x) => (
          <span key={x.number} className="inline-flex items-center gap-1 rounded-lg bg-ink-100 px-2 py-1 text-xs dark:bg-ink-800">
            <span className={cx('h-1.5 w-1.5 rounded-full', x.status === 'Available' ? 'bg-brand-500' : x.status === 'Occupied' ? 'bg-sky-500' : 'bg-ink-400')} />
            {CONNECTOR_LABEL[x.type] || x.type} · {x.maxPowerKw} kW {x.powerType}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs muted">
        <span>{priceLine(c.price, t)}</span>
        <span>{t('lastCharged')}: {ago(c.lastSuccessfulChargeAt)}</span>
      </div>
    </Link>
  );
}

export function ConnectorTile({ conn, selected, onSelect }) {
  const usable = conn.status === 'Available' || conn.status === 'Occupied';
  return (
    <button type="button" disabled={!usable} onClick={() => onSelect?.(conn.number)} className={cx('card flex min-h-[72px] w-full items-center justify-between gap-3 p-3 text-left transition disabled:opacity-50', selected ? 'border-brand-500 ring-2 ring-brand-500/30' : 'hover:border-brand-300')}>
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{conn.number}</div>
        <div>
          <div className="font-semibold">{CONNECTOR_LABEL[conn.type] || conn.type}</div>
          <div className="text-xs muted">{conn.maxPowerKw} kW {conn.powerType} · {(conn.vehicleTypes || []).join(' / ')}</div>
        </div>
      </div>
      <Status value={conn.status} />
    </button>
  );
}

export const directionsUrl = (loc) => (loc?.lat !== undefined ? `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}` : null);

export function MetaRow({ icon, children }) {
  return <div className="flex items-start gap-2 text-sm"><Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" /><div>{children}</div></div>;
}
