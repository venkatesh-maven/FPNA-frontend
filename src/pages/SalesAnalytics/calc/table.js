// Table helpers kept pure so sorting, presets and CSV output are testable.

const cmp = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // blanks last either way
  if (b == null) return -1;
  if (typeof a === "string" || typeof b === "string") return String(a).localeCompare(String(b));
  return a - b;
};

export function sortRows(rows, key, dir = "desc") {
  if (!key) return rows;
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((r1, r2) => {
    const a = r1[key];
    const b = r2[key];
    if (a == null || b == null) return cmp(a, b);
    return sign * cmp(a, b);
  });
}

/** A preset is { key, dir, filter? }: optional row filter, then sort. */
export function applySortPreset(rows, preset) {
  if (!preset) return rows;
  const filtered = preset.filter ? rows.filter(preset.filter) : rows;
  return sortRows(filtered, preset.key, preset.dir);
}

/** Columns of the column groups switched on (groups marked `always` stay). */
export const visibleColumns = (groups, enabled) =>
  groups.filter((g) => g.always || enabled.includes(g.id)).flatMap((g) => g.columns.map((c) => ({ ...c, group: g.id })));

/** CSV rows (header + data) for the visible columns; restricted cells say so. */
export function toCsvRows(columns, rows, { maskedLabel = "Restricted" } = {}) {
  const header = columns.map((c) => c.label);
  const data = rows.map((r) =>
    columns.map((c) => {
      if (r.__masked?.includes(c.key)) return maskedLabel;
      const v = c.csv ? c.csv(r) : r[c.key];
      if (v == null) return "";
      return typeof v === "number" ? Math.round(v * 100) / 100 : v;
    })
  );
  return [header, ...data];
}
