import { tx } from '../lib/i18n.jsx';
import { Link } from 'react-router-dom';
import { tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { dt, kwh, month, rs } from '../lib/format.js';
import { Card, Empty, ErrorBox, Loading, Status } from '../components/ui.jsx';

export default function History() {
  const logged = !!tokens.driver();
  const { data, error, loading } = useApi(logged ? '/api/me/sessions' : null, { auth: 'driver' });
  if (!logged) return <div className="p-4"><Empty icon="clock" title={tx("Your charging history")}>{tx("Log in with your phone number to see sessions, invoices and refunds.")} <Link className="font-semibold text-brand-700" to="/login?next=/history">{tx("Log in")}</Link></Empty></div>;
  if (loading) return <Loading />;
  return (
    <div className="space-y-5 p-4">
      <h1 className="text-xl font-bold">{tx("History")}</h1>
      <ErrorBox error={error} />
      {!data?.months?.length && <Empty icon="bolt" title={tx("No sessions yet")}>{tx("Your sessions, invoices and refunds will show here.")}</Empty>}
      {data?.months?.map((m) => (
        <section key={m.month} className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{month(m.month)}</h2>
            <div className="text-xs muted">{kwh(m.energyWh, 1)} · {rs(m.totalPaise)}</div>
          </div>
          {m.sessions.map((s) => (
            <Link key={s.id} to={`/s/${s.id}`}>
              <Card className="mb-2 flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{s.site || s.charger}</div>
                  <div className="text-xs muted">{dt(s.createdAt)} · {kwh(s.energyWh)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{rs(s.totalPaise)}</div>
                  {s.refundPaise > 0 ? <div className="text-xs text-brand-700">+{rs(s.refundPaise)} refunded</div> : <Status value={s.state} />}
                </div>
              </Card>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
