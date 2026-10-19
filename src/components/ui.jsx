import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { titleCase } from '../lib/format.js';

export const cx = (...a) => a.filter(Boolean).join(' ');

// ---------------------------------------------------------------- icons (inline, no icon library)
const paths = {
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14',
  list: 'M4 6h16M4 12h16M4 18h16',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  search: 'm21 21-4.3-4.3M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  pin: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  check: 'm5 13 4 4L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  plug: 'M9 2v6m6-6v6M6 8h12v4a6 6 0 0 1-12 0zm6 10v4',
  home: 'M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8.4-3a8.4 8.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2.2-1.3L15.4 3h-3.8l-.4 2.5a8 8 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a8.4 8.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2.2 1.3l.4 2.5h3.8l.4-2.5a8 8 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z',
  money: 'M3 7h18v10H3zm9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v4m12-4v4',
  users: 'M16 21v-2a4 4 0 0 0-8 0v2m4-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm9 10v-2a4 4 0 0 0-3-3.9M17 3.1a4 4 0 0 1 0 7.8',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9m-4.3 13a2 2 0 0 1-3.4 0',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M8 13h8m-8 4h8',
  cpu: 'M9 9h6v6H9zM5 5h14v14H5zM9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4',
  star: 'm12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z',
  refresh: 'M3 12a9 9 0 0 1 15.5-6.3L21 8m0-5v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16m0 5v-5h5',
  chev: 'm9 18 6-6-6-6',
  back: 'm15 18-6-6 6-6',
  car: 'M5 17h14M6 17v2m12-2v2M3 13l2-6h14l2 6v4H3zm4 1h.01M17 14h.01',
  play: 'M6 4l14 8-14 8z',
  layers: 'm12 2 10 5-10 5L2 7zm-10 10 10 5 10-5M2 17l10 5 10-5',
  out: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5m5 5H3',
  sun: 'M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17m10-10 1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  share: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14',
  gauge: 'M12 14l4-4M3.5 18a10 10 0 1 1 17 0',
  leaf: 'M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 12-4 16-9 16zm0 0c0-4 2-7 6-9',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zm14 7h.01',
  sparkle: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  battery: 'M3 8h15a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zm19 3v2',
  qr: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h3v3h-3zm4 4h3v3h-3zm-4 3h0m7-7h0',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
};
export function Icon({ name, className = 'h-5 w-5', strokeWidth = 2 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name] || paths.bolt} />
    </svg>
  );
}

// ---------------------------------------------------------------- basics
export const Card = ({ className, children, ...p }) => <div className={cx('card', className)} {...p}>{children}</div>;

export function Spinner({ className = 'h-5 w-5' }) {
  return <svg className={cx('animate-spin text-brand-600', className)} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".2" strokeWidth="4" /><path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>;
}

export const Loading = ({ label = 'Loading…' }) => <div className="flex items-center justify-center gap-3 py-16 muted"><Spinner /> {label}</div>;

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200" role="alert">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{error.message || String(error)}</div>
      {onRetry && <button type="button" className="font-semibold underline" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export const Empty = ({ icon = 'list', title, children }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
    <div className="rounded-full bg-ink-100 p-3 text-ink-400 dark:bg-ink-800"><Icon name={icon} className="h-6 w-6" /></div>
    <div className="font-semibold">{title}</div>
    {children && <div className="max-w-sm text-sm muted">{children}</div>}
  </div>
);

const TONES = {
  green: 'bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-950 dark:text-brand-300',
  red: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300',
  gray: 'bg-ink-100 text-ink-600 ring-ink-500/20 dark:bg-ink-800 dark:text-ink-300',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950 dark:text-violet-300',
};
export const Badge = ({ tone = 'gray', children, className }) => <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone], className)}>{children}</span>;

