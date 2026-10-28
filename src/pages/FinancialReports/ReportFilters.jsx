import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiFilter } from "react-icons/fi";
import AppButton from "../../components/ui/AppButton";
import AppChip from "../../components/ui/AppChip";
import AppSelect from "../../components/ui/AppSelect";

const ReportFilters = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="mb-4 flex w-full items-center justify-end gap-3">
      <div className="flex items-center gap-2">
        <AppChip label="Period: Current Month" className="bg-sky-900 text-white" />
        <AppChip label="Entity: Audree" className="bg-sky-900 text-white" />
        <AppChip label="Hierarchy: Group" className="bg-sky-900 text-white" />
      </div>

      <div className="relative" ref={ref}>
        <AppButton onClick={() => setOpen(!open)} variant="skySoft">
          <FiFilter size={14} />
          Filter
        </AppButton>

        <AnimatePresence>
          {open ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-sky-200 bg-white p-4 shadow-lg"
            >
              <div className="space-y-3">
                <AppSelect
                  label="Time Period"
                  value="Current Month"
                  onChange={() => {}}
                  options={[
                    { value: "All Periods", label: "All Periods" },
                    { value: "Current Month", label: "Current Month" },
                    { value: "Last Month", label: "Last Month" },
                    { value: "YTD", label: "YTD" },
                  ]}
                />

                <AppSelect
                  label="Hierarchy Level"
                  value="Group Level"
                  onChange={() => {}}
                  options={[
                    { value: "Group Level", label: "Group Level" },
                    { value: "Department Level", label: "Department Level" },
                    { value: "Product Level", label: "Product Level" },
                  ]}
                />

                <AppSelect
                  label="Entity"
                  value="Audree"
                  onChange={() => {}}
                  options={[
                    { value: "Audree", label: "Audree" },
                    { value: "Audree India", label: "Audree India" },
                    { value: "Audree US", label: "Audree US" },
                  ]}
                />

                <div className="border-t border-sky-200 pt-2">
                  <AppButton className="w-full" variant="outline">
                    Reset Filters
                  </AppButton>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ReportFilters;
