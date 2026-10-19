import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, tokens } from '../lib/api.js';
import { tx, useI18n } from '../lib/i18n.jsx';
import { Card, ErrorBox, Icon, Spinner } from '../components/ui.jsx';

export default function DriverLogin() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const h = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(h);
  }, [wait]);

  const send = async (channel = 'sms') => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api('/api/auth/otp/request', { method: 'POST', auth: 'none', body: { phone, channel, lang } });
      setSent(r);
      setWait(r.resendAfterSec || 30);
    } catch (e) {
      setErr(e);
      if (e.body?.error?.details?.retryAfterSec) setWait(e.body.error.details.retryAfterSec);
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api('/api/auth/otp/verify', { method: 'POST', auth: 'none', body: { phone, code, lang } });
      tokens.setDriver(r.token);
      nav(sp.get('next') || '/account', { replace: true });
    } catch (e) {
      setErr(e);
      if (e.code === 'OTP_EXPIRED') setSent(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-4 p-4 pt-8">
      <div className="relative overflow-hidden rounded-3xl bg-electric p-6 text-center text-white shadow-glow">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-white/20 backdrop-blur"><Icon name="bolt" className="h-8 w-8" strokeWidth={2.5} /></div>
        <h1 className="relative text-2xl font-extrabold">{t('login')}</h1>
        <p className="relative text-sm text-white/85">{tx("Phone number + OTP only. No password.")}</p>
      </div>
      <Card className="space-y-3 p-5">
        {!sent ? (
          <>
            <label className="block"><span className="label">{tx("Mobile number")}</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold muted">+91</span>
                <input className="input h-12 pl-12 text-base tracking-wide" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
              </div>
            </label>
            <button type="button" className="btn-electric btn-lg w-full disabled:opacity-60" disabled={busy || wait > 0 || phone.replace(/\D/g, '').length < 10} onClick={() => send()}>{busy && <Spinner className="h-5 w-5 text-white" />}{wait > 0 ? `Wait ${wait}s` : t('sendCode')}</button>
          </>
        ) : (
          <>
            <div className="text-sm">{t('otpSent')} <b>{phone}</b>{sent.demo && <span className="block text-xs muted">{tx("Demo mode: use 123456")}</span>}</div>
            <input className="input h-14 text-center text-2xl font-bold tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            <button type="button" className="btn-electric btn-lg w-full disabled:opacity-60" disabled={busy || code.length !== 6} onClick={verify}>{busy && <Spinner className="h-5 w-5 text-white" />}{t('verify')}</button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" className="font-semibold text-brand-700 disabled:opacity-50" disabled={wait > 0 || busy} onClick={() => send()}>{wait > 0 ? `${t('resend')} in ${wait}s` : t('resend')}</button>
              <button type="button" className="muted underline" onClick={() => { setSent(null); setCode(''); }}>{tx("Change number")}</button>
            </div>
            {wait <= 0 && <div className="flex gap-2 pt-1"><button type="button" className="btn-secondary btn-sm flex-1" onClick={() => send('whatsapp')}>{tx("Get code on WhatsApp")}</button><button type="button" className="btn-secondary btn-sm flex-1" onClick={() => send('voice')}>{tx("Voice call")}</button></div>}
          </>
        )}
        <ErrorBox error={err} />
      </Card>
    </div>
  );
}
