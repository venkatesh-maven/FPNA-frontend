// General Ledger transactions file checker (runs in the browser).
// Parses a CSV / XLSX export and reports every problem with its Excel row number,
// column, value and a plain-English fix. Any "Must fix" problem rejects the whole file.

import * as XLSX from 'xlsx';

export const SEVERITY_LABELS = { error: 'Must fix', warning: 'Please review', info: 'FYI' };

// Standard file layout (same headers and order as the client's sample export).
export const GL_COLUMNS = [
  { name: 'Transaction_id', type: 'int', required: true, nullable: false, example: '1', description: 'Journal / transaction number. All lines of one transaction share it.', aliases: ['transaction_id', 'txn_id', 'journal_id', 'je_id', 'journal_entry_id', 'journal_no', 'journal_number', 'entry_no', 'voucher_no', 'voucher_number'] },
  { name: 'gl_account_Id', type: 'code', required: true, nullable: false, example: '107', description: 'Account ID from your Chart of Accounts (account_id, not account_code).', aliases: ['gl_account_id', 'gl_account', 'account_id', 'acct_id'] },
  { name: 'Transaction_date', type: 'date', required: true, nullable: false, example: '1/13/2023', description: 'Posting date, in the date format you choose below.', aliases: ['transaction_date', 'date', 'posting_date', 'gl_date', 'entry_date', 'trans_date', 'value_date', 'document_date'] },
  { name: 'Amount_debit', type: 'amount', required: true, nullable: true, example: '0', description: 'Debit amount, plain number with up to 2 decimals (blank = 0).', aliases: ['amount_debit', 'debit', 'dr', 'debit_amount', 'dr_amount'] },
  { name: 'Amount_Credit', type: 'amount', required: true, nullable: true, example: '1639.72', description: 'Credit amount, plain number with up to 2 decimals (blank = 0).', aliases: ['amount_credit', 'credit', 'cr', 'credit_amount', 'cr_amount'] },
  { name: 'Currency', type: 'currency', required: true, nullable: false, example: 'USD', description: '3-letter currency code.', aliases: ['currency', 'currency_code', 'ccy'] },
  { name: 'department_id', type: 'code', required: true, nullable: false, example: '2', description: 'Department ID.', aliases: ['dept_id', 'dept', 'department', 'department_code'] },
  { name: 'cost_center_id', type: 'code', required: false, nullable: true, example: '122', description: 'Cost center ID (optional).', aliases: ['cost_centre_id', 'cc_id', 'cost_center'] },
  { name: 'profit_center_id', type: 'int', required: false, nullable: true, example: '211', description: 'Profit center ID (optional).', aliases: ['profit_centre_id', 'pc_id', 'profit_center'] },
  { name: 'entity_id', type: 'int', required: true, nullable: false, example: '1', description: 'Legal entity ID.', aliases: ['entity', 'entity_code'] },
  { name: 'customer_id', type: 'code', required: false, nullable: true, example: '', description: 'Customer ID (optional).', aliases: ['cust_id', 'customer', 'customer_code'] },
  { name: 'vendor_id', type: 'code', required: false, nullable: true, example: '', description: 'Vendor ID (optional).', aliases: ['vendor', 'supplier_id', 'vendor_code'] },
  { name: 'period', type: 'period', required: true, nullable: false, example: '2023-01', description: 'Accounting period YYYY-MM; must match the month of the date.', aliases: ['fiscal_period', 'accounting_period', 'posting_period', 'gl_period'] },
];

