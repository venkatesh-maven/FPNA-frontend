const NUMERIC = new Set(["money", "pct", "pp", "count", "hours", "rate", "ratio", "days"]);

export const isNumericUnit = (unit) => NUMERIC.has(unit || "money");
