import React, { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import AppChip from "../../components/ui/AppChip";

const ReportHeader = ({
  title = "Financial Reports",
  description = "Discover actionable financial insights",
  actions,
}) => {
  const { selectedCurrency, selectedYear } = useContext(AuthContext);

  return (
    <div className="mb-2 rounded-xl bg-gradient-to-r from-sky-950 via-sky-900 to-sky-700 px-4 py-2 shadow-md">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-lg font-bold text-white">{title}</h1>

          {description ? <p className="text-s text-sky-100">{description}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedYear ? <AppChip label={`Year: ${selectedYear}`} /> : null}
          {selectedCurrency ? <AppChip label={`Currency: ${selectedCurrency}`} /> : null}
          {actions}
        </div>
      </div>
    </div>
  );
};

export default ReportHeader;