// Where each column lands in the database (the table the FP&A reports read).
export const GL_DB_TABLE = 'fpna_landing.finance_general_ledger_transactions';
const DB_INFO = {
  Transaction_id: ['transaction_id', 'BIGINT', 'Transaction ID'],
  gl_account_Id: ['gl_account_id', 'VARCHAR(64)', 'GL account'],
  Transaction_date: ['transaction_date', 'DATE (text)', 'Transaction date'],
  Amount_debit: ['amount_debit', 'NUMBER', 'Debit amount'],
  Amount_Credit: ['amount_credit', 'NUMBER', 'Credit amount'],
  Currency: ['currency', 'TEXT', 'Currency'],
  department_id: ['department_id', 'VARCHAR(64)', 'Department'],
  cost_center_id: ['cost_center_id', 'VARCHAR(64)', 'Cost center'],
  profit_center_id: ['profit_center_id', 'BIGINT', 'Profit center'],
  entity_id: ['entity_id', 'BIGINT', 'Entity'],
  customer_id: ['customer_id', 'VARCHAR(64)', 'Customer'],
  vendor_id: ['vendor_id', 'VARCHAR(64)', 'Vendor'],
  period: ['period', 'TEXT (YYYY-MM)', 'Period'],
};
GL_COLUMNS.forEach((c) => {
  const [db, dbType, label] = DB_INFO[c.name];
  c.db = db;
  c.dbType = dbType;
  c.label = label;
});

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export const DATE_FORMATS = [
  { key: 'M/D/YYYY', label: 'M/D/YYYY — month first (1/13/2023)', example: '1/13/2023', re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ['m', 'd', 'y'], dm: 'MD' },
  { key: 'D/M/YYYY', label: 'D/M/YYYY — day first (13/1/2023)', example: '13/1/2023', re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: ['d', 'm', 'y'], dm: 'DM' },
  { key: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2023-01-13)', example: '2023-01-13', re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: ['y', 'm', 'd'], dm: null },
  { key: 'D-MMM-YYYY', label: 'D-MMM-YYYY (13-Jan-2023)', example: '13-Jan-2023', re: /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/, order: ['d', 'mon', 'y'], dm: null },
  { key: 'D.M.YYYY', label: 'D.M.YYYY — day first (13.1.2023)', example: '13.1.2023', re: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, order: ['d', 'm', 'y'], dm: 'DM' },
];
export const DEFAULT_DATE_FORMAT = 'M/D/YYYY';

export const RULES = {
  EMPTY_FILE: { severity: 'error', title: 'The file is empty', fix: 'Export the file again — it contains no data.' },
  UNSUPPORTED_FILE_TYPE: { severity: 'error', title: 'File type not supported', fix: 'Save the file as .csv or .xlsx and upload again.' },
  NO_DATA_ROWS: { severity: 'error', title: 'No data rows', fix: 'The file only has a header row. Export it again with the transactions.' },
  MISSING_REQUIRED_COLUMN: { severity: 'error', title: 'Required column missing', fix: 'Add the column (or rename yours) — the first row must contain the column names.' },
  DUPLICATE_HEADER: { severity: 'error', title: 'Same column appears twice', fix: 'Keep only one column for each field.' },
  UNMAPPED_COLUMN: { severity: 'warning', title: 'Extra column will be ignored', fix: 'No action needed unless this column should be loaded — then rename it to one of the expected names.' },
  COLUMN_NOT_IMPORTED: { severity: 'info', title: 'Columns not imported', fix: 'You chose not to map these columns, so they are not loaded.' },
  FIELD_COUNT_MISMATCH: { severity: 'error', title: 'Row has the wrong number of values', fix: 'Check for missing or extra commas in this row, or re-export the file.' },
  UNTERMINATED_QUOTE: { severity: 'error', title: 'Row ends inside quotes', fix: 'A quoted value is not closed. Re-export the file.' },
  TRUNCATED_FILE: { severity: 'error', title: 'The file looks cut off', fix: "Export the complete file again — don't just delete the last row, later rows are probably missing too." },
  MISSING_VALUE: { severity: 'error', title: 'Required value is blank', fix: 'Fill in the value.' },
  INVALID_ID: { severity: 'error', title: 'Not a valid ID', fix: 'Use a whole number ID (e.g. 1024).' },
  INVALID_CURRENCY: { severity: 'error', title: 'Not a valid currency code', fix: 'Use a 3-letter code such as USD, INR or EUR.' },
  INVALID_DATE_FORMAT: { severity: 'error', title: "Date doesn't match the chosen format", fix: 'Fix the value, or choose the date format your file uses and check again.' },
  INVALID_DATE: { severity: 'error', title: 'Not a real date', fix: 'Correct the date. If your dates are day-first, choose D/M/YYYY and check again.' },
  INVALID_PERIOD: { severity: 'error', title: 'Period is not YYYY-MM', fix: 'Write the period as YYYY-MM, e.g. 2023-01.' },
  PERIOD_MISMATCH: { severity: 'error', title: "Period doesn't match the date", fix: 'Correct the period or the date. Often the day and month in the date are swapped.' },
  NON_NUMERIC_AMOUNT: { severity: 'error', title: 'Amount is not a plain number', fix: 'Remove thousands separators and currency symbols, e.g. 1250.50.' },
  NEGATIVE_AMOUNT: { severity: 'error', title: 'Negative amount', fix: 'Put the amount in the other column (debit ↔ credit) as a positive number.' },
  TOO_MANY_DECIMALS: { severity: 'error', title: 'More than 2 decimals', fix: 'Round the amount to 2 decimals.' },
  BOTH_DEBIT_CREDIT: { severity: 'error', title: 'Both debit and credit filled', fix: 'Each line is either a debit or a credit — split it into two lines.' },
  UNBALANCED_TRANSACTION: { severity: 'error', title: "Transaction doesn't balance", fix: 'Debits must equal credits for each transaction. Add or correct the missing line.' },
  INCONSISTENT_TRANSACTION_HEADER: { severity: 'error', title: 'Lines of one transaction disagree', fix: 'All lines of a transaction must have the same date, period, currency and entity.' },
  DUPLICATE_ROW: { severity: 'error', title: 'Duplicate line', fix: 'Remove the repeated line — it would be counted twice.' },
  ZERO_AMOUNT_LINE: { severity: 'warning', title: 'Line with zero amount', fix: 'Check whether this line is needed.' },
  DATE_OUT_OF_RANGE: { severity: 'warning', title: 'Unusual date', fix: 'Check the year — the date is before 2000 or more than a year in the future.' },
  DATE_FORMAT_UNCONFIRMED: { severity: 'warning', title: 'Date format could not be confirmed', fix: 'Every date works both as day-first and month-first. Make sure the chosen format is right.' },
  PERIOD_VOLUME_ANOMALY: { severity: 'warning', title: 'Last month looks incomplete', fix: 'Check that the export includes the whole month.' },
  PERIOD_GAP: { severity: 'warning', title: 'Missing months', fix: 'Check that no month was left out of the export.' },
  LISTS_NOT_CHECKED: { severity: 'info', title: 'IDs not yet checked against your lists', fix: 'Account, department, cost center, entity and customer IDs are checked once those lists are uploaded.' },
  NO_TRAILING_NEWLINE: { severity: 'info', title: "File doesn't end with a line break", fix: 'Usually harmless; together with a broken last row it means the file was cut off.' },
  BLANK_ROWS_SKIPPED: { severity: 'info', title: 'Blank rows skipped', fix: 'No action needed.' },
  BLANK_AMOUNT_AS_ZERO: { severity: 'info', title: 'Blank amounts treated as 0', fix: 'No action needed.' },
  ID_NORMALISED: { severity: 'info', title: 'IDs like "100.0" read as "100"', fix: 'No action needed — Excel sometimes adds ".0" to IDs.' },
};

