import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, tokens } from '../lib/api.js';
import { useI18n } from '../lib/i18n.jsx';
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
    <div className="mx-auto max-w-sm space-y-4 p-4 pt-10">
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white"><Icon name="bolt" className="h-7 w-7" /></div>
        <h1 className="text-xl font-bold">{t('login')}</h1>
        <p className="text-sm muted">Phone number + OTP only. No password.</p>
      </div>
      <Card className="space-y-3 p-5">
        {!sent ? (
          <>
            <label className="block"><span className="label">Mobile number</span><input className="input text-base" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            <button type="button" className="btn-primary btn-lg w-full" disabled={busy || wait > 0 || phone.replace(/\D/g, '').length < 10} onClick={() => send()}>{busy && <Spinner className="h-5 w-5 text-white" />}{wait > 0 ? `Wait ${wait}s` : t('sendCode')}</button>
          </>
        ) : (
          <>
            <div className="text-sm">{t('otpSent')} <b>{phone}</b>{sent.demo && <span className="block text-xs muted">Demo mode: use 123456</span>}</div>
            <input className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            <button type="button" className="btn-primary btn-lg w-full" disabled={busy || code.length !== 6} onClick={verify}>{busy && <Spinner className="h-5 w-5 text-white" />}{t('verify')}</button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" className="font-semibold text-brand-700 disabled:opacity-50" disabled={wait > 0 || busy} onClick={() => send()}>{wait > 0 ? `${t('resend')} in ${wait}s` : t('resend')}</button>
              <button type="button" className="muted underline" onClick={() => { setSent(null); setCode(''); }}>Change number</button>
            </div>
            {wait <= 0 && <div className="flex gap-2 pt-1"><button type="button" className="btn-secondary btn-sm flex-1" onClick={() => send('whatsapp')}>Get code on WhatsApp</button><button type="button" className="btn-secondary btn-sm flex-1" onClick={() => send('voice')}>Voice call</button></div>}
          </>
        )}
        <ErrorBox error={err} />
      </Card>
    </div>
  );
}
