// String-based month / day maths in UTC ("YYYY-MM", "YYYY-MM-DD"), so results
// never drift with the viewer's timezone.

const pad = (n) => String(n).padStart(2, "0");

export const ym = (y, m) => `${y}-${pad(m)}`;

// Hot path (the sample-data generator calls this hundreds of thousands of times).
export const parseYm = (s) => ({ y: +s.slice(0, 4), m: +s.slice(5, 7) });

export const addMonths = (s, n) => {
  const { y, m } = parseYm(s);
  const t = y * 12 + (m - 1) + n;
  return ym(Math.floor(t / 12), (t % 12) + 1);
};

/** Months from `a` to `b` (b − a). */
export const monthDiff = (a, b) => {
  const A = parseYm(a);
  const B = parseYm(b);
  return (B.y - A.y) * 12 + (B.m - A.m);
};

export const monthRange = (from, to) => {
  const out = [];
  for (let c = from; c <= to; c = addMonths(c, 1)) out.push(c);
  return out;
};

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export const daysInMonth = (s) => {
  const { y, m } = parseYm(s);
  return m === 2 && isLeap(y) ? 29 : DAYS[m - 1];
};

export const toYm = (date) => date.slice(0, 7);
export const dayOf = (date) => Number(date.slice(8, 10));
export const isoDate = (s, d) => `${s}-${pad(d)}`;
export const monthStart = (s) => `${s}-01`;
export const monthEnd = (s) => `${s}-${pad(daysInMonth(s))}`;

const toUtc = (date) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));

export const addDays = (date, n) => new Date(toUtc(date) + n * 86400000).toISOString().slice(0, 10);

/** Days from `a` to `b` (b − a). */
export const dayDiff = (a, b) => Math.round((toUtc(b) - toUtc(a)) / 86400000);

export const minDate = (a, b) => (a <= b ? a : b);
export const maxDate = (a, b) => (a >= b ? a : b);

/** Fiscal quarter (1-4) of a month, for a fiscal year starting in `fiscalStartMonth`. */
export const fiscalQuarter = (s, fiscalStartMonth = 1) => {
  const { m } = parseYm(s);
  return Math.floor((((m - fiscalStartMonth) % 12) + 12) % 12 / 3) + 1;
};

/** First month of the fiscal quarter containing `s`. */
export const fiscalQuarterStart = (s, fiscalStartMonth = 1) => {
  const { m } = parseYm(s);
  const offset = (((m - fiscalStartMonth) % 12) + 12) % 12;
  return addMonths(s, -(offset % 3));
};

/** First month of the fiscal year containing `s`. */
export const fiscalYearStart = (s, fiscalStartMonth = 1) => {
  const { m } = parseYm(s);
  const offset = (((m - fiscalStartMonth) % 12) + 12) % 12;
  return addMonths(s, -offset);
};

/** Fiscal years are named by the calendar year they end in. */
export const fiscalYearLabel = (s, fiscalStartMonth = 1) => {
  const end = addMonths(fiscalYearStart(s, fiscalStartMonth), 11);
  return `FY${parseYm(end).y}`;
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const formatYm = (s) => {
  const { y, m } = parseYm(s);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

export const formatYmShort = (s) => {
  const { y, m } = parseYm(s);
  return `${MONTH_NAMES[m - 1]} ${String(y).slice(2)}`;
};

export const formatDate = (date) => {
  if (!date) return "—";
  const { y, m } = parseYm(date.slice(0, 7));
  return `${MONTH_NAMES[m - 1]} ${dayOf(date)}, ${y}`;
};
