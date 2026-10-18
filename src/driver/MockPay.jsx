// Stand-in for the UPI app / hosted checkout while PAYMENT_PROVIDER=mock. Lets QA drive every payment outcome.
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { rs } from '../lib/format.js';
import { Card, ErrorBox, Icon, Loading, Spinner } from '../components/ui.jsx';

export default function MockPay() {
  const { orderId } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { data, error, loading } = useApi(`/api/payments/mock/${orderId}`, { auth: 'none' });
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [qa, setQa] = useState(false);
  const [webhook, setWebhook] = useState('now');
  const sessionId = sp.get('s') || data?.sessionId;

  async function complete(outcome, extra = {}) {
    setBusy(outcome);
    setErr(null);
    try {
      await api(`/api/payments/mock/${orderId}/complete`, { method: 'POST', auth: 'none', body: { outcome, webhook: webhook === 'now' ? 'now' : webhook === 'never' ? 'never' : Number(webhook), ...extra } });
      nav(`/s/${sessionId}`, { replace: true });
    } catch (e) {
      setErr(e);
      setBusy(null);
    }
  }

  if (loading) return <Loading />;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 bg-gradient-to-b from-indigo-600 to-indigo-900 p-4 text-white">
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest opacity-70">Mock UPI app · test mode</div>
        <div className="mt-6 text-sm opacity-80">Paying</div>
        <div className="text-lg font-semibold">ChargeX (chargex@mockbank)</div>
        <div className="mt-3 text-5xl font-bold tabular-nums">{rs(data?.amountPaise)}</div>
        <div className="mt-1 text-xs opacity-70">Order {orderId}</div>
      </div>
      <ErrorBox error={error || err} />
      {data?.status && data.status !== 'created' && <div className="rounded-xl bg-white/10 p-3 text-center text-sm">This order is already {data.status}.</div>}
      <Card className="space-y-2 p-4 text-ink-900 dark:text-ink-100">
        <button type="button" className="btn-primary btn-lg w-full" disabled={!!busy} onClick={() => complete('success')}>{busy === 'success' ? <Spinner className="h-5 w-5 text-white" /> : <Icon name="check" />} Pay with UPI PIN</button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => complete('fail', { failureReason: 'Insufficient balance' })}>Fail (no balance)</button>
          <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => complete('cancel')}>Cancel</button>
        </div>
        <button type="button" className="w-full pt-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300" onClick={() => setQa(!qa)}>{qa ? 'Hide' : 'Show'} QA options</button>
        {qa && (
          <div className="space-y-2 rounded-xl bg-ink-50 p-3 text-xs dark:bg-ink-800">
            <label className="block">Webhook delivery
              <select className="input mt-1 min-h-[34px] text-xs" value={webhook} onChange={(e) => setWebhook(e.target.value)}>
                <option value="now">Immediately</option>
                <option value="8000">After 8 s (redirect first, PAY-06)</option>
                <option value="never">Never (server polls, PAY-12)</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={() => complete('success', { duplicateWebhook: true })}>Duplicate webhook</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => complete('success', { tamperPaise: 100 })}>Tamper: pay ₹1</button>
            </div>
          </div>
        )}
      </Card>
      <p className="text-center text-xs opacity-70">In production this is GPay / PhonePe / Paytm via UPI intent, or Razorpay Checkout.</p>
    </div>
  );
}
