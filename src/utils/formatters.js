/**
 * Global currency / number formatting utility.
 * Reads decimalPrecision from localStorage so it works outside React context too.
 */

// Used until the user picks a precision in Alerts & Currency Settings.
export const DEFAULT_DECIMAL_PRECISION = 0;

export const getDecimalPrecision = () => {
  const stored = localStorage.getItem("decimalPrecision");
  return stored !== null ? parseInt(stored, 10) : DEFAULT_DECIMAL_PRECISION;
};

/**
 * Format a numeric value as currency.
 * Uses the globally selected decimal precision unless an explicit value is passed.
 */
export const formatCurrencyValue = (value, currency = "USD", decimalPlaces = null) => {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const dp = decimalPlaces !== null ? decimalPlaces : getDecimalPrecision();
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(n);
};

/**
 * Format a plain numeric value with the globally selected decimal precision.
 */
export const formatNumber = (value, decimalPlaces = null) => {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const dp = decimalPlaces !== null ? decimalPlaces : getDecimalPrecision();
  return n.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
};
