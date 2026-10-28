// What a report's plan / variance columns compare actuals with: Budget (the
// default), the Official Forecast (each quarter's finalised scenario, frozen)
// or one scenario. Pure helpers shared by ComparisonBasisContext, the
// selector and the reports; the backend's forecasting/basis_core.py has the
// matching rules and labels.

export const DEFAULT_BASIS = Object.freeze({
  basis: "budget",
  scenarioId: null,
  scenarioName: null,
  basisQuarter: null,
  finalVersionId: null,
});

// Report filters that slice below company level. The forecast and scenarios
// are company-level only, so with any of these set there's no plan to show.
export const DIMENSION_FILTER_KEYS = ["entity", "cost_center", "profit_center", "customer", "region", "product_name"];

export const basisStorageKey = (userId) => `fpna_compare_basis_v1:${userId || "anon"}`;

function shape(raw) {
  const basis = ["budget", "forecast", "scenario"].includes(raw?.basis) ? raw.basis : "budget";
  if (basis !== "scenario") return { ...DEFAULT_BASIS, basis };
  return {
    basis,
    scenarioId: raw.scenarioId ?? null,
    scenarioName: raw.scenarioName ?? null,
    basisQuarter: raw.basisQuarter ?? null,
    finalVersionId: raw.finalVersionId ?? null,
  };
}

export function readStoredBasis(userId) {
  try {
    const raw = localStorage.getItem(basisStorageKey(userId));
    return raw ? shape(JSON.parse(raw)) : { ...DEFAULT_BASIS };
  } catch {
    return { ...DEFAULT_BASIS };
  }
}

export function writeStoredBasis(userId, state) {
  try {
    localStorage.setItem(basisStorageKey(userId), JSON.stringify(shape(state)));
  } catch {
    // Private mode / storage blocked: the choice just isn't remembered.
  }
}

/** One <select> value per choice: "budget", "forecast", "system:Best Case", "custom:12:Q4", "version:7". */
export function encodeBasis(state) {
  const s = shape(state);
  if (s.basis !== "scenario") return s.basis;
  if (s.finalVersionId != null) return `version:${s.finalVersionId}`;
  if (s.scenarioId != null) return `custom:${s.scenarioId}:${s.basisQuarter || ""}`;
  return `system:${s.scenarioName || ""}`;
}

export function decodeBasis(value, options) {
  if (!value || value === "budget") return { ...DEFAULT_BASIS };
  if (value === "forecast") return { ...DEFAULT_BASIS, basis: "forecast" };
  const [kind, ...rest] = String(value).split(":");
  if (kind === "system") return { ...DEFAULT_BASIS, basis: "scenario", scenarioName: rest.join(":") };
  if (kind === "custom") {
    const id = Number(rest[0]);
    const quarter = rest[1] || null;
    const found = (options?.scenarios?.custom?.[quarter] || []).find((s) => s.id === id);
    return { ...DEFAULT_BASIS, basis: "scenario", scenarioId: id, basisQuarter: quarter, scenarioName: found?.scenario_name ?? null };
  }
  if (kind === "version") {
    const id = Number(rest[0]);
    const v = (options?.final_versions || []).find((x) => x.id === id);
    return { ...DEFAULT_BASIS, basis: "scenario", finalVersionId: id, scenarioName: v?.scenario_name ?? null, basisQuarter: v?.quarter ?? null };
  }
  return { ...DEFAULT_BASIS };
}

/** Query params for the report request; none for Budget, so its URL is unchanged. */
export function basisQueryParams(state, fingerprint) {
  const s = shape(state);
  if (s.basis === "budget") return {};
  const out = { basis: s.basis };
  if (s.basis === "scenario") {
    if (s.finalVersionId != null) out.final_version_id = s.finalVersionId;
    else if (s.scenarioId != null) {
      out.scenario_id = s.scenarioId;
      out.basis_quarter = s.basisQuarter;
    } else out.scenario_name = s.scenarioName;
  }
  if (fingerprint) out.basis_rev = fingerprint;
  return out;
}

/**
 * Labels for headers and text. The response's basis_meta wins when there is
 * one (it knows a pinned version's scenario name); otherwise the same rules as
 * the backend's basis_labels.
 */
export function basisLabels(state, meta) {
  if (meta?.label) {
    return {
      label: meta.label,
      shortLabel: meta.short_label,
      noun: meta.noun,
      columnTop: meta.column_top,
      columnBottom: meta.column_bottom,
    };
  }
  const s = shape(state);
  if (s.basis === "forecast") {
    return { label: "Official Forecast", shortLabel: "Forecast", noun: "forecast", columnTop: "Forecast", columnBottom: "Official" };
  }
  if (s.basis === "scenario") {
    const name = s.scenarioName || "Scenario";
    return { label: `Scenario: ${name}`, shortLabel: name, noun: `the ${name} scenario`, columnTop: "Scenario", columnBottom: name };
  }
  return { label: "Budget", shortLabel: "Budget", noun: "budget", columnTop: "Budget", columnBottom: "Plan" };
}

/**
 * Falls back to the Official Forecast when the chosen scenario or version no
 * longer exists (deleted, or a different year's options).
 */
export function normalizeBasisState(state, options) {
  const s = shape(state);
  if (!options || s.basis !== "scenario") return s;
  const forecast = { ...DEFAULT_BASIS, basis: "forecast" };
  if (s.finalVersionId != null) {
    return (options.final_versions || []).some((v) => v.id === s.finalVersionId) ? s : forecast;
  }
  if (s.scenarioId != null) {
    const found = (options.scenarios?.custom?.[s.basisQuarter] || []).find((x) => x.id === s.scenarioId);
    return found ? { ...s, scenarioName: found.scenario_name } : forecast;
  }
  return (options.scenarios?.system || []).includes(s.scenarioName) ? s : forecast;
}

export function isPlanAvailableForFilters(filters) {
  return !DIMENSION_FILTER_KEYS.some((k) => {
    const v = filters?.[k];
    return v !== null && v !== undefined && v !== "";
  });
}

/**
 * The small chip under a month's header: where that month's plan number came
 * from. periodMeta is basis_meta.periods[period].
 */
export function periodSourceBadge(periodMeta, period) {
  const source = periodMeta?.source;
  if (!periodMeta || !source || source === "none") {
    return { text: "—", tone: "muted", title: "No plan figure for this month" };
  }
  if (source === "final_snapshot") {
    if (periodMeta.source_at_final === "actual" || periodMeta.source_at_final?.[period] === "actual") {
      return { text: "Actual at finalisation", tone: "muted", title: "This month was already actual when the forecast was marked final" };
    }
    const v = periodMeta.version?.version_number;
    return { text: v ? `Final v${v}` : "Final", tone: "final", title: `Frozen when ${periodMeta.quarter} was marked final` };
  }
  if (source === "baseline_forecast") {
    return { text: "Baseline", tone: "warn", title: `${periodMeta.quarter} isn't finalised yet, so the system baseline forecast is shown` };
  }
  if (source === "legacy_live") {
    return { text: "Legacy", tone: "warn", title: "Marked final before numbers were frozen, so its current figures are shown" };
  }
  return { text: "Live", tone: "live", title: "The scenario as it stands now" };
}
