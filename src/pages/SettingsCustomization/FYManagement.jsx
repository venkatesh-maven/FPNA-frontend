import React, { useContext, useEffect, useMemo, useState } from "react";
import { FiCalendar, FiSave } from "react-icons/fi";
import { toast } from "react-toastify";
import { BudgetYearContext } from "../../context/BudgetYearContext";
import { AuthContext } from "../../context/AuthContext";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FYManagement = () => {
  const {
    fiscalYear, setFiscalYear,
    fiscalYearStartMonth, setFiscalYearStartMonth,
  } = useContext(BudgetYearContext);
  const { years } = useContext(AuthContext);

  const [pendingFiscalYear, setPendingFiscalYear] = useState(fiscalYear);
  const [pendingStartMonth, setPendingStartMonth] = useState(fiscalYearStartMonth);
  const [saving, setSaving] = useState(false);

  // Keep the editable copies in sync with the real values once they arrive
  // from the backend (context starts from a localStorage cache, then the
  // initial fetch may update it shortly after mount).
  useEffect(() => setPendingFiscalYear(fiscalYear), [fiscalYear]);
  useEffect(() => setPendingStartMonth(fiscalYearStartMonth), [fiscalYearStartMonth]);

  // Same year-selection source as the Dashboard header (real GL years).
  // Always offer a 2-years-back/2-years-forward window around today so
  // users can plan future fiscal years even before any actuals exist for
  // them, merged with any real GL years (so older/newer actual data years
  // still show up) and the currently selected value (so a previously saved
  // year outside the window is never dropped from the list).
  const options = useMemo(() => {
    const currentCalendarYear = new Date().getFullYear();
    const window = [-2, -1, 0, 1, 2].map((offset) => currentCalendarYear + offset);
    const base = Array.isArray(years) ? years : [];
    const all = new Set([...base, ...window, pendingFiscalYear]);
    return Array.from(all).sort((a, b) => a - b);
  }, [years, pendingFiscalYear]);

  const handleSave = async () => {
    setSaving(true);
    try {
      setFiscalYear(pendingFiscalYear);
      await setFiscalYearStartMonth(pendingStartMonth);
      toast.success("FY settings saved");
    } catch (err) {
      toast.error(err.message || "Failed to save FY settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl">
      {/* ================= HEADER ================= */}
      <div className="mb-8
       bg-gradient-to-r from-sky-700 to-sky-900 text-white p-3
        rounded-xl">
        <h2 className="text-xl font-semibold">
          FY Management
        </h2>
        <p className="text-sky-100 text-s mt-1">
          Set the active Budget Year for financial planning
        </p>
      </div>

      {/* ================= FISCAL YEAR ================= */}
      <div className="bg-white border border-sky-100 rounded-xl p-6 mb-6">
        <h3 className="text-sky-900 font-medium font-bold mb-4 flex items-center gap-2">
          <FiCalendar className="text-sky-600 font-bold" />
          Fiscal Year
        </h3>

        <select
          value={pendingFiscalYear}
          onChange={(e) => setPendingFiscalYear(Number(e.target.value))}
          className="w-52 border border-sky-200 rounded-lg px-4 py-2
                     focus:ring-2 focus:ring-sky-500 focus:outline-none"
        >
          {options.map((y) => (
            <option key={y} value={y}>FY{y}</option>
          ))}
        </select>

        <p className="mt-2 text-xs text-sky-600">
          Budgeting Year: FY{pendingFiscalYear + 1}
        </p>

        {/* ── Fiscal Year Start Month ── */}
        <div className="mt-5">
          <h4 className="text-sky-800 font-semibold text-sm mb-2">
            Fiscal Year Start Month
          </h4>
          <select
            value={pendingStartMonth}
            onChange={(e) => setPendingStartMonth(Number(e.target.value))}
            className="w-52 border border-sky-200 rounded-lg px-4 py-2
                       focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ================= SAVE ================= */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-sky-800 hover:bg-sky-900
                     text-white px-5 py-2 rounded-lg
                     disabled:opacity-50 transition"
        >
          <FiSave />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

export default FYManagement;
