import React from "react";
import { CSVLink } from "react-csv";
import { FiDownload } from "react-icons/fi";

const ExportCSV = ({ data, filename, label = "CSV" }) => {
  return (
    <CSVLink
      data={data || []}
      filename={filename}
      className="flex items-center px-3 py-2 bg-sky-100 text-sky-800 rounded-lg text-x hover:bg-sky-200"
      onClick={(e) => e.stopPropagation()}
    >
      <FiDownload className="mr-1" /> {label}
    </CSVLink>
  );
};

export default ExportCSV;