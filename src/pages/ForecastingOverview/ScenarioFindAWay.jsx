import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BsSignpostSplit } from "react-icons/bs";
import { FiBarChart2, FiSend } from "react-icons/fi";
import FindAWayCard from "../FindAWayCard";
import ScenarioPnlComparison from "./ScenarioPnlComparison";
import { findAWayForScenario, recalculateScenarioFindAWay } from "../../utils/fpnaAssistant";

const signedPct = (v) => `${v > 0 ? "+" : ""}${Number(v).toFixed(1)}%`;

// One-click goals, run straight through recalculate (no AI parsing needed).
function quickGoals(net, margin) {
  const nextMargin = Math.max(5, (Math.floor((margin || 0) / 5) + 1) * 5);
  return [
    net < 0
      ? { label: "Break even", spec: { target: { metric: "net_profit", mode: "absolute", value: 0 } } }
      : { label: "Grow net profit 20%", spec: { target: { metric: "net_profit", mode: "change_pct", value: 20 } } },
    {
      label: "Hold net profit if revenue falls 10%",
      spec: { target: { metric: "net_profit", mode: "maintain" }, shocks: [{ driver: "revenue", change_pct: -10 }] },
    },
    {
      label: "Absorb a 5% cost increase",
      spec: { target: { metric: "net_profit", mode: "maintain" }, shocks: [{ driver: "cost", change_pct: 5 }] },
    },
    {
      label: `Reach ${nextMargin}% profit margin`,
      spec: { target: { metric: "profit_margin_pct", mode: "absolute", value: nextMargin } },
    },
  ];
}