export const normalizeHeader = (h) =>
  String(h ?? '').replace(/\ufeff/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const columnLetter = (index) => {
  if (index == null || index < 0) return '';
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

// Auto-match file headers to the standard columns (first header wins).
export function autoMapColumns(headers) {
  const mapping = {}; // canonical -> index
  const duplicates = [];
  const byNorm = new Map();
  GL_COLUMNS.forEach((c) => {
    byNorm.set(normalizeHeader(c.name), c.name);
    c.aliases.forEach((a) => { if (!byNorm.has(a)) byNorm.set(a, c.name); });
  });
  headers.forEach((h, i) => {
    const canon = byNorm.get(normalizeHeader(h));
    if (!canon) return;
    if (mapping[canon] === undefined) mapping[canon] = i;
    else duplicates.push({ canon, index: i, header: h, first: headers[mapping[canon]] });
  });
  return { mapping, duplicates };
}

// ── Parsing ──────────────────────────────────────────────────────────────────
export function parseCsvText(text) {
  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  let lastWasQuoteClosed = false;
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; lastWasQuoteClosed = true; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === '' && !lastWasQuoteClosed) { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; lastWasQuoteClosed = false; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      row.push(field); records.push(row); row = []; field = ''; lastWasQuoteClosed = false;
      if (ch === '\r' && text[i + 1] === '\n') i += 2; else i++;
      continue;
    }
    field += ch; i++;
  }
  const unterminated = inQuotes;
  if (field !== '' || row.length > 0 || unterminated) { row.push(field); records.push(row); }
  const trailingNewline = n > 0 && (text[n - 1] === '\n' || text[n - 1] === '\r');
  return { records, trailingNewline, unterminated };
}

export async function readFileTable(file) {
  const name = (file?.name || '').toLowerCase();
  if (name.endsWith('.csv')) {
    let text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const parsed = parseCsvText(text);
    return { ...parsed, fileType: 'csv' };
  }
  if (name.endsWith('.xlsx')) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true });
    const records = rows.map((r) => r.map((v) => (v == null ? '' : String(v))));
    return { records, trailingNewline: true, unterminated: false, fileType: 'xlsx', sheet: wb.SheetNames[0] };
  }
  return { records: [], trailingNewline: true, unterminated: false, fileType: null };
}

