import { safeDiv } from "./variance";

/** Won ÷ (won + lost), as a percentage. */
export const winRate = (won, lost) => (won + lost ? (won / (won + lost)) * 100 : null);

/** Sales contribution: GP less eligible sales expense (not accounting EBITDA). */
export const contribution = (gp, salesExpense) => gp - salesExpense;

/** Contribution per dollar of sales expense. */
export const salesRoi = (contrib, salesExpense) => safeDiv(contrib, salesExpense);

/** GP produced per dollar of sales expense. */
export const gpPerSalesDollar = (gp, salesExpense) => safeDiv(gp, salesExpense);

/** Pipeline coverage: weighted pipeline ÷ target still to go. */
export const coverage = (weightedPipeline, remainingTarget) =>
  remainingTarget > 0 ? weightedPipeline / remainingTarget : null;

export const pctOf = (part, whole) => (whole ? (part / whole) * 100 : null);

export const PROBABILITY_BANDS = [
  { id: "0-25", label: "0–25%", min: 0, max: 0.25 },
  { id: "25-50", label: "25–50%", min: 0.25, max: 0.5 },
  { id: "50-75", label: "50–75%", min: 0.5, max: 0.75 },
  { id: "75-100", label: "75–100%", min: 0.75, max: 1.01 },
];

export const probabilityBand = (p) => PROBABILITY_BANDS.find((b) => p >= b.min && p < b.max)?.id || "75-100";
