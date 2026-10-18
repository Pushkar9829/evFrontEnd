// OCPP simulator with fault injection (UX doc Part 2): run QA scenarios without real chargers.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useApi, useInterval } from '../../lib/hooks.js';
import { ActionButton, Badge, Card, Empty, ErrorBox, Loading, Status, cx, useToast } from '../../components/ui.jsx';
import { PageHeader, useConsole } from '../Console.jsx';

const FAULTS = [
  ['rejectStart', 'Reject remote start (STA-03)'],
  ['neverStart', 'Accept start but never send Started (STA-04)'],
  ['rejectStop', 'Reject remote stop (STP-02)'],
  ['unlockFails', 'Cable stays locked (STP-07)'],
  ['ignoreCalls', 'Ignore all commands (timeouts)'],
];

export default function SimulatorPage() {
  const { can } = useConsole();
  const toast = useToast();
  const { data, error, reload } = useApi('/api/cms/simulator');
  const [sel, setSel] = useState(null);
  const [emaid, setEmaid] = useState('');
  const sim = useApi(sel ? `/api/cms/simulator/${sel}` : null);
  useInterval(() => { if (sel) sim.reload({ quiet: true }); }, 1500);
  const act = async (action, args = {}) => {
    try {
      await api(`/api/cms/simulator/${sel}/action`, { method: 'POST', body: { action, args } });
      sim.reload({ quiet: true });
    } catch (e) {
      toast(e.message, 'red');
    }
  };
  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  const charger = data.chargers.find((c) => c._id === sel);
  const st = sim.data;
  const running = st && !st.notRunning;
  return (
    <>
      <PageHeader title="Charger simulator" sub="Virtual OCPP 2.0.1 / 1.6J chargers over a real WebSocket, with fault injection. Each meter tick = 1 minute of charging." />
      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="p-2 xl:col-span-1">
          {data.chargers.map((c) => (
            <button key={c._id} type="button" onClick={() => setSel(c._id)} className={cx('flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm', sel === c._id ? 'bg-brand-50 dark:bg-brand-950' : 'hover:bg-ink-50 dark:hover:bg-ink-800')}>
              <span><span className="font-mono font-medium">{c.ocppId}</span><span className="block text-xs muted">{c.protocol}{c.isSimulated ? ' · simulated' : ''}</span></span>
              {data.sims.some((s) => s.ocppId === c.ocppId && s.online) ? <Badge tone="green">running</Badge> : c.online ? <Badge tone="blue">online</Badge> : <Badge>off</Badge>}
            </button>
          ))}
        </Card>
        <div className="space-y-4 xl:col-span-3">
          {!sel ? <Card><Empty icon="cpu" title="Pick a charger">Start a virtual charger, then plug in and pay from the driver page to run the full journey.</Empty></Card> : (
            <>
              <Card className="flex flex-wrap items-center gap-2 p-4">
                <div className="mr-auto"><div className="font-mono font-semibold">{charger?.ocppId}</div><div className="text-xs muted">{running ? `${st.online ? 'Connected' : 'Disconnected'} · ${st.protocol} · ${st.hasClientCert ? 'client certificate held' : 'password auth'} · queued ${st.queued} · firmware ${st.firmware}` : 'Not running'}</div></div>
                {!running ? <ActionButton onClick={async () => { await api(`/api/cms/simulator/${sel}/start`, { method: 'POST', body: { force: charger?.online && !charger?.isSimulated } }); reload({ quiet: true }); sim.reload(); }}>Start simulator</ActionButton> : (
                  <>
                    <ActionButton className="btn-secondary" onClick={() => act('meter_now')}>Send meter tick</ActionButton>
                    {st.online ? <ActionButton className="btn-secondary" onClick={() => act('drop', { forMs: 15000 })}>Drop connection 15 s</ActionButton> : <ActionButton className="btn-secondary" onClick={() => act('reconnect')}>Reconnect</ActionButton>}
                    <ActionButton className="btn-ghost" onClick={() => act('request_certificate')}>Send CSR</ActionButton>
                    {st.hasClientCert && <ActionButton className="btn-ghost" onClick={() => act('reconnect_tls')}>Reconnect over mutual TLS</ActionButton>}
                    <ActionButton className="btn-ghost" onClick={async () => { await api(`/api/cms/simulator/${sel}/stop`, { method: 'POST' }); reload({ quiet: true }); sim.reload(); }}>Stop simulator</ActionButton>
                  </>
                )}
              </Card>
              {running && (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    {st.connectors.map((c) => (
                      <Card key={c.number} className="space-y-3 p-4">
                        <div className="flex items-center justify-between"><div className="font-semibold">Connector {c.number} · {c.maxPowerKw} kW</div><Status value={c.faulted ? 'Faulted' : c.tx ? 'Charging' : c.plugged ? 'Occupied' : 'Available'} /></div>
                        <div className="text-xs muted">Meter {(c.meterWh / 1000).toFixed(3)} kWh{c.exportWh ? ` · exported ${(c.exportWh / 1000).toFixed(3)} kWh` : ''}{c.dischargeKw ? ` · discharging ${c.dischargeKw} kW (V2G)` : ''}{c.tx ? ` · tx ${c.tx.id}` : ''}{c.pendingStart ? ' · start pending (waiting for cable)' : ''}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {!c.plugged ? <ActionButton className="btn-primary btn-sm" onClick={() => act('plug', { connector: c.number })}>Plug in</ActionButton> : <ActionButton className="btn-secondary btn-sm" onClick={() => act('unplug', { connector: c.number })}>Unplug</ActionButton>}
                          <ActionButton className="btn-secondary btn-sm" onClick={() => act('emergency_stop', { connector: c.number })}>Emergency stop</ActionButton>
                          <ActionButton className="btn-secondary btn-sm" onClick={() => act(c.faulted ? 'clear_fault' : 'fault', { connector: c.number })}>{c.faulted ? 'Clear fault' : 'Fault'}</ActionButton>
                          <ActionButton className="btn-secondary btn-sm" onClick={() => act(c.evSuspended ? 'ev_resume' : 'ev_suspend', { connector: c.number })}>{c.evSuspended ? 'Car accepts charge' : 'Car refuses charge'}</ActionButton>
                          <ActionButton className="btn-ghost btn-sm" onClick={() => act('meter_backwards', { connector: c.number })}>Next meter backwards</ActionButton>
                          <ActionButton className="btn-ghost btn-sm" onClick={() => act('meter_jump', { connector: c.number })}>Next meter jump</ActionButton>
                          <ActionButton className="btn-ghost btn-sm" onClick={() => act('meter_reset', { connector: c.number })}>Register reset</ActionButton>
                        </div>
                        {st.protocol !== 'ocpp1.6' && !c.plugged && (
                          <div className="flex gap-1.5">
                            <input className="input min-h-[34px] py-1 text-xs" placeholder="Car's eMAID e.g. IN-CHX-C1A2B3C4D" value={emaid} onChange={(e) => setEmaid(e.target.value.trim())} />
                            <ActionButton className="btn-secondary btn-sm whitespace-nowrap" disabled={!emaid} onClick={async () => { const r = await api(`/api/cms/simulator/${sel}/action`, { method: 'POST', body: { action: 'pnc_plug', args: { connector: c.number, emaid } } }); toast(`Plug & Charge: ${r.status} (certificate ${r.certificateStatus})`, r.status === 'Accepted' ? 'green' : 'red'); sim.reload({ quiet: true }); }}>Plug & Charge</ActionButton>
                          </div>
                        )}
                        <Link className="block text-xs font-semibold text-brand-700" to={`/c/${encodeURIComponent(charger.ocppId)}/${c.number}`} target="_blank">Open driver QR page for this connector ↗</Link>
                      </Card>
                    ))}
                  </div>
                  <Card className="space-y-2 p-4">
                    <div className="text-sm font-semibold">Fault injection</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {FAULTS.map(([k, label]) => (
                        <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!st.faults[k]} onChange={(e) => act('fault_flags', { [k]: e.target.checked })} />{label}</label>
                      ))}
                      <label className="flex items-center gap-2 text-sm">Delay messages <select className="input min-h-[30px] w-auto py-0 text-xs" value={st.faults.delayMs} onChange={(e) => act('fault_flags', { delayMs: Number(e.target.value) })}><option value={0}>0</option><option value={2000}>2 s</option><option value={8000}>8 s</option></select></label>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <ActionButton className="btn-ghost btn-sm" onClick={() => act('duplicate_next')}>Duplicate next message (CHG-07)</ActionButton>
                      <ActionButton className="btn-ghost btn-sm" onClick={() => act('reorder_next')}>Reorder next two (CHG-08)</ActionButton>
                    </div>
                  </Card>
                  <Card>
                    <div className="border-b border-ink-100 px-4 py-2 text-sm font-semibold dark:border-ink-800">Simulator wire log</div>
                    <div className="max-h-80 overflow-auto p-2 font-mono text-[11px]">
                      {[...st.log].reverse().map((l, i) => <div key={i} className="truncate"><span className="muted">{l.at.slice(11, 19)}</span> <span className={l.dir === 'out' ? 'text-brand-600' : 'text-sky-600'}>{l.dir === 'out' ? '→' : '←'}</span> {JSON.stringify(l.frame)}</div>)}
                    </div>
                  </Card>
                </>
              )}
            </>
          )}
          {can('simulator.use') && (
            <Card className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <div className="mr-auto"><div className="font-semibold">Mock payment gateway</div><div className="text-xs muted">Refunds failing next: {data.mockGateway.failRefunds} · gateway {data.mockGateway.down ? 'DOWN' : 'up'}</div></div>
              <ActionButton className="btn-secondary btn-sm" onClick={async () => { await api('/api/payments/mock-controls', { method: 'POST', body: { failRefunds: 3 } }); reload({ quiet: true }); }}>Fail next 3 refunds (BIL-05)</ActionButton>
              <ActionButton className="btn-secondary btn-sm" onClick={async () => { await api('/api/payments/mock-controls', { method: 'POST', body: { down: !data.mockGateway.down } }); reload({ quiet: true }); }}>{data.mockGateway.down ? 'Bring gateway up' : 'Take gateway down (PAY-11)'}</ActionButton>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
