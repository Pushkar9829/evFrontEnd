import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { Card, ErrorBox, Icon, Spinner } from '../components/ui.jsx';

export default function StaffLogin() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const { data: cfg } = useApi('/api/public/config', { auth: 'none' });
  const done = (r) => {
    tokens.setStaff(r.token);
    nav(sp.get('next')?.startsWith('/console') ? sp.get('next') : '/console', { replace: true });
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (!challenge) {
        const r = await api('/api/auth/staff/login', { method: 'POST', auth: 'none', body: { email, password } });
        if (r.twoFactorRequired) setChallenge(r);
        else done(r);
      } else {
        done(await api('/api/auth/staff/2fa', { method: 'POST', auth: 'none', body: { challenge: challenge.challenge, code } }));
      }
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-ink-900 via-ink-900 to-brand-950 p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white"><Icon name="bolt" /></span>
          <div><div className="font-bold">ChargeX Console</div><div className="text-xs muted">Operators and platform team</div></div>
        </div>
        <form className="space-y-3" onSubmit={submit}>
          {!challenge ? (
            <>
              <label className="block"><span className="label">Email</span><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
              <label className="block"><span className="label">Password</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            </>
          ) : (
            <>
              <div className="text-sm">Two-factor check: enter the code sent to {challenge.phoneHint}.</div>
              <input className="input text-center text-xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            </>
          )}
          <ErrorBox error={err} />
          <button type="submit" className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}{challenge ? 'Verify' : 'Sign in'}</button>
        </form>
        {cfg?.demoOtp && <details className="mt-5 text-xs muted">
          <summary className="cursor-pointer">Demo accounts</summary>
          <div className="mt-2 space-y-1">
            <div>Password for all: see backend <code>SEED_STAFF_PASSWORD</code> (default in .env.example). 2FA demo code: 123456.</div>
            {['admin@chargex.in (Super Admin)', 'support@chargex.in (Platform Support)', 'finance@chargex.in (Platform Finance)', 'owner@voltgrid.in (Tenant Owner)', 'ops@voltgrid.in (Operations)', 'tech@voltgrid.in (Technician)', 'accounts@voltgrid.in (Finance)', 'help@voltgrid.in (Support Agent)', 'owner@greenplug.in (2nd tenant)'].map((a) => (
              <button key={a} type="button" className="block text-left hover:text-brand-600" onClick={() => setEmail(a.split(' ')[0])}>{a}</button>
            ))}
          </div>
        </details>}
      </Card>
    </div>
  );
}
