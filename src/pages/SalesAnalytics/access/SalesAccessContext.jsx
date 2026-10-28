import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMyAccess } from "../services/salesAnalyticsApi";
import { accessStore, viewAsStore } from "../services/store/stores";

const SalesAccessContext = createContext(null);

/**
 * Who the module is showing data for. Until the backend exists, a "View as"
 * persona stands in for the signed-in user; the mock service resolves that
 * persona's capabilities and scope exactly as the server will from a token.
 */
export function SalesAccessProvider({ children }) {
  const [userId, setUserId] = useState(() => viewAsStore.read().userId);
  const [access, setAccess] = useState(null);

  const [rulesVersion, setRulesVersion] = useState(0);
  useEffect(() => accessStore.subscribe(() => setRulesVersion((v) => v + 1)), []);

  useEffect(() => {
    let live = true;
    getMyAccess({ userId }).then((a) => live && setAccess(a));
    return () => {
      live = false;
    };
  }, [userId, rulesVersion]);

  const setViewAs = useCallback((id) => {
    viewAsStore.write({ userId: id });
    setAccess(null);
    setUserId(id);
  }, []);

  const value = useMemo(() => {
    const caps = new Set(access?.capabilities || []);
    return {
      viewer: { userId },
      access,
      ready: !!access,
      setViewAs,
      can: (cap) => caps.has(cap),
      canAny: (list) => list.some((c) => caps.has(c)),
      isMasked: (field) => !!access?.maskedFields?.includes(field),
    };
  }, [userId, access, setViewAs]);

  return <SalesAccessContext.Provider value={value}>{children}</SalesAccessContext.Provider>;
}

export function useSalesAccess() {
  const ctx = useContext(SalesAccessContext);
  if (!ctx) throw new Error("useSalesAccess must be used inside SalesAccessProvider");
  return ctx;
}
