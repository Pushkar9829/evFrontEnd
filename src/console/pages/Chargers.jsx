import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useApi, useInterval } from '../../lib/hooks.js';
import { ago, dt, kwh, rs } from '../../lib/format.js';
import { ActionButton, Badge, Card, ErrorBox, Field, Icon, Loading, Modal, ReasonModal, Status, Table, Tabs, useToast } from '../../components/ui.jsx';
import { CONNECTOR_LABEL } from '../../driver/ChargerBits.jsx';
import { PageHeader, useConsole } from '../Console.jsx';

function SetupBox({ setup }) {
  return (
    <div className="space-y-2 text-sm">
      <p>Enter these in the charger's OCPP settings. The password is shown only once.</p>
      <div className="space-y-1 rounded-xl bg-ink-900 p-3 font-mono text-xs text-brand-200">
        <div>Server URL: {setup.serverUrl}</div>
        <div>Charger ID: {setup.chargerId}</div>
        <div>Password: {setup.password}</div>
        <div>Security profile: 2 (Basic auth over TLS)</div>
      </div>
      <p className="text-xs muted">When it connects it sends BootNotification; an automatic test then reads its configuration and marks it "Ready for public".</p>
    </div>
  );
}

function AddCharger({ open, onClose, onDone }) {
  const sites = useApi(open ? '/api/cms/sites' : null);
  const tariffs = useApi(open ? '/api/cms/tariffs' : null);
  const [f, setF] = useState({ site: '', ocppId: '', label: '', protocol: 'ocpp1.6', tariffKey: 'default' });
  const [conns, setConns] = useState([{ number: 1, type: 'Type2', powerType: 'AC', maxPowerKw: 7.4, vehicleTypes: ['car'] }]);
  const [setup, setSetup] = useState(null);
  const [err, setErr] = useState(null);
  const keys = [...new Set((tariffs.data?.tariffs || []).map((t) => t.key))];
  const close = () => {
    setSetup(null);
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title={setup ? 'Charger added' : 'Add charger'} wide footer={setup ? <button type="button" className="btn-primary" onClick={() => { close(); onDone(); }}>Done</button> : (
      <ActionButton onClick={async () => {
        try {
          const r = await api('/api/cms/chargers', { method: 'POST', body: { ...f, connectors: conns.map((c) => ({ ...c, maxPowerKw: Number(c.maxPowerKw) })) } });
          setSetup(r.setup);
        } catch (e) {
          setErr(e);
        }
      }}>Add charger</ActionButton>
    )}>
      {setup ? <SetupBox setup={setup} /> : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Site"><select className="input" value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })}><option value="">Choose site</option>{sites.data?.sites?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></Field>
            <Field label="Charger ID (as configured in the charger)"><input className="input font-mono" value={f.ocppId} onChange={(e) => setF({ ...f, ocppId: e.target.value })} placeholder="VG-PUN-010" /></Field>
            <Field label="Label"><input className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
            <Field label="OCPP version"><select className="input" value={f.protocol} onChange={(e) => setF({ ...f, protocol: e.target.value })}><option value="ocpp1.6">OCPP 1.6J (via adapter)</option><option value="ocpp2.0.1">OCPP 2.0.1</option><option value="ocpp2.1">OCPP 2.1 (V2G capable)</option></select></Field>
            <Field label="Tariff"><select className="input" value={f.tariffKey} onChange={(e) => setF({ ...f, tariffKey: e.target.value })}>{keys.map((k) => <option key={k}>{k}</option>)}</select></Field>
          </div>
          <div className="text-sm font-semibold">Connectors</div>
          {conns.map((c, i) => (
            <div key={c.number} className="grid grid-cols-2 gap-2 rounded-xl bg-ink-50 p-2 sm:grid-cols-5 dark:bg-ink-800">
              <div className="flex items-center text-sm font-semibold">#{c.number}</div>
              <select className="input" value={c.type} onChange={(e) => setConns(conns.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>{Object.entries(CONNECTOR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <select className="input" value={c.powerType} onChange={(e) => setConns(conns.map((x, j) => (j === i ? { ...x, powerType: e.target.value } : x)))}><option>AC</option><option>DC</option></select>
              <input className="input" value={c.maxPowerKw} onChange={(e) => setConns(conns.map((x, j) => (j === i ? { ...x, maxPowerKw: e.target.value } : x)))} aria-label="kW" />
              <select className="input" value={c.vehicleTypes.join(',')} onChange={(e) => setConns(conns.map((x, j) => (j === i ? { ...x, vehicleTypes: e.target.value.split(',') } : x)))}><option value="car">Car</option><option value="2W,3W">2W / 3W</option><option value="2W,3W,car">All</option></select>
            </div>
          ))}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setConns([...conns, { number: conns.length + 1, type: 'Type2', powerType: 'AC', maxPowerKw: 7.4, vehicleTypes: ['car'] }])}>+ Add connector</button>
          <ErrorBox error={err} />
        </div>
      )}
    </Modal>
  );
}

export function ChargersPage() {
  const nav = useNavigate();
  const { can, isPlatform } = useConsole();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [add, setAdd] = useState(false);
  const { data, error, reload } = useApi(`/api/cms/chargers?status=${status}&q=${encodeURIComponent(q)}`);
  useInterval(() => reload({ quiet: true }), 15000);
  return (
    <>
      <PageHeader title="Chargers" sub="Live status per connector">
        <input className="input min-h-[36px] w-48 py-1 text-sm" placeholder="Search ID or label" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input min-h-[36px] w-auto py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option value="online">Online</option><option value="offline">Offline</option><option value="faulted">Faulted</option><option value="charging">Charging</option></select>
        <button type="button" className="btn-secondary" onClick={() => nav(`/console/qr${status || q ? `?ids=${(data?.chargers || []).map((c) => c._id).join(',')}` : ''}`)}>Print QR stickers</button>
        {can('charger.manage') && !isPlatform && <button type="button" className="btn-primary" onClick={() => setAdd(true)}>Add charger</button>}
      </PageHeader>
      <ErrorBox error={error} />
      <Card>
        {!data ? <Loading /> : (
          <Table rows={data.chargers} onRow={(c) => nav(`/console/chargers/${c._id}`)} columns={[
            { key: 'id', label: 'Charger', render: (c) => <div><div className="font-mono font-medium">{c.ocppId}</div><div className="text-xs muted">{c.label}</div></div> },
            ...(isPlatform ? [{ key: 't', label: 'Tenant', render: (c) => c.tenant?.name }] : []),
            { key: 'site', label: 'Site', render: (c) => c.site?.name },
            { key: 'on', label: 'Link', render: (c) => (c.online ? <Badge tone="green">Online</Badge> : <Badge tone="gray">Offline · {ago(c.lastSeen)}</Badge>) },
            { key: 'conn', label: 'Connectors', render: (c) => <div className="flex gap-1">{c.connectors.map((x) => <Status key={x.number} value={x.activeSession ? 'Charging' : x.status} label={`#${x.number} ${x.activeSession ? 'Charging' : x.status}`} />)}</div> },
            { key: 'p', label: 'Protocol', render: (c) => <span className="text-xs">{c.protocol}{c.isSimulated ? ' · sim' : ''}</span> },
            { key: 'u', label: 'Uptime', render: (c) => `${c.uptime?.scorePct ?? 100}%` },
            { key: 'r', label: 'Public', render: (c) => (c.readyForPublic ? <Badge tone="green">Ready</Badge> : <Badge tone="amber">Onboarding</Badge>) },
          ]} />
        )}
      </Card>
      <AddCharger open={add} onClose={() => setAdd(false)} onDone={reload} />
    </>
  );
}

const COMMANDS = [
  { action: 'reset', type: 'soft', label: 'Soft reset', perm: 'charger.command' },
  { action: 'reset', type: 'hard', label: 'Hard reset', perm: 'charger.command', danger: true },
  { action: 'trigger', message: 'StatusNotification', label: 'Resend status', perm: 'charger.command' },
  { action: 'trigger', message: 'MeterValues', label: 'Request meter values', perm: 'charger.command' },
  { action: 'get_config', label: 'Read configuration', perm: 'charger.config' },
  { action: 'get_log', label: 'Fetch diagnostics', perm: 'charger.command' },
];

export function ChargerDetailPage() {
  const { id } = useParams();
  const { can } = useConsole();
  const toast = useToast();
  const { data, error, reload } = useApi(`/api/cms/chargers/${id}`);
  const [tab, setTab] = useState('control');
  const [reasonFor, setReasonFor] = useState(null);
  const [cfg, setCfg] = useState({ key: '', value: '' });
  const [fw, setFw] = useState('');
  const [pwd, setPwd] = useState(null);
  const [msgFilter, setMsgFilter] = useState('');
  const [v2g, setV2g] = useState({ connector: 1, kw: 7, minutes: 30 });
  const msgs = useApi(tab === 'log' && can('ocpp.log.view') ? `/api/cms/chargers/${id}/messages?q=${encodeURIComponent(msgFilter)}` : null);
  useInterval(() => { reload({ quiet: true }); if (tab === 'log') msgs.reload({ quiet: true }); }, 5000);
  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  const c = data.charger;

  const run = async (body, { confirmActive } = {}) => {
    try {
      const r = await api(`/api/cms/chargers/${id}/commands`, { method: 'POST', body: { ...body, ...(confirmActive ? { confirm: true } : {}) } });
      toast(`${body.action}: ${r.status}${r.approvalId ? ' (sent for approval)' : ''}`, r.status === 'Accepted' ? 'green' : r.status === 'PendingApproval' ? 'amber' : 'red');
      reload({ quiet: true });
      return r;
    } catch (e) {
      if (e.code === 'SESSION_ACTIVE' && window.confirm(`${e.message}`)) return run(body, { confirmActive: true });
      toast(e.message, 'red');
      return null;
    }
  };

  return (
    <>
      <PageHeader title={<span className="font-mono">{c.ocppId}</span>} sub={`${c.label || ''} · ${c.site?.name} · ${c.vendor || '—'} ${c.model || ''} · firmware ${c.firmware || '—'} · ${c.protocol}`}>
        {c.online ? <Badge tone="green">Online · last seen {ago(c.lastSeen)}</Badge> : <Badge tone="gray">Offline · {ago(c.lastSeen)}</Badge>}
        {!c.inService && <Badge tone="amber">Out of service</Badge>}
        <Link to={`/console/qr?ids=${c._id}`} className="btn-secondary btn-sm">QR stickers</Link>
        {c.roamingEnabled && <Badge tone="violet">Roaming</Badge>}
      </PageHeader>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {c.connectors.map((x) => (
          <Card key={x.number} className="p-4">
            <div className="flex items-center justify-between"><div className="font-semibold">#{x.number} {CONNECTOR_LABEL[x.type] || x.type}</div><Status value={x.status} /></div>
            <div className="mt-1 text-xs muted">{x.maxPowerKw} kW {x.powerType} · EVSE {x.evseId}{x.rawStatus ? ` · 1.6: ${x.rawStatus}` : ''}{x.errorCode ? ` · ${x.errorCode}` : ''}</div>
            {x.activeSession && <Link className="mt-2 inline-block text-xs font-semibold text-brand-700" to={`/console/sessions/${x.activeSession}`}>Active session →</Link>}
            {can('session.remote') && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {!x.activeSession ? <button type="button" className="btn-secondary btn-sm" onClick={() => setReasonFor({ action: 'remote_start', connector: x.number, label: `Remote start #${x.number}` })}>Remote start</button>
                  : <button type="button" className="btn-secondary btn-sm" onClick={() => setReasonFor({ action: 'remote_stop', connector: x.number, label: `Remote stop #${x.number}` })}>Remote stop</button>}
                {can('charger.command') && <ActionButton className="btn-ghost btn-sm" onClick={() => run({ action: 'unlock', connector: x.number })}>Unlock</ActionButton>}
                {can('charger.command') && <ActionButton className="btn-ghost btn-sm" onClick={() => run({ action: 'availability', connector: x.number, operative: x.status === 'Unavailable' })}>{x.status === 'Unavailable' ? 'Set in service' : 'Set out of service'}</ActionButton>}
              </div>
            )}
          </Card>
        ))}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'control', label: 'Command centre' }, { value: 'log', label: 'OCPP message log' }, { value: 'sessions', label: 'Recent sessions' }, { value: 'info', label: 'Setup & onboarding' }, { value: 'security', label: 'Security & V2G' }]} />
      <div className="mt-4">
        {tab === 'control' && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="space-y-4 p-4">
              <div className="flex flex-wrap gap-2">
                {COMMANDS.filter((x) => can(x.perm)).map((x) => <ActionButton key={x.label} className={x.danger ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'} onClick={() => run(x)}>{x.label}</ActionButton>)}
                {can('charger.command') && <ActionButton className="btn-secondary btn-sm" onClick={() => run({ action: 'availability', operative: !c.inService, reason: 'maintenance' })}>{c.inService ? 'Maintenance mode (hide from app)' : 'Back in service'}</ActionButton>}
              </div>
              {can('charger.config') && (
                <div className="space-y-2 border-t border-ink-100 pt-3 dark:border-ink-800">
                  <div className="text-sm font-semibold">Change configuration <span className="text-xs font-normal muted">(critical keys like SecurityProfile go to approval)</span></div>
                  <div className="flex gap-2"><input className="input" placeholder="Key e.g. HeartbeatInterval" value={cfg.key} onChange={(e) => setCfg({ ...cfg, key: e.target.value })} /><input className="input" placeholder="Value" value={cfg.value} onChange={(e) => setCfg({ ...cfg, value: e.target.value })} /><ActionButton className="btn-primary" disabled={!cfg.key} onClick={() => run({ action: 'set_config', key: cfg.key, value: cfg.value, reason: 'config change' })}>Set</ActionButton></div>
                </div>
              )}
              {can('charger.firmware') && (
                <div className="space-y-2 border-t border-ink-100 pt-3 dark:border-ink-800">
                  <div className="text-sm font-semibold">Firmware update (single charger)</div>
                  <div className="flex gap-2"><input className="input" placeholder="https://firmware.example/sim-2.0.0.bin" value={fw} onChange={(e) => setFw(e.target.value)} /><ActionButton className="btn-primary" disabled={!fw} onClick={() => run({ action: 'firmware', location: fw })}>Update</ActionButton></div>
                  <div className="text-xs muted">Bulk updates use a staged rollout with approval (1 charger → 10% → all). Status: {c.configCache?.firmwareStatus || '—'}</div>
                </div>
              )}
              {c.configCache?.variables && (
                <div className="border-t border-ink-100 pt-3 text-xs dark:border-ink-800">
                  <div className="mb-1 font-semibold">Configuration read {dt(c.configCache.readAt)}</div>
                  {c.configCache.variables.map((v) => <div key={v.variable?.name} className="flex justify-between font-mono"><span>{v.variable?.name}</span><span>{v.attributeValue ?? v.attributeStatus}</span></div>)}
                </div>
              )}
            </Card>
            <Card>
              <div className="border-b border-ink-100 px-4 py-3 font-semibold dark:border-ink-800">Command results</div>
              <Table rows={data.commands} empty="No commands yet" columns={[
                { key: 'a', label: 'Command', render: (r) => <div><div className="font-medium">{r.action}</div><div className="text-xs muted">{r.reason}</div></div> },
                { key: 's', label: 'Result', render: (r) => <Status value={r.status} /> },
                { key: 'b', label: 'By', render: (r) => r.requestedBy?.name || 'system' },
                { key: 't', label: 'When', render: (r) => dt(r.createdAt) },
              ]} />
            </Card>
          </div>
        )}
        {tab === 'log' && (
          <Card>
            <div className="border-b border-ink-100 p-3 dark:border-ink-800"><input className="input max-w-xs" placeholder="Filter by action or message id" value={msgFilter} onChange={(e) => setMsgFilter(e.target.value)} /></div>
            <div className="max-h-[60vh] overflow-auto font-mono text-xs">
              {(msgs.data?.messages || []).map((m) => (
                <div key={m._id} className="flex gap-3 border-b border-ink-100 px-3 py-1.5 dark:border-ink-800">
                  <span className="shrink-0 muted">{new Date(m.at).toLocaleTimeString()}</span>
                  <span className={m.direction === 'in' ? 'shrink-0 text-sky-600' : 'shrink-0 text-brand-600'}>{m.direction === 'in' ? '←' : '→'} {m.messageType === 2 ? 'CALL' : m.messageType === 3 ? 'RESULT' : 'ERROR'}</span>
                  <span className="shrink-0 font-semibold">{m.action || ''}</span>
                  <span className="truncate muted" title={JSON.stringify(m.payload)}>{JSON.stringify(m.payload)}</span>
                </div>
              ))}
              {!msgs.data?.messages?.length && <div className="p-6 text-center muted">No messages (kept 90 days)</div>}
            </div>
          </Card>
        )}
        {tab === 'sessions' && (
          <Card><Table rows={data.sessions} columns={[
            { key: 'id', label: 'Session', render: (s) => <Link className="font-mono text-brand-700" to={`/console/sessions/${s._id}`}>{String(s._id).slice(-8)}</Link> },
            { key: 'c', label: 'Connector', render: (s) => `#${s.connectorNumber}` },
            { key: 's', label: 'State', render: (s) => <Status value={s.state} /> },
            { key: 'e', label: 'Energy', render: (s) => kwh(s.energyWh) },
            { key: 't', label: 'Total', render: (s) => rs(s.costs?.totalPaise) },
            { key: 'w', label: 'When', render: (s) => dt(s.createdAt) },
          ]} /></Card>
        )}
        {tab === 'info' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-2 p-4 text-sm">
              <div className="font-semibold">Connection</div>
              <div className="break-all rounded-xl bg-ink-50 p-3 font-mono text-xs dark:bg-ink-800">{data.ocppUrl}</div>
              <div>Ready for public: {c.readyForPublic ? 'yes' : 'not yet (waiting for first connection + automatic test)'}</div>
              {c.onboardingReport && <div className="text-xs muted">Auto test {dt(c.onboardingReport.at)}: GetVariables {c.onboardingReport.getVariables}, TriggerMessage {c.onboardingReport.trigger}</div>}
              {c.clockSkewSec ? <div className="text-xs text-amber-600">Charger clock is off by {Math.round(c.clockSkewSec / 60)} min — server time is used for billing.</div> : null}
              {can('charger.manage') && <ActionButton className="btn-secondary btn-sm" confirm="Rotate password? The charger must be updated with the new one." onClick={async () => setPwd((await api(`/api/cms/chargers/${id}/rotate-password`, { method: 'POST', body: { reason: 'rotation' } })).password)}>Rotate password</ActionButton>}
              {pwd && <div className="rounded-xl bg-ink-900 p-3 font-mono text-xs text-brand-200">New password: {pwd}</div>}
            </Card>
            {can('roaming.manage') && (
              <Card className="space-y-2 p-4 text-sm">
                <div className="font-semibold">Roaming (OCPI / UEI)</div>
                <p className="text-xs muted">Publishes this charger to partner networks. Turning it off removes it from partner feeds.</p>
                <ActionButton className={c.roamingEnabled ? 'btn-secondary' : 'btn-primary'} onClick={async () => { await api(`/api/cms/chargers/${id}/roaming`, { method: 'POST', body: { enabled: !c.roamingEnabled, reason: 'console toggle' } }); reload({ quiet: true }); }}>{c.roamingEnabled ? 'Disable roaming' : 'Enable roaming'}</ActionButton>
              </Card>
            )}
          </div>
        )}
      </div>
      {tab === 'security' && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><div className="font-semibold">OCPP security profile</div><Badge tone={c.securityProfile === 3 ? 'green' : 'amber'}>Profile {c.securityProfile || 2}</Badge></div>
            <p className="text-xs muted">Profile 2: charger id + password over TLS. Profile 3: TLS with a client certificate signed by our CA; password logins are refused. Profile 3 needs the mutual-TLS listener (self-hosted or a TCP pass-through load balancer) — Render's proxy cannot forward client certificates.</p>
            <div className="rounded-xl bg-ink-50 p-3 text-xs dark:bg-ink-800">
              <div>Client certificate: {c.certificate?.serial ? <>serial <span className="font-mono">{c.certificate.serial.slice(0, 16)}…</span>, valid until {dt(c.certificate.notAfter)}</> : 'none yet'}</div>
              <div>Installed on charger: {(c.installedCertificates || []).map((x) => x.certificateType).join(', ') || '— (read with "List certificates")'}</div>
              {data.tlsOcppUrl && <div className="break-all">TLS endpoint: <span className="font-mono">{data.tlsOcppUrl}</span></div>}
            </div>
            {can('charger.config') && (
              <div className="flex flex-wrap gap-2">
                <ActionButton className="btn-secondary btn-sm" onClick={() => run({ action: 'install_root' })}>1. Install our root CA</ActionButton>
                <ActionButton className="btn-secondary btn-sm" onClick={() => run({ action: 'renew_certificate' })}>2. Request client certificate</ActionButton>
                <button type="button" className="btn-primary btn-sm" disabled={!c.certificate?.serial || c.securityProfile === 3} onClick={() => setReasonFor({ action: 'security_profile', profile: 3, label: 'Move to Security Profile 3 (needs approval)' })}>3. Move to Profile 3</button>
                <ActionButton className="btn-ghost btn-sm" onClick={() => run({ action: 'list_certificates' })}>List certificates</ActionButton>
                {c.securityProfile === 3 && <button type="button" className="btn-ghost btn-sm" onClick={() => setReasonFor({ action: 'security_profile', profile: 2, label: 'Back to Security Profile 2 (needs approval)' })}>Back to Profile 2</button>}
              </div>
            )}
          </Card>
          <Card className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between"><div className="font-semibold">V2G — vehicle to grid</div><Badge tone={c.protocol === 'ocpp2.1' ? 'green' : 'gray'}>{c.protocol}</Badge></div>
            {c.protocol !== 'ocpp2.1' ? <p className="text-xs muted">Bidirectional charging needs an OCPP 2.1 charger and a car that supports it (ISO 15118-20).</p> : (
              <>
                <p className="text-xs muted">Discharge a connected car to support the site or grid. Runs inside the active session, needs approval, and the energy returned is credited on the driver's bill at the tariff's V2G rate.</p>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Connector"><select className="input min-h-[36px]" value={v2g.connector} onChange={(e) => setV2g({ ...v2g, connector: Number(e.target.value) })}>{c.connectors.map((x) => <option key={x.number} value={x.number}>#{x.number}</option>)}</select></Field>
                  <Field label="kW"><input className="input min-h-[36px] w-20" value={v2g.kw} onChange={(e) => setV2g({ ...v2g, kw: e.target.value })} /></Field>
                  <Field label="Minutes"><input className="input min-h-[36px] w-20" value={v2g.minutes} onChange={(e) => setV2g({ ...v2g, minutes: e.target.value })} /></Field>
                  {can('smart.manage') && <button type="button" className="btn-primary btn-sm" onClick={() => setReasonFor({ action: 'v2g_discharge', connector: v2g.connector, kw: Number(v2g.kw), minutes: Number(v2g.minutes), label: `Discharge ${v2g.kw} kW for ${v2g.minutes} min` })}>Start discharge</button>}
                  {can('smart.manage') && <ActionButton className="btn-ghost btn-sm" onClick={() => run({ action: 'v2g_stop', connector: v2g.connector })}>Stop discharge</ActionButton>}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
      <ReasonModal open={!!reasonFor} title={reasonFor?.label} onClose={() => setReasonFor(null)} onSubmit={async (reason) => run({ ...reasonFor, label: undefined, reason })}>
        {reasonFor?.action === 'remote_start' && <p className="text-sm muted">Starts an operator session billed to your company (no driver payment).</p>}
      </ReasonModal>
    </>
  );
}

export function SitesPage() {
  const { can, isPlatform } = useConsole();
  const { data, error, reload } = useApi('/api/cms/sites');
  const [edit, setEdit] = useState(null);
  const [limitFor, setLimitFor] = useState(null);
  const [limit, setLimit] = useState('');
  const toast = useToast();
  const save = async () => {
    const body = { ...edit, location: edit.lat ? { lat: Number(edit.lat), lng: Number(edit.lng) } : undefined, amenities: typeof edit.amenities === 'string' ? edit.amenities.split(',').map((s) => s.trim()).filter(Boolean) : edit.amenities, photos: edit.photo ? [edit.photo] : edit.photos };
    delete body.lat; delete body.lng; delete body.photo; delete body._id; delete body.chargers; delete body.tenant; delete body.createdAt; delete body.updatedAt; delete body.__v;
    if (edit._id) await api(`/api/cms/sites/${edit._id}`, { method: 'PATCH', body });
    else await api('/api/cms/sites', { method: 'POST', body });
    setEdit(null);
    reload();
  };
  return (
    <>
      <PageHeader title="Sites" sub="Locations, timings, amenities and how-to-reach notes">
        {can('site.manage') && !isPlatform && <button type="button" className="btn-primary" onClick={() => setEdit({ name: '', address: '', city: '', timings: '24x7', amenities: '' })}>Add site</button>}
      </PageHeader>
      <ErrorBox error={error} />
      <Card>{!data ? <Loading /> : <Table rows={data.sites} columns={[
        { key: 'n', label: 'Site', render: (s) => <div><div className="font-medium">{s.name}</div><div className="text-xs muted">{s.address}</div></div> },
        { key: 'c', label: 'City', render: (s) => s.city },
        { key: 'ch', label: 'Chargers', render: (s) => `${s.chargers.online}/${s.chargers.n} online` },
        { key: 't', label: 'Timings', render: (s) => s.timings },
        { key: 'p', label: 'Power limit', render: (s) => (s.powerLimitKw ? `${s.powerLimitKw} kW` : '—') },
        { key: 'a', label: '', render: (s) => can('site.manage') && <div className="flex gap-1"><button type="button" className="btn-ghost btn-sm" onClick={() => setEdit({ ...s, lat: s.location?.lat, lng: s.location?.lng, amenities: (s.amenities || []).join(', '), photo: s.photos?.[0] })}>Edit</button>{can('smart.manage') && <button type="button" className="btn-ghost btn-sm" onClick={() => setLimitFor(s)}>Load limit</button>}</div> },
      ]} />}</Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? 'Edit site' : 'Add site'} footer={<ActionButton onClick={save}>Save</ActionButton>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Address" className="sm:col-span-2"><input className="input" value={edit.address || ''} onChange={(e) => setEdit({ ...edit, address: e.target.value })} /></Field>
            <Field label="City"><input className="input" value={edit.city || ''} onChange={(e) => setEdit({ ...edit, city: e.target.value })} /></Field>
            <Field label="Timings"><input className="input" value={edit.timings || ''} onChange={(e) => setEdit({ ...edit, timings: e.target.value })} /></Field>
            <Field label="Latitude"><input className="input" value={edit.lat ?? ''} onChange={(e) => setEdit({ ...edit, lat: e.target.value })} /></Field>
            <Field label="Longitude"><input className="input" value={edit.lng ?? ''} onChange={(e) => setEdit({ ...edit, lng: e.target.value })} /></Field>
            <Field label="Amenities (comma separated)" className="sm:col-span-2"><input className="input" value={edit.amenities || ''} onChange={(e) => setEdit({ ...edit, amenities: e.target.value })} /></Field>
            <Field label="How to reach (basements, malls)" className="sm:col-span-2"><textarea className="input min-h-[70px] py-2" value={edit.howToReach || ''} onChange={(e) => setEdit({ ...edit, howToReach: e.target.value })} /></Field>
            <Field label="Photo URL of the exact spot" className="sm:col-span-2"><input className="input" value={edit.photo || ''} onChange={(e) => setEdit({ ...edit, photo: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
      <ReasonModal open={!!limitFor} title={`Site power limit · ${limitFor?.name}`} submitLabel="Request approval" onClose={() => setLimitFor(null)} onSubmit={async (reason) => { await api(`/api/cms/sites/${limitFor._id}/power-limit`, { method: 'POST', body: { limitKw: Number(limit), reason } }); toast('Sent for approval'); }}>
        <Field label="Total site limit (kW), shared across chargers via SetChargingProfile"><input className="input" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} /></Field>
      </ReasonModal>
    </>
  );
}

