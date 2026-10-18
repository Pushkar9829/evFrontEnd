import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, tokens } from '../lib/api.js';
import { useApi, useInterval } from '../lib/hooks.js';
import { useI18n } from '../lib/i18n.jsx';
import { ago } from '../lib/format.js';
import { Card, ErrorBox, Icon, Loading, useToast } from '../components/ui.jsx';
import { ConnectorTile, MetaRow, directionsUrl, priceLine } from './ChargerBits.jsx';

export default function ChargerDetail() {
  const { ocppId } = useParams();
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const { data: c, error, loading, reload } = useApi(`/api/public/chargers/${encodeURIComponent(ocppId)}`, { auth: 'none' });
  const [sel, setSel] = useState(null);
  useInterval(() => reload({ quiet: true }), 15000); // live status
  if (loading && !c) return <Loading />;
  if (error) return <div className="p-4"><ErrorBox error={error} /></div>;
  const usable = c.connectors.filter((x) => ['Available', 'Occupied'].includes(x.status));
  const chosen = sel ?? (usable.length === 1 ? usable[0].number : null);
  const dir = directionsUrl(c.site?.location);
  const fav = async () => {
    if (!tokens.driver()) return nav('/login?next=' + encodeURIComponent(location.pathname));
    await api(`/api/me/favourites/${c.id}`, { method: 'POST', auth: 'driver' });
    return toast('Saved to favourites');
  };
  return (
    <div className="space-y-4 p-4">
      <button type="button" className="btn-ghost btn-sm -ml-2" onClick={() => nav(-1)}><Icon name="back" className="h-4 w-4" /> Back</button>
      {c.site?.photos?.[0] && <img src={c.site.photos[0]} alt={`Charger spot at ${c.site.name}`} className="h-44 w-full rounded-2xl object-cover" />}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{c.site?.name}</h1>
          <div className="text-sm muted">{c.label} · {c.operator}</div>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={fav} aria-label="Save to favourites"><Icon name="heart" className="h-4 w-4" /></button>
      </div>
      <Card className="space-y-2 p-4">
        <MetaRow icon="pin">{c.site?.address}</MetaRow>
        {c.site?.howToReach && <MetaRow icon="map"><b>{t('howToReach')}:</b> {c.site.howToReach}</MetaRow>}
        <MetaRow icon="clock">Open {c.site?.timings}</MetaRow>
        <MetaRow icon="bolt"><b>{t('price')}:</b> {priceLine(c.price, t)}</MetaRow>
        <MetaRow icon="check">{t('lastCharged')}: {ago(c.lastSuccessfulChargeAt)} · {t('uptime')} {c.uptimePct}%{c.rating?.count ? ` · ★ ${c.rating.avg} (${c.rating.count})` : ''}</MetaRow>
        {c.price?.idle?.paisePerMin > 0 && <MetaRow icon="alert">Idle fee ₹{(c.price.idle.paisePerMin / 100).toFixed(0)}/min after {c.price.idle.graceMin} min once charging ends.</MetaRow>}
        {c.site?.amenities?.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{c.site.amenities.map((a) => <span key={a} className="rounded-full bg-ink-100 px-2 py-0.5 text-xs dark:bg-ink-800">{a}</span>)}</div>}
        {dir && <a href={dir} target="_blank" rel="noreferrer" className="btn-secondary btn-sm mt-2 w-full">{t('directions')}</a>}
      </Card>
      <div className="space-y-2">
        <div className="text-sm font-semibold">Connectors</div>
        {c.connectors.map((x) => <ConnectorTile key={x.number} conn={x} selected={chosen === x.number} onSelect={setSel} />)}
      </div>
      {!c.working && <ErrorBox error={{ message: 'This charger is not working right now. We hide it from the map until it is back.' }} />}
      <div className="sticky bottom-20 pt-2">
        <Link to={chosen ? `/c/${encodeURIComponent(c.ocppId)}/${chosen}` : '#'} aria-disabled={!chosen} className={`btn-primary btn-lg w-full ${chosen ? '' : 'pointer-events-none opacity-50'}`}>
          <Icon name="bolt" /> {chosen ? `${t('startCharging')} · connector ${chosen}` : 'Choose a connector'}
        </Link>
      </div>
    </div>
  );
}
