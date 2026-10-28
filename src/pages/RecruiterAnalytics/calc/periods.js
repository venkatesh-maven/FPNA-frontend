import {
  addMonths,
  dayOf,
  daysInMonth,
  fiscalQuarter,
  fiscalQuarterStart,
  fiscalYearLabel,
  fiscalYearStart,
  formatYm,
  monthDiff,
  monthEnd,
  monthRange,
  toYm,
} from "./dates";

export const PERIOD_PRESETS = [
  { id: "MTD", label: "Month to date" },
  { id: "QTD", label: "Quarter to date" },
  { id: "YTD", label: "Year to date" },
  { id: "FY", label: "Full fiscal year" },
  { id: "R12", label: "Rolling 12 months" },
  { id: "CQ", label: "Current quarter" },
  { id: "PQ", label: "Prior quarter" },
  { id: "CUSTOM", label: "Custom range" },
];

export const COMPARE_BASES = [
  { id: "budget", label: "Budget", kind: "plan" },
  { id: "target", label: "Recruiting Target", kind: "plan" },
  { id: "board", label: "Board Plan", kind: "plan" },
  { id: "forecast", label: "Finance Forecast", kind: "plan" },
  { id: "py", label: "Prior Year", kind: "actual" },
  { id: "pp", label: "Prior Period", kind: "actual" },
];

export const compareLabel = (basis) => COMPARE_BASES.find((b) => b.id === basis)?.label || basis;

// How far "prior period" shifts back, per preset.
const PERIOD_LENGTH = { MTD: 1, QTD: 3, CQ: 3, PQ: 3, YTD: 12, FY: 12, R12: 12 };

/**
 * Resolves a period preset into its months. `months` is every month in the
 * period (future months included, for plan totals); `elapsed` is the months
 * with actuals so far, each with the fraction of the month elapsed (the as-of
 * month is partial).
 */
export function resolvePeriod({ preset = "QTD", from = "", to = "" } = {}, { asOf, fiscalStartMonth = 1 }) {
  const asOfYm = toYm(asOf);
  const asOfFraction = dayOf(asOf) / daysInMonth(asOfYm);
  let first;
  let last;
  let label;

  const qStart = fiscalQuarterStart(asOfYm, fiscalStartMonth);
  const fyStart = fiscalYearStart(asOfYm, fiscalStartMonth);
  const qLabel = (s) => `Q${fiscalQuarter(s, fiscalStartMonth)} ${fiscalYearLabel(s, fiscalStartMonth)}`;

  switch (preset) {
    case "MTD":
      first = asOfYm; last = asOfYm; label = `${formatYm(asOfYm)} MTD`;
      break;
    case "YTD":
      first = fyStart; last = asOfYm; label = `${fiscalYearLabel(asOfYm, fiscalStartMonth)} YTD`;
      break;
    case "FY":
      first = fyStart; last = addMonths(fyStart, 11); label = fiscalYearLabel(asOfYm, fiscalStartMonth);
      break;
    case "R12": {
      const end = asOfFraction < 1 ? addMonths(asOfYm, -1) : asOfYm;
      first = addMonths(end, -11); last = end; label = `Rolling 12 months to ${formatYm(end)}`;
      break;
    }
    case "CQ":
      first = qStart; last = addMonths(qStart, 2); label = qLabel(qStart);
      break;
    case "PQ": {
      const p = addMonths(qStart, -3);
      first = p; last = addMonths(p, 2); label = qLabel(p);
      break;
    }
    case "CUSTOM": {
      const f = from || fyStart;
      const t = to && to >= f ? to : f;
      first = f; last = t; label = f === t ? formatYm(f) : `${formatYm(f)} – ${formatYm(t)}`;
      break;
    }
    case "QTD":
    default:
      first = qStart; last = asOfYm; label = `${qLabel(qStart)} QTD`;
      break;
  }

  const months = monthRange(first, last);
  const elapsed = months
    .filter((m) => m <= asOfYm)
    .map((m) => ({ ym: m, fraction: m === asOfYm ? asOfFraction : 1 }));
  const endYm = elapsed.length ? elapsed[elapsed.length - 1].ym : null;

  return {
    preset: PERIOD_PRESETS.some((p) => p.id === preset) ? preset : "QTD",
    label,
    from: first,
    to: last,
    months,
    elapsed,
    isPartial: elapsed.some((e) => e.fraction < 1) || elapsed.length < months.length,
    // Date the period's "as at" figures (active contractors, open pipeline) are read on.
    endDate: endYm === asOfYm ? asOf : endYm ? monthEnd(endYm) : null,
    asOf,
    lengthMonths: preset === "CUSTOM" ? months.length : PERIOD_LENGTH[preset] || months.length,
  };
}

/**
 * The window a period is compared against. Plans compare on the same months
 * and elapsed fractions; Prior Year shifts back 12 months and Prior Period
 * one period length, keeping the same elapsed fractions so a part-month is
 * never compared with a full month.
 */
export function compareWindow(period, basis) {
  const base = { basis, label: compareLabel(basis) };
  if (basis === "py" || basis === "pp") {
    const shift = basis === "py" ? -12 : -(period.lengthMonths || period.months.length);
    return {
      ...base,
      kind: "actual",
      elapsed: period.elapsed.map((e) => ({ ym: addMonths(e.ym, shift), fraction: e.fraction, mapsTo: e.ym })),
      months: period.months.map((m) => addMonths(m, shift)),
      shift,
    };
  }
  return {
    ...base,
    kind: "plan",
    elapsed: period.elapsed.map((e) => ({ ...e, mapsTo: e.ym })),
    months: period.months,
    shift: 0,
  };
}

/** The months strictly after the as-of month, inside the period (plan-only remainder). */
export const remainingMonths = (period) => period.months.filter((m) => m > toYm(period.asOf));

export const monthsBetween = (a, b) => monthDiff(a, b);
