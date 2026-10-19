import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, tokens } from '../lib/api.js';
import { useApi, useInterval } from '../lib/hooks.js';
import { tx, useI18n } from '../lib/i18n.jsx';
import { useTemporaryBrand } from '../lib/brand.jsx';
import { ago, rs } from '../lib/format.js';
import { ActionButton, Card, ErrorBox, Icon, IconBubble, Loading, Modal, Stars, StatusDot, cx, useToast } from '../components/ui.jsx';
import { ConnectorTile, MetaRow, directionsUrl, nextChangeText, priceLine } from './ChargerBits.jsx';

function HeroAction({ icon, label, onClick, href }) {
  const cls = 'flex flex-1 flex-col items-center gap-1 rounded-2xl bg-white/15 py-2 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-white/25';
  const inner = <><Icon name={icon} className="h-5 w-5" />{label}</>;
  return href ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a> : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

export default function ChargerDetail() {
  const { ocppId } = useParams();
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const { data: c, error, loading, reload } = useApi(`/api/public/chargers/${encodeURIComponent(ocppId)}`, { auth: 'none' });
  const [sel, setSel] = useState(null);
  const [report, setReport] = useState(null);
  useTemporaryBrand(c?.branding);
  useInterval(() => reload({ quiet: true }), 15000); // live status
  if (loading && !c) return <Loading />;
  if (error) return <div className="p-4"><ErrorBox error={error} /></div>;
  const usable = c.connectors.filter((x) => ['Available', 'Occupied'].includes(x.status));
  const free = c.connectors.filter((x) => x.status === 'Available').length;
  const chosen = sel ?? (usable.length === 1 ? usable[0].number : null);
  const dir = directionsUrl(c.site?.location);
  const maxKw = Math.max(...c.connectors.map((x) => x.maxPowerKw || 0));
  const fav = async () => {
    if (!tokens.driver()) return nav('/login?next=' + encodeURIComponent(location.pathname));
    await api(`/api/me/favourites/${c.id}`, { method: 'POST', auth: 'driver' });
    return toast(tx('Saved to favourites'));
  };
  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: c.site?.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast(tx('Link copied'));
      }
    } catch {
      /* user cancelled */
    }
  };
  return (
    <div className="pb-4">
      <div className="relative overflow-hidden bg-electric text-white">
        {c.site?.photos?.[0] && <img src={c.site.photos[0]} alt={`Charger spot at ${c.site.name}`} className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/40 to-ink-950/10" />
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="relative space-y-4 p-4 pt-3">
          <button type="button" className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 backdrop-blur hover:bg-white/30" onClick={() => nav(-1)} aria-label={tx('Back')}><Icon name="back" className="h-4 w-4" /></button>
          <div className="pt-10">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/75">{c.operator}</div>
            <h1 className="text-2xl font-extrabold leading-tight">{c.site?.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/85">
              <span>{c.label}</span>
              {c.working ? <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold"><StatusDot tone={free ? 'green' : 'blue'} pulse={!!free} />{free ? `${free}/${c.connectors.length} ${tx('free')}` : tx('In use')}</span> : <span className="rounded-full bg-red-500/80 px-2 py-0.5 text-xs font-bold">{t('notWorking')}</span>}
              {c.rating?.count > 0 && <span className="text-white"><Stars value={c.rating.avg} count={c.rating.count} /></span>}
            </div>
          </div>
          <div className="flex gap-2">
            {dir && <HeroAction icon="route" label={t('directions')} href={dir} />}
            <HeroAction icon="heart" label={tx('Save')} onClick={fav} />
            <HeroAction icon="share" label={tx('Share')} onClick={share} />
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center"><div className="text-[10px] font-bold uppercase tracking-wider muted">{t('price')}</div><div className="mt-0.5 text-lg font-extrabold tabular-nums">{rs(c.price?.energyPaisePerKwh)}</div><div className="text-[10px] muted">/kWh{c.price?.band && c.price.band !== 'Standard' ? ` · ${c.price.band}` : ''}</div></Card>
          <Card className="p-3 text-center"><div className="text-[10px] font-bold uppercase tracking-wider muted">{tx('Up to')}</div><div className="mt-0.5 text-lg font-extrabold tabular-nums text-fast-600">{maxKw}</div><div className="text-[10px] muted">kW</div></Card>
          <Card className="p-3 text-center"><div className="text-[10px] font-bold uppercase tracking-wider muted">{t('uptime')}</div><div className="mt-0.5 text-lg font-extrabold tabular-nums text-brand-600">{c.uptimePct}%</div><div className="text-[10px] muted">30 d</div></Card>
        </div>
        {c.price?.nextChange && <div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"><Icon name="clock" className="h-4 w-4 shrink-0" />{nextChangeText(c.price)} — {tx('the price when you start is locked for your whole session.')}</div>}

        <div className="space-y-2">
          <div className="flex items-baseline justify-between"><h2 className="font-bold">{tx('Choose a connector')}</h2><span className="text-xs muted">{tx('Live')} · {tx('updates every 15 s')}</span></div>
          {c.connectors.map((x) => <ConnectorTile key={x.number} conn={x} selected={chosen === x.number} onSelect={setSel} />)}
        </div>
        {!c.working && <ErrorBox error={{ message: tx('This charger is not working right now. We hide it from the map until it is back.') }} />}

        <Card className="space-y-3 p-4">
          <MetaRow icon="pin">{c.site?.address}</MetaRow>
          {c.site?.howToReach && <MetaRow icon="map"><b>{t('howToReach')}:</b> {c.site.howToReach}</MetaRow>}
          <MetaRow icon="clock">{tx('Open')} {c.site?.timings}</MetaRow>
          <MetaRow icon="bolt"><b>{t('price')}:</b> {priceLine(c.price, t)}</MetaRow>
          {c.lastSuccessfulChargeAt && <MetaRow icon="check">{t('lastCharged')}: {ago(c.lastSuccessfulChargeAt)}</MetaRow>}
          {c.price?.idle?.paisePerMin > 0 && <MetaRow icon="alert">{tx('Idle fee')} ₹{(c.price.idle.paisePerMin / 100).toFixed(0)}/min {tx('after')} {c.price.idle.graceMin} min {tx('once charging ends.')}</MetaRow>}
          {c.site?.amenities?.length > 0 && <div className="flex flex-wrap gap-1.5 border-t border-ink-100 pt-3 dark:border-ink-800">{c.site.amenities.map((a) => <span key={a} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-300">{a}</span>)}</div>}
        </Card>

        <button type="button" className="card card-hover flex w-full items-center gap-3 p-3 text-left text-sm" onClick={() => setReport({ category: 'spot_blocked' })}>
          <IconBubble name="alert" tone="amber" size="sm" /><span className="flex-1 font-semibold">{tx('Report a problem with this spot')}</span><Icon name="chev" className="h-4 w-4 muted" />
        </button>
        <Modal open={!!report} onClose={() => setReport(null)} title={tx('Report a problem with this spot')} footer={<ActionButton onClick={async () => { await api(`/api/public/chargers/${encodeURIComponent(c.ocppId)}/report`, { method: 'POST', auth: 'none', body: { category: report.category, connector: report.connector || undefined, description: report.description || undefined } }); setReport(null); toast(tx('Thanks — the operator has been alerted.')); }}>{tx('Send report')}</ActionButton>}>
          {report && (
            <div className="space-y-2 text-sm">
              {[['spot_blocked', tx('Spot blocked by a parked car')], ['charger_damaged', tx('Charger damaged')], ['other', tx('Something else')]].map(([v, l]) => (
                <label key={v} className="flex items-center gap-2"><input type="radio" name="cat" className="accent-brand-600" checked={report.category === v} onChange={() => setReport({ ...report, category: v })} />{l}</label>
              ))}
              <select className="input" value={report.connector || ''} onChange={(e) => setReport({ ...report, connector: Number(e.target.value) || undefined })}><option value="">{tx('Connector')}…</option>{c.connectors.map((x) => <option key={x.number} value={x.number}>#{x.number}</option>)}</select>
              <textarea className="input min-h-[70px] py-2" placeholder={tx('Details (optional)')} value={report.description || ''} onChange={(e) => setReport({ ...report, description: e.target.value })} />
            </div>
          )}
        </Modal>
      </div>

      <div className="sticky bottom-24 z-10 px-4 pt-4">
        <Link to={chosen ? `/c/${encodeURIComponent(c.ocppId)}/${chosen}` : '#'} aria-disabled={!chosen} className={cx('btn-electric btn-lg w-full', !chosen && 'pointer-events-none bg-none bg-ink-200 text-ink-500 shadow-none dark:bg-ink-800 dark:text-ink-400')}>
          <Icon name="bolt" /> {chosen ? `${t('startCharging')} · ${tx('connector')} ${chosen}` : tx('Choose a connector above')}
        </Link>
      </div>
    </div>
  );
}
