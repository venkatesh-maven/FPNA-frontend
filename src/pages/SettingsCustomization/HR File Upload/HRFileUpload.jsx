import React, { useState, useContext } from 'react';
import { FiUpload, FiFileText, FiCheckCircle, FiChevronDown } from 'react-icons/fi';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { AuthContext } from '../../../context/AuthContext';
import { API_BASE_URL } from '../../../config/config';

// HR File Configs
const HR_FILE_CONFIGS = [
  { key: "employee_master", label: "Employee Master", endpoint: "/api/v1/company/hr/employee-master" },
  { key: "payroll_data", label: "Payroll Data", endpoint: "/api/v1/company/hr/payroll-data" },
  { key: "attendance", label: "Attendance", endpoint: "/api/v1/company/hr/attendance" },
  { key: "leave_records", label: "Leave Records", endpoint: "/api/v1/company/hr/leave-records" },
  { key: "tax_declarations", label: "Tax Declarations", endpoint: "/api/v1/company/hr/tax-declarations" },
];

// File Reader
const readExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const headers = json[0];
        const rows = json.slice(1).map((row) => {
          const obj = {};
          headers.forEach((h, i) => (obj[h] = row[i]));
          return obj;
        });
        resolve({ headers, data: rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject();
    reader.readAsArrayBuffer(file);
  });
};

const UploadHRFile = ({ token }) => {
  const [selectedDataType, setSelectedDataType] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (selectedFile) => {
    const validTypes = [".xlsx", ".xls", ".csv"];
    const fileExtension = "." + selectedFile.name.split(".").pop().toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      toast.error("Please upload a valid Excel/CSV file");
      return;
    }
    
    try {
      await readExcelFile(selectedFile);
      setFile(selectedFile);
      toast.success(`File loaded: ${selectedFile.name}`);
    } catch {
      toast.error("Invalid file format!");
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedDataType) {
      toast.error("Please select a data type first!");
      return;
    }

    if (!file) {
      toast.error("Please select a file first!");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const endpoint = HR_FILE_CONFIGS.find(config => config.key === selectedDataType)?.endpoint;

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        toast.success(
          <span className="flex items-center">
            <FiCheckCircle className="mr-2" /> File uploaded successfully!
          </span>
        );
      } else {
        toast.error("Upload failed!");
      }
    } catch (error) {
      toast.error("Upload failed!");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 py-8">
      <div className="w-100 mx-auto px-2">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-sky-800 mb-3">Upload HR Data</h1>
        </div>

        {/* Main Upload Box */}
        <div className="bg-white rounded-xl shadow-md border border-sky-200 p-4">
          {/* Data Type Dropdown */}
          {/* <div className="mb-6">
            <label className="block text-sky-700 text-s font-medium mb-3">
              Data Type
            </label>
            
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full bg-white border border-sky-300 rounded-lg px-4 py-3 text-left flex items-center justify-between hover:border-sky-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition"
              >
                <span className={`${selectedDataType ? 'text-sky-800' : 'text-sky-400'}`}>
                  {selectedDataType 
                    ? HR_FILE_CONFIGS.find(config => config.key === selectedDataType)?.label 
                    : "Select Data Type"
                  }
                </span>
                <FiChevronDown className={`text-sky-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-sky-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {HR_FILE_CONFIGS.map((config) => (
                    <button
                      key={config.key}
                      onClick={() => {
                        setSelectedDataType(config.key);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-sky-50 transition ${
                        selectedDataType === config.key ? 'bg-sky-100 text-sky-700' : 'text-sky-600'
                      }`}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div> */}

          {/* File Upload Area */}
          <div className="mb-6">
            <label className="block text-sky-700 text-s font-medium mb-3">
              Upload File
            </label>

            <div
              className="border-2 border-dashed border-sky-300 rounded-lg p-8 text-center cursor-pointer transition hover:border-sky-400 hover:bg-sky-50"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById('file-input').click()}
            >
              <FiUpload className="mx-auto text-4xl text-sky-400 mb-4" />
              <p className="text-sky-600 font-medium mb-2">
                Drag & Drop or Click to Upload File
              </p>
              <p className="text-sky-400 text-s">
                Supported formats: .xlsx, .xls, .csv
              </p>
              <input
                id="file-input"
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
            </div>

            {/* Selected File Display */}
            <div className="mt-4">
              <p className="text-sky-700 text-s">
                <span className="font-medium">Selected File:</span>{" "}
                <span className={file ? "text-sky-600" : "text-sky-400"}>
                  {file ? file.name : "None"}
                </span>
              </p>
            </div>
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!selectedDataType || !file || isUploading}
            className={`w-full py-3 rounded-lg text-white font-medium transition ${
              selectedDataType && file && !isUploading
                ? "bg-sky-600 hover:bg-sky-700"
                : "bg-sky-300 cursor-not-allowed"
            }`}
          >
            {isUploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main HR File Upload Component with Tabs
const HRFileUpload = () => {
  const { token } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('upload');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-sky-800 mb-4">HR Accounts Management</h2>
        <p className="text-sky-600 mb-6">Manage HR accounts, entries, and integration history.</p>

        {/* Tabs - Styled like GL */}
        <div className="mb-6">
          <nav className="flex flex-wrap border-b border-sky-200">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 font-medium text-s rounded-t-lg mr-2 ${
                activeTab === 'upload' 
                  ? 'bg-sky-600 text-white border border-sky-600' 
                  : 'bg-white text-sky-700 hover:bg-sky-50 border border-transparent'
              }`}
            >
              Upload HR File
            </button>
            <button
              onClick={() => setActiveTab('view')}
              className={`px-4 py-2 font-medium text-s rounded-t-lg mr-2 ${
                activeTab === 'view' 
                  ? 'bg-sky-600 text-white border border-sky-600' 
                  : 'bg-white text-sky-700 hover:bg-sky-50 border border-transparent'
              }`}
            >
              View HR File
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 font-medium text-s rounded-t-lg ${
                activeTab === 'history' 
                  ? 'bg-sky-600 text-white border border-sky-600' 
                  : 'bg-white text-sky-700 hover:bg-sky-50 border border-transparent'
              }`}
            >
              Integration History
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'upload' && <UploadHRFile token={token} />}
      {activeTab === 'view' && (
        <div className="bg-white rounded-xl shadow-md border border-sky-200 p-6 text-center">
          <p className="text-sky-600">View HR File content will go here</p>
        </div>
      )}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl shadow-md border border-sky-200 p-6 text-center">
          <p className="text-sky-600">Integration History content will go here</p>
        </div>
      )}
    </div>
  );
};

export default HRFileUpload;