// QR landing: charger + connector preselected, choose amount, phone, pay by UPI (3 taps).
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api, newKey, store, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { tx, useI18n } from '../lib/i18n.jsx';
import { useTemporaryBrand } from '../lib/brand.jsx';
import { rs, rs0 } from '../lib/format.js';
import { Card, ErrorBox, Icon, IconBubble, Loading, Spinner, Status, cx } from '../components/ui.jsx';
import { CONNECTOR_LABEL, ChargerCard, nextChangeText, priceLine } from './ChargerBits.jsx';

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error('Could not load the payment page. Check your connection.'));
    document.body.appendChild(s);
    return undefined;
  });
}

export default function QrStart() {
  const { ocppId, connector } = useParams();
  const { t } = useI18n();
  const nav = useNavigate();
  const { cfg } = useOutletContext() || {};
  const { data, error, loading } = useApi(`/api/public/qr/${encodeURIComponent(ocppId)}/${connector}`, { auth: 'none' });
  useTemporaryBrand(data?.branding);
  const loggedIn = !!tokens.driver();
  const me = useApi(loggedIn ? '/api/me' : null, { auth: 'driver' });
  const [amount, setAmount] = useState(() => Number(store.get('cx.lastAmount')) || 20000);
  const [custom, setCustom] = useState('');
  const [phone, setPhone] = useState(store.get('cx.phone') || '');
  const [promo, setPromo] = useState('');
  const [showPromo, setShowPromo] = useState(false);
  const [mode, setMode] = useState('upi'); // upi | autopay | fleet
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [key] = useState(newKey); // one order per screen, double taps ignored (PAY-09)
  const user = me.data?.user;

  useEffect(() => {
    if (user?.lastAmountPaise) setAmount(user.lastAmountPaise);
  }, [user?.lastAmountPaise]);

  const est = useMemo(() => data?.amounts?.find((a) => a.amountPaise === amount), [data, amount]);
  const vehicle = user?.vehicles?.[0];
  const suggestion = useMemo(() => {
    if (!vehicle?.batteryKwh || !data?.price) return null;
    const kwhNeeded = vehicle.batteryKwh * 0.5; // ~30% -> 80%
    const paise = Math.ceil(((kwhNeeded * data.price.energyPaisePerKwh + (data.price.sessionFeePaise || 0)) * (data.price.gstIncluded ? 1 : 1 + data.price.gstRatePct / 100)) / 1000) * 1000;
    return { paise: Math.min(paise, cfg?.maxAmountPaise || 500000), kwh: kwhNeeded };
  }, [vehicle, data, cfg]);

  if (loading) return <Loading />;
  if (error) {
    const alts = error.body?.alternatives || [];
    return (
      <div className="space-y-4 p-4">
        <Card className="p-5 text-center">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700"><Icon name="alert" /></div>
          <h1 className="text-lg font-bold">{error.code === 'NOT_IN_SERVICE' ? tx('This charger is not in service') : tx('Charger not found')}</h1>
          <p className="mt-1 text-sm muted">{tx("Nothing has been charged. Try one of these nearby:")}</p>
        </Card>
        {alts.map((c) => <ChargerCard key={c.ocppId} c={c} />)}
        <Link to="/" className="btn-secondary w-full">{tx("Find another charger")}</Link>
      </div>
    );
  }

  const conn = data.connector;
  const usable = ['Available', 'Occupied'].includes(conn.status);
  const minA = cfg?.minAmountPaise || 5000;
  const maxA = cfg?.maxAmountPaise || 500000;
  const finalAmount = custom ? Math.round(Number(custom) * 100) : amount;
  const amountOk = mode !== 'upi' || (finalAmount >= minA && finalAmount <= maxA);
  const phoneOk = loggedIn || /^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').slice(-10));
  const canPay = usable && amountOk && phoneOk && !busy && !(cfg?.paymentsPaused && mode === 'upi');

  async function pay() {
    setBusy(true);
    setErr(null);
    try {
      const body = { ocppId, connector: Number(connector), idempotencyKey: key };
      if (mode === 'upi') body.amountPaise = finalAmount;
      if (mode === 'fleet') body.fleet = true;
      if (!loggedIn) body.phone = phone.replace(/\D/g, '').slice(-10);
      if (promo) body.promoCode = promo;
      const r = await api('/api/sessions', { method: 'POST', body, auth: loggedIn ? 'driver' : 'none' });
      if (r.accessToken) tokens.setSession(r.sessionId, r.accessToken);
      if (r.viewToken) tokens.setView(r.sessionId, r.viewToken);
      store.set('cx.lastAmount', String(finalAmount));
      if (!loggedIn) store.set('cx.phone', body.phone);
      if (!r.checkout) return nav(`/s/${r.sessionId}`);
      if (r.checkout.provider === 'mock') return nav(`/pay/mock/${r.orderId}?s=${r.sessionId}`);
      const Razorpay = await loadRazorpay();
      const rp = new Razorpay({
        key: r.checkout.keyId, order_id: r.checkout.orderId, amount: r.checkout.amount, currency: 'INR', name: 'ChargeX', description: `Charging at ${data.site?.name}`,
        prefill: { contact: body.phone || user?.phone }, method: { upi: true },
        handler: () => nav(`/s/${r.sessionId}`),
        modal: { ondismiss: () => nav(`/s/${r.sessionId}`) },
      });
      rp.open();
      return undefined;
    } catch (e) {
      setErr(e);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  // Say why the button is disabled instead of a silent grey button.
  const blocker = cfg?.paymentsPaused && mode === 'upi' ? tx('Payments are paused') : !phoneOk ? tx('Enter your mobile number above') : !amountOk ? tx('Choose an amount') : null;
  const vt = conn.vehicleTypes || [];
  const kmPerKwh = vt.includes('car') ? 7 : vt.includes('3W') ? 12 : 30; // rough range for the ≈km hint
  const finalEst = custom ? null : est;

  return (
    <div className="space-y-4 p-4">
      <Card className="overflow-hidden">
        <div className="bg-electric p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/75">{data.operator}</div>
              <h1 className="truncate text-lg font-extrabold">{data.site?.name}</h1>
              <div className="truncate text-sm text-white/80">{data.site?.address}</div>
            </div>
            <span className="shrink-0 rounded-full bg-white p-0.5"><Status value={conn.status} /></span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/20 text-xl font-black">{conn.number}</div>
            <div className="min-w-0">
              <div className="font-bold">{CONNECTOR_LABEL[conn.type] || conn.type}</div>
              <div className="text-xs text-white/85">{conn.maxPowerKw} kW {conn.powerType}{conn.powerType === 'DC' && conn.maxPowerKw >= 25 ? ` · ${tx('DC fast')}` : ''}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-2xl font-extrabold tabular-nums">{rs(data.price?.energyPaisePerKwh)}</div>
              <div className="text-[11px] text-white/80">{t('perKwh')}{data.price?.band && data.price.band !== 'Standard' ? ` · ${data.price.band}` : ''}</div>
            </div>
          </div>
        </div>
        <div className="space-y-2 p-4 pt-3">
          <div className="text-xs muted">{priceLine(data.price, t)}</div>
          {data.price?.nextChange && <div className="text-xs font-medium text-amber-700 dark:text-amber-400">{nextChangeText(data.price)} — {tx("the price when you start is locked for your whole session.")}</div>}
          {/* QR-06: compare with the ID printed on the charger; our QR only opens chargex */}
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-2 text-xs dark:border-brand-800 dark:bg-brand-950/30">
            <Icon name="shield" className="h-4 w-4 shrink-0 text-brand-600" />
            <span>{tx("Check this matches the ID printed on the charger:")} <b className="font-mono">{data.printedId}</b>{tx(". We never ask you to pay a personal UPI ID.")}</span>
          </div>
          {data.connectors?.length > 1 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pt-1">
              {data.connectors.map((c) => (
                <Link key={c.number} to={`/c/${encodeURIComponent(ocppId)}/${c.number}`} replace className={cx('chip', c.number === conn.number && 'chip-on')}>#{c.number} {CONNECTOR_LABEL[c.type] || c.type}</Link>
              ))}
            </div>
          )}
        </div>
      </Card>

      {!usable ? (
        <ErrorBox error={{ message: conn.status === 'Offline' ? tx('This charger is offline right now. Nothing will be charged. Try another charger nearby.') : tx('This connector is not available right now. Try another connector.') }} />
      ) : (
        <>
          {!loggedIn && (
            <Card className="p-4">
              <label className="block">
                <span className="label flex items-center gap-1.5"><Icon name="phone" className="h-3.5 w-3.5" />{t('phoneForReceipt')}</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold muted">+91</span>
                  <input className={cx('input h-12 pl-12 text-base tracking-wide', phone && !phoneOk && 'border-red-400')} inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  {phoneOk && <Icon name="check" className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-600" />}
                </div>
              </label>
              {phone && !phoneOk && <div className="mt-1 text-xs text-red-600">{tx("Enter a valid 10-digit mobile number.")}</div>}
              <div className="mt-2 text-xs muted">{tx("No account needed.")} <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className="font-semibold text-brand-700 dark:text-brand-400">{tx("Log in")}</Link> {tx("for history and one-tap payments.")}</div>
            </Card>
          )}
          {user && (user.autopay?.status === 'active' || user.fleet) && (
            <div className="grid grid-flow-col gap-1 rounded-2xl bg-ink-100 p-1 dark:bg-ink-800">
              {[{ v: 'upi', l: tx('Prepay UPI') }, user.autopay?.status === 'active' && { v: 'autopay', l: tx('UPI Autopay') }, user.fleet && { v: 'fleet', l: tx('Fleet account') }].filter(Boolean).map((o) => (
                <button key={o.v} type="button" onClick={() => setMode(o.v)} className={cx('min-h-[40px] rounded-xl text-sm font-semibold transition', mode === o.v ? 'bg-white text-brand-700 shadow-card dark:bg-ink-950 dark:text-brand-300' : 'muted')}>{o.l}</button>
              ))}
            </div>
          )}
          {mode === 'upi' && (
            <Card className="space-y-3 p-4">
              <div className="flex items-baseline justify-between gap-2"><div className="font-bold">{t('chooseAmount')}</div><div className="text-[11px] muted">{tx('Unused money is refunded')}</div></div>
              {suggestion && (
                <button type="button" onClick={() => { setAmount(suggestion.paise); setCustom(''); }} className={cx('flex w-full items-center gap-3 rounded-2xl p-3 text-left text-sm transition', !custom && amount === suggestion.paise ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-200')}>
                  <Icon name="sparkle" className="h-5 w-5 shrink-0" />
                  <span>{tx('Charge your {{v}} to ~80%', { v: vehicle.label || vehicle.model })}: <b>{rs0(suggestion.paise)}</b></span>
                </button>
              )}
              <div className="grid grid-cols-3 gap-2">
                {data.amounts.map((a) => {
                  const on = !custom && amount === a.amountPaise;
                  return (
                    <button key={a.amountPaise} type="button" onClick={() => { setAmount(a.amountPaise); setCustom(''); }} className={cx('relative rounded-2xl border-2 p-3 text-center transition', on ? 'border-brand-600 bg-brand-50 shadow-glow dark:bg-brand-950' : 'border-ink-200 hover:border-brand-300 dark:border-ink-700')}>
                      {on && <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white"><Icon name="check" className="h-3 w-3" strokeWidth={3} /></span>}
                      <div className="text-lg font-extrabold">{rs0(a.amountPaise)}</div>
                      <div className="text-[11px] font-semibold text-brand-700 dark:text-brand-400">≈ {Math.round(a.kwh * kmPerKwh)} km</div>
                      <div className="text-[10px] muted">{a.kwh} kWh · {a.minutes} min</div>
                    </button>
                  );
                })}
              </div>
              <label className="block">
                <span className="label">{t('custom')} (₹{minA / 100}–₹{maxA / 100})</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold muted">₹</span>
                  <input className="input pl-7" inputMode="numeric" placeholder={tx("e.g. 350")} value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))} />
                </div>
              </label>
              {custom && !amountOk && <div className="text-xs text-red-600">{tx('Enter between ₹{{min}} and ₹{{max}}.', { min: minA / 100, max: maxA / 100 })}</div>}
              {finalEst && <div className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-xs dark:bg-ink-800"><Icon name="gauge" className="h-4 w-4 shrink-0 text-brand-600" />{tx("About {{kwh}} kWh, roughly {{min}} min at full power.", { kwh: finalEst.kwh, min: finalEst.minutes })}</div>}
            </Card>
          )}
          <div>
            {!showPromo ? <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-400" onClick={() => setShowPromo(true)}><Icon name="sparkle" className="h-3.5 w-3.5" />{tx("Have a promo code?")}</button> : (
              <input className="input" placeholder={tx("Promo code")} value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            {[['shield', tx('Secure UPI')], ['refresh', tx('Auto refund')], ['check', tx('Pay only for energy')]].map(([i, l]) => (
              <div key={l} className="flex flex-col items-center gap-1 rounded-2xl bg-white p-2 shadow-card dark:bg-ink-900"><IconBubble name={i} tone="green" size="sm" /><span className="font-semibold">{l}</span></div>
            ))}
          </div>
          <ErrorBox error={err} />
          <div className="sticky bottom-0 -mx-4 border-t border-ink-200 bg-white/95 p-4 pb-[max(env(safe-area-inset-bottom),16px)] backdrop-blur dark:border-ink-800 dark:bg-ink-950/95">
            <button type="button" disabled={!canPay} onClick={pay} className="btn-electric btn-lg w-full disabled:bg-none disabled:bg-ink-200 disabled:text-ink-500 disabled:opacity-100 disabled:shadow-none dark:disabled:bg-ink-800 dark:disabled:text-ink-400">
              {busy ? <Spinner className="h-5 w-5 text-white" /> : <Icon name="bolt" />}
              {mode === 'upi' ? `${t('payUpi')} · ${rs0(finalAmount)}` : mode === 'fleet' ? tx('Start on fleet account') : tx('Start with UPI Autopay')}
            </button>
            {blocker && !busy ? <div className="mt-2 flex items-center justify-center gap-1 text-center text-xs font-semibold text-amber-700 dark:text-amber-400"><Icon name="alert" className="h-3.5 w-3.5" />{blocker}</div> : (
              <div className="mt-2 text-center text-xs muted">
                {mode === 'upi' ? <>{rs0(finalAmount)} {t('prepaidNote')}. {tx('No energy delivered = no money taken.')}</> : tx('You pay only for the energy used, after the session.')}
              </div>
            )}
            {mode === 'upi' && (
              <div className="mt-2 flex items-center justify-center gap-1.5">
                {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map((a) => <span key={a} className="rounded-md border border-ink-200 px-1.5 py-0.5 text-[10px] font-bold text-ink-500 dark:border-ink-700 dark:text-ink-400">{a}</span>)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