// ── Checking ─────────────────────────────────────────────────────────────────
const RE_INT = /^-?\d+$/;
const RE_INT_DOT0 = /^-?\d+\.0+$/;
const RE_NUM = /^-?\d+(\.\d+)?$/;
const RE_PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const RE_CCY = /^[A-Za-z]{3}$/;

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function parseDateParts(value, fmt) {
  const mt = fmt.re.exec(value);
  if (!mt) return { ok: false, format: false };
  const parts = {};
  fmt.order.forEach((k, idx) => { parts[k] = mt[idx + 1]; });
  let m;
  if (parts.mon !== undefined) {
    m = MONTHS.indexOf(parts.mon.toLowerCase()) + 1;
    if (m === 0) return { ok: false, format: true, invalid: true };
  } else m = parseInt(parts.m, 10);
  const d = parseInt(parts.d, 10);
  const y = parseInt(parts.y, 10);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return { ok: false, format: true, invalid: true, y, m, d };
  return { ok: true, y, m, d };
}

// "1639.72" -> 163972 cents; returns null when not a plain number.
export function toCents(s) {
  if (!RE_NUM.test(s)) return null;
  const neg = s.startsWith('-');
  const [ip, fp = ''] = (neg ? s.slice(1) : s).split('.');
  const cents = parseInt(ip, 10) * 100 + parseInt((fp + '00').slice(0, 2), 10);
  return neg ? -cents : cents;
}
const fmtMoney = (cents) => (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => Number(n).toLocaleString();

export function validateGlTable(table, options = {}) {
  const started = performance.now();
  const dateFormat = DATE_FORMATS.find((f) => f.key === (options.dateFormat || DEFAULT_DATE_FORMAT)) || DATE_FORMATS[0];
  const issues = [];
  const add = (rule, message, extra = {}) => {
    issues.push({ rule, severity: RULES[rule].severity, message, line: null, column: null, colIndex: null, value: null, txn: null, ...extra });
  };
  const { records = [], trailingNewline = true, unterminated = false, fileType } = table;

  const finish = (rowCount, extras = {}) => buildReport(issues, rowCount, { dateFormat: dateFormat.key, fileType, durationMs: Math.round(performance.now() - started), ...extras });

  if (!fileType) { add('UNSUPPORTED_FILE_TYPE', 'Only .csv and .xlsx files can be checked. Save your file as CSV or Excel workbook (.xlsx).'); return finish(0); }
  if (records.length === 0 || records.every((r) => r.every((v) => String(v).trim() === ''))) { add('EMPTY_FILE', 'The file is empty.'); return finish(0); }

  const headers = records[0].map((h) => String(h).replace(/\ufeff/g, '').trim());
  const colMap = options.columnMapping || autoMapColumns(headers).mapping; // canonical -> index
  const { duplicates } = autoMapColumns(headers);
  if (!options.columnMapping) {
    duplicates.forEach((dup) => add('DUPLICATE_HEADER', `Columns "${dup.first}" and "${dup.header}" both look like ${dup.canon}. Keep only one.`, { column: dup.header, colIndex: dup.index }));
  }
  const usedIdx = new Set(Object.values(colMap));
  headers.forEach((h, i) => {
    if (usedIdx.has(i) || h === '') return;
    if (options.columnMapping) add('COLUMN_NOT_IMPORTED', `Column "${h}" was not mapped to a database column, so it is not loaded.`, { column: h, colIndex: i });
    else add('UNMAPPED_COLUMN', `Column "${h}" is not one of the expected columns and will be ignored.`, { column: h, colIndex: i });
  });
  const missing = GL_COLUMNS.filter((c) => c.required && colMap[c.name] === undefined);
  missing.forEach((c) => add('MISSING_REQUIRED_COLUMN', options.columnMapping
    ? `Required database column "${c.db}" (${c.label}) is not mapped to any column in your file.`
    : `Required column "${c.name}" was not found. Accepted names: ${[c.name, ...c.aliases].join(', ')}. Make sure the first row contains the column names.`, { column: c.name }));

  const dataRecords = records.slice(1);
  let blankRows = 0;
  const rows = []; // { line, cells }
  dataRecords.forEach((rec, idx) => {
    const line = idx + 2;
    if (rec.every((v) => String(v).trim() === '')) { blankRows++; return; }
    rows.push({ line, cells: rec });
  });
  if (rows.length === 0) { add('NO_DATA_ROWS', 'The file has a header row but no transactions.'); return finish(0); }

  const H = headers.length;
  const lastLine = rows[rows.length - 1].line;
  const structuralBad = new Set();
  rows.forEach(({ line, cells }) => {
    if (cells.length !== H) {
      structuralBad.add(line);
      add('FIELD_COUNT_MISMATCH', `Row ${fmtInt(line)} has ${cells.length} values but the header has ${H} columns.`, { line, value: cells.join(',').slice(0, 200) });
    }
  });
  if (unterminated) { structuralBad.add(lastLine); add('UNTERMINATED_QUOTE', `Row ${fmtInt(lastLine)} ends inside a quoted value.`, { line: lastLine }); }

  const idx = (name) => colMap[name];
  const hdr = (name) => (idx(name) !== undefined ? headers[idx(name)] : name);
  const cell = (cells, name) => (idx(name) === undefined ? '' : String(cells[idx(name)] ?? '').trim());
  const rowIssue = (rule, line, name, value, message, txn = null) =>
    add(rule, message, { line, column: hdr(name), colIndex: idx(name) ?? null, value: value == null ? null : String(value).slice(0, 200), txn });

  const has = (name) => idx(name) !== undefined;
  const today = new Date();
  const maxDate = Date.UTC(today.getFullYear() + 1, today.getMonth(), today.getDate());
  const minDate = Date.UTC(2000, 0, 1);

  let idNormalised = 0;
  let blankAmounts = 0;
  const evidence = { proves: 0, ambiguous: 0, contradicts: 0 };
  const dateValues = []; // for format hints: { v, period }
  const txns = new Map(); // id -> { lines:[], dr, cr, bad, dates:Set, periods:Set, ccy:Set, ent:Set }
  const rowKeys = new Map();
  const periodRows = new Map();
  const periodTxns = new Map();

  for (const { line, cells } of rows) {
    if (structuralBad.has(line)) continue;
    let rowBadAmount = false;

    // Required non-null values
    GL_COLUMNS.forEach((c) => {
      if (!has(c.name) || c.nullable) return;
      if (cell(cells, c.name) === '') rowIssue('MISSING_VALUE', line, c.name, '', `Row ${fmtInt(line)}: ${hdr(c.name)} is blank.`);
    });

    // IDs
    ['Transaction_id', 'profit_center_id', 'entity_id'].forEach((name) => {
      const v = cell(cells, name);
      if (!has(name) || v === '') return;
      if (RE_INT_DOT0.test(v)) { idNormalised++; return; }
      if (!RE_INT.test(v)) rowIssue('INVALID_ID', line, name, v, `Row ${fmtInt(line)}: ${hdr(name)} '${v}' is not a whole-number ID.`);
    });
    ['gl_account_Id', 'department_id', 'cost_center_id', 'customer_id', 'vendor_id'].forEach((name) => {
      const v = cell(cells, name);
      if (v && RE_INT_DOT0.test(v)) idNormalised++;
    });
    const txnRaw = cell(cells, 'Transaction_id');
    const txnId = RE_INT_DOT0.test(txnRaw) ? txnRaw.replace(/\.0+$/, '') : txnRaw;

    // Currency
    const ccy = cell(cells, 'Currency');
    let ccyOk = false;
    if (has('Currency') && ccy !== '') {
      if (!RE_CCY.test(ccy)) rowIssue('INVALID_CURRENCY', line, 'Currency', ccy, `Row ${fmtInt(line)}: '${ccy}' is not a 3-letter currency code.`);
      else ccyOk = true;
    }

    // Amounts
    const amt = {};
    ['Amount_debit', 'Amount_Credit'].forEach((name) => {
      if (!has(name)) { amt[name] = null; return; }
      const v = cell(cells, name);
      if (v === '') { blankAmounts++; amt[name] = 0; return; }
      const c = toCents(v);
      if (c === null) { rowIssue('NON_NUMERIC_AMOUNT', line, name, v, `Row ${fmtInt(line)}, ${hdr(name)}: '${v}' isn't a plain number. Remove thousands separators and currency symbols, e.g. 1250.50.`); rowBadAmount = true; amt[name] = null; return; }
      const dec = v.includes('.') ? v.split('.')[1].length : 0;
      if (dec > 2) { rowIssue('TOO_MANY_DECIMALS', line, name, v, `Row ${fmtInt(line)}, ${hdr(name)}: '${v}' has more than 2 decimals.`); rowBadAmount = true; }
      if (c < 0) { rowIssue('NEGATIVE_AMOUNT', line, name, v, `Row ${fmtInt(line)}, ${hdr(name)}: '${v}' is negative. Put it in the other column as a positive number.`); rowBadAmount = true; }
      amt[name] = c;
    });
    const dr = amt.Amount_debit;
    const cr = amt.Amount_Credit;
    if (dr != null && cr != null && !rowBadAmount) {
      if (dr > 0 && cr > 0) { rowIssue('BOTH_DEBIT_CREDIT', line, 'Amount_debit', `${cell(cells, 'Amount_debit')} / ${cell(cells, 'Amount_Credit')}`, `Row ${fmtInt(line)} has both a debit (${fmtMoney(dr)}) and a credit (${fmtMoney(cr)}).`); rowBadAmount = true; }
      else if (dr === 0 && cr === 0) rowIssue('ZERO_AMOUNT_LINE', line, 'Amount_debit', '0 / 0', `Row ${fmtInt(line)} has no debit and no credit.`);
    }

    // Date
    const dv = cell(cells, 'Transaction_date');
    let dateOk = null;
    if (has('Transaction_date') && dv !== '') {
      const p = parseDateParts(dv, dateFormat);
      if (!p.format && !p.ok) rowIssue('INVALID_DATE_FORMAT', line, 'Transaction_date', dv, `Row ${fmtInt(line)}, ${hdr('Transaction_date')} (column ${columnLetter(idx('Transaction_date'))}): '${dv}' doesn't match the date format you chose, ${dateFormat.key} (e.g. ${dateFormat.example}).`);
      else if (!p.ok) rowIssue('INVALID_DATE', line, 'Transaction_date', dv, `Row ${fmtInt(line)}, ${hdr('Transaction_date')}: '${dv}' isn't a real date when read as ${dateFormat.key}.`);
      else {
        dateOk = p;
        const t = Date.UTC(p.y, p.m - 1, p.d);
        if (t < minDate || t > maxDate) rowIssue('DATE_OUT_OF_RANGE', line, 'Transaction_date', dv, `Row ${fmtInt(line)}: date ${dv} is before 2000 or more than a year ahead.`);
        if (dateFormat.dm) {
          if (p.d > 12) evidence.proves++;
          else if (p.d === p.m) evidence.ambiguous++;
          else evidence.ambiguous++;
        }
      }
      if (dateFormat.dm && !p.ok && p.format) evidence.contradicts++;
    }

    // Period
    const pv = cell(cells, 'period');
    let periodOk = false;
    if (has('period') && pv !== '') {
      if (!RE_PERIOD.test(pv)) rowIssue('INVALID_PERIOD', line, 'period', pv, `Row ${fmtInt(line)}: period '${pv}' is not in YYYY-MM format.`);
      else {
        periodOk = true;
        let mismatch = false;
        if (dateOk) {
          const dp = `${dateOk.y}-${String(dateOk.m).padStart(2, '0')}`;
          if (dp !== pv) {
            mismatch = true;
            rowIssue('PERIOD_MISMATCH', line, 'period', pv, `Row ${fmtInt(line)}: period is ${pv} but the date ${dv} is in ${new Date(Date.UTC(dateOk.y, dateOk.m - 1, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' })} ${dateOk.y} — the day and month may be swapped.`);
          }
        }
        // Month statistics only use rows whose period is trustworthy.
        if (!mismatch) {
          periodRows.set(pv, (periodRows.get(pv) || 0) + 1);
          if (txnId) { if (!periodTxns.has(pv)) periodTxns.set(pv, new Set()); periodTxns.get(pv).add(txnId); }
        }
      }
    }
    if (dv !== '') dateValues.push({ v: dv, p: periodOk ? pv : null });

    // Duplicate lines
    const key = headers.map((_, i) => String(cells[i] ?? '').trim()).join('\u0001');
    const prev = rowKeys.get(key);
    if (prev) prev.push(line); else rowKeys.set(key, [line]);

    // Transaction grouping
    if (txnId && RE_INT.test(txnId)) {
      let t = txns.get(txnId);
      if (!t) { t = { lines: [], dr: 0, cr: 0, bad: false, dates: new Set(), periods: new Set(), ccy: new Set(), ent: new Set() }; txns.set(txnId, t); }
      t.lines.push(line);
      if (dr == null || cr == null || rowBadAmount) t.bad = true;
      else { t.dr += dr; t.cr += cr; }
      if (dateOk) t.dates.add(`${dateOk.y}-${dateOk.m}-${dateOk.d}`);
      if (periodOk) t.periods.add(pv);
      if (ccyOk) t.ccy.add(ccy.toUpperCase());
      const ev = cell(cells, 'entity_id');
      if (ev && RE_INT.test(ev.replace(/\.0+$/, ''))) t.ent.add(ev.replace(/\.0+$/, ''));
    }
  }

  // Duplicates
  rowKeys.forEach((lines) => {
    if (lines.length > 1) lines.forEach((l) => rowIssue('DUPLICATE_ROW', l, 'Transaction_id', null, `Row ${fmtInt(l)} is identical to row${lines.length > 2 ? 's' : ''} ${lines.filter((x) => x !== l).map(fmtInt).join(', ')}.`));
  });

  // Transactions
  txns.forEach((t, id) => {
    const range = t.lines.length > 1 ? `rows ${fmtInt(Math.min(...t.lines))}–${fmtInt(Math.max(...t.lines))}` : `row ${fmtInt(t.lines[0])}`;
    if (!t.bad && t.dr !== t.cr) {
      const msg = `Transaction ${id} (${range}) doesn't balance: debits ${fmtMoney(t.dr)}, credits ${fmtMoney(t.cr)}, difference ${fmtMoney(Math.abs(t.dr - t.cr))}.`;
      t.lines.forEach((l) => rowIssue('UNBALANCED_TRANSACTION', l, 'Transaction_id', id, msg, id));
    }
    const incons = [];
    if (t.dates.size > 1) incons.push('date');
    if (t.periods.size > 1) incons.push('period');
    if (t.ccy.size > 1) incons.push('currency');
    if (t.ent.size > 1) incons.push('entity');
    if (incons.length) {
      const msg = `Transaction ${id} (${range}) has different ${incons.join(', ')} on its lines.`;
      t.lines.forEach((l) => rowIssue('INCONSISTENT_TRANSACTION_HEADER', l, 'Transaction_id', id, msg, id));
    }
  });

  // Date format evidence & hints
  const hints = [];
  if (dateFormat.dm && evidence.proves === 0 && evidence.ambiguous > 0 && evidence.contradicts === 0) {
    add('DATE_FORMAT_UNCONFIRMED', `None of the ${fmtInt(evidence.ambiguous)} dates proves the ${dateFormat.key} order (every date also works the other way round). Make sure the chosen format is right.`, { column: hdr('Transaction_date'), colIndex: idx('Transaction_date') ?? null });
  }
  const chosenFails = issues.filter((i) => ['INVALID_DATE_FORMAT', 'INVALID_DATE', 'PERIOD_MISMATCH'].includes(i.rule)).length;
  if (dateValues.length && chosenFails / dateValues.length >= 0.01) {
    DATE_FORMATS.filter((f) => f.key !== dateFormat.key).forEach((f) => {
      let bad = 0;
      for (const { v, p } of dateValues) {
        const r = parseDateParts(v, f);
        if (!r.ok) { bad++; continue; }
        if (p && `${r.y}-${String(r.m).padStart(2, '0')}` !== p) bad++;
      }
      if (bad === 0) hints.push(`All ${fmtInt(dateValues.length)} dates are valid as ${f.key} — did you choose the wrong date format? Choose ${f.key} and check again.`);
    });
  }
  if (missing.length) hints.push('Make sure the first row of the file contains the column names.');

  // Periods
  const periods = [...periodRows.keys()].sort().map((p) => ({ period: p, rows: periodRows.get(p), transactions: periodTxns.get(p)?.size || 0 }));
  if (periods.length >= 3) {
    const last = periods[periods.length - 1];
    const others = periods.slice(0, -1).map((p) => p.rows).sort((a, b) => a - b);
    const median = others[Math.floor(others.length / 2)];
    if (last.rows < median * 0.5) add('PERIOD_VOLUME_ANOMALY', `${last.period} has ${fmtInt(last.rows)} rows; other months have about ${fmtInt(median)} — the file may be incomplete.`, { column: hdr('period'), colIndex: idx('period') ?? null, value: last.period });
  }
  if (periods.length >= 2) {
    const [fy, fm] = periods[0].period.split('-').map(Number);
    const [ly, lm] = periods[periods.length - 1].period.split('-').map(Number);
    const have = new Set(periods.map((p) => p.period));
    const gaps = [];
    for (let y = fy, m = fm; y < ly || (y === ly && m <= lm); m === 12 ? (y++, m = 1) : m++) {
      const k = `${y}-${String(m).padStart(2, '0')}`;
      if (!have.has(k)) gaps.push(k);
    }
    if (gaps.length) add('PERIOD_GAP', `No rows for ${gaps.slice(0, 12).join(', ')}${gaps.length > 12 ? '…' : ''} between ${periods[0].period} and ${periods[periods.length - 1].period}.`, { column: hdr('period'), colIndex: idx('period') ?? null });
  }

  // Truncation: no final line break + a broken or rare-error last row.
  if (fileType === 'csv' && !trailingNewline) {
    add('NO_TRAILING_NEWLINE', "The file doesn't end with a line break.");
    const counts = {};
    issues.forEach((i) => { if (RULES[i.rule].severity === 'error') counts[i.rule] = (counts[i.rule] || 0) + 1; });
    const lastErr = issues.find((i) => i.line === lastLine && i.severity === 'error' && (structuralBad.has(lastLine) || counts[i.rule] <= Math.max(1, rows.length * 0.001)));
    if (lastErr || structuralBad.has(lastLine)) {
      const what = lastErr && lastErr.column ? ` (${lastErr.column} is '${lastErr.value ?? ''}')` : '';
      add('TRUNCATED_FILE', `The file looks cut off. Row ${fmtInt(lastLine)} is incomplete${what} and the file doesn't end with a line break. This usually means a download or copy was interrupted. Export the complete file again — don't just delete the last row.`, { line: lastLine, column: lastErr?.column ?? null, colIndex: lastErr?.colIndex ?? null, value: lastErr?.value ?? null });
    }
  }

  if (blankRows) add('BLANK_ROWS_SKIPPED', `${fmtInt(blankRows)} empty row(s) were skipped.`);
  if (blankAmounts) add('BLANK_AMOUNT_AS_ZERO', `${fmtInt(blankAmounts)} blank amount(s) were treated as 0.`);
  if (idNormalised) add('ID_NORMALISED', `${fmtInt(idNormalised)} ID value(s) like "100.0" were read as "100".`);
  add('LISTS_NOT_CHECKED', 'Account, department, cost center, entity and customer IDs will be checked against your Chart of Accounts and other lists once those lists are uploaded.');

  return finish(rows.length, { hints, periods, evidence, headers, mapping: colMap });
}

function buildReport(issues, rowCount, extras) {
  const order = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => {
    const la = a.line ?? -1; const lb = b.line ?? -1;
    if (la !== lb) return la - lb;
    return order[a.severity] - order[b.severity];
  });
  const byRule = new Map();
  issues.forEach((i) => {
    let g = byRule.get(i.rule);
    if (!g) { g = { rule: i.rule, severity: i.severity, count: 0, columns: new Set(), examples: [] }; byRule.set(i.rule, g); }
    g.count++;
    if (i.column) g.columns.add(i.column);
    if (g.examples.length < 3) g.examples.push(i);
  });
  const ruleSummary = [...byRule.values()]
    .map((g) => ({ ...g, columns: [...g.columns], title: RULES[g.rule].title, fix: RULES[g.rule].fix, severityLabel: SEVERITY_LABELS[g.severity] }))
    .sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
  const errors = issues.filter((i) => i.severity === 'error');
  const counts = {
    rows: rowCount,
    errors: errors.length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    infos: issues.filter((i) => i.severity === 'info').length,
    errorRows: new Set(errors.filter((i) => i.line != null).map((i) => i.line)).size,
  };
  const truncated = issues.find((i) => i.rule === 'TRUNCATED_FILE');
  return {
    status: counts.errors > 0 ? 'rejected' : 'accepted',
    counts,
    ruleSummary,
    issues,
    truncatedAt: truncated ? truncated.line : null,
    hints: extras.hints || [],
    periods: extras.periods || [],
    dateFormat: extras.dateFormat,
    fileType: extras.fileType,
    durationMs: extras.durationMs,
    checkedAt: new Date().toISOString(),
  };
}

