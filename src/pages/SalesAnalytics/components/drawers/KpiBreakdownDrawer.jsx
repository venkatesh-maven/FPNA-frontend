import React from "react";
import EvidenceDrawer from "./EvidenceDrawer";
import { getKpiBreakdown } from "../../services/salesAnalyticsApi";
import { useSalesQuery } from "../../hooks/useSalesQuery";
import { useSalesFilters } from "../../filters/SalesFiltersContext";
import { useSalesAccess } from "../../access/SalesAccessContext";

/** What sits behind a KPI tile, loaded when the tile is opened. */
export default function KpiBreakdownDrawer({ tile, repId, onClose }) {
  const { filters } = useSalesFilters();
  const { viewer } = useSalesAccess();
  const args = tile ? { kpiKey: tile.key, label: tile.label, ...(repId ? { repId } : {}) } : {};
  const { data, meta, loading, error } = useSalesQuery(getKpiBreakdown, filters, viewer, args, { enabled: !!tile });
  return (
    <EvidenceDrawer
      open={!!tile}
      onClose={onClose}
      title={tile?.label || ""}
      subtitle={meta ? `${meta.period.label} · vs ${meta.compareBasis} · ${meta.scope.label}` : ""}
      sections={data?.sections}
      loading={loading && !data}
      error={error}
    />
  );
}