const STATUS_TONE = {
  Available: 'green', Occupied: 'blue', Charging: 'blue', Reserved: 'violet', Faulted: 'red', Unavailable: 'gray', Offline: 'gray',
  CREATED: 'gray', PAID: 'blue', STARTING: 'amber', CHARGING: 'green', STOPPING: 'amber', COMPLETED: 'blue', BILLED: 'green', FAILED: 'red', INTERRUPTED: 'amber', CANCELLED: 'gray',
  open: 'red', acknowledged: 'amber', resolved: 'green', in_progress: 'amber', closed: 'gray', pending: 'amber', approved: 'blue', rejected: 'red', executed: 'green',
  succeeded: 'green', failed: 'red', processing: 'amber', finance_queue: 'red', issued: 'green', cancelled: 'gray', captured: 'green', expired: 'gray',
  active: 'green', suspended: 'red', pending_kyc: 'amber', paid: 'green', held: 'red', released: 'blue', draft: 'gray', published: 'green', scheduled: 'violet', archived: 'gray',
  Accepted: 'green', Rejected: 'red', TimedOut: 'amber', Error: 'red', PendingApproval: 'violet', Queued: 'amber', critical: 'red', warning: 'amber', info: 'blue',
  registered: 'green', sent: 'green', matched: 'green', disputed: 'red', ok: 'green', mismatch: 'red', received: 'blue',
};
export const Status = ({ value, label }) => <Badge tone={STATUS_TONE[value] || 'gray'}>{label || titleCase(value || '—')}</Badge>;

export function Stat({ label, value, sub, icon, tone, delta, spark }) {
  const bubble = tone === 'red' ? 'red' : tone || 'green';
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider muted">{label}</div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
        </div>
        {icon && <IconBubble name={icon} tone={bubble} size="sm" />}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="min-w-0 text-xs muted">
          {delta !== undefined && delta !== null && <span className={cx('mr-1 font-semibold', delta > 0 ? 'text-brand-600' : delta < 0 ? 'text-red-600' : 'muted')}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Math.abs(delta)}%</span>}
          {sub}
        </div>
        {spark && <Sparkline data={spark} />}
      </div>
    </Card>
  );
}

export function Field({ label, children, hint, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs muted">{hint}</span>}
    </label>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-ink-950/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" className={cx('card max-h-[92dvh] w-full overflow-auto rounded-b-none sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3 dark:border-ink-800">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose} aria-label="Close"><Icon name="x" className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-3 dark:border-ink-800">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-ink-200 dark:border-ink-800">
      {tabs.map((t) => (
        <button key={t.value} type="button" onClick={() => onChange(t.value)} className={cx('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition', value === t.value ? 'border-brand-600 text-brand-700 dark:text-brand-400' : 'border-transparent muted hover:text-ink-800 dark:hover:text-ink-200')}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 rounded-full bg-ink-100 px-1.5 text-xs dark:bg-ink-800">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Generic data table. columns: [{ key, label, render?, className? }] */
export function Table({ columns, rows, onRow, empty = 'Nothing here yet.', rowKey = (r, i) => r._id || r.id || i }) {
  if (!rows?.length) return <Empty title={empty} />;
  return (
    <div className={cx('overflow-x-auto', rows.length > 15 && 'max-h-[70vh] overflow-y-auto')}>
      <table className="min-w-full divide-y divide-ink-100 dark:divide-ink-800">
        <thead><tr>{columns.map((c) => <th key={c.key} className={cx('th', c.className)}>{c.label}</th>)}</tr></thead>
        <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)} onClick={onRow ? () => onRow(r) : undefined} className={cx(onRow && 'cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/50')}>
              {columns.map((c) => <td key={c.key} className={cx('td', c.className)}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- toasts
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, tone = 'green') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[1100] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg', t.tone === 'red' ? 'bg-red-600' : t.tone === 'amber' ? 'bg-amber-600' : 'bg-ink-900 dark:bg-ink-700')}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/** Button that runs an async action, shows a spinner and reports errors as a toast. */
export function ActionButton({ onClick, children, className = 'btn-primary', confirm, success, ...p }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <button
      type="button"
      className={className}
      disabled={busy || p.disabled}
      {...p}
      onClick={async (e) => {
        e.stopPropagation();
        if (confirm && !window.confirm(confirm)) return;
        setBusy(true);
        try {
          const r = await onClick?.();
          if (success) toast(typeof success === 'function' ? success(r) : success);
        } catch (err) {
          toast(err.message, 'red');
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Spinner className="h-4 w-4 text-current" />}
      {children}
    </button>
  );
}

/** Ask for a reason (guardrail: reason code required). Returns a promise-like flow via callbacks. */
export function ReasonModal({ open, title, onClose, onSubmit, children, submitLabel = 'Confirm', danger }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (open) {
      setReason('');
      setErr(null);
    }
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} disabled={busy || reason.trim().length < 3} onClick={async () => {
            setBusy(true);
            try {
              await onSubmit(reason.trim());
              onClose();
            } catch (e) {
              setErr(e);
            } finally {
              setBusy(false);
            }
          }}>{busy && <Spinner className="h-4 w-4 text-current" />}{submitLabel}</button>
        </>
      }
    >
      <div className="space-y-3">
        {children}
        <Field label="Reason (required, kept in the audit log)"><textarea className="input min-h-[80px] py-2" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
        <ErrorBox error={err} />
      </div>
    </Modal>
  );
}


// ---------------------------------------------------------------- revamp building blocks

/** Coloured round icon (section headers, list rows, KPI cards). */
const BUBBLE = {
  green: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  gray: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
};
export function IconBubble({ name, tone = 'green', size = 'md', className }) {
  const s = size === 'lg' ? 'h-12 w-12 rounded-2xl' : size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl';
  return <span className={cx('grid shrink-0 place-items-center', s, BUBBLE[tone] || BUBBLE.green, className)}><Icon name={name} className={size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} /></span>;
}

/** "60 kW DC FAST" — DC fast in orange, AC in cyan, 2W/3W slow in green. */
export function PowerBadge({ kw, type, className }) {
  const dc = type === 'DC';
  const fast = dc && kw >= 25;
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide', fast ? 'bg-fast-100 text-fast-700 dark:bg-orange-950 dark:text-orange-300' : dc ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300', className)}>
      <Icon name="bolt" className="h-3 w-3" strokeWidth={2.5} />{kw} kW {fast ? 'DC fast' : type}
    </span>
  );
}

