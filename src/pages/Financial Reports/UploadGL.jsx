import React, { useState } from 'react';
import { MdOutlineFileCopy } from 'react-icons/md';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as XLSX from 'xlsx';

function UploadGL() {
  const [columns, setColumns] = useState([]);
  const [mapping, setMapping] = useState({});
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [processedData, setProcessedData] = useState([]);

  const dbFields = ["gl_account", "amount", "posting_date", "cost_center"];

  const handleFile = async (selectedFile) => {
    if (!selectedFile) return;

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error('Only Excel files are allowed!', {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (selectedFile.size > maxSize) {
      toast.error('File size exceeds 5MB limit!', {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    setFile(selectedFile);

    // Read Excel columns
    try {
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        setColumns(jsonData[0]); // Get first row as headers
        setProcessedData(jsonData.slice(1)); // Store data rows (excluding headers)
      };
      reader.readAsArrayBuffer(selectedFile);
    } catch (error) {
      toast.error('Error reading Excel file!', {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e) => {
    handleFile(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFile(droppedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleMappingChange = (dbField, excelField) => {
    setMapping(prev => ({ ...prev, [dbField]: excelField }));
  };

  const submitMapping = async () => {
    const requiredFields = ["gl_account", "amount", "posting_date"];
    const missing = requiredFields.filter(f => !mapping[f]);

    if (missing.length > 0) {
      toast.error(`Missing required fields: ${missing.join(', ')}`, {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('File uploaded and processed successfully!', {
        position: "top-right",
        autoClose: 3000,
      });
    } catch (error) {
      toast.error('Error processing file!', {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Map Excel data to database fields for display
  const getMappedData = () => {
    if (!processedData.length || !Object.keys(mapping).length) return [];

    return processedData.map(row => {
      const mappedRow = {};
      dbFields.forEach(dbField => {
        const excelField = mapping[dbField];
        if (excelField) {
          const colIndex = columns.indexOf(excelField);
          mappedRow[dbField] = colIndex !== -1 ? row[colIndex] : '';
        } else {
          mappedRow[dbField] = '';
        }
      });
      return mappedRow;
    });
  };

  return (
    <div className="space-y-6 p-4 min-h-screen relative bg-sky-50">
      <style>{`
        .loadergl {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
          display: inline-block;
          margin-right: 8px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <ToastContainer />

      {/* Header Bar */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">Excel File Uploader</h1>
          </div>
          <div className="flex space-x-2"></div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex gap-8 items-center">
            {/* Left Side - File Upload with Drag and Drop */}
            <div className="w-1/3">
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                  id="fileInput"
                  disabled={isProcessing}
                />
                <label htmlFor="fileInput" className="cursor-pointer">
                  <div className="flex flex-col items-center">
                    <MdOutlineFileCopy size={32} className="m-7 text-sky-300" />
                    <p className="text-gray-600 font-medium">
                      {isDragging ? 'Drop your file here' : 'Drag & drop your Excel file here'}
                    </p>
                    <p className="text-s text-gray-500 mt-2 mb-5">or click to browse</p>
                  </div>
                </label>
              </div>

              {file && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-s text-green-700 font-medium">{file.name}</p>
                    <p className="text-x text-green-600">
                      ({Math.round(file.size / 1024)} KB)
                    </p>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-red-500 hover:text-red-700"
                    disabled={isProcessing}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Right Side - Mapping */}
            <div className="flex-1">
              {columns.length > 0 ? (
                <div>
                  <h3 className="text-xl font-semibold mb-6 text-gray-800">Map Excel Columns</h3>
                  <div className="space-y-5">
                    {dbFields.map(dbField => (
                      <div key={dbField} className="flex items-center gap-4">
                        <label className="w-40 font-medium text-gray-700 capitalize">
                          {dbField.replace(/_/g, ' ')}
                        </label>
                        <select
                          className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          onChange={(e) => handleMappingChange(dbField, e.target.value)}
                          value={mapping[dbField] || ""}
                        >
                          <option value="">Select Column</option>
                          {columns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={submitMapping}
                    className="mt-8 bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <span className="flex items-center">
                        <div className="loadergl"></div>
                        Processing...
                      </span>
                    ) : (
                      'Upload & Process'
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-gray-500 text-center flex flex-col items-center py-16">
                  <div className="loadergl mb-5"></div>
                  <p className="text-lg font-medium">Upload an Excel file to start mapping</p>
                  <p className="text-s mt-2">Supported formats: .xlsx, .xls (Max 5MB)</p>
                </div>
              )}
            </div>
          </div>

          {/* Data Table */}
          {processedData.length > 0 && Object.keys(mapping).length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Processed Data</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                  <thead>
                    <tr className="bg-gray-100">
                      {dbFields.map(dbField => (
                        <th key={dbField} className="py-2 px-4 border-b text-left text-gray-600 capitalize">
                          {dbField.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getMappedData().map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {dbFields.map(dbField => (
                          <td key={dbField} className="py-2 px-4 border-b text-gray-700">
                            {row[dbField] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UploadGL;