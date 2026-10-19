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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-night p-4">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="relative grid w-full max-w-4xl items-center gap-10 lg:grid-cols-2">
      <div className="hidden text-white lg:block">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-electric shadow-glow"><Icon name="bolt" className="h-7 w-7" strokeWidth={2.5} /></span>
        <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight">Run your charging network<br /><span className="bg-gradient-to-r from-brand-300 to-cyan-300 bg-clip-text text-transparent">from one console.</span></h1>
        <ul className="mt-6 space-y-3 text-sm text-ink-300">
          {['Live map of every charger and session', 'Tariffs, payouts and GST invoices', 'Roles, approvals and a full audit trail', 'OCPP 1.6J, 2.0.1 and 2.1 chargers'].map((x) => <li key={x} className="flex items-center gap-2"><Icon name="check" className="h-4 w-4 text-brand-400" />{x}</li>)}
        </ul>
      </div>
      <Card className="mx-auto w-full max-w-sm p-6 shadow-lift">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-electric text-white shadow-glow"><Icon name="bolt" /></span>
          <div><div className="font-extrabold">ChargeX Console</div><div className="text-xs muted">Operators and platform team</div></div>
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
          <button type="submit" className="btn-electric btn-lg w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-white" />}{challenge ? 'Verify' : 'Sign in'}</button>
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
    </div>
  );
}