/** Small coloured dot + optional pulse for "available now" / live states. */
export function StatusDot({ tone = 'green', pulse }) {
  const c = { green: 'bg-brand-500', blue: 'bg-sky-500', red: 'bg-red-500', amber: 'bg-amber-500', gray: 'bg-ink-400' }[tone];
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {pulse && <span className={cx('absolute inline-flex h-full w-full rounded-full animate-pulse-ring', c)} />}
      <span className={cx('relative inline-flex h-2.5 w-2.5 rounded-full', c)} />
    </span>
  );
}

export function Chip({ on, onClick, icon, children, className }) {
  return (
    <button type="button" aria-pressed={!!on} onClick={onClick} className={cx('chip', on && 'chip-on', className)}>
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}{children}
    </button>
  );
}

export const Skeleton = ({ className }) => <div className={cx('skeleton', className)} aria-hidden="true" />;

export function SkeletonCards({ n = 3 }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="card space-y-3 p-4"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /><div className="flex gap-2"><Skeleton className="h-6 w-24" /><Skeleton className="h-6 w-20" /></div></div>
      ))}
    </div>
  );
}

/** Circular progress (amount used / battery). value 0..100 */
export function ProgressRing({ value = 0, size = 200, stroke = 14, tone = 'brand', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const color = tone === 'amber' ? '#f59e0b' : tone === 'red' ? '#dc2626' : 'url(#cx-ring)';
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="cx-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--brand-500))" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-ink-100 dark:stroke-ink-800" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={color} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Small inline sparkline (KPI cards). */
export function Sparkline({ data = [], width = 96, height = 28, className }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * width},${height - ((d - min) / (max - min || 1)) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="rgb(var(--brand-500))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Stars({ value = 0, count }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-xs" aria-label={`${value} of 5 stars`}>
      <Icon name="star" className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <b>{Number(value).toFixed(1)}</b>{count !== undefined && <span className="muted">({count})</span>}
    </span>
  );
}
