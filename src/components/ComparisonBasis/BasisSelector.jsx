// "Compare with" picker: no comparison | Budget | Official Forecast | a
// scenario (system, custom by quarter, or a frozen final version). Values are
// comparisonBasis.encodeBasis strings; "" means no comparison.
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

export default function BasisSelector({ label = "Compare with", value, onChange, options, allowNone = true }) {
  const system = options?.scenarios?.system || [];
  const custom = options?.scenarios?.custom || {};
  const versions = options?.final_versions || [];
  const quarters = options?.quarters || [];

  return (
    <div>
      <label className="block mb-1 text-sky-700">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-sky-200 rounded p-2 bg-white"
      >
        {allowNone && <option value="">No comparison</option>}
        <option value="budget">Budget</option>
        <option value="forecast">Official Forecast</option>
        {system.length > 0 && (
          <optgroup label="System scenarios">
            {system.map((name) => <option key={name} value={`system:${name}`}>{name}</option>)}
          </optgroup>
        )}
        {QUARTERS.filter((q) => (custom[q] || []).length).map((q) => (
          <optgroup key={q} label={`Custom scenarios · ${q}`}>
            {custom[q].map((s) => <option key={s.id} value={`custom:${s.id}:${q}`}>{s.scenario_name}</option>)}
          </optgroup>
        ))}
        {versions.length > 0 && (
          <optgroup label="Final versions (frozen)">
            {versions.map((v) => (
              <option key={v.id} value={`version:${v.id}`}>
                {v.quarter} v{v.version_number} · {v.scenario_name}{v.status === "final" ? " (current)" : ""}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {value === "forecast" && quarters.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {quarters.map((q) => {
            const fv = q.final_version;
            const frozen = fv && fv.id != null && fv.snapshot_status !== "legacy";
            return (
              <span
                key={q.quarter}
                title={fv ? `${fv.scenario_name}${frozen ? "" : " (marked final before numbers were frozen)"}` : `${q.quarter} has no final forecast; the baseline forecast is used`}
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full border ${
                  frozen ? "bg-emerald-50 text-emerald-700 border-emerald-200" : fv ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-500 border-slate-200"
                }`}
              >
                {q.quarter} · {fv ? (fv.version_number ? `Final v${fv.version_number}` : "Final (legacy)") : "Baseline"}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
