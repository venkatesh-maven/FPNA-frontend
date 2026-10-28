// 📌 GLExcelUpload.jsx
import React, { useState, useContext, useRef, useEffect } from "react";
import { FiUpload, FiFileText, FiCheckCircle, FiChevronDown } from "react-icons/fi";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { API_BASE_URL } from "../../../config/config";
import { AuthContext } from "../../../context/AuthContext";

// UI Config
const FILE_CONFIGS = [
  { key: "chart_of_accounts", label: "Chart of Accounts", endpoint: "/api/v1/company/financial/gl-master" },
  { key: "cost_centers", label: "Cost Centers", endpoint: "/api/v1/company/financial/cost-centers" },
  { key: "customers", label: "Customers", endpoint: "/api/v1/company/financial/customers" },
  { key: "departments", label: "Departments", endpoint: "/api/v1/company/financial/departments" },
  { key: "entities", label: "Entities", endpoint: "/api/v1/company/financial/entities" },
  { key: "general_ledger_transactions", label: "General Ledger Transactions", endpoint: "/api/v1/company/financial/upload-gl/" },
  { key: "profit_centers", label: "Profit Centers", endpoint: "/api/v1/company/financial/profit-centers" },
  { key: "trial_balance", label: "Trial Balance", endpoint: "/api/v1/company/financial/trial-balance" },
  { key: "vendors", label: "Vendors", endpoint: "/api/v1/company/financial/vendors" },
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

const GLExcelUpload = () => {
  const { token } = useContext(AuthContext);
  const [selectedDataType, setSelectedDataType] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Ref for dropdown to detect outside clicks
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

    const endpoint = FILE_CONFIGS.find(config => config.key === selectedDataType)?.endpoint;

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

  // Toggle dropdown function
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Handle dropdown item selection
  const handleDropdownSelect = (config) => {
    setSelectedDataType(config.key);
    setIsDropdownOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 py-8">
      <div className="w-100 mx-auto px-2">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-sky-800 mb-3">Upload Financial Data</h1>
        </div>

        {/* Main Upload Box */}
        <div className="bg-white rounded-xl shadow-md border border-sky-200 p-4">
          {/* Data Type Dropdown */}
          <div className="mb-6">
            <label className="block text-sky-700 text-s font-medium mb-3">
              Data Type
            </label>
            
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={toggleDropdown}
                className="w-full bg-white border border-sky-300 rounded-lg px-4 py-3 text-left flex items-center justify-between hover:border-sky-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition"
              >
                <span className={`${selectedDataType ? 'text-sky-800' : 'text-sky-400'}`}>
                  {selectedDataType 
                    ? FILE_CONFIGS.find(config => config.key === selectedDataType)?.label 
                    : "Select Data Type"
                  }
                </span>
                <FiChevronDown className={`text-sky-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-sky-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {FILE_CONFIGS.map((config) => (
                    <button
                      key={config.key}
                      onClick={() => handleDropdownSelect(config)}
                      className={`w-full px-4 py-1 text-left hover:bg-sky-200  transition ${
                        selectedDataType === config.key ? 'bg-sky-200 text-sky-700' : 'bg-sky-50  text-sky-600'
                      }`}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

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

export default GLExcelUpload;



// import React, { useState, useContext, useRef, useEffect } from 'react';
// import { FiUpload, FiPlus, FiTrash2, FiX, FiArrowRight } from 'react-icons/fi';
// import { toast } from 'react-toastify';
// import * as XLSX from 'xlsx';
// import { API_BASE_URL } from '../../../config/config';
// import { AuthContext from '../../../context/AuthContext';
// import Select from 'react-select';

// const GLExcelUpload = ({ token, onUploadSuccess }) => {
//   const [file, setFile] = useState(null);
//   const [uploadedHeaders, setUploadedHeaders] = useState([]);
//   const [previewData, setPreviewData] = useState([]);
//   const [mappings, setMappings] = useState({});
//   const [loading, setLoading] = useState(false);
//   const [dragActive, setDragActive] = useState(false);
//   const [draggingField, setDraggingField] = useState(null);
//   const [connections, setConnections] = useState([]);
//   const [uploadProgress, setUploadProgress] = useState(0);
//   const [visibleRows, setVisibleRows] = useState(30);
//   const [editingCell, setEditingCell] = useState(null);
//   const [editedValue, setEditedValue] = useState('');
//   const previewTableRef = useRef(null);
//   const containerRef = useRef(null);

//   const backendFields = [
//     { id: 'date', label: 'date', required: true },
//     { id: 'general_ledger_code', label: 'GL Code', required: true },
//     { id: 'account_name', label: 'Account Name', required: true },
//     { id: 'category', label: 'Category', required: false },
//     { id: 'amount', label: 'amount', required: false },
//     { id: 'single_col_debit_credit', label: 'single_col_debit_credit', required: false },
//   ];

//   useEffect(() => {
//     const table = previewTableRef.current;
//     if (!table) return;

//     const handleScroll = () => {
//       const { scrollTop, scrollHeight, clientHeight } = table;
//       if (scrollTop + clientHeight >= scrollHeight - 20) {
//         setVisibleRows(prev => Math.min(prev + 30, previewData.length));
//       }
//     };

//     table.addEventListener('scroll', handleScroll);
//     return () => table.removeEventListener('scroll', handleScroll);
//   }, [previewData]);

//   useEffect(() => {
//     if (!containerRef.current || !uploadedHeaders.length) return;

//     const calculateConnections = () => {
//       const newConnections = [];
//       backendFields.forEach(field => {
//         if (mappings[field.id]) {
//           const sourceElem = document.getElementById(`backend-${field.id}`);
//           const targetElem = document.getElementById(`uploaded-${mappings[field.id]}`);

//           if (sourceElem && targetElem) {
//             const containerRect = containerRef.current.getBoundingClientRect();
//             const sourceRect = sourceElem.getBoundingClientRect();
//             const targetRect = targetElem.getBoundingClientRect();

//             const sourceX = sourceRect.right - containerRect.left;
//             const sourceY = sourceRect.top + sourceRect.height / 2 - containerRect.top;
//             const targetX = targetRect.left - containerRect.left;
//             const targetY = targetRect.top + targetRect.height / 2 - containerRect.top;

//             newConnections.push({
//               id: `${field.id}-${mappings[field.id]}`,
//               path: `M${sourceX},${sourceY} C${(sourceX + targetX) / 2},${sourceY} ${(sourceX + targetX) / 2},${targetY} ${targetX},${targetY}`,
//               fieldId: field.id,
//               header: mappings[field.id]
//             });
//           }
//         }
//       });

//       setConnections(newConnections);
//     };

//     const timer = setTimeout(calculateConnections, 100);
//     return () => clearTimeout(timer);
//   }, [mappings, uploadedHeaders]);

//   const handleDragStart = (fieldId) => {
//     setDraggingField(fieldId);
//   };

//   const handleDragOver = (e) => {
//     e.preventDefault();
//   };

//   const handleDrop = (e, header) => {
//     e.preventDefault();
//     if (draggingField) {
//       const updatedMappings = { ...mappings };
//       Object.keys(updatedMappings).forEach(key => {
//         if (updatedMappings[key] === header) {
//           delete updatedMappings[key];
//         }
//       });

//       updatedMappings[draggingField] = header;
//       setMappings(updatedMappings);
//     }
//     setDraggingField(null);
//   };

//   const removeMapping = (fieldId) => {
//     const updatedMappings = { ...mappings };
//     delete updatedMappings[fieldId];
//     setMappings(updatedMappings);
//   };

//   const handleFileDrag = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     if (e.type === 'dragenter' || e.type === 'dragover') {
//       setDragActive(true);
//     } else if (e.type === 'dragleave') {
//       setDragActive(false);
//     }
//   };

//   const handleFileDrop = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setDragActive(false);
//     if (e.dataTransfer.files && e.dataTransfer.files[0]) {
//       handleFile(e.dataTransfer.files[0]);
//     }
//   };

//   const handleFileChange = (e) => {
//     if (e.target.files && e.target.files[0]) {
//       handleFile(e.target.files[0]);
//     }
//   };

//   const handleFile = async (file) => {
//     const validExtensions = ['.xlsx', '.xls', '.csv'];
//     const fileExtension = file.name.split('.').pop().toLowerCase();

//     if (!validExtensions.includes(`.${fileExtension}`)) {
//       toast.error('Please upload a valid Excel file (XLSX, XLS, CSV)');
//       return;
//     }

//     setFile(file);
//     setMappings({});
//     setUploadProgress(0);
//     setVisibleRows(30);

//     try {
//       const { headers, previewData } = await readExcelFile(file);
//       setUploadedHeaders(headers);
//       setPreviewData(previewData);

//       const autoMappings = {};
//       headers.forEach(header => {
//         const lowerHeader = header.toLowerCase();

//         if (lowerHeader.includes('gl') && lowerHeader.includes('code')) {
//           autoMappings.general_ledger_code = header;
//         } else if (lowerHeader.includes('account') && lowerHeader.includes('name')) {
//           autoMappings.account_name = header;
//         } else if (lowerHeader.includes('category')) {
//           autoMappings.category = header;
//         } else if (lowerHeader.includes('tag')) {
//           autoMappings.tags = header;
//         }
//       });

//       setMappings(autoMappings);
//     } catch (error) {
//       toast.error('Failed to read file. Please try again.');
//       console.error('Error reading file:', error);
//     }
//   };

//   const readExcelFile = (file) => {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();

//       reader.onload = (e) => {
//         try {
//           const data = new Uint8Array(e.target.result);
//           const workbook = XLSX.read(data, { type: 'array' });
//           const firstSheetName = workbook.SheetNames[0];
//           const worksheet = workbook.Sheets[firstSheetName];

//           const headers = [];
//           const range = XLSX.utils.decode_range(worksheet['!ref']);
//           for (let C = range.s.c; C <= range.e.c; ++C) {
//             const cellAddress = { c: C, r: range.s.r };
//             const cellRef = XLSX.utils.encode_cell(cellAddress);
//             const cell = worksheet[cellRef];
//             headers.push(cell ? cell.v : undefined);
//           }

//           const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
//           const previewData = jsonData.slice(1).map(row => {
//             const obj = {};
//             headers.forEach((header, idx) => {
//               obj[header] = row[idx];
//             });
//             return obj;
//           });

//           resolve({ headers: headers.filter(h => h), previewData });
//         } catch (error) {
//           reject(error);
//         }
//       };

//       reader.onerror = (error) => reject(error);
//       reader.readAsArrayBuffer(file);
//     });
//   };

//   const validateMappings = () => {
//     const errors = [];
//     backendFields.forEach(field => {
//       if (field.required && !mappings[field.id]) {
//         errors.push(`${field.label} is required`);
//       }
//     });

//     if (errors.length > 0) {
//       toast.error(`Missing required mappings: ${errors.join(', ')}`);
//       return false;
//     }

//     return true;
//   };

//   const handleCellEdit = (rowIndex, header) => {
//     setEditingCell({ rowIndex, header });
//     setEditedValue(previewData[rowIndex][header] || '');
//   };

//   const handleCellSave = () => {
//     if (editingCell) {
//       const newData = [...previewData];
//       newData[editingCell.rowIndex][editingCell.header] = editedValue;
//       setPreviewData(newData);
//       setEditingCell(null);
//     }
//   };

//   const handleUpload = async () => {
//     if (!file) {
//       toast.error('Please select a file first');
//       return;
//     }

//     if (!validateMappings()) return;

//     try {
//       setLoading(true);
//       setUploadProgress(0);

//       const formData = new FormData();
//       formData.append('file', file);
//       formData.append('column_mapping', JSON.stringify(mappings));

//       const editedData = previewData.map(row => {
//         const editedRow = {};
//         Object.keys(row).forEach(key => {
//           editedRow[key] = row[key];
//         });
//         return editedRow;
//       });
//       formData.append('edited_data', JSON.stringify(editedData));

//       const xhr = new XMLHttpRequest();
//       xhr.open('POST', `${API_BASE_URL}/api/v1/company/financial/upload-gl/`, true);
//       xhr.setRequestHeader('Authorization', `Bearer ${token}`);

//       xhr.upload.onprogress = (event) => {
//         if (event.lengthComputable) {
//           const percentComplete = Math.round((event.loaded / event.total) * 100);
//           setUploadProgress(percentComplete);
//         }
//       };

//       xhr.onload = () => {
//         if (xhr.status >= 200 && xhr.status < 300) {
//           const responseData = JSON.parse(xhr.responseText);
//           toast.success('GL accounts uploaded successfully!');
//           setFile(null);
//           setUploadedHeaders([]);
//           setPreviewData([]);
//           setMappings({});
//           setUploadProgress(0);

//           if (onUploadSuccess) {
//             onUploadSuccess(responseData);
//           }
//         } else {
//           const errorData = JSON.parse(xhr.responseText);
//           throw new Error(errorData.detail || 'Failed to upload GL accounts');
//         }
//         setLoading(false);
//       };

//       xhr.onerror = () => {
//         throw new Error('File upload failed. Please try again.');
//       };

//       xhr.send(formData);
//     } catch (error) {
//       toast.error(error.message);
//       setLoading(false);
//       setUploadProgress(0);
//     }
//   };

//   return (
//     <div className="space-y-6">
//       <div
//         className={`border-2 border-dashed rounded-lg p-6 text-center ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
//         onDragEnter={handleFileDrag}
//         onDragLeave={handleFileDrag}
//         onDragOver={handleFileDrag}
//         onDrop={handleFileDrop}
//       >
//         <div className="flex flex-col items-center justify-center space-y-2">
//           <FiUpload className="text-gray-400 text-2xl" />
//           <p className="text-s text-gray-600">
//             Drag and drop your Excel file here, or
//           </p>
//           <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded text-s font-medium transition">
//             Browse Files
//             <input
//               type="file"
//               className="hidden"
//               accept=".xlsx,.xls,.csv"
//               onChange={handleFileChange}
//             />
//           </label>
//           {file && (
//             <div className="mt-2 text-s text-gray-700">
//               Selected file: <span className="font-medium">{file.name}</span>
//               <button
//                 onClick={() => {
//                   setFile(null);
//                   setUploadedHeaders([]);
//                   setPreviewData([]);
//                   setMappings({});
//                   setUploadProgress(0);
//                 }}
//                 className="ml-2 text-red-500 hover:text-red-700"
//               >
//                 <FiX className="inline" />
//               </button>
//             </div>
//           )}
//         </div>
//       </div>

//       {uploadedHeaders.length > 0 && (
//         <div className="mt-6 relative" ref={containerRef}>
//           <h4 className="text-s font-medium text-gray-700 mb-3">Map Columns</h4>

//           <svg className="absolute w-full h-full top-0 left-0 pointer-events-none" style={{ zIndex: 1 }}>
//             {connections.map(conn => (
//               <path
//                 key={conn.id}
//                 d={conn.path}
//                 stroke="#3b82f6"
//                 strokeWidth="2"
//                 fill="none"
//               />
//             ))}
//           </svg>

//           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
//             <div className="flex justify-between items-start">
//               <div className="w-5/12 pr-4">
//                 <h5 className="text-x font-medium text-gray-500 uppercase tracking-wider mb-2">GL Account Fields</h5>
//                 <div className="space-y-2">
//                   {backendFields.map(field => (
//                     <div
//                       key={field.id}
//                       id={`backend-${field.id}`}
//                       draggable
//                       onDragStart={() => handleDragStart(field.id)}
//                       className={`p-3 border rounded-lg cursor-move flex justify-between items-center ${mappings[field.id]
//                           ? 'bg-blue-50 border-blue-200'
//                           : 'bg-white border-gray-200 hover:bg-gray-50'
//                         }`}
//                     >
//                       <span className="font-medium text-gray-700">
//                         {field.label}
//                         {field.required && <span className="text-red-500 ml-1">*</span>}
//                       </span>
//                       {mappings[field.id] && (
//                         <button
//                           onClick={() => removeMapping(field.id)}
//                           className="text-red-500 hover:text-red-700 p-1"
//                         >
//                           <FiX />
//                         </button>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               <div className="w-5/12 pl-4">
//                 <h5 className="text-x font-medium text-gray-500 uppercase tracking-wider mb-2">Excel Columns</h5>
//                 <div className="space-y-2">
//                   {uploadedHeaders.map(header => {
//                     const isMapped = Object.values(mappings).includes(header);
//                     return (
//                       <div
//                         key={header}
//                         id={`uploaded-${header}`}
//                         onDragOver={handleDragOver}
//                         onDrop={(e) => handleDrop(e, header)}
//                         className={`p-3 border rounded-lg ${isMapped
//                             ? 'bg-green-50 border-green-200'
//                             : 'bg-white border-gray-200 hover:bg-gray-50'
//                           } ${!isMapped && 'cursor-pointer'}`}
//                       >
//                         <span className="text-gray-700">{header}</span>
//                         {isMapped && (
//                           <div className="text-x text-green-600 mt-1">
//                             Mapped to: {backendFields.find(f => f.id === Object.keys(mappings).find(key => mappings[key] === header))?.label}
//                           </div>
//                         )}
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {uploadProgress > 0 && (
//         <div className="w-full bg-gray-200 rounded-full h-2.5">
//           <div
//             className="bg-blue-600 h-2.5 rounded-full"
//             style={{ width: `${uploadProgress}%` }}
//           ></div>
//         </div>
//       )}

//       {previewData.length > 0 && (
//         <div className="mt-6">
//           <h4 className="text-s font-medium text-gray-700 mb-3">Data Preview (Showing {Math.min(visibleRows, previewData.length)} of {previewData.length} rows)</h4>
//           <div
//             className="overflow-x-auto border border-gray-200 rounded"
//             style={{ maxHeight: '400px', overflowY: 'auto' }}
//             ref={previewTableRef}
//           >
//             <table className="min-w-full divide-y divide-gray-200">
//               <thead className="bg-gray-50 sticky top-0">
//                 <tr>
//                   {uploadedHeaders.map(header => (
//                     <th
//                       key={header}
//                       className="px-3 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider"
//                     >
//                       {header}
//                     </th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody className="bg-white divide-y divide-gray-200">
//                 {previewData.slice(0, visibleRows).map((row, rowIndex) => (
//                   <tr key={rowIndex}>
//                     {uploadedHeaders.map(header => (
//                       <td
//                         key={`${rowIndex}-${header}`}
//                         className="px-3 py-2 whitespace-nowrap text-s text-gray-500"
//                         onClick={() => handleCellEdit(rowIndex, header)}
//                       >
//                         {editingCell?.rowIndex === rowIndex && editingCell?.header === header ? (
//                           <input
//                             type="text"
//                             value={editedValue}
//                             onChange={(e) => setEditedValue(e.target.value)}
//                             onBlur={handleCellSave}
//                             onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
//                             autoFocus
//                             className="w-full p-1 border border-blue-300 rounded"
//                           />
//                         ) : (
//                           row[header] || '-'
//                         )}
//                       </td>
//                     ))}
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       )}

//       <div className="flex justify-end">
//         <button
//           onClick={handleUpload}
//           disabled={!file || loading}
//           className={`px-4 py-2 rounded-lg text-s font-medium transition-colors ${!file || loading
//               ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
//               : 'bg-blue-600 text-white hover:bg-blue-700'
//             }`}
//         >
//           {loading ? (
//             <span className="flex items-center">
//               <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
//                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//               </svg>
//               {uploadProgress > 0 ? `Uploading (${uploadProgress}%)` : 'Uploading...'}
//             </span>
//           ) : 'Upload GL Accounts'}
//         </button>
//       </div>
//     </div>
//   );
// };

// const GLCreateForm = ({ onCreateSuccess }) => {
//   const [glAccounts, setGlAccounts] = useState([
//     { glCode: '', accountName: '', category: '', tags: [] }
//   ]);
//   const [loading, setLoading] = useState(false);
//   const [tags, setTags] = useState([]);
//   const [tagsLoading, setTagsLoading] = useState(false);
//   const { token } = useContext(AuthContext);

//   useEffect(() => {
//     const fetchTags = async () => {
//       try {
//         setTagsLoading(true);
//         const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/tags`, {
//           headers: {
//             'Authorization': `Bearer ${token}`
//           }
//         });

//         if (!response.ok) {
//           throw new Error('Failed to fetch tags');
//         }

//         const data = await response.json();
//         setTags(data.map(tag => ({ value: tag.tag_name, label: tag.tag_name })));
//       } catch (error) {
//         toast.error(error.message);
//       } finally {
//         setTagsLoading(false);
//       }
//     };

//     fetchTags();
//   }, [token]);

//   const handleAddAccount = () => {
//     setGlAccounts([...glAccounts, { glCode: '', accountName: '', category: '', tags: [] }]);
//   };

//   const handleRemoveAccount = (index) => {
//     if (glAccounts.length <= 1) {
//       toast.error('You must have at least one GL account');
//       return;
//     }
//     const newAccounts = [...glAccounts];
//     newAccounts.splice(index, 1);
//     setGlAccounts(newAccounts);
//   };

//   const handleInputChange = (index, field, value) => {
//     const newAccounts = [...glAccounts];
//     newAccounts[index][field] = value;
//     setGlAccounts(newAccounts);
//   };

//   const handleTagChange = (index, selectedOptions) => {
//     const newAccounts = [...glAccounts];
//     newAccounts[index].tags = selectedOptions ? selectedOptions.map(option => option.value) : [];
//     setGlAccounts(newAccounts);
//   };

//   const handleCreateSingle = async (index) => {
//     const account = glAccounts[index];
//     if (!account.glCode || !account.accountName || !account.category) {
//       toast.error('Please fill all required fields');
//       return;
//     }

//     try {
//       setLoading(true);
//       const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-master`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//           data: [{
//             general_ledger_code: account.glCode,
//             account_name: account.accountName,
//             category: account.category,
//             tags: account.tags
//           }]
//         })
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.message || 'Failed to create GL account');
//       }

//       toast.success('GL account created successfully!');

//       const newAccounts = [...glAccounts];
//       newAccounts[index] = { glCode: '', accountName: '', category: '', tags: [] };
//       setGlAccounts(newAccounts);

//       if (onCreateSuccess) {
//         onCreateSuccess();
//       }
//     } catch (error) {
//       toast.error(error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleBulkCreate = async () => {
//     const accountsToCreate = glAccounts.filter(
//       account => account.glCode && account.accountName && account.category
//     );

//     if (accountsToCreate.length === 0) {
//       toast.error('No valid GL accounts to create');
//       return;
//     }

//     try {
//       setLoading(true);
//       const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-master`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//           data: accountsToCreate.map(account => ({
//             general_ledger_code: account.glCode,
//             account_name: account.accountName,
//             category: account.category,
//             tags: account.tags
//           }))
//         })
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.message || 'Failed to create GL accounts');
//       }

//       toast.success(`${accountsToCreate.length} GL accounts created successfully!`);
//       setGlAccounts([{ glCode: '', accountName: '', category: '', tags: [] }]);

//       if (onCreateSuccess) {
//         onCreateSuccess();
//       }
//     } catch (error) {
//       toast.error(error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="space-y-8">
//       <div className="border border-gray-200 rounded-lg overflow-hidden">
//         <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
//           <h3 className="text-s font-medium text-gray-700">Create GL 234567 Accounts Manually</h3>
//         </div>
//         <div className="p-4">
//           {glAccounts.map((account, index) => (
//             <div key={index} className="mb-6 last:mb-0 border-b border-gray-100 last:border-b-0 pb-6 last:pb-0">
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
//                 <div>
//                   <label className="block text-s font-medium text-gray-700 mb-1">GL Code*</label>
//                   <input
//                     type="text"
//                     value={account.glCode}
//                     onChange={(e) => handleInputChange(index, 'glCode', e.target.value)}
//                     className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
//                     placeholder="e.g., 1000"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-s font-medium text-gray-700 mb-1">Account Name*</label>
//                   <input
//                     type="text"
//                     value={account.accountName}
//                     onChange={(e) => handleInputChange(index, 'accountName', e.target.value)}
//                     className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
//                     placeholder="e.g., Cash Account"
//                   />
//                 </div>
//               </div>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
//                 <div>
//                   <label className="block text-s font-medium text-gray-700 mb-1">Category*</label>
//                   <input
//                     type="text"
//                     value={account.category}
//                     onChange={(e) => handleInputChange(index, 'category', e.target.value)}
//                     className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
//                     placeholder="e.g., Asset, Liability, etc."
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-s font-medium text-gray-700 mb-1">Tags</label>
//                   <Select
//                     isMulti
//                     options={tags}
//                     value={account.tags.map(tag => ({ value: tag, label: tag }))}
//                     onChange={(selected) => handleTagChange(index, selected)}
//                     isLoading={tagsLoading}
//                     className="basic-multi-select"
//                     classNamePrefix="select"
//                     placeholder="Select tags..."
//                     menuPortalTarget={document.body}
//                     styles={{
//                       menuPortal: (base) => ({ ...base, zIndex: 9999 }),
//                     }}
//                   />

//                   {tagsLoading && (
//                     <p className="text-x text-gray-500 mt-1">Loading tags...</p>
//                   )}
//                 </div>
//               </div>

//               <div className="flex justify-between items-center">
//                 <button
//                   onClick={() => handleRemoveAccount(index)}
//                   className="flex items-center text-red-600 hover:text-red-800 text-s"
//                 >
//                   <FiTrash2 className="mr-1" />
//                   Remove
//                 </button>
//                 <button
//                   onClick={() => handleCreateSingle(index)}
//                   disabled={!account.glCode || !account.accountName || !account.category || loading}
//                   className="px-3 py-1 bg-blue-600 text-white rounded text-s hover:bg-blue-700 disabled:opacity-50"
//                 >
//                   {loading ? 'Creating...' : 'Create This Account'}
//                 </button>
//               </div>
//             </div>
//           ))}

//           <div className="flex justify-between mt-4">
//             <button
//               onClick={handleAddAccount}
//               className="flex items-center text-blue-600 hover:text-blue-800 text-s"
//             >
//               <FiPlus className="mr-1" />
//               Add Another Account
//             </button>
//             <button
//               onClick={handleBulkCreate}
//               disabled={loading || !glAccounts.some(account => account.glCode && account.accountName && account.category)}
//               className="px-3 py-1 bg-green-600 text-white rounded text-s hover:bg-green-700 disabled:opacity-50"
//             >
//               {loading ? 'Creating All...' : 'Create All Accounts'}
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Excel upload section */}
//       <div className="border border-gray-200 rounded-lg overflow-hidden">
//         <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
//           <h3 className="text-s font-medium text-gray-700">Upload GL Accounts via Excel</h3>
//           <p className="text-x text-gray-500 mt-1">
//             Upload an Excel file with GL account data. Drag fields to map columns.
//           </p>
//         </div>
//         <div className="p-4">
//           <GLExcelUpload token={token} onUploadSuccess={onCreateSuccess} />
//         </div>
//       </div>
//     </div>
//   );
// };

// export default GLCreateForm;

























// =========================================================================================

//                                                 sep/2025

// =========================================================================================







// import React, { useState, useContext, useRef, useEffect } from 'react';
// import { FiUpload, FiPlus, FiTrash2, FiX, FiArrowRight } from 'react-icons/fi';
// import { toast } from 'react-toastify';
// import * as XLSX from 'xlsx';
// import { API_BASE_URL } from '../../../config/config';
// import { AuthContext } from '../../../context/AuthContext';
// import Select from 'react-select';

// const GLExcelUpload = ({ token, onUploadSuccess, endpoint, title, description, requiredFields }) => {
//   const [file, setFile] = useState(null);
//   const [uploadedHeaders, setUploadedHeaders] = useState([]);
//   const [previewData, setPreviewData] = useState([]);
//   const [mappings, setMappings] = useState({});
//   const [loading, setLoading] = useState(false);
//   const [dragActive, setDragActive] = useState(false);
//   const [draggingField, setDraggingField] = useState(null);
//   const [connections, setConnections] = useState([]);
//   const [uploadProgress, setUploadProgress] = useState(0);
//   const [visibleRows, setVisibleRows] = useState(30);
//   const [editingCell, setEditingCell] = useState(null);
//   const [editedValue, setEditedValue] = useState('');
//   const previewTableRef = useRef(null);
//   const containerRef = useRef(null);

//   useEffect(() => {
//     const table = previewTableRef.current;
//     if (!table) return;

//     const handleScroll = () => {
//       const { scrollTop, scrollHeight, clientHeight } = table;
//       if (scrollTop + clientHeight >= scrollHeight - 20) {
//         setVisibleRows(prev => Math.min(prev + 30, previewData.length));
//       }
//     };

//     table.addEventListener('scroll', handleScroll);
//     return () => table.removeEventListener('scroll', handleScroll);
//   }, [previewData]);

//   useEffect(() => {
//     if (!containerRef.current || !uploadedHeaders.length) return;
    
//     const calculateConnections = () => {
//       const newConnections = [];
//       Object.entries(mappings).forEach(([excelHeader, systemField]) => {
//         const sourceElem = document.getElementById(`backend-${systemField}`);
//         const targetElem = document.getElementById(`uploaded-${excelHeader}`);
        
//         if (sourceElem && targetElem) {
//           const containerRect = containerRef.current.getBoundingClientRect();
//           const sourceRect = sourceElem.getBoundingClientRect();
//           const targetRect = targetElem.getBoundingClientRect();
          
//           const sourceX = sourceRect.right - containerRect.left;
//           const sourceY = sourceRect.top + sourceRect.height/2 - containerRect.top;
//           const targetX = targetRect.left - containerRect.left;
//           const targetY = targetRect.top + targetRect.height/2 - containerRect.top;
          
//           newConnections.push({
//             id: `${systemField}-${excelHeader}`,
//             path: `M${sourceX},${sourceY} C${(sourceX + targetX)/2},${sourceY} ${(sourceX + targetX)/2},${targetY} ${targetX},${targetY}`,
//             systemField,
//             excelHeader
//           });
//         }
//       });
      
//       setConnections(newConnections);
//     };

//     const timer = setTimeout(calculateConnections, 100);
//     return () => clearTimeout(timer);
//   }, [mappings, uploadedHeaders]);

//   const handleDragStart = (fieldId) => {
//     setDraggingField(fieldId);
//   };

//   const handleDragOver = (e) => {
//     e.preventDefault();
//   };

//   const handleDrop = (e, excelHeader) => {
//     e.preventDefault();
//     if (draggingField) {
//       const updatedMappings = { ...mappings };
//       Object.entries(updatedMappings).forEach(([header, field]) => {
//         if (field === draggingField) {
//           delete updatedMappings[header];
//         }
//       });
      
//       updatedMappings[excelHeader] = draggingField;
//       setMappings(updatedMappings);
//     }
//     setDraggingField(null);
//   };

//   const removeMapping = (excelHeader) => {
//     const updatedMappings = { ...mappings };
//     delete updatedMappings[excelHeader];
//     setMappings(updatedMappings);
//   };

//   const handleFileDrag = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     if (e.type === 'dragenter' || e.type === 'dragover') {
//       setDragActive(true);
//     } else if (e.type === 'dragleave') {
//       setDragActive(false);
//     }
//   };

//   const handleFileDrop = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setDragActive(false);
//     if (e.dataTransfer.files && e.dataTransfer.files[0]) {
//       handleFile(e.dataTransfer.files[0]);
//     }
//   };

//   const handleFileChange = (e) => {
//     if (e.target.files && e.target.files[0]) {
//       handleFile(e.target.files[0]);
//     }
//   };

//   const handleFile = async (file) => {
//     const validExtensions = ['.xlsx', '.xls', '.csv'];
//     const fileExtension = file.name.split('.').pop().toLowerCase();
    
//     if (!validExtensions.includes(`.${fileExtension}`)) {
//       toast.error('Please upload a valid Excel file (XLSX, XLS, CSV)');
//       return;
//     }

//     setFile(file);
//     setMappings({});
//     setUploadProgress(0);
//     setVisibleRows(30);
    
//     try {
//       const { headers, previewData } = await readExcelFile(file);
//       setUploadedHeaders(headers);
//       setPreviewData(previewData);
      
//       const autoMappings = {};
//       headers.forEach(header => {
//         const lowerHeader = header.toLowerCase();
        
//         const matchedField = requiredFields.find(field => {
//           const isDirectMatch = lowerHeader === field.id.toLowerCase();
//           const matchesAlias = field.aliases?.some(alias => 
//             alias && lowerHeader === alias.toLowerCase()
//           );
//           return isDirectMatch || matchesAlias;
//         });
        
//         if (matchedField) {
//           autoMappings[header] = matchedField.id;
//         }
//       });
      
//       setMappings(autoMappings);
//     } catch (error) {
//       toast.error('Failed to read file. Please try again.');
//       console.error('Error reading file:', error);
//     }
//   };

//   const readExcelFile = (file) => {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();
      
//       reader.onload = (e) => {
//         try {
//           const data = new Uint8Array(e.target.result);
//           const workbook = XLSX.read(data, { type: 'array' });
//           const firstSheetName = workbook.SheetNames[0];
//           const worksheet = workbook.Sheets[firstSheetName];
          
//           const headers = [];
//           const range = XLSX.utils.decode_range(worksheet['!ref']);
//           for (let C = range.s.c; C <= range.e.c; ++C) {
//             const cellAddress = { c: C, r: range.s.r };
//             const cellRef = XLSX.utils.encode_cell(cellAddress);
//             const cell = worksheet[cellRef];
//             headers.push(cell ? cell.v : undefined);
//           }
          
//           const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
//           const previewData = jsonData.slice(1).map(row => {
//             const obj = {};
//             headers.forEach((header, idx) => {
//               obj[header] = row[idx];
//             });
//             return obj;
//           });

//           resolve({ headers: headers.filter(h => h), previewData });
//         } catch (error) {
//           reject(error);
//         }
//       };
      
//       reader.onerror = (error) => reject(error);
//       reader.readAsArrayBuffer(file);
//     });
//   };

//   const validateMappings = () => {
//     const errors = [];
//     const mappedFields = new Set(Object.values(mappings));

//     requiredFields.forEach(field => {
//       if (field.required && !mappedFields.has(field.id)) {
//         errors.push(`${field.label} is required`);
//       }
//     });

//     if (errors.length > 0) {
//       toast.error(`Missing required mappings: ${errors.join(', ')}`);
//       return false;
//     }

//     return true;
//   };

//   const handleCellEdit = (rowIndex, header) => {
//     setEditingCell({ rowIndex, header });
//     setEditedValue(previewData[rowIndex][header] || '');
//   };

//   const handleCellSave = () => {
//     if (editingCell) {
//       const newData = [...previewData];
//       newData[editingCell.rowIndex][editingCell.header] = editedValue;
//       setPreviewData(newData);
//       setEditingCell(null);
//     }
//   };

//   const handleUpload = async () => {
//   if (!file) {
//     toast.error('Please select a file first');
//     return;
//   }

//   if (!validateMappings()) return;

//   try {
//     setLoading(true);
//     setUploadProgress(0);
    
//     const formData = new FormData();
//     formData.append('file', file);
//     formData.append('column_mapping', JSON.stringify(mappings));

//     const xhr = new XMLHttpRequest();
//     xhr.open('POST', `${API_BASE_URL}${endpoint}`, true);
//     xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    
//     xhr.upload.onprogress = (event) => {
//       if (event.lengthComputable) {
//         const percentComplete = Math.round((event.loaded / event.total) * 100);
//         setUploadProgress(percentComplete);
//       }
//     };

//     xhr.onload = () => {
//       try {
//         if (xhr.status >= 200 && xhr.status < 300) {
//           let responseData;
//           try {
//             responseData = JSON.parse(xhr.responseText);
//           } catch (e) {
//             responseData = xhr.responseText;
//           }
          
//           toast.success('Upload completed successfully!');
//           setFile(null);
//           setUploadedHeaders([]);
//           setPreviewData([]);
//           setMappings({});
//           setUploadProgress(0);
          
//           if (onUploadSuccess) {
//             onUploadSuccess(responseData);
//           }
//         } else {
//           let errorData;
//           try {
//             errorData = JSON.parse(xhr.responseText);
//           } catch (e) {
//             errorData = xhr.responseText;
//           }
          
//           let errorMessage = 'Upload failed';
//           if (typeof errorData === 'object' && errorData !== null) {
//             if (errorData.detail) {
//               errorMessage = errorData.detail;
//             } else if (errorData.message) {
//               errorMessage = errorData.message;
//             } else if (errorData.non_field_errors) {
//               errorMessage = errorData.non_field_errors.join(', ');
//             } else {
//               const fieldErrors = Object.entries(errorData)
//                 .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
//                 .join('; ');
//               if (fieldErrors) {
//                 errorMessage = fieldErrors;
//               }
//             }
//           } else if (typeof errorData === 'string') {
//             errorMessage = errorData;
//           }
          
//           throw new Error(errorMessage);
//         }
//       } catch (error) {
//         console.error('Upload error:', error);
//         toast.error(`Upload failed: ${error.message}`);
//       } finally {
//         setLoading(false);
//       }
//     };

//     xhr.onerror = () => {
//       toast.error('Network error during file upload. Please try again.');
//       setLoading(false);
//       setUploadProgress(0);
//     };

//     xhr.send(formData);
//   } catch (error) {
//     console.error('Upload error:', error);
//     toast.error(error.message || 'An unexpected error occurred');
//     setLoading(false);
//     setUploadProgress(0);
//   }
// };

//   return (
//     <div className="space-y-6">
//       <div 
//         className={`border-2 border-dashed rounded-lg p-6 text-center ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
//         onDragEnter={handleFileDrag}
//         onDragLeave={handleFileDrag}
//         onDragOver={handleFileDrag}
//         onDrop={handleFileDrop}
//       >
//         <div className="flex flex-col items-center justify-center space-y-2">
//           <FiUpload className="text-gray-400 text-2xl" />
//           <p className="text-s text-gray-600">
//             Drag and drop your Excel file here, or
//           </p>
//           <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded text-s font-medium transition">
//             Browse Files
//             <input 
//               type="file" 
//               className="hidden" 
//               accept=".xlsx,.xls,.csv"
//               onChange={handleFileChange}
//             />
//           </label>
//           {file && (
//             <div className="mt-2 text-s text-gray-700">
//               Selected file: <span className="font-medium">{file.name}</span>
//               <button 
//                 onClick={() => {
//                   setFile(null);
//                   setUploadedHeaders([]);
//                   setPreviewData([]);
//                   setMappings({});
//                   setUploadProgress(0);
//                 }} 
//                 className="ml-2 text-red-500 hover:text-red-700"
//               >
//                 <FiX className="inline" />
//               </button>
//             </div>
//           )}
//         </div>
//       </div>

//       {uploadedHeaders.length > 0 && (
//         <div className="mt-6 relative" ref={containerRef}>
//           <h4 className="text-s font-medium text-gray-700 mb-3">Map Columns</h4>
          
//           <svg className="absolute w-full h-full top-0 left-0 pointer-events-none" style={{ zIndex: 1 }}>
//             {connections.map(conn => (
//               <path
//                 key={conn.id}
//                 d={conn.path}
//                 stroke="#3b82f6"
//                 strokeWidth="2"
//                 fill="none"
//               />
//             ))}
//           </svg>

//           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
//             <div className="flex justify-between items-start">
//               <div className="w-5/12 pr-4">
//                 <h5 className="text-x font-medium text-gray-500 uppercase tracking-wider mb-2">System Fields</h5>
//                 <div className="space-y-2">
//                   {requiredFields.map(field => (
//                     <div 
//                       key={field.id}
//                       id={`backend-${field.id}`}
//                       draggable
//                       onDragStart={() => handleDragStart(field.id)}
//                       className={`p-3 border rounded-lg cursor-move flex justify-between items-center ${
//                         Object.values(mappings).includes(field.id)
//                           ? 'bg-blue-50 border-blue-200' 
//                           : 'bg-white border-gray-200 hover:bg-gray-50'
//                       }`}
//                     >
//                       <span className="font-medium text-gray-700">
//                         {field.label}
//                         {field.required && <span className="text-red-500 ml-1">*</span>}
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//               </div>
              
//               <div className="w-5/12 pl-4">
//                 <h5 className="text-x font-medium text-gray-500 uppercase tracking-wider mb-2">Excel Columns</h5>
//                 <div className="space-y-2">
//                   {uploadedHeaders.map(header => {
//                     const systemField = mappings[header];
//                     return (
//                       <div
//                         key={header}
//                         id={`uploaded-${header}`}
//                         onDragOver={handleDragOver}
//                         onDrop={(e) => handleDrop(e, header)}
//                         className={`p-3 border rounded-lg ${
//                           systemField
//                             ? 'bg-green-50 border-green-200'
//                             : 'bg-white border-gray-200 hover:bg-gray-50'
//                         } ${!systemField && 'cursor-pointer'}`}
//                       >
//                         <div className="flex justify-between items-center">
//                           <span className="text-gray-700">{header}</span>
//                           {systemField && (
//                             <button 
//                               onClick={() => removeMapping(header)}
//                               className="text-red-500 hover:text-red-700 p-1"
//                             >
//                               <FiX />
//                             </button>
//                           )}
//                         </div>
//                         {systemField && (
//                           <div className="text-x text-green-600 mt-1">
//                             Mapped to: {requiredFields.find(f => f.id === systemField)?.label}
//                           </div>
//                         )}
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {uploadProgress > 0 && (
//         <div className="w-full bg-gray-200 rounded-full h-2.5">
//           <div 
//             className="bg-blue-600 h-2.5 rounded-full" 
//             style={{ width: `${uploadProgress}%` }}
//           ></div>
//         </div>
//       )}

//       {previewData.length > 0 && (
//         <div className="mt-6">
//           <h4 className="text-s font-medium text-gray-700 mb-3">Data Preview (Showing {Math.min(visibleRows, previewData.length)} of {previewData.length} rows)</h4>
//           <div 
//             className="overflow-x-auto border border-gray-200 rounded"
//             style={{ maxHeight: '400px', overflowY: 'auto' }}
//             ref={previewTableRef}
//           >
//             <table className="min-w-full divide-y divide-gray-200">
//               <thead className="bg-gray-50 sticky top-0">
//                 <tr>
//                   {uploadedHeaders.map(header => (
//                     <th 
//                       key={header} 
//                       className="px-3 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider"
//                     >
//                       {header}
//                     </th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody className="bg-white divide-y divide-gray-200">
//                 {previewData.slice(0, visibleRows).map((row, rowIndex) => (
//                   <tr key={rowIndex}>
//                     {uploadedHeaders.map(header => (
//                       <td 
//                         key={`${rowIndex}-${header}`} 
//                         className="px-3 py-2 whitespace-nowrap text-s text-gray-500"
//                         onClick={() => handleCellEdit(rowIndex, header)}
//                       >
//                         {editingCell?.rowIndex === rowIndex && editingCell?.header === header ? (
//                           <input
//                             type="text"
//                             value={editedValue}
//                             onChange={(e) => setEditedValue(e.target.value)}
//                             onBlur={handleCellSave}
//                             onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
//                             autoFocus
//                             className="w-full p-1 border border-blue-300 rounded"
//                           />
//                         ) : (
//                           row[header] || '-'
//                         )}
//                       </td>
//                     ))}
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       )}

//       <div className="flex justify-end">
//         <button
//           onClick={handleUpload}
//           disabled={!file || loading}
//           className={`px-4 py-2 rounded-lg text-s font-medium transition-colors ${
//             !file || loading
//               ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
//               : 'bg-blue-600 text-white hover:bg-blue-700'
//           }`}
//         >
//           {loading ? (
//             <span className="flex items-center">
//               <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
//                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//               </svg>
//               {uploadProgress > 0 ? `Uploading (${uploadProgress}%)` : 'Uploading...'}
//             </span>
//           ) : `Upload ${title}`}
//         </button>
//       </div>
//     </div>
//   );
// };

// const GLCreateForm = ({ onCreateSuccess }) => {
//   const { token } = useContext(AuthContext);

//   const glMasterFields = [
//     { id: 'general_ledger_code', label: 'general_ledger_code', required: true },
//     { id: 'account_name', label: 'account_name', required: true },
//     { id: 'category', label: 'category', required: true },
//     { id: 'tags', label: 'tags', required: false }
//   ];

//   const glTransactionFields = [
//     { id: 'date', label: 'Transaction Date', required: true, aliases: ['transaction_date'] },
//     { id: 'general_ledger_code', label: 'GL Code', required: true, aliases: ['gl_account_number'] },
//     { id: 'account_name', label: 'Account Name', required: true, aliases: ['gl_account_name'] },
//     { id: 'category', label: 'Category', required: false },
//     { id: 'amount', label: 'Amount', required: false, aliases: ['Final Amount'] },
//     { id: 'single_col_debit_credit', label: 'Debit/Credit Flag', required: false, aliases: ['debit_credit_flag', 'debit_credit_flagt'] }
//   ];

//   return (
//     <div className="space-y-8">
//       <div className="border border-gray-200 rounded-lg overflow-hidden">
//         <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
//           <h3 className="text-s font-medium text-gray-700">Upload GL Master Accounts</h3>
//           <p className="text-x text-gray-500 mt-1">
//             Upload an Excel file with GL master account data. Map columns to: Account ID, Account Name, Account Type, and Sub-Type.
//           </p>
//         </div>
//         <div className="p-4">
//           <GLExcelUpload 
//             token={token} 
//             onUploadSuccess={onCreateSuccess} 
//             endpoint="/api/v1/company/financial/gl-master"
//             title="GL Master Accounts"
//             requiredFields={glMasterFields}
//           />
//         </div>
//       </div>

//       <div className="border border-gray-200 rounded-lg overflow-hidden">
//         <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
//           <h3 className="text-s font-medium text-gray-700">Upload GL Transactions</h3>
//           <p className="text-x text-gray-500 mt-1">
//             Upload an Excel file with GL transaction data. Drag fields to map columns.
//           </p>
//         </div>
//         <div className="p-4">
//           <GLExcelUpload 
//             token={token} 
//             onUploadSuccess={onCreateSuccess} 
//             endpoint="/api/v1/company/financial/upload-gl/"
//             title="GL Transactions"
//             requiredFields={glTransactionFields}
//           />
//         </div>
//       </div>
//     </div>
//   );
// };

// export default GLCreateForm;















// ========================================================================
                              
                                  // june / 2025

// ===========================================================================





// import React, { useState, useContext, useRef, useEffect } from 'react';
// import { FiUpload, FiPlus, FiTrash2, FiX, FiArrowRight } from 'react-icons/fi';
// import { toast } from 'react-toastify';
// import * as XLSX from 'xlsx';
// import { API_BASE_URL } from '../../../config/config';
// import { AuthContext } from '../../../context/AuthContext';
// import Select from 'react-select';

// const GLExcelUpload = ({ token, onUploadSuccess }) => {
//   const [file, setFile] = useState(null);
//   const [uploadedHeaders, setUploadedHeaders] = useState([]);
//   const [previewData, setPreviewData] = useState([]);
//   const [mappings, setMappings] = useState({});
//   const [loading, setLoading] = useState(false);
//   const [dragActive, setDragActive] = useState(false);
//   const [draggingField, setDraggingField] = useState(null);
//   const [connections, setConnections] = useState([]);
//   const [uploadProgress, setUploadProgress] = useState(0);
//   const [visibleRows, setVisibleRows] = useState(30);
//   const [editingCell, setEditingCell] = useState(null);
//   const [editedValue, setEditedValue] = useState('');
//   const previewTableRef = useRef(null);
//   const containerRef = useRef(null);

//   const backendFields = [
//     { id: 'date', label: 'date', required: true },
//     { id: 'general_ledger_code', label: 'GL Code', required: true },
//     { id: 'account_name', label: 'Account Name', required: true },
//     { id: 'category', label: 'Category', required: false },
//     { id: 'amount', label: 'amount', required: false },
//     { id: 'single_col_debit_credit', label: 'single_col_debit_credit', required: false },
//   ];

//   useEffect(() => {
//     const table = previewTableRef.current;
//     if (!table) return;

//     const handleScroll = () => {
//       const { scrollTop, scrollHeight, clientHeight } = table;
//       if (scrollTop + clientHeight >= scrollHeight - 20) {
//         setVisibleRows(prev => Math.min(prev + 30, previewData.length));
//       }
//     };

//     table.addEventListener('scroll', handleScroll);
//     return () => table.removeEventListener('scroll', handleScroll);
//   }, [previewData]);

//   useEffect(() => {
//     if (!containerRef.current || !uploadedHeaders.length) return;

//     const calculateConnections = () => {
//       const newConnections = [];
//       backendFields.forEach(field => {
//         if (mappings[field.id]) {
//           const sourceElem = document.getElementById(`backend-${field.id}`);
//           const targetElem = document.getElementById(`uploaded-${mappings[field.id]}`);

//           if (sourceElem && targetElem) {
//             const containerRect = containerRef.current.getBoundingClientRect();
//             const sourceRect = sourceElem.getBoundingClientRect();
//             const targetRect = targetElem.getBoundingClientRect();

//             const sourceX = sourceRect.right - containerRect.left;
//             const sourceY = sourceRect.top + sourceRect.height / 2 - containerRect.top;
//             const targetX = targetRect.left - containerRect.left;
//             const targetY = targetRect.top + targetRect.height / 2 - containerRect.top;

//             newConnections.push({
//               id: `${field.id}-${mappings[field.id]}`,
//               path: `M${sourceX},${sourceY} C${(sourceX + targetX) / 2},${sourceY} ${(sourceX + targetX) / 2},${targetY} ${targetX},${targetY}`,
//               fieldId: field.id,
//               header: mappings[field.id]
//             });
//           }
//         }
//       });

//       setConnections(newConnections);
//     };

//     const timer = setTimeout(calculateConnections, 100);
//     return () => clearTimeout(timer);
//   }, [mappings, uploadedHeaders]);

//   const handleDragStart = (fieldId) => {
//     setDraggingField(fieldId);
//   };

//   const handleDragOver = (e) => {
//     e.preventDefault();
//   };

//   const handleDrop = (e, header) => {
//     e.preventDefault();
//     if (draggingField) {
//       const updatedMappings = { ...mappings };
//       Object.keys(updatedMappings).forEach(key => {
//         if (updatedMappings[key] === header) {
//           delete updatedMappings[key];
//         }
//       });

//       updatedMappings[draggingField] = header;
//       setMappings(updatedMappings);
//     }
//     setDraggingField(null);
//   };

//   const removeMapping = (fieldId) => {
//     const updatedMappings = { ...mappings };
//     delete updatedMappings[fieldId];
//     setMappings(updatedMappings);
//   };

//   const handleFileDrag = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     if (e.type === 'dragenter' || e.type === 'dragover') {
//       setDragActive(true);
//     } else if (e.type === 'dragleave') {
//       setDragActive(false);
//     }
//   };

//   const handleFileDrop = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setDragActive(false);
//     if (e.dataTransfer.files && e.dataTransfer.files[0]) {
//       handleFile(e.dataTransfer.files[0]);
//     }
//   };

//   const handleFileChange = (e) => {
//     if (e.target.files && e.target.files[0]) {
//       handleFile(e.target.files[0]);
//     }
//   };

//   const handleFile = async (file) => {
//     const validExtensions = ['.xlsx', '.xls', '.csv'];
//     const fileExtension = file.name.split('.').pop().toLowerCase();

//     if (!validExtensions.includes(`.${fileExtension}`)) {
//       toast.error('Please upload a valid Excel file (XLSX, XLS, CSV)');
//       return;
//     }

//     setFile(file);
//     setMappings({});
//     setUploadProgress(0);
//     setVisibleRows(30);

//     try {
//       const { headers, previewData } = await readExcelFile(file);
//       setUploadedHeaders(headers);
//       setPreviewData(previewData);

//       const autoMappings = {};
//       headers.forEach(header => {
//         const lowerHeader = header.toLowerCase();

//         if (lowerHeader.includes('gl') && lowerHeader.includes('code')) {
//           autoMappings.general_ledger_code = header;
//         } else if (lowerHeader.includes('account') && lowerHeader.includes('name')) {
//           autoMappings.account_name = header;
//         } else if (lowerHeader.includes('category')) {
//           autoMappings.category = header;
//         } else if (lowerHeader.includes('tag')) {
//           autoMappings.tags = header;
//         }
//       });

//       setMappings(autoMappings);
//     } catch (error) {
//       toast.error('Failed to read file. Please try again.');
//       console.error('Error reading file:', error);
//     }
//   };

//   const readExcelFile = (file) => {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();

//       reader.onload = (e) => {
//         try {
//           const data = new Uint8Array(e.target.result);
//           const workbook = XLSX.read(data, { type: 'array' });
//           const firstSheetName = workbook.SheetNames[0];
//           const worksheet = workbook.Sheets[firstSheetName];

//           const headers = [];
//           const range = XLSX.utils.decode_range(worksheet['!ref']);
//           for (let C = range.s.c; C <= range.e.c; ++C) {
//             const cellAddress = { c: C, r: range.s.r };
//             const cellRef = XLSX.utils.encode_cell(cellAddress);
//             const cell = worksheet[cellRef];
//             headers.push(cell ? cell.v : undefined);
//           }

//           const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
//           const previewData = jsonData.slice(1).map(row => {
//             const obj = {};
//             headers.forEach((header, idx) => {
//               obj[header] = row[idx];
//             });
//             return obj;
//           });

//           resolve({ headers: headers.filter(h => h), previewData });
//         } catch (error) {
//           reject(error);
//         }
//       };

//       reader.onerror = (error) => reject(error);
//       reader.readAsArrayBuffer(file);
//     });
//   };

//   const validateMappings = () => {
//     const errors = [];
//     backendFields.forEach(field => {
//       if (field.required && !mappings[field.id]) {
//         errors.push(`${field.label} is required`);
//       }
//     });

//     if (errors.length > 0) {
//       toast.error(`Missing required mappings: ${errors.join(', ')}`);
//       return false;
//     }

//     return true;
//   };

//   const handleCellEdit = (rowIndex, header) => {
//     setEditingCell({ rowIndex, header });
//     setEditedValue(previewData[rowIndex][header] || '');
//   };

//   const handleCellSave = () => {
//     if (editingCell) {
//       const newData = [...previewData];
//       newData[editingCell.rowIndex][editingCell.header] = editedValue;
//       setPreviewData(newData);
//       setEditingCell(null);
//     }
//   };

//   const handleUpload = async () => {
//     if (!file) {
//       toast.error('Please select a file first');
//       return;
//     }

//     if (!validateMappings()) return;

//     try {
//       setLoading(true);
//       setUploadProgress(0);

//       const formData = new FormData();
//       formData.append('file', file);
//       formData.append('column_mapping', JSON.stringify(mappings));

//       const editedData = previewData.map(row => {
//         const editedRow = {};
//         Object.keys(row).forEach(key => {
//           editedRow[key] = row[key];
//         });
//         return editedRow;
//       });
//       formData.append('edited_data', JSON.stringify(editedData));

//       const xhr = new XMLHttpRequest();
//       xhr.open('POST', `${API_BASE_URL}/api/v1/company/financial/upload-gl/`, true);
//       xhr.setRequestHeader('Authorization', `Bearer ${token}`);

//       xhr.upload.onprogress = (event) => {
//         if (event.lengthComputable) {
//           const percentComplete = Math.round((event.loaded / event.total) * 100);
//           setUploadProgress(percentComplete);
//         }
//       };

//       xhr.onload = () => {
//         if (xhr.status >= 200 && xhr.status < 300) {
//           const responseData = JSON.parse(xhr.responseText);
//           toast.success('GL accounts uploaded successfully!');
//           setFile(null);
//           setUploadedHeaders([]);
//           setPreviewData([]);
//           setMappings({});
//           setUploadProgress(0);

//           if (onUploadSuccess) {
//             onUploadSuccess(responseData);
//           }
//         } else {
//           const errorData = JSON.parse(xhr.responseText);
//           throw new Error(errorData.detail || 'Failed to upload GL accounts');
//         }
//         setLoading(false);
//       };

//       xhr.onerror = () => {
//         throw new Error('File upload failed. Please try again.');
//       };

//       xhr.send(formData);
//     } catch (error) {
//       toast.error(error.message);
//       setLoading(false);
//       setUploadProgress(0);
//     }
//   };

//   return (
//     <div className="space-y-6">
//       <div
//         className={`border-2 border-dashed rounded-lg p-6 text-center ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
//         onDragEnter={handleFileDrag}
//         onDragLeave={handleFileDrag}
//         onDragOver={handleFileDrag}
//         onDrop={handleFileDrop}
//       >
//         <div className="flex flex-col items-center justify-center space-y-2">
//           <FiUpload className="text-gray-400 text-2xl" />
//           <p className="text-s text-gray-600">
//             Drag and drop your Excel file here, or
//           </p>
//           <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded text-s font-medium transition">
//             Browse Files
//             <input
//               type="file"
//               className="hidden"
//               accept=".xlsx,.xls,.csv"
//               onChange={handleFileChange}
//             />
//           </label>
//           {file && (
//             <div className="mt-2 text-s text-gray-700">
//               Selected file: <span className="font-medium">{file.name}</span>
//               <button
//                 onClick={() => {
//                   setFile(null);
//                   setUploadedHeaders([]);
//                   setPreviewData([]);
//                   setMappings({});
//                   setUploadProgress(0);
//                 }}
//                 className="ml-2 text-red-500 hover:text-red-700"
//               >
//                 <FiX className="inline" />
//               </button>
//             </div>
//           )}
//         </div>
//       </div>

//       {uploadedHeaders.length > 0 && (
//         <div className="mt-6 relative" ref={containerRef}>
//           <h4 className="text-s font-medium text-gray-700 mb-3">Map Columns</h4>

//           <svg className="absolute w-full h-full top-0 left-0 pointer-events-none" style={{ zIndex: 1 }}>
//             {connections.map(conn => (
//               <path
//                 key={conn.id}
//                 d={conn.path}
//                 stroke="#3b82f6"
//                 strokeWidth="2"
//                 fill="none"
//               />
//             ))}
//           </svg>

//           <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
//             <div className="flex justify-between items-start">
//               <div className="w-5/12 pr-4">
//                 <h5 className="text-x font-medium text-gray-500 uppercase tracking-wider mb-2">GL Account Fields</h5>
//                 <div className="space-y-2">
//                   {backendFields.map(field => (
//                     <div
//                       key={field.id}
//                       id={`backend-${field.id}`}
//                       draggable
//                       onDragStart={() => handleDragStart(field.id)}
//                       className={`p-3 border rounded-lg cursor-move flex justify-between items-center ${mappings[field.id]
//                           ? 'bg-blue-50 border-blue-200'
//                           : 'bg-white border-gray-200 hover:bg-gray-50'
//                         }`}
//                     >
//                       <span className="font-medium text-gray-700">
//                         {field.label}
//                         {field.required && <span className="text-red-500 ml-1">*</span>}
//                       </span>
//                       {mappings[field.id] && (
//                         <button
//                           onClick={() => removeMapping(field.id)}
//                           className="text-red-500 hover:text-red-700 p-1"
//                         >
//                           <FiX />
//                         </button>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               <div className="w-5/12 pl-4">
//                 <h5 className="text-x font-medium text-gray-500 uppercase tracking-wider mb-2">Excel Columns</h5>
//                 <div className="space-y-2">
//                   {uploadedHeaders.map(header => {
//                     const isMapped = Object.values(mappings).includes(header);
//                     return (
//                       <div
//                         key={header}
//                         id={`uploaded-${header}`}
//                         onDragOver={handleDragOver}
//                         onDrop={(e) => handleDrop(e, header)}
//                         className={`p-3 border rounded-lg ${isMapped
//                             ? 'bg-green-50 border-green-200'
//                             : 'bg-white border-gray-200 hover:bg-gray-50'
//                           } ${!isMapped && 'cursor-pointer'}`}
//                       >
//                         <span className="text-gray-700">{header}</span>
//                         {isMapped && (
//                           <div className="text-x text-green-600 mt-1">
//                             Mapped to: {backendFields.find(f => f.id === Object.keys(mappings).find(key => mappings[key] === header))?.label}
//                           </div>
//                         )}
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {uploadProgress > 0 && (
//         <div className="w-full bg-gray-200 rounded-full h-2.5">
//           <div
//             className="bg-blue-600 h-2.5 rounded-full"
//             style={{ width: `${uploadProgress}%` }}
//           ></div>
//         </div>
//       )}

//       {previewData.length > 0 && (
//         <div className="mt-6">
//           <h4 className="text-s font-medium text-gray-700 mb-3">Data Preview (Showing {Math.min(visibleRows, previewData.length)} of {previewData.length} rows)</h4>
//           <div
//             className="overflow-x-auto border border-gray-200 rounded"
//             style={{ maxHeight: '400px', overflowY: 'auto' }}
//             ref={previewTableRef}
//           >
//             <table className="min-w-full divide-y divide-gray-200">
//               <thead className="bg-gray-50 sticky top-0">
//                 <tr>
//                   {uploadedHeaders.map(header => (
//                     <th
//                       key={header}
//                       className="px-3 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider"
//                     >
//                       {header}
//                     </th>
//                   ))}
//                 </tr>
//               </thead>
//               <tbody className="bg-white divide-y divide-gray-200">
//                 {previewData.slice(0, visibleRows).map((row, rowIndex) => (
//                   <tr key={rowIndex}>
//                     {uploadedHeaders.map(header => (
//                       <td
//                         key={`${rowIndex}-${header}`}
//                         className="px-3 py-2 whitespace-nowrap text-s text-gray-500"
//                         onClick={() => handleCellEdit(rowIndex, header)}
//                       >
//                         {editingCell?.rowIndex === rowIndex && editingCell?.header === header ? (
//                           <input
//                             type="text"
//                             value={editedValue}
//                             onChange={(e) => setEditedValue(e.target.value)}
//                             onBlur={handleCellSave}
//                             onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
//                             autoFocus
//                             className="w-full p-1 border border-blue-300 rounded"
//                           />
//                         ) : (
//                           row[header] || '-'
//                         )}
//                       </td>
//                     ))}
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       )}

//       <div className="flex justify-end">
//         <button
//           onClick={handleUpload}
//           disabled={!file || loading}
//           className={`px-4 py-2 rounded-lg text-s font-medium transition-colors ${!file || loading
//               ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
//               : 'bg-blue-600 text-white hover:bg-blue-700'
//             }`}
//         >
//           {loading ? (
//             <span className="flex items-center">
//               <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
//                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
//                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
//               </svg>
//               {uploadProgress > 0 ? `Uploading (${uploadProgress}%)` : 'Uploading...'}
//             </span>
//           ) : 'Upload GL Accounts'}
//         </button>
//       </div>
//     </div>
//   );
// };

// const GLCreateForm = ({ onCreateSuccess }) => {
//   const [glAccounts, setGlAccounts] = useState([
//     { glCode: '', accountName: '', category: '', tags: [] }
//   ]);
//   const [loading, setLoading] = useState(false);
//   const [tags, setTags] = useState([]);
//   const [tagsLoading, setTagsLoading] = useState(false);
//   const { token } = useContext(AuthContext);

//   useEffect(() => {
//     const fetchTags = async () => {
//       try {
//         setTagsLoading(true);
//         const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/tags`, {
//           headers: {
//             'Authorization': `Bearer ${token}`
//           }
//         });

//         if (!response.ok) {
//           throw new Error('Failed to fetch tags');
//         }

//         const data = await response.json();
//         setTags(data.map(tag => ({ value: tag.tag_name, label: tag.tag_name })));
//       } catch (error) {
//         toast.error(error.message);
//       } finally {
//         setTagsLoading(false);
//       }
//     };

//     fetchTags();
//   }, [token]);

//   const handleAddAccount = () => {
//     setGlAccounts([...glAccounts, { glCode: '', accountName: '', category: '', tags: [] }]);
//   };

//   const handleRemoveAccount = (index) => {
//     if (glAccounts.length <= 1) {
//       toast.error('You must have at least one GL account');
//       return;
//     }
//     const newAccounts = [...glAccounts];
//     newAccounts.splice(index, 1);
//     setGlAccounts(newAccounts);
//   };

//   const handleInputChange = (index, field, value) => {
//     const newAccounts = [...glAccounts];
//     newAccounts[index][field] = value;
//     setGlAccounts(newAccounts);
//   };

//   const handleTagChange = (index, selectedOptions) => {
//     const newAccounts = [...glAccounts];
//     newAccounts[index].tags = selectedOptions ? selectedOptions.map(option => option.value) : [];
//     setGlAccounts(newAccounts);
//   };

//   const handleCreateSingle = async (index) => {
//     const account = glAccounts[index];
//     if (!account.glCode || !account.accountName || !account.category) {
//       toast.error('Please fill all required fields');
//       return;
//     }

//     try {
//       setLoading(true);
//       const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-master`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//           data: [{
//             general_ledger_code: account.glCode,
//             account_name: account.accountName,
//             category: account.category,
//             tags: account.tags
//           }]
//         })
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.message || 'Failed to create GL account');
//       }

