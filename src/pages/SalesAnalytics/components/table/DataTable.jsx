import React, { useMemo, useState } from "react";
import { FiArrowDown, FiArrowUp, FiChevronDown } from "react-icons/fi";
import { PaginationBar } from "../../../Budget/budgetHelpers";
import { applySortPreset, sortRows, visibleColumns } from "../../calc/table";
import { Cell } from "./SimpleTable";
import { isNumericUnit } from "./tableUtils";

/**
 * Report table with column groups the viewer can switch on and off, header
 * sorting, named sort presets, a sticky first column, a totals row, paging
 * and a row-click drill. `groups` = [{ id, label, always?, columns }].
 * `presets` = [{ id, label, key, dir, filter? }].
 */
export default function DataTable({
  groups,
  rows,
  rowKey = "id",
  presets = [],
  defaultSort = null,
  defaultGroups,
  totals = null,
  onRowClick,
  pageSize = 25,
  emptyLabel = "No rows for the current filters.",
  onVisibleColumnsChange,
}) {
  const [enabled, setEnabled] = useState(() => defaultGroups || groups.map((g) => g.id));
  const [sort, setSort] = useState(defaultSort);
  const [presetId, setPresetId] = useState(null);
  const [page, setPage] = useState(1);

  const columns = useMemo(() => visibleColumns(groups, enabled), [groups, enabled]);
  const preset = presets.find((p) => p.id === presetId) || null;
  const sorted = useMemo(() => {
    if (preset) return applySortPreset(rows, preset);
    return sort ? sortRows(rows, sort.key, sort.dir) : rows;
  }, [rows, sort, preset]);

  React.useEffect(() => {
    onVisibleColumnsChange?.(columns);
  }, [columns]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount);
  const shown = sorted.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key) => {
    setPresetId(null);
    setPage(1);
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  };

  const optionalGroups = groups.filter((g) => !g.always);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {optionalGroups.length ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Column groups">
            {optionalGroups.map((g) => {
              const on = enabled.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setEnabled((list) => (on ? list.filter((x) => x !== g.id) : [...list, g.id]))}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    on ? "bg-sky-800 text-white border-sky-800" : "bg-white text-sky-700 border-sky-200 hover:bg-sky-50"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        ) : <span />}
        {presets.length ? (
          <label className="flex items-center gap-2 text-xs text-sky-700">
            <span>Rank by</span>
            <span className="relative">
              <select
                value={presetId || ""}
                onChange={(e) => {
                  setPresetId(e.target.value || null);
                  setPage(1);
                }}
                className="appearance-none border border-sky-200 rounded-md bg-white pl-2 pr-7 py-1 text-xs text-sky-900"
              >
                <option value="">Column sort</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <FiChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sky-500" size={12} />
            </span>
          </label>
        ) : null}
      </div>

      {preset?.filter && !sorted.length ? (
        <p className="text-sm text-sky-600 py-4">No rows meet “{preset.label}” for the current filters.</p>
      ) : !rows.length ? (
        <p className="text-sm text-sky-600 py-6 text-center">{emptyLabel}</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-sky-100 report-table-scroll max-h-[560px]">
          <table className="w-full text-sm">
            <thead className="bg-sky-900 text-white sticky top-0 z-20">
              <tr>
                {columns.map((c, i) => {
                  const active = !preset && sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      className={`px-3 py-2 font-semibold whitespace-nowrap ${isNumericUnit(c.unit) ? "text-right" : "text-left"} ${i === 0 ? "sticky left-0 z-30 bg-sky-900" : ""}`}
                    >
                      <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-sky-200">
                        {c.label}
                        {active ? (sort.dir === "desc" ? <FiArrowDown size={11} /> : <FiArrowUp size={11} />) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr
                  key={r[rowKey]}
                  className={`border-b border-sky-50 ${onRowClick ? "cursor-pointer hover:bg-sky-50" : "hover:bg-sky-50/50"}`}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                >
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={`px-3 py-2 whitespace-nowrap text-sky-900 ${isNumericUnit(c.unit) ? "text-right tabular-nums" : "text-left"} ${i === 0 ? "sticky left-0 bg-white font-medium" : ""}`}
                    >
                      <Cell row={r} column={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {totals ? (
              <tfoot className="bg-sky-50 font-semibold sticky bottom-0">
                <tr>
                  {columns.map((c, i) => (
                    <td key={c.key} className={`px-3 py-2 whitespace-nowrap text-sky-900 ${isNumericUnit(c.unit) ? "text-right tabular-nums" : "text-left"} ${i === 0 ? "sticky left-0 bg-sky-50" : ""}`}>
                      {i === 0 ? "Total" : totals[c.key] !== undefined ? <Cell row={totals} column={c} /> : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
          <PaginationBar
            page={current}
            pageCount={pageCount}
            total={sorted.length}
            pageSize={pageSize}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
          />
        </div>
      )}
    </div>
  );
}
