// 📌 UploadHRFile.jsx
import React, { useState, useContext } from "react";
import { FiUpload, FiFileText, FiCheckCircle } from "react-icons/fi";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { API_BASE_URL } from "../../../config/config";
import { AuthContext } from "../../../context/AuthContext";

// 📁 HR File Configs
const HR_FILE_CONFIGS = [
  { key: "employees", label: "Employees", endpoint: "/api/v1/company/hr/employees" },
  { key: "compensation", label: "Compensation", endpoint: "/api/v1/company/hr/compensation" },
  { key: "headcount_history", label: "Headcount History", endpoint: "/api/v1/company/hr/headcount-history" },
  { key: "recruitment_pipeline", label: "Recruitment Pipeline", endpoint: "/api/v1/company/hr/recruitment" },
  { key: "departments_lookup", label: "Departments Lookup", endpoint: "/api/v1/company/hr/departments-lookup" },
  { key: "cost_centers_lookup", label: "Cost Centers Lookup", endpoint: "/api/v1/company/hr/cost-centers-lookup" },
];

// 🔍 Excel Reader
const readExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: "binary" });
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
    reader.readAsBinaryString(file);
  });
};

// 🎯 Upload Card Component
const HRFileUploadCard = ({ label, endpoint, token }) => {
  const [file, setFile] = useState(null);

  const handleFile = async (file) => {
    const allowed = [".xlsx", ".xls", ".csv"];
    if (!allowed.includes("." + file.name.split(".").pop())) {
      toast.error("Please upload a valid Excel or CSV file");
      return;
    }

    try {
      await readExcelFile(file);
      setFile(file);
      toast.success(`Loaded: ${file.name}`);
    } catch {
      toast.error("Invalid file!");
      setFile(null);
    }
  };

  const handleUpload = () => {
    if (!file) return toast.error("Please select a file first!");

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${endpoint}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success(
          <span className="flex items-center">
            <FiCheckCircle className="mr-2" /> Uploaded Successfully!
          </span>
        );
      } else {
        toast.error("Upload failed!");
      }
    };

    xhr.send(formData);
  };

  return (
    <div className="bg-white shadow-md border border-sky-100 hover:border-sky-300 p-5 rounded-xl flex flex-col">
      <h3 className="text-sky-700 font-medium mb-3 flex items-center">
        <FiFileText className="mr-2 text-sky-500" /> {label}
      </h3>

      <label className="group block border border-sky-200 hover:border-sky-400 p-6 rounded-xl text-center cursor-pointer">
        <FiUpload className="text-4xl mx-auto text-sky-400 group-hover:text-sky-600" />
        <p className="text-sky-600 mt-2">
          {file ? file.name : "Click to upload Excel file"}
        </p>
        <input
          type="file"
          hidden
          accept=".xlsx,.xls,.csv"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>

      <button
        onClick={handleUpload}
        disabled={!file}
        className={`mt-5 py-2 rounded-lg text-white transition ${
          file ? "bg-sky-600 hover:bg-sky-700" : "bg-sky-300 cursor-not-allowed"
        }`}
      >
        Upload File
      </button>
    </div>
  );
};

// 🗂 Main Page
const UploadHRFile = () => {
  const { token } = useContext(AuthContext);

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* <h1 className="text-3xl font-bold text-sky-800">HR Data Upload</h1>
      <p className="text-sky-600 mb-8">Upload HR Excel/CSV data files.</p> */}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {HR_FILE_CONFIGS.map(({ key, label, endpoint }) => (
          <HRFileUploadCard
            key={key}
            label={label}
            endpoint={endpoint}
            token={token}
          />
        ))}
      </div>
    </div>
  );
};

export default UploadHRFile;




















// import React, { useState, useCallback, useRef, useEffect } from 'react';
// import { FiUpload, FiX, FiCheckCircle, FiChevronLeft, FiChevronRight, FiMove, FiLoader } from 'react-icons/fi';
// import { toast } from 'react-toastify';
// import * as XLSX from 'xlsx';
// import { uploadHRData } from './hrApiService';

