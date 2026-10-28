import { useEffect, useRef, useState } from "react";

const cache = new Map();
const MAX_CACHE = 40;
// Service functions are anonymous, so each gets its own id for the cache key.
const fnIds = new WeakMap();
let nextFnId = 1;
const idOf = (fn) => {
  if (!fnIds.has(fn)) fnIds.set(fn, nextFnId++);
  return fnIds.get(fn);
};

/**
 * Runs a service call and keeps the latest answer. Only the most recent
 * request may update state, so a slow, older response can't overwrite the
 * view for filters that are no longer applied. Results are cached per
 * arguments so switching back to a tab doesn't flash a spinner.
 */
export function useSalesQuery(fn, filters, viewer, args = {}, { enabled = true } = {}) {
  const key = JSON.stringify([idOf(fn), filters, viewer?.userId, args]);
  const [state, setState] = useState(() => cache.get(key) || { data: null, meta: null, error: null });
  const [loading, setLoading] = useState(!cache.has(key));
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled || !viewer?.userId) return;
    const id = ++seq.current;
    const hit = cache.get(key);
    if (hit) setState(hit);
    setLoading(!hit);
    fn(filters, viewer, args)
      .then((res) => {
        if (id !== seq.current) return;
        const next = { data: res.data, meta: res.meta, error: null };
        cache.set(key, next);
        if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
        setState(next);
      })
      .catch((error) => {
        if (id !== seq.current) return;
        setState({ data: null, meta: null, error });
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, loading };
}

/** Forget cached results (e.g. after access changes). */
export const clearSalesQueryCache = () => cache.clear();
