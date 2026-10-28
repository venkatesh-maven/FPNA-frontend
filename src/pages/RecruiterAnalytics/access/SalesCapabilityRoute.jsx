import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSalesAccess } from "./SalesAccessContext";
import { SALES_ANALYTICS_BASE } from "../config/tabs";
import { Spinner } from "../../Budget/budgetHelpers";

/**
 * Tab guard (same pattern as AdminProtectedRoute): without one of the
 * capabilities the tab needs, send the viewer to the module's landing route
 * with a notice. Server-side checks will back this once the API exists.
 */
export default function SalesCapabilityRoute({ any }) {
  const { ready, canAny } = useSalesAccess();
  const location = useLocation();
  if (!ready) return <Spinner label="Checking access…" />;
  if (!canAny(any)) {
    return (
      <Navigate
        to={{ pathname: SALES_ANALYTICS_BASE, search: location.search }}
        replace
        state={{ notice: "That view isn't available for your role, so you've been taken to one that is." }}
      />
    );
  }
  return <Outlet />;
}
