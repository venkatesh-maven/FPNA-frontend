import React from "react";
import { FiPrinter } from "react-icons/fi";

const PrintReport = ({ label = "Print" }) => {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200"
      onClickCapture={(e) => e.stopPropagation()}
    >
      <FiPrinter className="mr-1" /> {label}
    </button>
  );
};

export default PrintReport;