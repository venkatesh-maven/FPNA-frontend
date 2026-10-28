import React, { useState } from "react";
import { FiCheckCircle, FiCopy, FiRotateCcw, FiSave, FiSend, FiStar, FiTrash2 } from "react-icons/fi";
import { formatDate } from "../../calc/dates";

const btn = "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50";
const light = `${btn} border-sky-200 bg-white text-sky-800 hover:bg-sky-50`;
const dark = `${btn} border-sky-900 bg-sky-900 text-white hover:bg-sky-800`;

export const STATUS_STYLE = {
  missing: "bg-slate-100 text-slate-700",
  submitted: "bg-sky-100 text-sky-800",
  returned: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  superseded: "bg-slate-100 text-slate-500",
};
export const STATUS_LABEL = { missing: "Not submitted", submitted: "Submitted", returned: "Returned for revision", confirmed: "Confirmed by director", superseded: "Superseded" };

/**
 * Scenario management and the forecast submission controls. Save needs
 * create_scenario; "My Sales Forecast" and Submit only appear for the
 * salesperson's own book (edit_own_forecast).
 */
export default function ScenarioBar({
  scenarios,
  current,
  name,
  setName,
  dirty,
  changes,
  canSave,
  canSubmit,
  status,
  onLoad,
  onSave,
  onSaveAs,
  onDelete,
  onReset,
  onSetForecast,
  onSubmit,
  notice,
}) {
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const latest = status?.latest;
  const forecastScenario = scenarios.find((s) => s.isMyForecast);
  const lastReview = latest?.reviews?.[latest.reviews.length - 1];
  const locked = latest?.status === "confirmed";

  return (
    <div className="space-y-2 rounded-xl border border-sky-100 bg-white px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-sky-900">
          Scenario
          <select value={current?.id || ""} onChange={(e) => onLoad(e.target.value || null)} className="max-w-[220px] rounded border border-sky-200 bg-white px-1.5 py-1 text-xs font-normal">
            <option value="">Baseline — no changes</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.isMyForecast ? "★ " : ""}
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {canSave ? (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Scenario name" maxLength={80} className="w-44 rounded border border-sky-200 px-2 py-1 text-xs" aria-label="Scenario name" />
            <button type="button" className={dark} onClick={onSave} disabled={!name.trim() || (current && !dirty && name === current.name)}>
              <FiSave size={12} /> {current ? "Save" : "Save scenario"}
            </button>
            {current ? (
              <button type="button" className={light} onClick={onSaveAs} disabled={!name.trim()}>
                <FiCopy size={12} /> Save as new
              </button>
            ) : null}
            {current ? (
              <button type="button" className={light} onClick={onDelete}>
                <FiTrash2 size={12} /> Delete
              </button>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-slate-500">Your role can explore scenarios but not save them.</span>
        )}
        <button type="button" className={light} onClick={onReset} disabled={!changes}>
          <FiRotateCcw size={12} /> Reset to baseline
        </button>
        <span className="text-[11px] text-slate-500">
          {changes ? `${changes} change${changes === 1 ? "" : "s"} from baseline` : "No changes from baseline"}
          {dirty && current ? " · unsaved edits" : ""}
        </span>
      </div>

      {canSubmit ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-sky-100 pt-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[latest?.status || "missing"]}`}>
            {STATUS_LABEL[latest?.status || "missing"]}
            {latest ? ` · v${latest.version} · ${formatDate(latest.submittedAt.slice(0, 10))}` : ""}
          </span>
          <span className="text-[11px] text-slate-600">
            My Sales Forecast: <span className="font-semibold text-sky-900">{forecastScenario ? forecastScenario.name : "not chosen"}</span>
          </span>
          <button type="button" className={light} onClick={onSetForecast} disabled={!current || dirty || current.isMyForecast}>
            <FiStar size={12} /> Use as My Sales Forecast
          </button>
          {confirming ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to your director (optional)" className="w-56 rounded border border-sky-200 px-2 py-1 text-xs" />
              <button
                type="button"
                className={dark}
                onClick={async () => {
                  const ok = await onSubmit(note);
                  if (ok) {
                    setConfirming(false);
                    setNote("");
                  }
                }}
              >
                <FiCheckCircle size={12} /> Confirm submit
              </button>
              <button type="button" className={light} onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className={dark} onClick={() => setConfirming(true)} disabled={!forecastScenario || locked || dirty}>
              <FiSend size={12} /> {latest?.status === "returned" ? "Resubmit to Sales Director" : latest ? "Submit a new version" : "Submit to Sales Director"}
            </button>
          )}
          {locked ? <span className="text-[11px] text-green-800">Confirmed — your director must return it before it can change.</span> : null}
          {dirty && !locked ? <span className="text-[11px] text-slate-500">Save your edits before choosing or submitting a forecast.</span> : null}
        </div>
      ) : null}

      {canSubmit && latest?.status === "returned" && lastReview?.comment ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
          <span className="font-semibold">{lastReview.by?.name} returned your forecast:</span> {lastReview.comment}
        </p>
      ) : null}
      {notice ? <p className={`text-xs ${notice.error ? "text-red-700" : "text-green-800"}`}>{notice.text}</p> : null}
    </div>
  );
}
