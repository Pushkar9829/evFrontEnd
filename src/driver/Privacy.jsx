// Data rights for anyone who charged as a guest: prove the phone with an OTP, then export or request deletion.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, tokens } from '../lib/api.js';
import { dt } from '../lib/format.js';
import { ActionButton, Card, ErrorBox, Field } from '../components/ui.jsx';

export default function Privacy() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);
  const submit = async (kind) => {
    setErr(null);
    try {
      const r = await api('/api/public/data-requests', { method: 'POST', auth: 'none', body: { phone, code, kind } });
      if (r.export) {
        const blob = new Blob([JSON.stringify(r.export, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'chargex-my-data.json';
        a.click();
        setDone('Your data was downloaded.');
      } else setDone(`Deletion request received. We complete it by ${dt(r.request.dueAt)}. Invoices are kept for the legal tax period without your name or number.`);
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-bold">Your data</h1>
      <p className="text-sm muted">Charged without an account? Verify your phone number to download your data or ask us to delete it. {tokens.driver() && <>Logged in drivers can do this from <Link className="font-semibold text-brand-700" to="/account">Account</Link>.</>}</p>
      <Card className="space-y-3 p-4">
        {done ? <div className="text-sm">{done}</div> : (
          <>
            <Field label="Mobile number"><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            {!sent ? (
              <ActionButton className="btn-primary w-full" disabled={phone.replace(/\D/g, '').length < 10} onClick={async () => { try { await api('/api/public/data-requests/otp', { method: 'POST', auth: 'none', body: { phone } }); setSent(true); } catch (e) { setErr(e); } }}>Send code</ActionButton>
            ) : (
              <>
                <Field label="Code"><input className="input text-center tracking-[0.4em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton className="btn-secondary" disabled={code.length !== 6} onClick={() => submit('export')}>Download my data</ActionButton>
                  <ActionButton className="btn-danger" disabled={code.length !== 6} confirm="Ask us to delete your data? This cannot be undone." onClick={() => submit('delete')}>Delete my data</ActionButton>
                </div>
              </>
            )}
          </>
        )}
        <ErrorBox error={err} />
      </Card>
    </div>
  );
}
