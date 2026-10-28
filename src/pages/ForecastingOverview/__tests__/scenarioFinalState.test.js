import { describe, it, expect } from "vitest";
import { getMarkFinalState, markFinalPermission, finalVersionLabel, needsOpexReview, versionStatusLabel } from "../scenarioFinalState";

describe("Mark as final state", () => {
  it("permission rule matches the backend's", () => {
    expect(markFinalPermission("Administration", "draft", "Best Case", "Q4").allowed).toBe(true);
    expect(markFinalPermission("CEO", "draft", "Worst Case", "Q4").allowed).toBe(true);
    expect(markFinalPermission("finance", "approved", "Upside", "Q4").allowed).toBe(true);
    expect(markFinalPermission("finance", "draft", "Upside", "Q4")).toEqual({
      allowed: false, reason: "Finance can mark final once Q4 is Approved (current: Draft).",
    });
    expect(markFinalPermission("sales", "approved", "Upside", "Q4").reason).toBe("Only Administrators, the CEO or Finance can mark a forecast as final.");
    expect(markFinalPermission("administration", "approved", "Base Case", "Q4").allowed).toBe(false);
  });

  it("the final scenario shows the version badge", () => {
    const state = getMarkFinalState(
      { scenario_name: "Best Case", is_final: true },
      { finalVersion: { version_number: 3, set_final_by_name: "Priya", set_final_at: "2026-10-27T10:00:00" } },
    );
    expect(state.kind).toBe("final");
    expect(state.label).toBe("Final · v3");
    expect(state.byline).toMatch(/^by Priya on /);
  });

  it("other scenarios get the button, disabled with the backend's reason", () => {
    const state = getMarkFinalState(
      { scenario_name: "Upside", mark_final: { allowed: false, reason: "Finance can mark final once Q4 is Approved (current: Draft)." } },
      { finalScenarioName: "Best Case" },
    );
    expect(state).toEqual({ kind: "button", allowed: false, reason: "Finance can mark final once Q4 is Approved (current: Draft)." });
  });

  it("falls back to the rule when the response has no mark_final", () => {
    const state = getMarkFinalState({ scenario_name: "Upside" }, { department: "administration", stage: "draft", quarter: "Q4" });
    expect(state).toEqual({ kind: "button", allowed: true, reason: null });
  });

  it("labels", () => {
    expect(finalVersionLabel(null)).toBe("Final");
    expect(needsOpexReview({ is_system: false, model_version: 1 })).toBe(true);
    expect(needsOpexReview({ is_system: false, model_version: 2 })).toBe(false);
    expect(versionStatusLabel({ status: "superseded", snapshot_status: "complete" })).toBe("Superseded");
    expect(versionStatusLabel({ status: "final", snapshot_status: "legacy" })).toBe("Final · Legacy – no snapshot");
  });
});