// const UploadHRFile = ({ token }) => {
//   const containerRef = useRef(null);
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [previewData, setPreviewData] = useState([]);
//   const [headers, setHeaders] = useState([]);
//   const [currentPage, setCurrentPage] = useState(0);
//   const [isDraggingFile, setIsDraggingFile] = useState(false);
//   const [draggingField, setDraggingField] = useState(null);
//   const [columnMappings, setColumnMappings] = useState({});
//   const [connections, setConnections] = useState([]);
//   const [isUploading, setIsUploading] = useState(false);
//   const [uploadProgress, setUploadProgress] = useState(0);

//   const systemFields = [
//     { id: 'employee_id', label: 'Employee ID', required: true },
//     { id: 'name', label: 'Name', required: true },
//     { id: 'email', label: 'Email', required: false },
//     { id: 'job_title', label: 'Job Title', required: false },
//     { id: 'department', label: 'Department', required: false },
//     { id: 'start_date', label: 'Start Date', required: false },
//     { id: 'termination_date', label: 'Termination Date', required: false },
//     { id: 'base_salary', label: 'Base Salary', required: false },
//     { id: 'bonus', label: 'Bonus', required: false },
//     { id: 'status', label: 'Status', required: false },
//     { id: 'location', label: 'Location', required: false },
//   ];

//   const parseFile = (file) => {
//     const reader = new FileReader();
    
//     reader.onload = (e) => {
//       try {
//         const data = new Uint8Array(e.target.result);
//         const workbook = XLSX.read(data, { type: 'array' });
//         const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
//         const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
//         if (jsonData.length > 0) {
//           setHeaders(jsonData[0]);
//           setPreviewData(jsonData.slice(1));
//           initializeMappings(jsonData[0]);
          
//           toast.warning(
//             <div className="flex items-start">
//               <FiCheckCircle className="text-amber-500 text-xl mr-2 mt-0.5 flex-shrink-0" />
//               <div>
//                 <p className="font-medium">Map your columns</p>
//                 <p className="text-s">Drag system fields to Excel columns to complete mapping</p>
//               </div>
//             </div>,
//             { autoClose: 8000 }
//           );
//         }
//       } catch (error) {
//         toast.error('Error parsing file: ' + error.message);
//       }
//     };
    
//     reader.readAsArrayBuffer(file);
//   };

//   const initializeMappings = (fileHeaders) => {
//     const initialMappings = {};
//     fileHeaders.forEach(header => {
//       initialMappings[header] = '';
//     });
//     setColumnMappings(initialMappings);
//   };

//   const handleFileDrop = useCallback((e) => {
//     e.preventDefault();
//     setIsDraggingFile(false);
//     const file = e.dataTransfer.files[0];
//     if (file) validateAndSetFile(file);
//   }, []);

//   const handleFileChange = (e) => {
//     const file = e.target.files[0];
//     if (file) validateAndSetFile(file);
//   };

//   const validateAndSetFile = (file) => {
//     const validTypes = [
//       'text/csv',
//       'application/vnd.ms-excel',
//       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
//     ];
    
//     if (!validTypes.includes(file.type)) {
//       toast.error('Please upload a CSV or Excel file');
//       return;
//     }

//     setSelectedFile(file);
    
//     toast.success(
//       <div className="flex items-start">
//         <FiCheckCircle className="text-green-500 text-xl mr-2 mt-0.5 flex-shrink-0" />
//         <div>
//           <p className="font-medium">File selected</p>
//           <p className="text-s">{file.name}</p>
//         </div>
//       </div>,
//       { autoClose: 3000 }
//     );
    
//     parseFile(file);
//   };

//   const handleDragStart = (fieldId) => {
//     setDraggingField(fieldId);
//   };

//   const handleDragOver = (e) => {
//     e.preventDefault();
//   };

//   const handleDrop = (e, header) => {
//     e.preventDefault();
//     if (draggingField) {
//       setColumnMappings(prev => {
//         const updated = { ...prev };
//         Object.keys(updated).forEach(key => {
//           if (updated[key] === draggingField) {
//             updated[key] = '';
//           }
//         });
//         updated[header] = draggingField;
//         return updated;
//       });
//     }
//     setDraggingField(null);
//   };

