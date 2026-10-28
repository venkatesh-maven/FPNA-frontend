// What a scenario card / the workspace header shows for "Mark as final": the
// "Final · vN" badge when the scenario is the quarter's final, otherwise the
// button, enabled or disabled with the reason. The backend sends the rule's
// answer per scenario (`mark_final`, forecasting/basis_core.py
// mark_final_permission); markFinalPermission mirrors it for responses that
// don't carry it.

const FINAL_ALLOWED_STAGES = ["approved", "locked"];
// Departments that may mark final at any workflow stage.
const FINAL_ANY_STAGE_DEPARTMENTS = ["administration", "ceo"];

const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function markFinalPermission(department, stage, scenarioName, quarter) {
  const dept = String(department || "").trim().toLowerCase();
  const st = String(stage || "draft").trim().toLowerCase();
  if (String(scenarioName || "").trim().toLowerCase() === "base case") {
    return { allowed: false, reason: "Base Case is the automatic baseline, so it can't be marked final." };
  }
  if (FINAL_ANY_STAGE_DEPARTMENTS.includes(dept)) return { allowed: true, reason: null };
  if (dept === "finance") {
    if (FINAL_ALLOWED_STAGES.includes(st)) return { allowed: true, reason: null };
    return { allowed: false, reason: `Finance can mark final once ${quarter ? `${quarter} ` : ""}is Approved (current: ${titleCase(st)}).` };
  }
  return { allowed: false, reason: "Only Administrators, the CEO or Finance can mark a forecast as final." };
}

/** "Final · v3", or "Final" for a final set before version history. */
export function finalVersionLabel(finalVersion) {
  return finalVersion?.version_number ? `Final · v${finalVersion.version_number}` : "Final";
}

/** "by Priya on 27 Oct 2026" */
export function finalVersionByline(finalVersion) {
  if (!finalVersion) return "";
  const who = finalVersion.set_final_by_name ? `by ${finalVersion.set_final_by_name}` : "";
  const when = finalVersion.set_final_at
    ? `on ${new Date(finalVersion.set_final_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
    : "";
  return [who, when].filter(Boolean).join(" ");
}

/**
 * { kind: "final", label, byline } for the quarter's final scenario, else
 * { kind: "button", allowed, reason }.
 */
export function getMarkFinalState(scenario, { finalScenarioName, finalVersion, department, stage, quarter } = {}) {
  const isFinal = !!scenario?.is_final || (!!finalScenarioName && scenario?.scenario_name === finalScenarioName);
  if (isFinal) {
    return { kind: "final", label: finalVersionLabel(finalVersion), byline: finalVersionByline(finalVersion) };
  }
  const rule = scenario?.mark_final || markFinalPermission(department, stage, scenario?.scenario_name, quarter);
  return { kind: "button", allowed: !!rule.allowed, reason: rule.allowed ? null : rule.reason };
}

/** Custom scenarios from before COGS had its own driver may carry COGS in Other OpEx. */
export function needsOpexReview(scenario) {
  return !!scenario && !scenario.is_system && scenario.model_version === 1;
}

/** Version History status chip text. */
export function versionStatusLabel(version) {
  if (version?.status === "final") {
    return version.snapshot_status === "legacy" ? "Final · Legacy – no snapshot" : "Final";
  }
  return version?.snapshot_status === "legacy" ? "Superseded · Legacy – no snapshot" : "Superseded";
}
