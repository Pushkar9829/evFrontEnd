// Thin fetch wrapper. The API lives on a different origin (Render) from the web app (Vercel).
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4410').replace(/\/$/, '');

const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      if (v === null || v === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

export const tokens = {
  driver: () => store.get('cx.driver'),
  setDriver: (t) => store.set('cx.driver', t),
  staff: () => store.get('cx.staff'),
  setStaff: (t) => store.set('cx.staff', t),
  // Guest session tokens per session id (owner token from the browser that paid)
  session: (id) => store.get(`cx.s.${id}`),
  setSession: (id, t) => store.set(`cx.s.${id}`, t),
  view: (id) => store.get(`cx.v.${id}`),
  setView: (id, t) => store.set(`cx.v.${id}`, t),
};
export { store };

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code;
    this.body = body;
  }
}

/**
 * api('/api/x', { method, body, auth: 'driver' | 'staff' | 'none', sessionId })
 * Driver calls send the driver token; console calls send the staff token.
 */
export async function api(path, { method = 'GET', body, auth = 'auto', sessionId, headers = {}, raw = false } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const kind = auth === 'auto' ? (path.startsWith('/api/cms') || path.startsWith('/api/admin') || path.startsWith('/api/payments/mock-controls') ? 'staff' : 'driver') : auth;
  const t = kind === 'staff' ? tokens.staff() : kind === 'driver' ? tokens.driver() : null;
  if (t) h.Authorization = `Bearer ${t}`;
  if (sessionId) {
    const st = tokens.session(sessionId);
    const vt = tokens.view(sessionId);
    if (st) h['x-session-token'] = st;
    if (vt) h['x-view-token'] = vt;
  }
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, { error: { code: 'NETWORK', message: 'No internet connection. Check your network and try again.' } });
  }
  if (raw) return res;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && kind === 'staff' && !path.includes('/auth/')) {
      tokens.setStaff(null);
      if (!location.pathname.startsWith('/console/login')) location.href = `/console/login?next=${encodeURIComponent(location.pathname)}`;
    }
    throw new ApiError(res.status, json);
  }
  return json;
}

/** Download a protected file (PDF/CSV) with auth headers. */
export async function download(path, filename, opts = {}) {
  const res = await api(path, { ...opts, raw: true });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
