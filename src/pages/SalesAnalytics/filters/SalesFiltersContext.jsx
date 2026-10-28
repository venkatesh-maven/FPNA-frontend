import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_FILTERS, FILTER_FIELDS } from "./filterSchema";
import { decodeFilters, encodeFilters, hasFilterParams } from "./urlCodec";
import { getFilterOptions } from "../services/salesAnalyticsApi";
import { useSalesAccess } from "../access/SalesAccessContext";

const SESSION_KEY = "fpna.sa.filters";
const SalesFiltersContext = createContext(null);

const readSession = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
};
const writeSession = (qs) => {
  try {
    sessionStorage.setItem(SESSION_KEY, qs);
  } catch {
    // storage blocked: the URL still carries the filters
  }
};

/**
 * Applied filters live in the URL (shareable, survive reload and Back). The
 * last applied set is mirrored to sessionStorage so opening a tab from the
 * sidebar — which drops the query string — restores it.
 */
export function SalesFiltersProvider({ children }) {
  const [params, setParams] = useSearchParams();
  const { viewer, ready } = useSalesAccess();
  const [options, setOptions] = useState(null);

  // Restore the last filters when arriving without any.
  useEffect(() => {
    if (!hasFilterParams(params)) {
      const saved = readSession();
      if (saved) setParams(new URLSearchParams(saved), { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filters = useMemo(() => decodeFilters(params), [params]);

  useEffect(() => {
    writeSession(encodeFilters(filters).toString());
  }, [filters]);

  useEffect(() => {
    if (!ready) return undefined;
    let live = true;
    getFilterOptions(viewer).then((o) => live && setOptions(o));
    return () => {
      live = false;
    };
  }, [viewer, ready]);

  const setFilters = useCallback(
    (next) => {
      const merged = typeof next === "function" ? next(decodeFilters(params)) : next;
      // Keep any non-filter params (e.g. a rep picked on My Performance).
      const out = encodeFilters(merged);
      for (const [k, v] of params) if (!out.has(k) && !isFilterParam(k)) out.set(k, v);
      setParams(out);
    },
    [params, setParams]
  );

  const value = useMemo(
    () => ({ filters, setFilters, resetFilters: () => setFilters(DEFAULT_FILTERS), options, search: params.toString() }),
    [filters, setFilters, options, params]
  );
  return <SalesFiltersContext.Provider value={value}>{children}</SalesFiltersContext.Provider>;
}

const FILTER_URL_KEYS = new Set(FILTER_FIELDS.map((f) => f.url));
const isFilterParam = (k) => FILTER_URL_KEYS.has(k);

export function useSalesFilters() {
  const ctx = useContext(SalesFiltersContext);
  if (!ctx) throw new Error("useSalesFilters must be used inside SalesFiltersProvider");
  return ctx;
}
