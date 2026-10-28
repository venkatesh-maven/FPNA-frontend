import React, { useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import { FiAlertOctagon, FiAlertTriangle, FiCheckCircle, FiChevronDown, FiChevronRight, FiDownload, FiInfo, FiRefreshCw } from 'react-icons/fi';
import { SEVERITY_LABELS, columnLetter, issuesToCsv } from './glValidator';

const fmt = (n) => Number(n || 0).toLocaleString();

const SEV_STYLE = {
  error: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  info: 'bg-sky-100 text-sky-700 border-sky-200',
};

function SeverityChip({ severity }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${SEV_STYLE[severity]}`}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    slate: 'border-slate-200 text-slate-800',
    red: 'border-red-200 text-red-700',
    amber: 'border-amber-200 text-amber-700',
    green: 'border-emerald-200 text-emerald-700',
  };
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 ${tones[tone]}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

const PAGE_SIZE = 50;

/**
 * Report for one checked file.
 * props: report (from validateGlTable), fileName, onCheckAgain?, compact? (history view: no issue table when issues absent)
 */
export default function ValidationReport({ report, fileName, onCheckAgain, onCheckAnother }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(report.ruleSummary.filter((g) => g.severity === 'error').slice(0, 2).map((g) => g.rule)));
  const [sevFilter, setSevFilter] = useState('all');
  const [ruleFilter, setRuleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showInfo, setShowInfo] = useState(false);

  const issues = report.issues || null;
  const rejected = report.status === 'rejected';
  const { counts } = report;

  const filtered = useMemo(() => {
    if (!issues) return [];
    return issues.filter((i) => (sevFilter === 'all' || i.severity === sevFilter) && (ruleFilter === 'all' || i.rule === ruleFilter) && i.severity !== 'info');
  }, [issues, sevFilter, ruleFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const groups = report.ruleSummary.filter((g) => g.severity !== 'info');
  const infoGroups = report.ruleSummary.filter((g) => g.severity === 'info');

  const toggle = (rule) => setOpenGroups((s) => {
    const n = new Set(s);
    if (n.has(rule)) n.delete(rule); else n.add(rule);
    return n;
  });

  const showRows = (rule) => { setRuleFilter(rule); setSevFilter('all'); setPage(1); document.getElementById('gl-issues-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const downloadCsv = (onlyErrors) => {
    const list = (issues || []).filter((i) => (onlyErrors ? i.severity === 'error' : true));
    const base = (fileName || 'file').replace(/\.[^.]+$/, '');
    saveAs(new Blob([issuesToCsv(list)], { type: 'text/csv;charset=utf-8' }), `${base}__problems.csv`);
  };

  return (
    <div className="space-y-5">
      {/* Banner */}
      {rejected ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <FiAlertOctagon className="text-red-600 text-2xl shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-800 text-lg">
              {report.truncatedAt ? `Rejected — the file appears to be cut off at row ${fmt(report.truncatedAt)}` : 'Rejected — nothing was uploaded'}
            </div>
            <div className="text-red-700 text-sm mt-1">
              {fmt(counts.errors)} problem{counts.errors === 1 ? '' : 's'} in {fmt(counts.errorRows || 0)} row{counts.errorRows === 1 ? '' : 's'} must be fixed before this file can be loaded.
              Fix them in your file and upload it again{onCheckAgain ? ', or change the options below and check again' : ''}.
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex gap-3">
          <FiCheckCircle className="text-emerald-600 text-2xl shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-emerald-800 text-lg">Accepted — {fmt(counts.rows)} rows passed all checks</div>
            <div className="text-emerald-700 text-sm mt-1">
              The file is ready to be loaded into FP&amp;A.{counts.warnings ? ` ${fmt(counts.warnings)} item${counts.warnings === 1 ? '' : 's'} to review below (they don't block the upload).` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Rows checked" value={fmt(counts.rows)} tone="slate" />
        <StatCard label="Must fix" value={fmt(counts.errors)} tone={counts.errors ? 'red' : 'green'} />
        <StatCard label="Rows with problems" value={fmt(counts.errorRows)} tone={counts.errorRows ? 'red' : 'green'} />
        <StatCard label="Please review" value={fmt(counts.warnings)} tone={counts.warnings ? 'amber' : 'green'} />
      </div>

      {/* Hints */}
      {report.hints?.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-900 text-sm space-y-1">
          <div className="font-semibold flex items-center gap-2"><FiInfo /> Suggestion</div>
          {report.hints.map((h) => <div key={h}>{h}</div>)}
        </div>
      )}

      {/* Problem groups */}
      {groups.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold text-[#004a80]">What we found</div>
          {groups.map((g) => (
            <div key={g.rule} className="border-b border-slate-100 last:border-b-0">
              <button type="button" onClick={() => toggle(g.rule)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                {openGroups.has(g.rule) ? <FiChevronDown /> : <FiChevronRight />}
                <SeverityChip severity={g.severity} />
                <span className="font-medium text-slate-800 flex-1">{g.title}</span>
                {g.columns?.length > 0 && <span className="text-xs text-slate-500 hidden md:inline">{g.columns.join(', ')}</span>}
                <span className="text-sm font-semibold text-slate-700">{fmt(g.count)}</span>
              </button>
              {openGroups.has(g.rule) && (
                <div className="px-11 pb-4 text-sm space-y-2">
                  <div className="text-slate-600"><span className="font-medium text-slate-700">How to fix: </span>{g.fix}</div>
                  <ul className="space-y-1">
                    {g.examples.map((ex, i) => (
                      <li key={i} className="text-slate-700 bg-slate-50 rounded px-3 py-2">
                        {ex.line ? <span className="font-mono text-xs text-slate-500 mr-2">Row {fmt(ex.line)}{ex.colIndex != null ? ` · col ${columnLetter(ex.colIndex)}` : ''}</span> : null}
                        {ex.message}
                      </li>
                    ))}
                  </ul>
                  {issues && g.count > 0 && g.examples.some((e) => e.line) && (
                    <button type="button" onClick={() => showRows(g.rule)} className="text-sky-700 font-medium hover:underline">Show all {fmt(g.count)} rows →</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info / changes we made */}
      {infoGroups.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <button type="button" onClick={() => setShowInfo((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-left text-slate-600 hover:bg-slate-50">
            {showInfo ? <FiChevronDown /> : <FiChevronRight />} <FiInfo /> FYI — notes about the file ({infoGroups.length})
          </button>
          {showInfo && (
            <ul className="px-11 pb-4 text-sm text-slate-600 space-y-1">
              {infoGroups.map((g) => <li key={g.rule}>• {g.examples[0]?.message || g.title}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Issues table */}
      {issues && filtered.length + (ruleFilter !== 'all' || sevFilter !== 'all' ? 1 : 0) > 0 && (
        <div id="gl-issues-table" className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-100">
            <span className="font-semibold text-[#004a80] mr-auto">Row-by-row problems</span>
            <label className="text-sm text-slate-600">Show{' '}
              <select value={sevFilter} onChange={(e) => { setSevFilter(e.target.value); setPage(1); }} className="border border-slate-300 rounded px-2 py-1 text-sm ml-1">
                <option value="all">All</option>
                <option value="error">Must fix</option>
                <option value="warning">Please review</option>
              </select>
            </label>
            <label className="text-sm text-slate-600">Problem{' '}
              <select value={ruleFilter} onChange={(e) => { setRuleFilter(e.target.value); setPage(1); }} className="border border-slate-300 rounded px-2 py-1 text-sm ml-1 max-w-[16rem]">
                <option value="all">All problems</option>
                {groups.map((g) => <option key={g.rule} value={g.rule}>{g.title} ({fmt(g.count)})</option>)}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-sky-50 text-sky-900">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Row</th>
                  <th className="text-left px-3 py-2 font-semibold">Column</th>
                  <th className="text-left px-3 py-2 font-semibold">Your value</th>
                  <th className="text-left px-3 py-2 font-semibold">Problem</th>
                  <th className="text-left px-3 py-2 font-semibold">Severity</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((i, k) => (
                  <tr key={k} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 font-mono text-xs text-slate-600 whitespace-nowrap">{i.line ? fmt(i.line) : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{i.column || '—'}{i.colIndex != null ? <span className="text-xs text-slate-400"> ({columnLetter(i.colIndex)})</span> : null}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700 max-w-[10rem] truncate" title={i.value ?? ''}>{i.value === '' ? <span className="text-slate-400">(blank)</span> : (i.value ?? '—')}</td>
                    <td className="px-3 py-2 text-slate-700">{i.message}</td>
                    <td className="px-3 py-2"><SeverityChip severity={i.severity} /></td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No rows match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-600">
            <span>{fmt(filtered.length)} row{filtered.length === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40">Previous</button>
              <span>Page {page} of {fmt(totalPages)}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border border-slate-300 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {issues && (counts.errors > 0 || counts.warnings > 0) && (
          <button type="button" onClick={() => downloadCsv(false)} className="inline-flex items-center gap-2 bg-[#004a80] text-white px-4 py-2 rounded-lg hover:bg-[#003366]">
            <FiDownload /> Download problems (CSV)
          </button>
        )}
        {onCheckAgain && (
          <button type="button" onClick={onCheckAgain} className="inline-flex items-center gap-2 border border-sky-300 text-sky-800 px-4 py-2 rounded-lg hover:bg-sky-50">
            <FiRefreshCw /> Check again
          </button>
        )}
        {onCheckAnother && (
          <button type="button" onClick={onCheckAnother} className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50">
            Upload another file
          </button>
        )}
        {!issues && (
          <span className="text-sm text-slate-500 flex items-center gap-2"><FiAlertTriangle /> Row-by-row details are shown right after an upload; history keeps the summary.</span>
        )}
      </div>
    </div>
  );
}
