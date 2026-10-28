import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { FiCheck, FiDownload, FiFileText, FiLoader, FiUploadCloud, FiX } from 'react-icons/fi';
import { AuthContext } from '../../../context/AuthContext';
import ValidationReport from './ValidationReport';
import ColumnMappingStep from './ColumnMappingStep';
import { buildGlDataset } from './glDataset';
import { openTab, saveAcceptedGl } from './acceptedDataStore';
import { addHistoryEntry, loadDateFormatPref, saveDateFormatPref } from './uploadHistory';
import {
  DATE_FORMATS, DEFAULT_DATE_FORMAT, GL_COLUMNS, autoMapColumns, readFileTable, templateCsv, validateGlTable,
} from './glValidator';

const MAX_BYTES = 50 * 1024 * 1024;

const DATASET_CARDS = [
  { key: 'general_ledger_transactions', label: 'General Ledger Transactions', description: 'Journal lines with debits and credits (CSV or Excel).' },
  { key: 'chart_of_accounts', label: 'Chart of Accounts', description: 'Account IDs, codes, names, types and parent accounts.' },
  { key: 'entities', label: 'Entities', description: 'Legal entities with their region and currency.' },
  { key: 'departments', label: 'Departments', description: 'Departments with their cost center and manager.' },
  { key: 'cost_centers', label: 'Cost Centers', description: 'Cost centers with department, manager and active flag.' },
  { key: 'customers', label: 'Customers', description: 'Customers with industry, region and size segment.' },
];
const fmt = (n) => Number(n || 0).toLocaleString();
const fmtSize = (b) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function Step({ n, title, children, done }) {
  return (
    <section className="rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-sky-700 text-white'}`}>
          {done ? <FiCheck /> : n}
        </span>
        <h3 className="font-semibold text-[#004a80]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function GLUploadWizard() {
  const { currentUser, userEmail } = useContext(AuthContext) || {};
  const [file, setFile] = useState(null);
  const [table, setTable] = useState(null);
  const [readError, setReadError] = useState('');
  const [dateFormat, setDateFormat] = useState(() => loadDateFormatPref() || DEFAULT_DATE_FORMAT);
  const [stage, setStage] = useState('idle'); // idle | reading | checking | done
  const [report, setReport] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const headers = useMemo(() => (table?.records?.[0] || []).map((h) => String(h).replace(/\ufeff/g, '').trim()), [table]);
  // Automatic suggestion, as { fileColumnIndex: standardColumn }.
  const autoFileMap = useMemo(() => {
    const { mapping: auto } = autoMapColumns(headers);
    const inv = {};
    Object.entries(auto).forEach(([canon, i]) => { inv[i] = canon; });
    return inv;
  }, [headers]);
  const [fileMap, setFileMap] = useState({});
  useEffect(() => {
    setFileMap(Object.fromEntries(headers.map((_, i) => [i, autoFileMap[i] || ''])));
  }, [headers, autoFileMap]);
  // Mapping the checker uses: { standardColumn: fileColumnIndex }.
  const mapping = useMemo(() => {
    const m = {};
    Object.entries(fileMap).forEach(([i, canon]) => { if (canon) m[canon] = Number(i); });
    return m;
  }, [fileMap]);
  const missingRequired = GL_COLUMNS.filter((c) => c.required && mapping[c.name] === undefined);
  const previewRows = (table?.records || []).slice(1, 11);
  const dataRowCount = Math.max(0, (table?.records?.length || 1) - 1);

  const previewDateCheck = useMemo(() => {
    const di = mapping.Transaction_date;
    if (di === undefined || !previewRows.length) return null;
    const fmtDef = DATE_FORMATS.find((f) => f.key === dateFormat);
    const vals = previewRows.map((r) => String(r[di] ?? '').trim()).filter(Boolean);
    const bad = vals.filter((v) => {
      const m = fmtDef.re.exec(v);
      if (!m) return true;
      const parts = {}; fmtDef.order.forEach((k, i) => { parts[k] = m[i + 1]; });
      const mo = parts.mon ? 1 : parseInt(parts.m, 10);
      const d = parseInt(parts.d, 10);
      return mo < 1 || mo > 12 || d < 1 || d > 31;
    }).length;
    return { total: vals.length, bad };
  }, [mapping, previewRows, dateFormat]);

  const reset = () => {
    setFile(null); setTable(null); setReport(null); setStage('idle'); setReadError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const onFile = async (f) => {
    setReport(null); setReadError('');
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx')) {
      setFile(null); setTable(null);
      setReadError(lower.endsWith('.xls') ? 'Old Excel (.xls) files are not supported. Save the file as .xlsx or .csv and try again.' : 'Only .csv and .xlsx files can be uploaded.');
      return;
    }
    if (f.size > MAX_BYTES) { setFile(null); setTable(null); setReadError(`The file is ${fmtSize(f.size)} — the limit is 50 MB.`); return; }
    setFile(f); setStage('reading');
    try {
      const t = await readFileTable(f);
      setTable(t);
    } catch (e) {
      setReadError(`We couldn't read this file (${e?.message || 'unknown error'}). Is it open or password-protected?`);
      setTable(null);
    } finally {
      setStage('idle');
    }
  };

  const runCheck = async () => {
    if (!table) return;
    setStage('checking'); setReport(null);
    await new Promise((r) => setTimeout(r, 60)); // let the "Checking…" state paint
    const rep = validateGlTable(table, { dateFormat, columnMapping: mapping });
    const uploadId = `${Date.now()}`;
    const uploadedBy = currentUser?.full_name || currentUser?.user_name || currentUser?.name || currentUser?.user_email || userEmail || '—';
    if (rep.status === 'accepted') {
      // Accepted files become the data shown in the Accounts and Entries tabs.
      const ds = buildGlDataset(table, {
        dateFormat,
        columnMapping: mapping,
        meta: { uploadId, fileName: file?.name, checkedAt: rep.checkedAt, uploadedBy },
      });
      await saveAcceptedGl(ds);
    }
    setReport(rep);
    setStage('done');
    saveDateFormatPref(dateFormat);
    addHistoryEntry({
      id: uploadId,
      dataset: 'general_ledger_transactions',
      datasetLabel: 'General Ledger Transactions',
      fileName: file?.name,
      fileSize: file?.size,
      status: rep.status,
      counts: rep.counts,
      dateFormat: rep.dateFormat,
      durationMs: rep.durationMs,
      checkedAt: rep.checkedAt,
      truncatedAt: rep.truncatedAt,
      hints: rep.hints,
      mapping: headers.map((h, i) => {
        const col = GL_COLUMNS.find((c) => c.name === fileMap[i]);
        return { file: h, db: col ? col.db : null };
      }),
      uploadedBy,
      ruleSummary: rep.ruleSummary.map((g) => ({
        rule: g.rule, severity: g.severity, severityLabel: g.severityLabel, title: g.title, fix: g.fix, count: g.count, columns: g.columns,
        examples: g.examples.map((e) => ({ line: e.line, column: e.column, colIndex: e.colIndex, value: e.value, message: e.message, severity: e.severity, rule: e.rule })),
      })),
    });
    setTimeout(() => document.getElementById('gl-upload-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    onFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="space-y-5 mt-2">
      <div className="rounded-xl bg-gradient-to-r from-[#004a80] to-sky-600 text-white p-5">
        <div className="text-xl font-semibold">Upload Financial Data</div>
        <div className="text-sky-100 text-sm mt-1">
          Every file is checked before it is loaded. If anything must be fixed, the whole file is rejected and you get a row-by-row list of problems — nothing half-loaded.
        </div>
      </div>

      <Step n={1} title="Choose the type of data" done>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DATASET_CARDS.map((d) => (
            <div
              key={d.key}
              className={d.key === 'general_ledger_transactions'
                ? 'rounded-xl border-2 border-sky-600 bg-sky-50 p-4'
                : 'rounded-xl border border-slate-200 bg-white p-4'}
            >
              <div className={`font-semibold ${d.key === 'general_ledger_transactions' ? 'text-[#004a80]' : 'text-slate-700'}`}>{d.label}</div>
              <div className="text-xs text-slate-600 mt-1">{d.description}</div>
            </div>
          ))}
        </div>
      </Step>

      <Step n={2} title="What the file needs">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <p className="text-sm text-slate-600 flex-1">
            One row per journal line. The first row must hold the column names below (common alternatives like <em>Debit</em>, <em>Posting Date</em> are recognised automatically).
          </p>
          <button type="button" onClick={() => saveAs(new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' }), 'general_ledger_transactions_template.csv')}
            className="inline-flex items-center gap-2 border border-sky-300 text-sky-800 px-3 py-2 rounded-lg hover:bg-sky-50 text-sm">
            <FiDownload /> Download template (CSV)
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-sky-50 text-sky-900">
              <tr><th className="text-left px-3 py-2">Column in file</th><th className="text-left px-3 py-2">Database column</th><th className="text-left px-3 py-2">Required</th><th className="text-left px-3 py-2">What to put in it</th><th className="text-left px-3 py-2">Example</th></tr>
            </thead>
            <tbody>
              {GL_COLUMNS.map((c) => (
                <tr key={c.name} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-mono text-xs">{c.name}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-sky-800">{c.db}</td>
                  <td className="px-3 py-1.5">{c.required ? <span className="text-red-600 font-medium">Required</span> : <span className="text-slate-500">Optional</span>}</td>
                  <td className="px-3 py-1.5 text-slate-600">{c.description}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-slate-500">{c.example || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Step>

      <Step n={3} title="Choose your file" done={!!table}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed p-6 text-center transition ${dragOver ? 'border-sky-500 bg-sky-50' : 'border-slate-300 bg-slate-50'}`}
        >
          <FiUploadCloud className="mx-auto text-4xl text-sky-600" />
          <div className="mt-2 text-slate-700">Drag &amp; drop a .csv or .xlsx file here, or</div>
          <label className="inline-block mt-2 cursor-pointer bg-[#004a80] text-white px-4 py-2 rounded-lg hover:bg-[#003366]">
            Browse files
            <input ref={inputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <div className="text-xs text-slate-500 mt-2">Up to 50 MB</div>
        </div>
        {stage === 'reading' && <div className="mt-3 text-sm text-slate-600 flex items-center gap-2"><FiLoader className="animate-spin" /> Reading file…</div>}
        {readError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{readError}</div>}
        {file && table && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <FiFileText className="text-sky-700" />
              <span className="font-medium">{file.name}</span>
              <span className="text-slate-500">{fmtSize(file.size)} · {fmt(dataRowCount)} rows · {headers.length} columns</span>
              <button type="button" onClick={reset} className="ml-auto text-slate-500 hover:text-red-600 inline-flex items-center gap-1"><FiX /> Remove</button>
            </div>

            <div>
              <div className="text-sm font-medium text-slate-700 mb-2">Preview (first {previewRows.length} rows)</div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-72">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-slate-500">Row</th>
                      {headers.map((h, i) => <th key={i} className="px-2 py-1.5 text-left whitespace-nowrap">{h || <em className="text-slate-400">(blank)</em>}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, ri) => (
                      <tr key={ri} className="border-t border-slate-100">
                        <td className="px-2 py-1 text-slate-400">{ri + 2}</td>
                        {headers.map((_, ci) => <td key={ci} className="px-2 py-1 whitespace-nowrap font-mono">{r[ci] ?? ''}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Step>

      {table && headers.length > 0 && (
        <Step n={4} title="Map your file's columns to the database" done={missingRequired.length === 0}>
          <ColumnMappingStep
            headers={headers}
            previewRows={previewRows}
            fileMap={fileMap}
            autoMap={autoFileMap}
            onChange={setFileMap}
          />
        </Step>
      )}

      <Step n={table ? 5 : 4} title="Date format used in the file" done={!!table && previewDateCheck && previewDateCheck.bad === 0}>
        <div className="flex flex-wrap items-center gap-3">
          <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {DATE_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {previewDateCheck && (
            previewDateCheck.bad === 0
              ? <span className="text-sm text-emerald-700">All {previewDateCheck.total} sample dates match {dateFormat}.</span>
              : <span className="text-sm text-amber-700">{previewDateCheck.bad} of {previewDateCheck.total} sample dates don't match {dateFormat}.</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2">We never guess: 03/04/2023 could be 3 April or 4 March, so dates are read exactly in the format you choose.</p>
      </Step>

      <div className="flex items-center gap-3">
        <button type="button" disabled={!table || stage === 'checking' || missingRequired.length > 0} onClick={runCheck}
          className="inline-flex items-center gap-2 bg-sky-700 text-white px-6 py-3 rounded-xl font-semibold shadow hover:bg-sky-800 disabled:opacity-40">
          {stage === 'checking' ? <><FiLoader className="animate-spin" /> Checking {fmt(dataRowCount)} rows…</> : <><FiUploadCloud /> Validate &amp; Upload</>}
        </button>
        {!table && <span className="text-sm text-slate-500">Choose a file first.</span>}
        {table && missingRequired.length > 0 && (
          <span className="text-sm text-red-700">
            Map the required database column{missingRequired.length > 1 ? 's' : ''} first: {missingRequired.map((c) => c.db).join(', ')}.
          </span>
        )}
      </div>

      {report && (
        <div id="gl-upload-result" className="pt-2">
          <div className="text-sm text-slate-500 mb-2">
            {file?.name} · checked in {(report.durationMs / 1000).toFixed(1)} s · date format {report.dateFormat}
          </div>
          {report.status === 'accepted' && (
            <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-sky-900 flex-1">
                {fmt(report.counts.rows)} lines are now available in <strong>View Financial Data Accounts</strong> and <strong>Financial Data Entries</strong>.
              </span>
              <button type="button" onClick={() => openTab('view')} className="bg-[#004a80] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#003366]">View accounts</button>
              <button type="button" onClick={() => openTab('entries')} className="border border-sky-300 text-sky-800 text-sm px-4 py-2 rounded-lg hover:bg-white">View entries</button>
            </div>
          )}
          <ValidationReport report={report} fileName={file?.name} onCheckAgain={runCheck} onCheckAnother={reset} />
        </div>
      )}
    </div>
  );
}
