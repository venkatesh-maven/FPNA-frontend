import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSalesAccess } from "./access/SalesAccessContext";
import { TABS } from "./config/tabs";
import { EmptyState, Spinner } from "../Budget/budgetHelpers";

/** Opens the first tab the viewer's role allows. */
export default function SalesAnalyticsIndexRedirect() {
  const { ready, canAny } = useSalesAccess();
  const location = useLocation();
  if (!ready) return <Spinner label="Checking access…" />;
  const first = TABS.find((t) => canAny(t.any));
  if (!first) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-sky-100">
        <EmptyState label="Your role can manage access but doesn't include any sales performance data." />
      </div>
    );
  }
  return <Navigate to={{ pathname: first.path, search: location.search }} replace state={location.state} />;
}
