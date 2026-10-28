import React from "react";
import { FiAlertCircle } from "react-icons/fi";

export default function SampleDataBanner() {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
      <FiAlertCircle size={14} className="mt-0.5 shrink-0" />
      <span>
        Sample staffing data for design review. Saved commentary, What-If scenarios, forecast submissions and access changes stay in
        this browser only, and the role-based access shown here previews rules the server will enforce once the backend is connected.
      </span>
    </div>
  );
}