function describePath(payload, path, scenarioName) {
  const shockLabel = Object.fromEntries(payload.options?.shocks || []);
  const shocks = payload.spec.shocks.map((s) => `${shockLabel[s.driver] || s.driver} ${signedPct(s.change_pct)}`);
  const moves = path.moves.map((m) => `${m.label} ${signedPct(m.change_pct)}`);
  return [
    `Find a Way (${path.name} path) from ${scenarioName}.`,
    shocks.length ? `Assumes ${shocks.join(", ")}.` : "",
    `Moves: ${moves.join(", ")}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * "Find a Way" from Ask AI, scoped to one Scenario Modeling scenario: the user
 * states a goal for this scenario's quarter, the server computes alternative
 * paths through the scenario's own drivers, and the selected path can be
 * compared as a P&L statement (against the previous quarter by default) or
 * saved as a new scenario (the original is left unchanged).
 *
 * Rendered into <body> so the Scenario Modeling page theme
 * (.forecasting-pnl-theme in index.css restyles every table and button with
 * !important) doesn't reach it — the card looks the same as in Ask AI.
 */
export default function ScenarioFindAWay({
  scenario, figures, year, quarter, currency, token, saved, onResult, onClose, onCreateScenario, creating,
}) {
  const [input, setInput] = useState("");
  const [payload, setPayload] = useState(saved || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [clarification, setClarification] = useState(null);
  const [saveName, setSaveName] = useState("");
  const [comparing, setComparing] = useState(false);

  const scenarioRef = scenario.is_system
    ? { year, quarter, scenario_name: scenario.scenario_name }
    : { year, quarter, scenario_id: scenario.id };
  const selectedPath = payload?.result.paths.find((p) => p.id === payload.selected_path);
  const selectedName = selectedPath?.name;

  useEffect(() => {
    if (selectedName) setSaveName(`${scenario.scenario_name} – ${selectedName}`);
  }, [selectedName, scenario.scenario_name]);

  const update = (data) => {
    setPayload(data);
    onResult(data);
    if (!data.selected_path) setComparing(false);
  };

  const run = async (request) => {
    setBusy(true);
    setError(null);
    setClarification(null);
    try {
      const data = await request();
      if (data.understood === false) setClarification(data.clarification);
      else update(data);
    } catch (e) {
      setError(e.message || "Could not work that out. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // A follow-up ("what if revenue drops 12% instead") modifies the last goal.
  const ask = () => {
    const message = input.trim();
    if (!message || busy) return;
    run(() => findAWayForScenario(scenarioRef, message, payload?.spec, token, currency));
  };
  const runSpec = (spec) => run(() => recalculateScenarioFindAWay(scenarioRef, spec, token, currency));

  const save = () => {
    if (!selectedPath || !saveName.trim()) return;
    onCreateScenario({
      scenario_name: saveName.trim(),
      description: describePath(payload, selectedPath, scenario.scenario_name),
      baseline_scenario_name: scenario.scenario_name,
      revenue_drivers: selectedPath.drivers.revenue_drivers,
      cost_drivers: selectedPath.drivers.cost_drivers,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-sky-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BsSignpostSplit className="text-sky-600" /> Find a Way · {scenario.scenario_name}
            </h3>
            <div className="text-x text-slate-500 mt-0.5">
              {year} · {quarter} · Revenue {figures.display.revenue} · Cost {figures.display.cost} · Net{" "}
              <span className={figures.net < 0 ? "text-red-700 font-semibold" : "text-emerald-700 font-semibold"}>
                {figures.display.net}
              </span>{" "}
              · Margin {figures.display.margin}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-zinc-100 shrink-0">x</button>
        </div>

        <div className="px-6 py-4 overflow-auto flex-1 space-y-3">
          {comparing && selectedPath ? (
            <ScenarioPnlComparison
              payload={payload}
              pathId={selectedPath.id}
              onPathChange={(pathId) => update({ ...payload, selected_path: pathId })}
              scenario={scenario}
              scenarioRef={scenarioRef}
              year={year}
              quarter={quarter}
              token={token}
              onBack={() => setComparing(false)}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-300 px-3 py-2 focus-within:border-sky-500">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask();
                    }
                  }}
                  rows={2}
                  disabled={busy}
                  placeholder={
                    payload
                      ? "Refine it, e.g. what if revenue drops 12% instead? Don't touch CAPEX."
                      : `e.g. Find a way to break even in ${scenario.scenario_name} if revenue falls another 5%, without cutting payroll`
                  }
                  className="flex-1 min-w-0 resize-none outline-none border-none bg-transparent text-s placeholder-slate-400"
                />
                <button
                  onClick={ask}
                  disabled={!input.trim() || busy}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-x font-semibold disabled:opacity-50"
                >
                  <FiSend /> Find a Way
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-x text-slate-500">Quick goals:</span>
                {quickGoals(figures.net, figures.margin).map((g) => (
                  <button
                    key={g.label}
                    onClick={() => runSpec(g.spec)}
                    disabled={busy}
                    className="px-2.5 py-1 rounded-full text-x border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 disabled:opacity-50"
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {busy && (
                <div className="flex items-center gap-2 text-x text-slate-500 py-2">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-sky-700 animate-spin" />
                  Working out paths for {scenario.scenario_name}…
                </div>
              )}
              {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-x px-3 py-2">{error}</div>}
              {clarification && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-x px-3 py-2">{clarification}</div>
              )}

              {payload ? (
                <div className="bg-gradient-to-br from-blue-50 to-gray-50 border border-gray-200 rounded-lg p-3">
                  <FindAWayCard
                    payload={payload}
                    busy={busy}
                    onRecalculate={runSpec}
                    onSelectPath={(pathId) => update({ ...payload, selected_path: pathId })}
                  />
                </div>
              ) : (
                !busy && (
                  <p className="text-x text-slate-500 leading-relaxed">
                    Describe the outcome you want for this scenario and any constraints, or pick a quick goal. Paths are
                    computed from this scenario's own drivers (volume, selling price, payroll, non-people costs, CAPEX,
                    interest), and any path you select can be compared as a P&amp;L or saved as a new scenario.
                  </p>
                )
              )}
            </>
          )}
        </div>

        {selectedPath && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex items-center gap-2 flex-wrap">
            <div className="text-x text-slate-600 flex-1 min-w-[220px]">
              Selected: <span className="font-semibold text-sky-900">{selectedPath.name}</span> path. Saving creates a
              new scenario; {scenario.scenario_name} stays unchanged.
            </div>
            {!comparing && (
              <button
                onClick={() => setComparing(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl border border-sky-300 bg-white text-sky-800 text-x font-semibold hover:bg-sky-50"
              >
                <FiBarChart2 /> Compare P&amp;L
              </button>
            )}
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Scenario name"
              className="w-72 max-w-full px-3 py-1.5 rounded-xl border border-slate-300 text-x outline-none focus:border-sky-500"
            />
            <button
              onClick={save}
              disabled={creating || !saveName.trim()}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-x font-semibold disabled:opacity-60"
            >
              {creating ? "Saving..." : "Save as new scenario"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
