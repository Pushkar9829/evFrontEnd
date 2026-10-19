// Live session: step indicator while starting, big numbers while charging, summary + refund after.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { API_URL, api, download, tokens } from '../lib/api.js';
import { tx, txKey, useI18n } from '../lib/i18n.jsx';
import { useNow } from '../lib/hooks.js';
import { useTemporaryBrand } from '../lib/brand.jsx';
import { duration, kw, rs, rs0, dt } from '../lib/format.js';
import { ActionButton, Card, ErrorBox, Field, Icon, Loading, Modal, ProgressRing, Spinner, Status, cx, useToast } from '../components/ui.jsx';

const ACTIVE = ['CREATED', 'PAID', 'STARTING', 'CHARGING', 'STOPPING', 'INTERRUPTED'];

function Steps({ s, t }) {
  const labels = t('steps');
  return (
    <ol className="space-y-3">
      {labels.map((l, i) => {
        const done = s.step > i || (s.step === i && s.state === 'CHARGING');
        const current = s.step === i && s.state !== 'CHARGING';
        return (
          <li key={l} className="flex items-center gap-3">
            <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold', done ? 'bg-brand-600 text-white' : current ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500 dark:bg-brand-950' : 'bg-ink-100 muted dark:bg-ink-800')}>
              {done ? <Icon name="check" className="h-4 w-4" /> : current ? <Spinner className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cx('text-sm', current ? 'font-semibold' : done ? '' : 'muted')}>{l}</span>
          </li>
        );
      })}
    </ol>
  );
}

function PlugAnimation() {
  return (
    <div className="flex flex-col items-center gap-2 py-4" aria-live="polite">
      <div className="relative h-20 w-40">
        <div className="absolute left-0 top-6 h-8 w-16 rounded-lg bg-ink-200 dark:bg-ink-700" />
        <div className="absolute right-0 top-4 h-12 w-12 rounded-xl border-4 border-brand-600" />
        <div className="absolute top-8 h-4 w-10 animate-[plug_1.6s_ease-in-out_infinite] rounded bg-brand-600" style={{ left: 60 }} />
      </div>
      <style>{'@keyframes plug{0%,100%{transform:translateX(0)}50%{transform:translateX(30px)}}'}</style>
      <div className="text-lg font-semibold">{tx("Plug the cable into your vehicle")}</div>
    </div>
  );
}

const Big = ({ label, value, sub }) => (
  <div className="rounded-2xl bg-ink-50 p-3 text-center dark:bg-ink-800">
    <div className="text-[10px] font-bold uppercase tracking-wider muted">{label}</div>
    <div className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</div>
    {sub && <div className="text-[10px] muted">{sub}</div>}
  </div>
);

function shareReceipt(s) {
  const lines = [
    `⚡ ${tx('Charged at')} ${s.charger?.site?.name || ''}`,
    `${((s.energyWh || 0) / 1000).toFixed(2)} kWh · ${duration(s.startedAt, s.endedAt)}`,
    `${tx('Total')}: ${rs(s.costs?.totalPaise)}${s.refundPaise > 0 ? ` · ${tx('Refund')} ${rs(s.refundPaise)}` : ''}`,
    s.invoice?.number ? `${tx('Invoice')} ${s.invoice.number}` : '',
  ].filter(Boolean);
  window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
}

