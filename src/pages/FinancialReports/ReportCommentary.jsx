import React, { useState } from "react";
import { BsStars } from "react-icons/bs";
import { FiEdit2, FiTrash2, FiCheck, FiX } from "react-icons/fi";
import { toast } from "react-toastify";
import { CATEGORY_STYLES } from "./insightCategories";

/**
 * Saved commentary for the report view on screen (`commentary` is
 * hooks/useReportCommentary). It is part of the page itself, so it is
 * included when the report is printed / saved as PDF (action buttons are
 * hidden by the global print CSS, which hides all <button>s).
 */
export default function ReportCommentary({ commentary }) {
  const { items, updateItem, removeItem } = commentary;
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: "", text: "" });
  const [saving, setSaving] = useState(false);

  if (!items.length) return null;

  const startEdit = (item) => {
    setEditingId(item.id);
    setDraft({ title: item.title || "", text: item.text });
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await updateItem(editingId, draft);
      setEditingId(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (item) => {
    if (!window.confirm("Remove this commentary from the report?")) return;
    try {
      await removeItem(item.id);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <section
      className="mt-6 bg-white border border-sky-200 rounded-xl p-4 shadow-sm"
      style={{ breakInside: "avoid" }}
    >
      <h3 className="text-s font-semibold text-sky-900 mb-3">Report Commentary</h3>

      <ol className="space-y-3">
        {items.map((item) => {
          const cat = CATEGORY_STYLES[item.category];
          const isEditing = editingId === item.id;
          return (
            <li key={item.id} className="border-l-4 border-sky-300 pl-3" style={{ breakInside: "avoid" }}>
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder="Title"
                    className="w-full px-2 py-1 text-x border border-sky-200 rounded"
                  />
                  <textarea
                    value={draft.text}
                    onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                    rows={3}
                    className="w-full px-2 py-1 text-x border border-sky-200 rounded"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving || !draft.text.trim()}
                      className="flex items-center gap-1 px-2 py-1 text-x rounded bg-sky-800 text-white disabled:opacity-50"
                    >
                      <FiCheck /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 px-2 py-1 text-x rounded bg-slate-100 text-slate-700"
                    >
                      <FiX /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.title && <h4 className="text-x font-semibold text-sky-900">{item.title}</h4>}
                      {cat && (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${cat.className}`}>
                          {cat.label}
                        </span>
                      )}
                      {item.source === "ai" && (
                        <span className="flex items-center gap-0.5 text-[11px] text-sky-600">
                          <BsStars /> AI-generated
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(item)}
                        className="text-sky-600 hover:text-sky-900"
                        aria-label="Edit commentary"
                      >
                        <FiEdit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleRemove(item)}
                        className="text-red-500 hover:text-red-700"
                        aria-label="Remove commentary"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-x text-slate-700 leading-relaxed">{item.text}</p>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
