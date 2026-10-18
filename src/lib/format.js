export const rs = (paise, { decimals = 2 } = {}) => (paise === undefined || paise === null ? '—' : `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`);
export const rs0 = (paise) => rs(paise, { decimals: 0 });
export const kwh = (wh, d = 2) => (wh === undefined || wh === null ? '—' : `${(wh / 1000).toFixed(d)} kWh`);
export const kw = (w) => (w === undefined || w === null ? '—' : `${(w / 1000).toFixed(1)} kW`);
export const dt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const dateOnly = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const ago = (d) => {
  if (!d) return 'never';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};
export const duration = (from, to = Date.now()) => {
  if (!from) return '—';
  const s = Math.max(0, Math.round((new Date(to) - new Date(from)) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}h ${m}m` : `${m}m ${String(sec).padStart(2, '0')}s`;
};
export const month = (k) => new Date(`${k}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
export const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