function Rating({ s, sessionId }) {
  const [stars, setStars] = useState(s.rating?.stars || 0);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(!!s.rating?.stars);
  const toast = useToast();
  const send = async (n, c) => {
    setStars(n);
    try {
      await api(`/api/sessions/${sessionId}/rating`, { method: 'POST', sessionId, body: { stars: n, comment: c || undefined } });
      setDone(true);
      toast(tx('Thanks for rating!'));
    } catch (e) {
      toast(e.message, 'red');
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} stars`} onClick={() => send(n, comment)} className="p-1"><Icon name="star" className={cx('h-8 w-8', n <= stars ? 'fill-amber-400 text-amber-400' : 'text-ink-300')} /></button>
        ))}
      </div>
      {done && stars <= 3 && <div className="flex gap-2"><input className="input" placeholder={tx("What went wrong? (optional)")} value={comment} onChange={(e) => setComment(e.target.value)} /><button type="button" className="btn-secondary" onClick={() => send(stars, comment)}>{tx("Send")}</button></div>}
    </div>
  );
}

function Complaint({ open, onClose, sessionId }) {
  const [category, setCategory] = useState('did_not_start');
  const [desc, setDesc] = useState('');
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);
  return (
    <Modal open={open} onClose={onClose} title={tx("Report a problem")}>
      {done ? <div className="text-sm">{tx("We have your report. Ticket")} <b>{String(done.id).slice(-6).toUpperCase()}</b>; we respond by {dt(done.slaDueAt)}. Session details are attached automatically.</div> : (
        <div className="space-y-3">
          <Field label={tx("What happened?")}>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="did_not_start">{tx("Charging didn't start")}</option><option value="overcharged">{tx("I was overcharged")}</option><option value="stopped_early">{tx("It stopped early")}</option>
              <option value="refund_missing">{tx("Refund not received")}</option><option value="spot_blocked">{tx("Spot blocked")}</option><option value="charger_damaged">{tx("Charger damaged")}</option><option value="other">{tx("Something else")}</option>
            </select>
          </Field>
          <Field label={tx("Details (optional)")}><textarea className="input min-h-[90px] py-2" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <ErrorBox error={err} />
          <ActionButton className="btn-primary w-full" onClick={async () => {
            try {
              setDone(await api(`/api/sessions/${sessionId}/complaint`, { method: 'POST', sessionId, body: { category, description: desc || undefined } }));
            } catch (e) {
              setErr(e);
            }
          }}>{tx("Send report")}</ActionButton>
        </div>
      )}
    </Modal>
  );
}

function OtpStop({ open, onClose, sessionId, onStopped }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState(null);
  return (
    <Modal open={open} onClose={onClose} title={tx("Stop with OTP")}>
      <div className="space-y-3 text-sm">
        <p>{tx("This link is read-only. To stop charging we send a code to the phone number used for payment.")}</p>
        {!sent ? <ActionButton className="btn-primary w-full" onClick={async () => { await api(`/api/sessions/${sessionId}/stop-otp/request`, { method: 'POST', sessionId }); setSent(true); }}>{tx("Send code")}</ActionButton> : (
          <>
            <input className="input text-center text-lg tracking-[0.5em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" />
            <ErrorBox error={err} />
            <ActionButton className="btn-danger w-full" onClick={async () => {
              try {
                const r = await api(`/api/sessions/${sessionId}/stop-otp/verify`, { method: 'POST', sessionId, body: { code } });
                onStopped(r.session);
                onClose();
              } catch (e) {
                setErr(e);
              }
            }}>{tx("Verify and stop")}</ActionButton>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function LiveSession() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { t } = useI18n();
  const toast = useToast();
  const now = useNow(1000);
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [complaint, setComplaint] = useState(false);
  const [otpStop, setOtpStop] = useState(false);
  const verified = useRef(false);
  useTemporaryBrand(s?.branding);

  // A view token can arrive in the SMS link (?v=...)
  if (sp.get('v') && !tokens.view(id)) tokens.setView(id, sp.get('v'));

  useEffect(() => {
    let es;
    let poll;
    let closed = false;
    const load = async () => {
      try {
        const v = await api(`/api/sessions/${id}`, { sessionId: id });
        if (!closed) {
          setS(v);
          setErr(null);
        }
        // Back from the UPI app: verify with the gateway (same final state as the webhook)
        if (v.state === 'CREATED' && v.access === 'owner' && !verified.current) {
          verified.current = true;
          const r = await api(`/api/sessions/${id}/verify-payment`, { method: 'POST', sessionId: id }).catch(() => null);
          if (r && !closed) setS(r);
        }
      } catch (e) {
        if (!closed) setErr(e);
      }
    };
    load();
    const q = new URLSearchParams();
    if (tokens.session(id)) q.set('t', tokens.session(id));
    else if (tokens.view(id)) q.set('v', tokens.view(id));
    if (typeof EventSource !== 'undefined' && q.toString()) {
      es = new EventSource(`${API_URL}/api/sessions/${id}/events?${q}`);
      es.onmessage = (m) => {
        try {
          setS(JSON.parse(m.data));
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        /* EventSource retries automatically; polling below covers proxies that drop SSE */
      };
    }
    poll = setInterval(load, 10000);
    return () => {
      closed = true;
      es?.close();
      clearInterval(poll);
    };
  }, [id]);

  if (err && !s) return <div className="space-y-3 p-4"><ErrorBox error={err} /><Link to="/" className="btn-secondary w-full">{tx("Go home")}</Link></div>;
  if (!s) return <Loading label={tx("Loading your session…")} />;

  const owner = s.access === 'owner' || s.access === 'staff';
  const active = ACTIVE.includes(s.state);
  const used = s.liveCostPaise ?? s.costs?.totalPaise ?? 0;
  const pct = s.capPaise ? Math.min(100, Math.round((used / s.capPaise) * 100)) : 0;
  const stale = s.live?.updatedAt && now - new Date(s.live.updatedAt).getTime() > 10 * 60_000;

  const doStop = async () => {
    const r = await api(`/api/sessions/${id}/stop`, { method: 'POST', sessionId: id });
    setS(r.session);
    if (r.message) toast(r.message, r.rejected || r.queued ? 'amber' : 'green');
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs muted">{s.charger?.site?.name}</div>
          <h1 className="text-lg font-bold">{s.charger?.label} · #{s.connectorNumber}</h1>
        </div>
        <Status value={s.state} />
      </div>

      {s.message && !(s.state === 'BILLED' && s.stopReason !== 'limit') && (
        <div className={cx('rounded-2xl p-4 text-sm', s.state === 'FAILED' ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200' : s.state === 'INTERRUPTED' || stale ? 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100')} aria-live="polite">
          {txKey(s.messageKey, s.messageVars, s.message)}
        </div>
      )}

      {['CREATED', 'PAID', 'STARTING'].includes(s.state) && (
        <Card className="p-5">
          {s.state === 'STARTING' && !s.pluggedAt ? <PlugAnimation /> : null}
          <Steps s={s} t={t} />
          {s.state === 'STARTING' && !s.pluggedAt && s.plugDeadline && <div className="mt-4 text-center text-xs muted">Waiting up to {Math.max(0, Math.round((new Date(s.plugDeadline) - now) / 1000))} s. If you don't plug in, your full amount is refunded.</div>}
          {s.suggestSwitchTo && owner && (
            <div className="mt-4 rounded-xl bg-sky-50 p-3 text-sm dark:bg-sky-950">
              Looks like you plugged into connector {s.suggestSwitchTo}.
              <ActionButton className="btn-primary btn-sm ml-2" onClick={async () => setS(await api(`/api/sessions/${id}/switch-connector`, { method: 'POST', sessionId: id, body: { connector: s.suggestSwitchTo } }))}>Switch to #{s.suggestSwitchTo}</ActionButton>
            </div>
          )}
          {s.state === 'CREATED' && owner && ['failed', 'cancelled'].includes(s.payment?.status) && (
            <ActionButton className="btn-primary mt-4 w-full" onClick={async () => {
              const r = await api(`/api/sessions/${id}/pay`, { method: 'POST', sessionId: id });
              if (r.checkout?.provider === 'mock') location.href = `/pay/mock/${r.orderId}?s=${id}`;
            }}>{tx("Try payment again")}</ActionButton>
          )}
          {owner && ['CREATED', 'PAID', 'STARTING'].includes(s.state) && (
            <ActionButton className="btn-ghost mt-2 w-full" confirm={tx("Cancel this session? Anything paid is refunded automatically.")} onClick={async () => setS((await api(`/api/sessions/${id}/cancel`, { method: 'POST', sessionId: id })).session)}>{tx("Cancel")}</ActionButton>
          )}
        </Card>
      )}

      {['CHARGING', 'STOPPING', 'INTERRUPTED'].includes(s.state) && (
        <Card className="space-y-4 p-5">
          <div className="flex flex-col items-center">
            <ProgressRing value={s.live?.socPct !== undefined ? s.live.socPct : pct} size={220} tone={s.live?.socPct === undefined && pct >= 80 ? 'amber' : 'brand'}>
              <div>
                <div className={cx('mx-auto mb-1 grid h-8 w-8 place-items-center rounded-full', s.state === 'CHARGING' ? 'bg-brand-100 text-brand-600 dark:bg-brand-950' : 'bg-amber-100 text-amber-600 dark:bg-amber-950')}><Icon name={s.live?.socPct !== undefined ? 'battery' : 'bolt'} className={cx('h-4 w-4', s.state === 'CHARGING' && 'animate-pulse')} /></div>
                <div className="text-4xl font-black tabular-nums">{s.live?.socPct !== undefined ? `${Math.round(s.live.socPct)}%` : ((s.energyWh || 0) / 1000).toFixed(2)}</div>
                <div className="text-xs font-semibold muted">{s.live?.socPct !== undefined ? t('battery') : 'kWh'}</div>
              </div>
            </ProgressRing>
            {s.capPaise > 0 && <div className={cx('mt-2 text-xs font-semibold', pct >= 80 ? 'text-amber-600' : 'muted')}>{tx('{{pct}}% of your amount used', { pct })}{pct >= 80 ? ` · ${tx('80% used')}` : ''}</div>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Big label={t('cost')} value={rs(used)} sub={s.capPaise ? `/ ${rs0(s.capPaise)}` : undefined} />
            <Big label={s.live?.socPct !== undefined ? t('energy') : t('power')} value={s.live?.socPct !== undefined ? ((s.energyWh || 0) / 1000).toFixed(2) : kw(s.live?.powerW)} sub={s.live?.socPct !== undefined ? 'kWh' : undefined} />
            <Big label={t('elapsed')} value={duration(s.startedAt, now)} />
          </div>
          {stale && <div className="text-xs text-amber-600">{tx("Waiting for update from the charger…")}</div>}
          {owner ? (
            <button type="button" className="btn-danger btn-lg w-full" disabled={s.state === 'STOPPING'} onClick={() => setConfirmStop(true)}>
              {s.state === 'STOPPING' ? <><Spinner className="h-5 w-5 text-white" /> {tx("Stopping…")}</> : t('stop')}
            </button>
          ) : (
            <button type="button" className="btn-secondary w-full" onClick={() => setOtpStop(true)}>{tx("Stop (OTP to the payer's phone)")}</button>
          )}
          <div className="text-center text-xs muted">{tx("You can close this page — charging continues and stops at your limit or when you unplug. Your SMS link reopens it.")}</div>
        </Card>
      )}

      {['BILLED', 'COMPLETED'].includes(s.state) && (
        <Card className="space-y-4 overflow-hidden p-0">
          <div className="relative bg-electric px-5 pb-6 pt-6 text-center text-white">
            <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
            <div className="relative mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-white text-brand-600 shadow-lift animate-pop"><Icon name="check" className="h-7 w-7" strokeWidth={3} /></div>
            <div className="relative text-xl font-extrabold">{tx("Charging complete")}</div>
            <div className="relative text-sm text-white/85">{t('unplug')}</div>
            <div className="relative mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/15 p-2"><div className="text-lg font-extrabold tabular-nums">{((s.energyWh || 0) / 1000).toFixed(2)}</div><div className="text-[10px] text-white/80">kWh</div></div>
              <div className="rounded-2xl bg-white/15 p-2"><div className="text-lg font-extrabold tabular-nums">{rs0(s.costs?.totalPaise)}</div><div className="text-[10px] text-white/80">{t('total')}</div></div>
              <div className="rounded-2xl bg-white/15 p-2"><div className="text-lg font-extrabold tabular-nums">{duration(s.startedAt, s.endedAt)}</div><div className="text-[10px] text-white/80">{tx('Time')}</div></div>
            </div>
          </div>
          <div className="space-y-4 px-5 pb-5">
          {s.energyWh > 0 && <div className="flex items-center gap-2 rounded-2xl bg-brand-50 px-3 py-2 text-xs text-brand-900 dark:bg-brand-950 dark:text-brand-200"><Icon name="leaf" className="h-4 w-4 shrink-0" />{tx('About {{kg}} kg CO₂ avoided vs. petrol', { kg: ((s.energyWh / 1000) * 0.6).toFixed(1) })}</div>}
          <dl className="divide-y divide-dashed divide-ink-200 text-sm dark:divide-ink-700">
            <div className="flex justify-between py-2"><dt className="muted">{t('energy')}</dt><dd className="font-semibold">{((s.energyWh || 0) / 1000).toFixed(3)} kWh</dd></div>
            <div className="flex justify-between py-2"><dt className="muted">{tx("Time")}</dt><dd>{duration(s.startedAt, s.endedAt)}</dd></div>
            {s.costs && <div className="flex justify-between py-2"><dt className="muted">{tx("Taxable value")}</dt><dd>{rs(s.costs.taxablePaise)}</dd></div>}
            {s.costs && <div className="flex justify-between py-2"><dt className="muted">{tx("GST")}</dt><dd>{rs(s.costs.gstPaise)}</dd></div>}
            <div className="flex justify-between py-2 text-base"><dt className="font-semibold">{t('total')}</dt><dd className="font-bold">{rs(s.costs?.totalPaise)}</dd></div>
            {!s.postpaid && <div className="flex justify-between py-2"><dt className="muted">{tx("Prepaid")}</dt><dd>{rs(s.prepaidPaise)}</dd></div>}
            {s.refundPaise > 0 && (
              <div className="flex justify-between py-2 text-brand-700 dark:text-brand-400">
                <dt className="font-semibold">{t('refund')} (automatic)</dt>
                <dd className="text-right font-semibold">{rs(s.refundPaise)}<div className="text-xs font-normal muted">{s.refunds?.some((r) => r.status === 'succeeded') ? 'Sent to your payment method · usually instant, up to 5 days for some banks' : tx('Processing')}</div></dd>
              </div>
            )}
          </dl>
          {s.invoice?.number ? (
            <ActionButton className="btn-secondary w-full" onClick={() => download(`/api/sessions/${id}/invoice.pdf`, `${s.invoice.number.replace(/\//g, '-')}.pdf`, { sessionId: id })}><Icon name="doc" className="h-4 w-4" /> {t('invoice')} {s.invoice.number}</ActionButton>
          ) : s.costs?.totalPaise > 0 ? <div className="text-center text-xs muted">{tx("Your invoice is being prepared.")}</div> : null}
          <button type="button" className="btn w-full bg-[#25D366] text-white hover:brightness-105" onClick={() => shareReceipt(s)}><Icon name="share" className="h-4 w-4" /> {tx('Share receipt on WhatsApp')}</button>
          {owner && <div className="rounded-2xl bg-ink-50 p-3 dark:bg-ink-800"><div className="mb-1 text-center text-sm font-semibold">{t('rate')}</div><Rating s={s} sessionId={id} /></div>}
          {owner && <ActionButton className="btn-ghost btn-sm w-full" onClick={async () => { const r = await api(`/api/sessions/${id}/unlock`, { method: 'POST', sessionId: id }); toast(r.message, r.ok ? 'green' : 'amber'); }}>{tx("Cable stuck? Unlock connector")}</ActionButton>}
          {!tokens.driver() && <Link to="/login" className="block rounded-xl bg-ink-50 p-3 text-center text-sm dark:bg-ink-800">{t('installApp')} →</Link>}
          </div>
        </Card>
      )}

      {['FAILED', 'CANCELLED'].includes(s.state) && (
        <Card className="space-y-3 p-5">
          {s.refunds?.length > 0 && <div className="text-sm">Refund {rs(s.refunds.reduce((a, r) => a + r.amountPaise, 0))}: <Status value={s.refunds[0].status} /></div>}
          <Link to={`/charger/${encodeURIComponent(s.charger?.ocppId || '')}`} className="btn-primary w-full">{t('tryAnother')}</Link>
          <Link to="/" className="btn-secondary w-full">{tx("Find another charger")}</Link>
        </Card>
      )}

      {owner && <button type="button" className="btn-ghost btn-sm w-full" onClick={() => setComplaint(true)}><Icon name="alert" className="h-4 w-4" /> {t('reportProblem')}</button>}
      <div className="text-center text-xs muted">Support: {s.supportPhone} · Session {String(id).slice(-6).toUpperCase()}</div>

      <Modal open={confirmStop} onClose={() => setConfirmStop(false)} title={t('stopConfirm')} footer={<><button type="button" className="btn-secondary" onClick={() => setConfirmStop(false)}>{tx("Keep charging")}</button><ActionButton className="btn-danger" onClick={async () => { await doStop(); setConfirmStop(false); }}>{t('stop')}</ActionButton></>}>
        <p className="text-sm">You'll pay only for the energy used so far ({rs(used)}). The rest is refunded automatically.</p>
      </Modal>
      <Complaint open={complaint} onClose={() => setComplaint(false)} sessionId={id} />
      <OtpStop open={otpStop} onClose={() => setOtpStop(false)} sessionId={id} onStopped={setS} />
    </div>
  );
}
