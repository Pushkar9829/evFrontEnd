import { tx } from '../lib/i18n.jsx';
import { Link } from 'react-router-dom';
import { tokens } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { dt, kwh, month, rs } from '../lib/format.js';
import { Card, Empty, ErrorBox, IconBubble, Loading, Status } from '../components/ui.jsx';

export default function History() {
  const logged = !!tokens.driver();
  const { data, error, loading } = useApi(logged ? '/api/me/sessions' : null, { auth: 'driver' });
  if (!logged) return <div className="p-4"><Empty icon="clock" title={tx("Your charging history")}>{tx("Log in with your phone number to see sessions, invoices and refunds.")} <Link className="font-semibold text-brand-700" to="/login?next=/history">{tx("Log in")}</Link></Empty></div>;
  if (loading) return <Loading />;

  return (
    <div className="space-y-5 p-4">
      <h1 className="text-2xl font-extrabold tracking-tight">{tx("History")}</h1>
      <ErrorBox error={error} />
      {!data?.months?.length && <Card><Empty icon="bolt" title={tx("No sessions yet")}>{tx("Your sessions, invoices and refunds will show here.")}</Empty></Card>}
      {data?.months?.map((m, i) => (
        <section key={m.month} className="space-y-2">
          {i === 0 ? (
            <div className="relative overflow-hidden rounded-3xl bg-electric p-4 text-white shadow-glow">
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
              <div className="relative text-xs font-bold uppercase tracking-wider text-white/80">{month(m.month)}</div>
              <div className="relative mt-2 grid grid-cols-3 gap-2">
                <div><div className="text-xl font-extrabold tabular-nums">{rs(m.totalPaise, { decimals: 0 })}</div><div className="text-[11px] text-white/80">{tx('spent')}</div></div>
                <div><div className="text-xl font-extrabold tabular-nums">{kwh(m.energyWh, 1)}</div><div className="text-[11px] text-white/80">{tx('energy')}</div></div>
                <div><div className="text-xl font-extrabold tabular-nums">{m.sessions.length}</div><div className="text-[11px] text-white/80">{tx('sessions')}</div></div>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline justify-between pt-2">
              <h2 className="font-bold">{month(m.month)}</h2>
              <div className="text-xs font-semibold muted">{kwh(m.energyWh, 1)} · {rs(m.totalPaise)}</div>
            </div>
          )}
          {m.sessions.map((s) => (
            <Link key={s.id} to={`/s/${s.id}`} className="card card-hover flex items-center gap-3 p-3">
              <IconBubble name={s.state === 'BILLED' ? 'bolt' : s.state === 'FAILED' || s.state === 'CANCELLED' ? 'alert' : 'clock'} tone={s.state === 'BILLED' ? 'green' : s.state === 'FAILED' || s.state === 'CANCELLED' ? 'gray' : 'blue'} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{s.site || s.charger}</div>
                <div className="text-xs muted">{dt(s.createdAt)} · {kwh(s.energyWh)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold tabular-nums">{rs(s.totalPaise)}</div>
                {s.refundPaise > 0 ? <div className="text-[11px] font-semibold text-brand-700 dark:text-brand-400">+{rs(s.refundPaise)} {tx('refunded')}</div> : <Status value={s.state} />}
              </div>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
