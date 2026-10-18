import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/** Load data from the API with loading/error state and a reload function. */
export function useApi(path, opts = {}, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!!path);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const load = useCallback(async ({ quiet } = {}) => {
    if (!path) return null;
    if (!quiet) setLoading(true);
    try {
      const d = await api(path, optsRef.current);
      setData(d);
      setError(null);
      return d;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [path, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}

/** Poll a loader every `ms` while the component is mounted. */
export function useInterval(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!ms) return undefined;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Re-render every second (for timers). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useInterval(() => setNow(Date.now()), ms);
  return now;
}