//   const removeMapping = (header) => {
//     setColumnMappings(prev => ({
//       ...prev,
//       [header]: ''
//     }));
//   };

//   const calculateConnections = useCallback(() => {
//     if (!containerRef.current) return;

//     const newConnections = [];
//     const containerRect = containerRef.current.getBoundingClientRect();

//     headers.forEach(header => {
//       const systemFieldId = columnMappings[header];
//       if (systemFieldId) {
//         const sourceEl = document.getElementById(`excel-${header}`);
//         const targetEl = document.getElementById(`system-${systemFieldId}`);

//         if (sourceEl && targetEl) {
//           const sourceRect = sourceEl.getBoundingClientRect();
//           const targetRect = targetEl.getBoundingClientRect();

//           const sourceX = sourceRect.right - containerRect.left;
//           const sourceY = sourceRect.top + sourceRect.height / 2 - containerRect.top;
//           const targetX = targetRect.left - containerRect.left;
//           const targetY = targetRect.top + targetRect.height / 2 - containerRect.top;

//           const controlX1 = sourceX + Math.abs(targetX - sourceX) * 0.5;
//           const controlX2 = targetX - Math.abs(targetX - sourceX) * 0.5;
          
//           const path = `M${sourceX},${sourceY} C${controlX1},${sourceY} ${controlX2},${targetY} ${targetX},${targetY}`;

//           newConnections.push({
//             id: `${header}-${systemFieldId}`,
//             path,
//             header,
//             systemFieldId
//           });
//         }
//       }
//     });

//     setConnections(newConnections);
//   }, [headers, columnMappings]);

//   useEffect(() => {
//     calculateConnections();
//     window.addEventListener('resize', calculateConnections);
//     return () => window.removeEventListener('resize', calculateConnections);
//   }, [calculateConnections]);

//   const pageSize = 20;
//   const totalPages = Math.ceil(previewData.length / pageSize);
//   const paginatedData = previewData.slice(
//     currentPage * pageSize,
//     (currentPage + 1) * pageSize
//   );

//   const handleUpload = async () => {
//     if (!selectedFile) {
//       toast.error('Please select a file first');
//       return;
//     }

//     const requiredFields = systemFields
//       .filter(field => field.required)
//       .map(field => field.id);
    
//     const missingFields = requiredFields.filter(
//       field => !Object.values(columnMappings).includes(field)
//     );

//     if (missingFields.length > 0) {
//       toast.error(`Missing required field mappings: ${missingFields.join(', ')}`);
//       return;
//     }

//     setIsUploading(true);
//     setUploadProgress(0);

//     try {
//       const progressCallback = (progress) => {
//         setUploadProgress(Math.round(progress * 100));
//       };

//       await uploadHRData(token, selectedFile, columnMappings, progressCallback);
      
//       toast.success(
//         <div className="flex items-start">
//           <FiCheckCircle className="text-green-500 text-xl mr-2 mt-0.5 flex-shrink-0" />
//           <div>
//             <p className="font-medium">Upload successful!</p>
//             <p className="text-s">{selectedFile.name} has been processed</p>
//           </div>
//         </div>,
//         { autoClose: 5000 }
//       );
      
//       setSelectedFile(null);
//       setPreviewData([]);
//       setHeaders([]);
//       setColumnMappings({});
//     } catch (error) {
//       console.error('Upload error:', error);
//       toast.error(`Upload failed: ${error.message}`);
//     } finally {
//       setUploadProgress(100);
//       setTimeout(() => {
//         setIsUploading(false);
//         setUploadProgress(0);
//       }, 500);
//     }
//   };

