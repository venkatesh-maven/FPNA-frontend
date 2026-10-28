// Staffing economics shared by the sample-data generator and (later) What-If,
// so both apply burden the same way.

export const FICA_RATE = 0.0765; // Social Security + Medicare, employer share
export const FUTA_RATE = 0.006; // after the standard state credit
export const FUTA_WAGE_BASE = 7000;
export const OT_MULTIPLIER = 1.5;

/** Tax on the part of `wages` that still falls under a yearly wage base. */
export const cappedTax = (rate, wageBase, ytdBefore, wages) =>
  rate * Math.max(0, Math.min(wages, wageBase - ytdBefore));

/**
 * Employer payroll burden for one pay slice. FUTA and SUTA stop once the
 * contractor's year-to-date wages pass the wage base, so burden is front-loaded
 * in each calendar year.
 */
export function burdenFor({ ytdWagesBefore = 0, wages, sutaRate, sutaWageBase, wcRate, paidHours, benefitsPerHour = 0 }) {
  const fica = wages * FICA_RATE;
  const futa = cappedTax(FUTA_RATE, FUTA_WAGE_BASE, ytdWagesBefore, wages);
  const suta = cappedTax(sutaRate, sutaWageBase, ytdWagesBefore, wages);
  const wc = wages * wcRate;
  const benefits = paidHours * benefitsPerHour;
  return { fica, futa, suta, wc, benefits, total: fica + futa + suta + wc + benefits };
}

export const grossProfit = (revenue, directCost) => revenue - directCost;

export const gmPct = (gp, revenue) => (revenue ? (gp / revenue) * 100 : null);

/** Hours-weighted average of a per-hour rate: Σ(amount) / Σ(hours). */
export const perHour = (amount, hours) => (hours ? amount / hours : null);

/** Revenue for one slice of billed hours, with overtime billed at time and a half. */
export const timeRevenue = (billedHours, otHours, billRate) =>
  (billedHours - otHours) * billRate + otHours * billRate * OT_MULTIPLIER;