// Problems report as CSV for Excel (UTF-8 BOM, formula-injection guard).
export function issuesToCsv(issues) {
  const guard = (v) => {
    const s = v == null ? '' : String(v);
    const g = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\r\n]/.test(g) ? `"${g.replace(/"/g, '""')}"` : g;
  };
  const header = ['Row (Excel)', 'Column letter', 'Column', 'Your value', 'Problem', 'How to fix', 'Severity', 'Transaction', 'Rule'];
  const lines = [header.join(',')];
  issues.forEach((i) => {
    lines.push([
      i.line ?? '', columnLetter(i.colIndex), i.column ?? '', i.value ?? '', i.message, RULES[i.rule].fix,
      SEVERITY_LABELS[i.severity], i.txn ?? '', i.rule,
    ].map(guard).join(','));
  });
  return '\ufeff' + lines.join('\r\n') + '\r\n';
}

export function templateCsv() {
  const header = GL_COLUMNS.map((c) => c.name).join(',');
  const r1 = ['1', '107', '1/13/2023', '0', '1639.72', 'USD', '2', '122', '211', '1', '', '', '2023-01'].join(',');
  const r2 = ['1', '512', '1/13/2023', '1639.72', '0', 'USD', '2', '122', '211', '1', '', '', '2023-01'].join(',');
  return `${header}\r\n${r1}\r\n${r2}\r\n`;
}