//   return (
//     <div className="space-y-6 relative">
//       {isUploading && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
//             <FiLoader className="w-12 h-12 text-sky-500 animate-spin mx-auto mb-4" />
//             <h3 className="text-xl font-semibold text-sky-800 mb-2">
//               {uploadProgress < 100 ? "Uploading File" : "Processing Data"}
//             </h3>
//             <p className="text-sky-600 mb-4">
//               {uploadProgress < 100 
//                 ? "Please wait while we upload your file..." 
//                 : "Finalizing processing..."}
//             </p>
//             <div className="w-full bg-sky-100 rounded-full h-4 mb-4 overflow-hidden">
//               <div
//                 className={`h-4 rounded-full transition-all duration-300 ${
//                   uploadProgress < 100 ? 'bg-green-500' : 'bg-green-600'
//                 }`}
//                 style={{ width: `${uploadProgress}%` }}
//               ></div>
//             </div>
//             <p className="text-s font-medium text-sky-700">
//               Progress: {uploadProgress}%
//             </p>
//           </div>
//         </div>
//       )}

//       <div 
//         className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
//           isDraggingFile ? 'border-sky-500 bg-sky-50' : 'border-sky-300 bg-white'
//         }`}
//         onDrop={handleFileDrop}
//         onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
//         onDragLeave={() => setIsDraggingFile(false)}
//       >
//         <div className="flex flex-col items-center justify-center space-y-3">
//           <FiUpload className="w-12 h-12 text-sky-400" />
//           <p className="text-lg font-medium text-sky-700">
//             Drag and drop your HR file here
//           </p>
//           <p className="text-s text-sky-500">or</p>
//           <label className="cursor-pointer bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-colors">
//             Browse Files
//             <input
//               type="file"
//               className="hidden"
//               onChange={handleFileChange}
//               accept=".csv,.xlsx,.xls"
//             />
//           </label>
//           <p className="text-x text-sky-400 mt-2">
//             Supported formats: CSV, XLSX
//           </p>
//         </div>
//       </div>

//       {selectedFile && (
//         <div className="space-y-6">
//           <div className="bg-white rounded-lg border border-sky-200 shadow-sm overflow-hidden">
//             <div className="p-4 border-b border-sky-200 bg-sky-50">
//               <h3 className="font-medium text-sky-800">Map Your Columns</h3>
//               <p className="text-s text-sky-500">
//                 Drag system fields to Excel columns
//               </p>
//             </div>

//             <div className="p-4 relative" ref={containerRef}>
//               <svg 
//                 className="absolute top-0 left-0 w-full h-full pointer-events-none z-0"
//                 style={{ overflow: 'visible' }}
//               >
//                 {connections.map(conn => (
//                   <path
//                     key={conn.id}
//                     d={conn.path}
//                     stroke="#3b82f6"
//                     strokeWidth="2"
//                     fill="none"
//                     markerEnd="url(#arrowhead)"
//                   />
//                 ))}
//                 <defs>
//                   <marker
//                     id="arrowhead"
//                     markerWidth="10"
//                     markerHeight="7"
//                     refX="9"
//                     refY="3.5"
//                     orient="auto"
//                   >
//                     <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
//                   </marker>
//                 </defs>
//               </svg>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
//                 <div>
//                   <h4 className="text-s font-medium text-sky-700 mb-3">System Fields</h4>
//                   <div className="space-y-2">
//                     {systemFields.map(field => (
//                       <div
//                         key={field.id}
//                         id={`system-${field.id}`}
//                         draggable
//                         onDragStart={() => handleDragStart(field.id)}
//                         onDragEnd={() => setDraggingField(null)}
//                         className={`p-3 border rounded-lg flex items-center justify-between ${
//                           Object.values(columnMappings).includes(field.id)
//                             ? 'bg-sky-100 border-sky-300'
//                             : 'bg-white border-sky-200'
//                         } ${draggingField === field.id ? 'opacity-50' : 'cursor-move'}`}
//                       >
//                         <div>
//                           <span className="font-medium text-sky-800">{field.label}</span>
//                           {field.required && (
//                             <span className="ml-2 text-x text-amber-600">Required</span>
//                           )}
//                         </div>
//                         <FiMove className="text-sky-400" />
//                       </div>
//                     ))}
//                   </div>
//                 </div>

