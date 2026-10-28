// Turns an accepted GL file into a compact, column-oriented dataset used by the
// "View Financial Data Accounts" and "Financial Data Entries" tabs.
//
// Dataset shape (all arrays have length = rowCount, index i = one journal line):
// {
//   meta: { uploadId, fileName, checkedAt, uploadedBy, dateFormat, rowCount },
//   line:          number[]  Excel row number in the uploaded file
//   txn:           string[]  transaction_id
//   account:       string[]  gl_account_id
//   date:          string[]  transaction_date as ISO "YYYY-MM-DD" (sortable)
//   dateText:      string[]  transaction_date as written in the file
//   debit:         number[]  amount_debit in CENTS (integer)
//   credit:        number[]  amount_credit in CENTS (integer)
//   currency:      string[]
//   department:    string[]
//   costCenter:    string[]  ('' when blank)
//   profitCenter:  string[]  ('' when blank)
//   entity:        string[]
//   customer:      string[]  ('' when blank)
//   vendor:        string[]  ('' when blank)
//   period:        string[]  "YYYY-MM"
// }
import { DATE_FORMATS, DEFAULT_DATE_FORMAT, autoMapColumns, parseDateParts, toCents } from './glValidator';

const FIELDS = [
  ['txn', 'Transaction_id'],
  ['account', 'gl_account_Id'],
  ['currency', 'Currency'],
  ['department', 'department_id'],
  ['costCenter', 'cost_center_id'],
  ['profitCenter', 'profit_center_id'],
  ['entity', 'entity_id'],
  ['customer', 'customer_id'],
  ['vendor', 'vendor_id'],
  ['period', 'period'],
];

const cleanId = (v) => (/^-?\d+\.0+$/.test(v) ? v.replace(/\.0+$/, '') : v);

export function buildGlDataset(table, { dateFormat, columnMapping, meta } = {}) {
  const fmt = DATE_FORMATS.find((f) => f.key === (dateFormat || DEFAULT_DATE_FORMAT)) || DATE_FORMATS[0];
  const records = table?.records || [];
  const headers = (records[0] || []).map((h) => String(h).replace(/\ufeff/g, '').trim());
  const map = columnMapping || autoMapColumns(headers).mapping;
  const ds = {
    meta: { ...(meta || {}), dateFormat: fmt.key, rowCount: 0 },
    line: [], txn: [], account: [], date: [], dateText: [], debit: [], credit: [],
    currency: [], department: [], costCenter: [], profitCenter: [], entity: [], customer: [], vendor: [], period: [],
  };
  const get = (cells, canon) => (map[canon] === undefined ? '' : String(cells[map[canon]] ?? '').trim());

  for (let r = 1; r < records.length; r++) {
    const cells = records[r];
    if (!cells || cells.every((v) => String(v).trim() === '')) continue;
    ds.line.push(r + 1);
    FIELDS.forEach(([key, canon]) => {
      const v = get(cells, canon);
      ds[key].push(key === 'currency' ? v.toUpperCase() : cleanId(v));
    });
    const dt = get(cells, 'Transaction_date');
    const p = parseDateParts(dt, fmt);
    ds.dateText.push(dt);
    ds.date.push(p.ok ? `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : '');
    const dr = get(cells, 'Amount_debit');
    const cr = get(cells, 'Amount_Credit');
    ds.debit.push(dr === '' ? 0 : (toCents(dr) ?? 0));
    ds.credit.push(cr === '' ? 0 : (toCents(cr) ?? 0));
  }
  ds.meta.rowCount = ds.line.length;
  return ds;
}

// ── Formatting helpers shared by the two tabs ────────────────────────────────
export const formatMoney = (cents) => (Number(cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatInt = (n) => Number(n || 0).toLocaleString();
export const formatPeriod = (p) => {
  if (!/^\d{4}-\d{2}$/.test(p || '')) return p || '';
  const [y, m] = p.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
};
