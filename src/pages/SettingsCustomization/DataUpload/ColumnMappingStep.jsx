import React from 'react';
import { FiArrowRight, FiCheckCircle, FiDatabase, FiFileText, FiRotateCcw, FiXCircle } from 'react-icons/fi';
import { GL_COLUMNS, GL_DB_TABLE } from './glValidator';

/**
 * Map each column of the uploaded file to a database column.
 * props:
 *   headers      – file header names
 *   previewRows  – first data rows (arrays) for sample values
 *   fileMap      – { [fileColumnIndex]: canonicalName | '' }   current mapping
 *   autoMap      – { [fileColumnIndex]: canonicalName }         what automatic matching suggested
 *   onChange     – (newFileMap) => void
 */
export default function ColumnMappingStep({ headers, previewRows, fileMap, autoMap, onChange }) {
  const usedBy = {}; // canonical -> file index
  Object.entries(fileMap).forEach(([i, canon]) => { if (canon) usedBy[canon] = Number(i); });

  const setTarget = (index, canon) => {
    const next = { ...fileMap };
    if (canon) {
      // A database column can take only one file column: move it.
      Object.keys(next).forEach((k) => { if (next[k] === canon) next[k] = ''; });
    }
    next[index] = canon;
    onChange(next);
  };

  const samples = (i) => previewRows.map((r) => String(r[i] ?? '').trim()).filter(Boolean).slice(0, 3);
  const required = GL_COLUMNS.filter((c) => c.required);
  const mappedRequired = required.filter((c) => usedBy[c.name] !== undefined).length;
  const mappedCount = Object.values(fileMap).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-2 text-slate-600">
          <FiDatabase className="text-sky-700" /> Loads into <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{GL_DB_TABLE}</span>
        </span>
        <span className="text-slate-500">· {mappedCount} of {headers.length} file columns mapped · {mappedRequired} of {required.length} required database columns filled</span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => onChange({ ...Object.fromEntries(headers.map((_, i) => [i, autoMap[i] || ''])) })}
            className="inline-flex items-center gap-1 text-sm border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50">
            <FiRotateCcw /> Auto-match again
          </button>
          <button type="button" onClick={() => onChange(Object.fromEntries(headers.map((_, i) => [i, ''])))}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50">
            Clear all
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-sky-50 text-sky-900">
            <tr>
              <th className="text-left px-3 py-2 w-10">#</th>
              <th className="text-left px-3 py-2"><span className="inline-flex items-center gap-1"><FiFileText /> Column in your file</span></th>
              <th className="text-left px-3 py-2">Sample values</th>
              <th className="px-2 py-2" />
              <th className="text-left px-3 py-2"><span className="inline-flex items-center gap-1"><FiDatabase /> Database column</span></th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((h, i) => {
              const target = fileMap[i] || '';
              const col = GL_COLUMNS.find((c) => c.name === target);
              const isAuto = target && autoMap[i] === target;
              return (
                <tr key={i} className={`border-t border-slate-100 ${target ? '' : 'bg-slate-50/60'}`}>
                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{h || <em className="text-slate-400">(blank header)</em>}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500 max-w-[14rem] truncate" title={samples(i).join(', ')}>{samples(i).join(', ') || '—'}</td>
                  <td className="px-2 py-2 text-slate-400"><FiArrowRight /></td>
                  <td className="px-3 py-2">
                    <select
                      value={target}
                      onChange={(e) => setTarget(i, e.target.value)}
                      aria-label={`Database column for ${h}`}
                      className={`border rounded-lg px-2 py-1.5 text-sm w-full min-w-[15rem] ${target ? 'border-sky-300 bg-white' : 'border-slate-300 bg-slate-50 text-slate-500'}`}
                    >
                      <option value="">— Don't import —</option>
                      {GL_COLUMNS.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.db} — {c.label}{c.required ? ' *' : ''}{usedBy[c.name] !== undefined && usedBy[c.name] !== i ? `  (now: ${headers[usedBy[c.name]]})` : ''}
                        </option>
                      ))}
                    </select>
                    {col && <div className="text-[11px] text-slate-400 mt-0.5">{col.dbType}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {!target && <span className="text-xs text-slate-500">Not imported</span>}
                    {target && isAuto && <span className="text-xs rounded-full px-2 py-0.5 bg-sky-100 text-sky-800">Auto-matched</span>}
                    {target && !isAuto && <span className="text-xs rounded-full px-2 py-0.5 bg-violet-100 text-violet-800">Set by you</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <div className="text-sm font-medium text-slate-700 mb-2">Database columns</div>
        <div className="flex flex-wrap gap-2">
          {GL_COLUMNS.map((c) => {
            const fi = usedBy[c.name];
            const ok = fi !== undefined;
            return (
              <span key={c.name} className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : c.required ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                {ok ? <FiCheckCircle /> : c.required ? <FiXCircle /> : null}
                <span className="font-mono">{c.db}</span>
                {ok ? <span className="text-emerald-600">← {headers[fi]}</span> : c.required ? <span>required</span> : <span>optional</span>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
