// QR landing: charger + connector preselected, choose amount, phone, pay by UPI (3 taps).
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api, newKey, store, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { tx, useI18n } from '../lib/i18n.jsx';
import { useTemporaryBrand } from '../lib/brand.jsx';
import { rs, rs0 } from '../lib/format.js';
import { Card, ErrorBox, Icon, Loading, Spinner, Status, cx } from '../components/ui.jsx';
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

  return (
    <div className="space-y-4 p-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide muted">{data.operator}</div>
            <h1 className="text-lg font-bold">{data.site?.name}</h1>
            <div className="text-sm muted">{data.site?.address}</div>
          </div>
          <Status value={conn.status} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-ink-50 p-2 dark:bg-ink-800"><div className="text-xs muted">{tx("Connector")} {conn.number}</div><div className="font-semibold">{CONNECTOR_LABEL[conn.type] || conn.type} · {conn.maxPowerKw} kW</div></div>
          <div className="rounded-xl bg-ink-50 p-2 dark:bg-ink-800"><div className="text-xs muted">{t('price')}</div><div className="font-semibold">{rs(data.price?.energyPaisePerKwh)}/kWh</div></div>
        </div>
        <div className="mt-2 text-xs muted">{priceLine(data.price, t)}</div>
        {data.price?.nextChange && <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">{nextChangeText(data.price)} — {tx("the price when you start is locked for your whole session.")}</div>}
        {/* QR-06: compare with the ID printed on the charger; our QR only opens chargex */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-ink-300 p-2 text-xs dark:border-ink-700">
          <Icon name="shield" className="h-4 w-4 text-brand-600" />
          <span>{tx("Check this matches the ID printed on the charger:")} <b className="font-mono">{data.printedId}</b>{tx(". We never ask you to pay a personal UPI ID.")}</span>
        </div>
        {data.connectors?.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {data.connectors.map((c) => (
              <Link key={c.number} to={`/c/${encodeURIComponent(ocppId)}/${c.number}`} replace className={cx('btn-sm btn border', c.number === conn.number ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950' : 'border-ink-200 dark:border-ink-700')}>#{c.number} {CONNECTOR_LABEL[c.type] || c.type}</Link>
            ))}
          </div>
        )}
      </Card>

      {!usable ? (
        <ErrorBox error={{ message: conn.status === 'Offline' ? tx('This charger is offline right now. Nothing will be charged. Try another charger nearby.') : tx('This connector is not available right now. Try another connector.') }} />
      ) : (
        <>
          {user && (user.autopay?.status === 'active' || user.fleet) && (
            <Card className="flex gap-2 p-2">
              {[{ v: 'upi', l: tx('Prepay UPI') }, user.autopay?.status === 'active' && { v: 'autopay', l: tx('UPI Autopay') }, user.fleet && { v: 'fleet', l: tx('Fleet account') }].filter(Boolean).map((o) => (
                <button key={o.v} type="button" onClick={() => setMode(o.v)} className={cx('btn-sm btn flex-1', mode === o.v ? 'bg-brand-600 text-white' : 'btn-ghost')}>{o.l}</button>
              ))}
            </Card>
          )}
          {mode === 'upi' && (
            <Card className="space-y-3 p-4">
              <div className="font-semibold">{t('chooseAmount')}</div>
              {suggestion && (
                <button type="button" onClick={() => { setAmount(suggestion.paise); setCustom(''); }} className="w-full rounded-xl bg-brand-50 p-3 text-left text-sm text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                  Charge your {vehicle.label || vehicle.model} to ~80%: about <b>{rs0(suggestion.paise)}</b>
                </button>
              )}
              <div className="grid grid-cols-3 gap-2">
                {data.amounts.map((a) => (
                  <button key={a.amountPaise} type="button" onClick={() => { setAmount(a.amountPaise); setCustom(''); }} className={cx('rounded-2xl border-2 p-3 text-center transition', !custom && amount === a.amountPaise ? 'border-brand-600 bg-brand-50 dark:bg-brand-950' : 'border-ink-200 dark:border-ink-700')}>
                    <div className="text-lg font-bold">{rs0(a.amountPaise)}</div>
                    <div className="text-[11px] muted">~{a.kwh} kWh · {a.minutes} min</div>
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="label">{t('custom')} (₹{minA / 100}–₹{maxA / 100})</span>
                <input className="input" inputMode="numeric" placeholder={tx("e.g. 350")} value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))} />
              </label>
              {custom && !amountOk && <div className="text-xs text-red-600">Enter between ₹{minA / 100} and ₹{maxA / 100}.</div>}
              {!custom && est && <div className="text-xs muted">{tx("About {{kwh}} kWh, roughly {{min}} min at full power.", { kwh: est.kwh, min: est.minutes })}</div>}
            </Card>
          )}
          {!loggedIn && (
            <Card className="p-4">
              <label className="block">
                <span className="label">{t('phoneForReceipt')}</span>
                <input className="input text-base" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              {phone && !phoneOk && <div className="mt-1 text-xs text-red-600">{tx("Enter a valid 10-digit mobile number.")}</div>}
              <div className="mt-2 text-xs muted">{tx("No account needed.")} <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className="font-semibold text-brand-700">{tx("Log in")}</Link> {tx("for history and one-tap payments.")}</div>
            </Card>
          )}
          <div>
            {!showPromo ? <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setShowPromo(true)}>{tx("Have a promo code?")}</button> : (
              <input className="input" placeholder={tx("Promo code")} value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} />
            )}
          </div>
          <ErrorBox error={err} />
          <div className="sticky bottom-0 -mx-4 border-t border-ink-200 bg-white/95 p-4 backdrop-blur dark:border-ink-800 dark:bg-ink-950/95">
            <button type="button" disabled={!canPay} onClick={pay} className="btn-primary btn-lg w-full">
              {busy ? <Spinner className="h-5 w-5 text-white" /> : <Icon name="bolt" />}
              {mode === 'upi' ? `${t('payUpi')} · ${rs0(finalAmount)}` : mode === 'fleet' ? tx('Start on fleet account') : tx('Start with UPI Autopay')}
            </button>
            <div className="mt-2 text-center text-xs muted">
              {mode === 'upi' ? <>{rs0(finalAmount)} {t('prepaidNote')}. {tx('No energy delivered = no money taken.')}</> : tx('You pay only for the energy used, after the session.')}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
