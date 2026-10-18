// Custom roles and API keys (Phase 3).
import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useApi } from '../../lib/hooks.js';
import { dt, rs, titleCase } from '../../lib/format.js';
import { ActionButton, Badge, Card, ErrorBox, Field, Loading, Modal, Table, Tabs, useToast } from '../../components/ui.jsx';
import { PageHeader } from '../Console.jsx';

const GROUPS = { site: 'Sites', charger: 'Chargers', ocpp: 'Chargers', tariff: 'Tariffs', session: 'Sessions', customer: 'Customers', complaint: 'Complaints', finance: 'Finance', invoice: 'Finance', reconciliation: 'Finance', report: 'Reports', audit: 'Audit', alert: 'Alerts', approval: 'Approvals', roaming: 'Roaming', smart: 'Smart charging', simulator: 'Simulator', staff: 'Company', bank: 'Company', branding: 'Company' };

function RoleEditor({ open, onClose, perms, role, fixed, onSaved }) {
  const [f, setF] = useState(null);
  const [err, setErr] = useState(null);
  if (open && !f) {
    setF(role ? { name: role.name, description: role.description || '', perms: role.perms, scope: role.scope, refundLimit: (role.refundLimitPaise || 0) / 100 } : { name: '', description: '', perms: [], scope: 'tenant', refundLimit: 0 });
  }
  const close = () => {
    setF(null);
    setErr(null);
    onClose();
  };
  if (!open || !f) return null;
  const groups = {};
  for (const p of perms) (groups[GROUPS[p.split('.')[0]] || 'Other'] ||= []).push(p);
  const toggle = (p) => setF({ ...f, perms: f.perms.includes(p) ? f.perms.filter((x) => x !== p) : [...f.perms, p] });
  return (
    <Modal open onClose={close} wide title={role ? `Edit role · ${role.name}` : 'New custom role'} footer={<ActionButton onClick={async () => {
      try {
        const body = { name: f.name, description: f.description || undefined, perms: f.perms, scope: f.scope, refundLimitPaise: Math.round(Number(f.refundLimit || 0) * 100) };
        if (role) await api(`/api/cms/roles/${role._id}`, { method: 'PATCH', body });
        else await api('/api/cms/roles', { method: 'POST', body });
        onSaved();
        close();
      } catch (e) {
        setErr(e);
      }
    }}>Save role</ActionButton>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Role name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Night shift supervisor" /></Field>
          <Field label="Scope"><select className="input" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}><option value="tenant">Whole company</option><option value="site">Assigned sites only</option></select></Field>
          <Field label="Refund limit (₹)" hint="Above this goes to approval"><input className="input" inputMode="decimal" value={f.refundLimit} onChange={(e) => setF({ ...f, refundLimit: e.target.value })} /></Field>
        </div>
        {!role && (
          <Field label="Start from a fixed role (optional)">
            <select className="input" onChange={(e) => { const r = fixed.find((x) => x.key === e.target.value); if (r) setF({ ...f, perms: r.perms, scope: r.scope === 'site' ? 'site' : 'tenant', refundLimit: (r.refundLimitPaise || 0) / 100 }); }}>
              <option value="">—</option>{fixed.map((r) => <option key={r.key} value={r.key}>{titleCase(r.key)}</option>)}
            </select>
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(groups).map(([g, ps]) => (
            <div key={g} className="rounded-xl border border-ink-200 p-3 dark:border-ink-700">
              <div className="mb-1 text-sm font-semibold">{g}</div>
              {ps.map((p) => <label key={p} className="flex items-center gap-2 py-0.5 text-xs"><input type="checkbox" className="accent-brand-600" checked={f.perms.includes(p)} onChange={() => toggle(p)} /><span className="font-mono">{p}</span></label>)}
            </div>
          ))}
        </div>
        <p className="text-xs muted">Roles with money permissions (refunds, finance) or charger commands always require two-factor login. You can only grant permissions you have yourself.</p>
        <ErrorBox error={err} />
      </div>
    </Modal>
  );
}

export default function AccessPage() {
  const toast = useToast();
  const [tab, setTab] = useState('roles');
  const roles = useApi('/api/cms/roles');
  const keys = useApi(tab === 'keys' ? '/api/cms/api-keys' : null);
  const [edit, setEdit] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [kf, setKf] = useState({ name: '', scopes: ['chargers:read', 'sessions:read'], days: '' });
  const [shown, setShown] = useState(null);
  return (
    <>
      <PageHeader title="Roles & API keys" sub="Build your own roles from the permission list; connect your systems with scoped API keys">
        {tab === 'roles' ? <button type="button" className="btn-primary" onClick={() => setEdit({})}>New role</button> : <button type="button" className="btn-primary" onClick={() => setNewKey(true)}>New API key</button>}
      </PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'roles', label: 'Custom roles' }, { value: 'keys', label: 'API keys' }]} />
      <div className="mt-3">
        {tab === 'roles' && (!roles.data ? <Loading /> : (
          <Card><Table rows={roles.data.custom} empty="No custom roles yet — the fixed roles still apply." columns={[
            { key: 'n', label: 'Role', render: (r) => <div><div className="font-medium">{r.name}{r.archived && <Badge className="ml-1">archived</Badge>}</div><div className="text-xs muted">{r.description}</div></div> },
            { key: 'p', label: 'Permissions', render: (r) => <span className="text-xs">{r.perms.length} permissions</span> },
            { key: 's', label: 'Scope', render: (r) => (r.scope === 'site' ? 'Sites' : 'Company') },
            { key: 'l', label: 'Refund limit', render: (r) => rs(r.refundLimitPaise, { decimals: 0 }) },
            { key: 'm', label: 'Members', render: (r) => r.members },
            { key: 'x', label: '', render: (r) => !r.archived && <div className="flex gap-1"><button type="button" className="btn-ghost btn-sm" onClick={() => setEdit({ role: r })}>Edit</button><ActionButton className="btn-ghost btn-sm" confirm={`Archive ${r.name}?`} onClick={async () => { await api(`/api/cms/roles/${r._id}`, { method: 'DELETE' }); roles.reload({ quiet: true }); }}>Archive</ActionButton></div> },
          ]} /></Card>
        ))}
        {tab === 'keys' && (!keys.data ? <Loading /> : (
          <>
            <Card className="mb-3 p-4 text-sm">
              <div className="font-semibold">Using the API</div>
              <p className="text-xs muted">Base URL <code>{(import.meta.env.VITE_API_URL || 'http://localhost:4410').replace(/\/$/, '')}/api/v1</code>. Send <code>Authorization: Bearer cx_…</code>. Endpoints: <code>GET /chargers</code>, <code>GET /sessions?from=&amp;to=&amp;state=&amp;after=</code>, <code>GET /sessions/:id</code>, <code>POST /chargers/:id/connectors/:n/start</code>, <code>POST /sessions/:id/stop</code>, <code>GET /tariffs</code>, <code>GET /finance/summary</code>. 120 requests/min per key.</p>
            </Card>
            <Card><Table rows={keys.data.keys} empty="No API keys" columns={[
              { key: 'n', label: 'Name', render: (k) => <div><div className="font-medium">{k.name}</div><div className="font-mono text-xs muted">cx_{k.prefix}_…</div></div> },
              { key: 's', label: 'Scopes', render: (k) => <div className="flex flex-wrap gap-1">{k.scopes.map((s) => <Badge key={s}>{s}</Badge>)}</div> },
              { key: 'u', label: 'Last used', render: (k) => (k.lastUsedAt ? `${dt(k.lastUsedAt)} · ${k.useCount} calls` : 'never') },
              { key: 'e', label: 'Expires', render: (k) => (k.expiresAt ? dt(k.expiresAt) : '—') },
              { key: 'st', label: 'Status', render: (k) => (k.revokedAt ? <Badge tone="red">Revoked</Badge> : <Badge tone="green">Active</Badge>) },
              { key: 'x', label: '', render: (k) => !k.revokedAt && <ActionButton className="btn-ghost btn-sm" confirm={`Revoke ${k.name}? Systems using it stop working immediately.`} onClick={async () => { await api(`/api/cms/api-keys/${k._id}/revoke`, { method: 'POST', body: { reason: 'console' } }); keys.reload({ quiet: true }); }}>Revoke</ActionButton> },
            ]} /></Card>
          </>
        ))}
      </div>
      {roles.data && <RoleEditor open={!!edit} role={edit?.role} perms={roles.data.permissions} fixed={roles.data.fixed} onClose={() => setEdit(null)} onSaved={() => { roles.reload({ quiet: true }); toast('Role saved'); }} />}
      <Modal open={!!newKey} onClose={() => { setNewKey(null); setShown(null); }} title={shown ? 'Copy your API key' : 'New API key'} footer={!shown && <ActionButton onClick={async () => {
        const r = await api('/api/cms/api-keys', { method: 'POST', body: { name: kf.name, scopes: kf.scopes, expiresInDays: kf.days ? Number(kf.days) : undefined } });
        setShown(r.key);
        keys.reload({ quiet: true });
      }}>Create key</ActionButton>}>
        {shown ? (
          <div className="space-y-2 text-sm"><p>This is the only time the key is shown. Store it in your system's secret store.</p><div className="break-all rounded-xl bg-ink-900 p-3 font-mono text-xs text-brand-200">{shown}</div><button type="button" className="btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(shown).then(() => toast('Copied'))}>Copy</button></div>
        ) : (
          <div className="space-y-3">
            <Field label="Name"><input className="input" value={kf.name} onChange={(e) => setKf({ ...kf, name: e.target.value })} placeholder="ERP sync" /></Field>
            <div><div className="label">Scopes</div>{(keys.data?.scopes || ['chargers:read', 'sessions:read', 'sessions:write', 'tariffs:read', 'finance:read']).map((s) => <label key={s} className="mr-4 inline-flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={kf.scopes.includes(s)} onChange={() => setKf({ ...kf, scopes: kf.scopes.includes(s) ? kf.scopes.filter((x) => x !== s) : [...kf.scopes, s] })} /><span className="font-mono text-xs">{s}</span></label>)}</div>
            <Field label="Expires after (days, optional)"><input className="input" inputMode="numeric" value={kf.days} onChange={(e) => setKf({ ...kf, days: e.target.value.replace(/\D/g, '') })} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
