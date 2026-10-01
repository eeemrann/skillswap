import { useCallback, useEffect, useRef, useState } from 'react';

/** Current time, refreshed every `intervalMs`. Keeps `Date.now()` out of render. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · SkillSwap` : 'SkillSwap';
    return () => { document.title = previous; };
  }, [title]);
}

/**
 * Loads data and keeps it fresh: refetches on an interval and when the tab regains focus.
 * `loading` is true until the first result for the current `deps` arrives; `reload()` forces a refetch.
 */
export function useQuery(fetcher, deps = [], { interval = 0, enabled = true, focus = true } = {}) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState({ key: null, data: undefined, error: null });
  const [version, setVersion] = useState(0);
  const fetcherRef = useRef(fetcher);

  useEffect(() => { fetcherRef.current = fetcher; });

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const run = () => fetcherRef.current().then(
      (data) => { if (active) setState({ key, data, error: null }); },
      (error) => { if (active) setState((current) => ({ key, data: current.key === key ? current.data : undefined, error })); }
    );
    run();
    const refresh = () => { if (!document.hidden) run(); };
    const timer = interval ? window.setInterval(refresh, interval) : null;
    if (focus) window.addEventListener('focus', refresh);
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
      if (focus) window.removeEventListener('focus', refresh);
    };
  }, [key, interval, enabled, focus, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const setData = useCallback((updater) => setState((current) => ({ ...current, data: typeof updater === 'function' ? updater(current.data) : updater })), []);
  return { data: state.data, error: state.error, loading: enabled && state.key !== key, reload, setData };
}

/** Runs `handler` when the window receives a custom or socket-driven refresh signal. */
export function useWindowEvent(name, handler) {
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });
  useEffect(() => {
    const listener = (event) => handlerRef.current(event);
    window.addEventListener(name, listener);
    return () => window.removeEventListener(name, listener);
  }, [name]);
}

/** Locks page scroll while an overlay is open. */
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [locked]);
}

/** Calls `onClose` for Escape while `active`. */
export function useEscape(active, onClose) {
  useEffect(() => {
    if (!active) return undefined;
    const listener = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [active, onClose]);
}

/**
 * Device location, requested only while `enabled` (i.e. after the member opts in to a nearby search).
 * status: 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported'
 */
export function useGeolocation(enabled) {
  const [state, setState] = useState({ status: 'idle', coords: null });
  useEffect(() => {
    if (!enabled) return undefined;
    if (!navigator.geolocation) {
      queueMicrotask(() => setState({ status: 'unsupported', coords: null }));
      return undefined;
    }
    let active = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { if (active) setState({ status: 'granted', coords: { lng: coords.longitude, lat: coords.latitude } }); },
      () => { if (active) setState({ status: 'denied', coords: null }); },
      { maximumAge: 600000, timeout: 10000 }
    );
    return () => { active = false; };
  }, [enabled]);
  if (!enabled) return { status: 'idle', coords: null };
  return state.status === 'idle' ? { status: 'loading', coords: null } : state;
}

/** Debounces a fast-changing value (e.g. a search box). */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