//                 <div>
//                   <h4 className="text-s font-medium text-sky-700 mb-3">Excel Columns</h4>
//                   <div className="space-y-2">
//                     {headers.map(header => (
//                       <div
//                         key={header}
//                         id={`excel-${header}`}
//                         onDragOver={handleDragOver}
//                         onDrop={(e) => handleDrop(e, header)}
//                         className={`p-3 border rounded-lg relative z-10 ${
//                           columnMappings[header]
//                             ? 'bg-green-50 border-green-300'
//                             : 'bg-white border-sky-200'
//                         }`}
//                       >
//                         <div className="flex justify-between items-center">
//                           <span className="font-medium text-sky-800">{header}</span>
//                           {columnMappings[header] && (
//                             <button
//                               onClick={() => removeMapping(header)}
//                               className="text-red-500 hover:text-red-700 p-1"
//                             >
//                               <FiX />
//                             </button>
//                           )}
//                         </div>
//                         {columnMappings[header] && (
//                           <div className="text-x text-green-600 mt-1">
//                             Mapped to: {systemFields.find(f => f.id === columnMappings[header])?.label}
//                           </div>
//                         )}
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div className="bg-white rounded-lg border border-sky-200 shadow-sm overflow-hidden">
//             <div className="p-4 border-b border-sky-200 bg-sky-50 flex justify-between items-center">
//               <h3 className="font-medium text-sky-800">Data Preview</h3>
//               <div className="flex items-center space-x-2">
//                 <span className="text-s text-sky-600">
//                   Page {currentPage + 1} of {totalPages}
//                 </span>
//                 <button
//                   onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
//                   disabled={currentPage === 0}
//                   className="p-1 disabled:opacity-50"
//                 >
//                   <FiChevronLeft className="text-sky-600" />
//                 </button>
//                 <button
//                   onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages - 1))}
//                   disabled={currentPage === totalPages - 1}
//                   className="p-1 disabled:opacity-50"
//                 >
//                   <FiChevronRight className="text-sky-600" />
//                 </button>
//               </div>
//             </div>

//             <div className="overflow-x-auto">
//               <table className="min-w-full divide-y divide-sky-200">
//                 <thead className="bg-sky-50">
//                   <tr>
//                     {headers.map(header => (
//                       <th
//                         key={header}
//                         className={`px-4 py-3 text-left text-x font-medium uppercase tracking-wider ${
//                           columnMappings[header]
//                             ? 'text-green-700 bg-green-50'
//                             : 'text-sky-500'
//                         }`}
//                       >
//                         <div className="flex items-center">
//                           {header}
//                           {columnMappings[header] && (
//                             <span className="ml-1 px-1 py-0.5 bg-sky-100 text-sky-600 text-xxs rounded">
//                               {systemFields.find(f => f.id === columnMappings[header])?.label}
//                             </span>
//                           )}
//                         </div>
//                       </th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody className="bg-white divide-y divide-sky-200">
//                   {paginatedData.map((row, rowIndex) => (
//                     <tr key={rowIndex}>
//                       {row.map((cell, cellIndex) => (
//                         <td
//                           key={cellIndex}
//                           className="px-4 py-2 whitespace-nowrap text-s text-sky-900 max-w-xs truncate"
//                           title={cell}
//                         >
//                           {cell}
//                         </td>
//                       ))}
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>

//           <div className="flex justify-end">
//             <button
//               onClick={handleUpload}
//               disabled={isUploading}
//               className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
//             >
//               {isUploading ? (
//                 <>
//                   <FiLoader className="mr-2 animate-spin" />
//                   Uploading...
//                 </>
//               ) : (
//                 <>
//                   <FiUpload className="mr-2" />
//                   Upload Mapped Data
//                 </>
//               )}
//             </button>
//           </div>
//         </div>
//       )}

//       <div className="bg-sky-50 p-6 rounded-lg border border-sky-200">
//         <h3 className="text-md font-semibold text-sky-800 mb-3">Upload Instructions</h3>
//         <ul className="space-y-2 text-s text-sky-700 list-disc pl-5">
//           <li>Drag system fields from the left to Excel columns on the right</li>
//           <li>Required fields must be mapped before uploading</li>
//           <li>You can click the X icon to remove a mapping</li>
//           <li>Preview your data before uploading</li>
//           <li>Files should be UTF-8 encoded</li>
//         </ul>
//       </div>
//     </div>
//   );
// };

// export default UploadHRFile;