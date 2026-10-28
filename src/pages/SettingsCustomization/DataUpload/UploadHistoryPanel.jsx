import React, { useEffect, useState } from 'react';
import { FiChevronDown, FiChevronRight, FiClock } from 'react-icons/fi';
import ValidationReport from './ValidationReport';
import { loadHistory } from './uploadHistory';

const fmt = (n) => Number(n || 0).toLocaleString();

const STATUS = {
  accepted: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
};

export default function UploadHistoryPanel() {
  const [items, setItems] = useState(loadHistory);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const refresh = () => setItems(loadHistory());
    window.addEventListener('fpna-upload-history', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('fpna-upload-history', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return (
    <div className="rounded-xl border border-sky-100 bg-white shadow-sm mb-6">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <FiClock className="text-sky-700" />
        <span className="font-semibold text-[#004a80]">Upload history</span>
        <span className="text-xs text-slate-500 ml-2">every upload, including rejected ones — click a row for the details</span>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-slate-500 text-sm">No uploads yet. Use “Financial Data Upload” to upload a file.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-sky-50 text-sky-900">
              <tr>
                <th className="px-3 py-2" />
                <th className="text-left px-3 py-2">Uploaded</th>
                <th className="text-left px-3 py-2">Data type</th>
                <th className="text-left px-3 py-2">File</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Rows</th>
                <th className="text-right px-3 py-2">Must fix</th>
                <th className="text-right px-3 py-2">To review</th>
                <th className="text-left px-3 py-2">Uploaded by</th>
              </tr>
            </thead>
            <tbody>
              {items.map((h) => {
                const st = STATUS[h.status] || { label: h.status, cls: 'bg-slate-100 text-slate-700' };
                const isOpen = open === h.id;
                return (
                  <React.Fragment key={h.id}>
                    <tr onClick={() => setOpen(isOpen ? null : h.id)} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-400">{isOpen ? <FiChevronDown /> : <FiChevronRight />}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(h.checkedAt).toLocaleString()}</td>
                      <td className="px-3 py-2">{h.datasetLabel}</td>
                      <td className="px-3 py-2 max-w-[16rem] truncate" title={h.fileName}>{h.fileName}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span></td>
                      <td className="px-3 py-2 text-right">{fmt(h.counts?.rows)}</td>
                      <td className={`px-3 py-2 text-right ${h.counts?.errors ? 'text-red-700 font-semibold' : ''}`}>{fmt(h.counts?.errors)}</td>
                      <td className="px-3 py-2 text-right">{fmt(h.counts?.warnings)}</td>
                      <td className="px-3 py-2">{h.uploadedBy}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="text-xs text-slate-500 mb-3">Date format {h.dateFormat} · checked in {((h.durationMs || 0) / 1000).toFixed(1)} s</div>
                          {Array.isArray(h.mapping) && h.mapping.length > 0 && (
                            <div className="mb-4">
                              <div className="text-sm font-medium text-slate-700 mb-2">Column mapping used</div>
                              <div className="flex flex-wrap gap-2">
                                {h.mapping.map((m, k) => (
                                  <span key={k} className={`text-xs rounded-full px-2.5 py-1 border ${m.db ? 'bg-white border-sky-200 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                    {m.file || '(blank)'} → <span className="font-mono">{m.db || 'not imported'}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <ValidationReport report={{ ...h, issues: null }} fileName={h.fileName} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