//       toast.success('GL account created successfully!');

//       const newAccounts = [...glAccounts];
//       newAccounts[index] = { glCode: '', accountName: '', category: '', tags: [] };
//       setGlAccounts(newAccounts);

//       if (onCreateSuccess) {
//         onCreateSuccess();
//       }
//     } catch (error) {
//       toast.error(error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleBulkCreate = async () => {
//     const accountsToCreate = glAccounts.filter(
//       account => account.glCode && account.accountName && account.category
//     );

//     if (accountsToCreate.length === 0) {
//       toast.error('No valid GL accounts to create');
//       return;
//     }

//     try {
//       setLoading(true);
//       const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-master`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//           data: accountsToCreate.map(account => ({
//             general_ledger_code: account.glCode,
//             account_name: account.accountName,
//             category: account.category,
//             tags: account.tags
//           }))
//         })
//       });

//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(errorData.message || 'Failed to create GL accounts');
//       }

//       toast.success(`${accountsToCreate.length} GL accounts created successfully!`);
//       setGlAccounts([{ glCode: '', accountName: '', category: '', tags: [] }]);

//       if (onCreateSuccess) {
//         onCreateSuccess();
//       }
//     } catch (error) {
//       toast.error(error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="space-y-8">
//       <div className="border border-gray-200 rounded-lg overflow-hidden">
//         <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
//           <h3 className="text-s font-medium text-gray-700">Create GL 234567 Accounts Manually</h3>
//         </div>
//         <div className="p-4">
//           {glAccounts.map((account, index) => (
//             <div key={index} className="mb-6 last:mb-0 border-b border-gray-100 last:border-b-0 pb-6 last:pb-0">
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
//                 <div>
//                   <label className="block text-s font-medium text-gray-700 mb-1">GL Code*</label>
//                   <input
//                     type="text"
//                     value={account.glCode}
//                     onChange={(e) => handleInputChange(index, 'glCode', e.target.value)}
//                     className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
//                     placeholder="e.g., 1000"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-s font-medium text-gray-700 mb-1">Account Name*</label>
//                   <input
//                     type="text"
//                     value={account.accountName}
//                     onChange={(e) => handleInputChange(index, 'accountName', e.target.value)}
//                     className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
//                     placeholder="e.g., Cash Account"
//                   />
//                 </div>
//               </div>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
//                 <div>
//                   <label className="block text-s font-medium text-gray-700 mb-1">Category*</label>
//                   <input
//                     type="text"
//                     value={account.category}
//                     onChange={(e) => handleInputChange(index, 'category', e.target.value)}
//                     className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
//                     placeholder="e.g., Asset, Liability, etc."
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-s font-medium text-gray-700 mb-1">Tags</label>
//                   <Select
//                     isMulti
//                     options={tags}
//                     value={account.tags.map(tag => ({ value: tag, label: tag }))}
//                     onChange={(selected) => handleTagChange(index, selected)}
//                     isLoading={tagsLoading}
//                     className="basic-multi-select"
//                     classNamePrefix="select"
//                     placeholder="Select tags..."
//                     menuPortalTarget={document.body}
//                     styles={{
//                       menuPortal: (base) => ({ ...base, zIndex: 9999 }),
//                     }}
//                   />

//                   {tagsLoading && (
//                     <p className="text-x text-gray-500 mt-1">Loading tags...</p>
//                   )}
//                 </div>
//               </div>

//               <div className="flex justify-between items-center">
//                 <button
//                   onClick={() => handleRemoveAccount(index)}
//                   className="flex items-center text-red-600 hover:text-red-800 text-s"
//                 >
//                   <FiTrash2 className="mr-1" />
//                   Remove
//                 </button>
//                 <button
//                   onClick={() => handleCreateSingle(index)}
//                   disabled={!account.glCode || !account.accountName || !account.category || loading}
//                   className="px-3 py-1 bg-blue-600 text-white rounded text-s hover:bg-blue-700 disabled:opacity-50"
//                 >
//                   {loading ? 'Creating...' : 'Create This Account'}
//                 </button>
//               </div>
//             </div>
//           ))}

//           <div className="flex justify-between mt-4">
//             <button
//               onClick={handleAddAccount}
//               className="flex items-center text-blue-600 hover:text-blue-800 text-s"
//             >
//               <FiPlus className="mr-1" />
//               Add Another Account
//             </button>
//             <button
//               onClick={handleBulkCreate}
//               disabled={loading || !glAccounts.some(account => account.glCode && account.accountName && account.category)}
//               className="px-3 py-1 bg-green-600 text-white rounded text-s hover:bg-green-700 disabled:opacity-50"
//             >
//               {loading ? 'Creating All...' : 'Create All Accounts'}
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Excel upload section */}
//       <div className="border border-gray-200 rounded-lg overflow-hidden">
//         <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
//           <h3 className="text-s font-medium text-gray-700">Upload GL Accounts via Excel</h3>
//           <p className="text-x text-gray-500 mt-1">
//             Upload an Excel file with GL account data. Drag fields to map columns.
//           </p>
//         </div>
//         <div className="p-4">
//           <GLExcelUpload token={token} onUploadSuccess={onCreateSuccess} />
//         </div>
//       </div>
//     </div>
//   );
// };

// export default GLCreateForm;









