import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';

const ExcelMappingValidator2 = () => {
  const [file, setFile] = useState(null);
  const [uploadedHeaders, setUploadedHeaders] = useState([]);
  const [mappings, setMappings] = useState({});
  const [dragging, setDragging] = useState(null);
  const [connections, setConnections] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const containerRef = useRef(null);

  // Expected backend field names (unique)
  const backendFields = [
    'date',
    'general_ledger_code',
    'category',
    'description',
    'debit',
    'credit',
    'account_name'
  ];

  useEffect(() => {
    // Calculate SVG connections whenever mappings change
    const newConnections = [];
    backendFields.forEach(backendField => {
      if (mappings[backendField]) {
        const sourceElem = document.getElementById(`backend-${backendField}`);
        const targetElem = document.getElementById(`uploaded-${mappings[backendField]}`);
        
        if (sourceElem && targetElem) {
          const sourceRect = sourceElem.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();
          
          const sourceX = sourceRect.right - containerRect.left;
          const sourceY = sourceRect.top + sourceRect.height / 2 - containerRect.top;
          const targetX = targetElem.getBoundingClientRect().left - containerRect.left;
          const targetY = targetElem.getBoundingClientRect().top + targetElem.getBoundingClientRect().height / 2 - containerRect.top;
          
          newConnections.push({
            id: `conn-${backendField}`,
            path: `M${sourceX},${sourceY} C${(sourceX + targetX) / 2},${sourceY} ${(sourceX + targetX) / 2},${targetY} ${targetX},${targetY}`,
            backendField,
            uploadedField: mappings[backendField]
          });
        }
      }
    });
    setConnections(newConnections);
  }, [mappings]);

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setUploadedHeaders([]);
    setMappings({});
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (jsonData.length === 0) {
        setValidationResult({ isValid: false, message: 'The uploaded file is empty' });
        return;
      }

      const headers = jsonData[0].filter(h => h); // Remove empty headers
      setUploadedHeaders(headers);

      // Initialize auto-mappings based on exact matches
      const initialMappings = {};
      backendFields.forEach(backendField => {
        const exactMatch = headers.find(h => h.toLowerCase() === backendField.toLowerCase());
        if (exactMatch) {
          initialMappings[backendField] = exactMatch;
        }
      });
      setMappings(initialMappings);
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleDragStart = (backendField) => {
    setDragging(backendField);
  };

  const handleDragOver = (e, uploadedField) => {
    e.preventDefault();
  };

  const handleDrop = (e, uploadedField) => {
    e.preventDefault();
    if (dragging) {
      // Remove any existing mapping to this uploaded field
      const updatedMappings = { ...mappings };
      Object.keys(updatedMappings).forEach(key => {
        if (updatedMappings[key] === uploadedField) {
          delete updatedMappings[key];
        }
      });
      
      // Add new mapping
      updatedMappings[dragging] = uploadedField;
      setMappings(updatedMappings);
    }
    setDragging(null);
  };

  const removeMapping = (backendField) => {
    const updatedMappings = { ...mappings };
    delete updatedMappings[backendField];
    setMappings(updatedMappings);
  };

  const validateMappings = () => {
    const unmappedFields = backendFields.filter(field => !mappings[field]);

    if (unmappedFields.length > 0) {
      setValidationResult({
        isValid: false,
        message: `Some required fields are not mapped: ${unmappedFields.join(', ')}`
      });
    } else {
      setValidationResult({
        isValid: true,
        message: 'All fields are properly mapped!',
        mappings: mappings
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Excel Field Mapper</h2>
      
      <div className="mb-6 bg-blue-50 p-4 rounded-lg">
        <label className="block text-s font-medium text-blue-800 mb-2">
          Upload Excel File
        </label>
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          className="block w-full text-s text-blue-800
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-s file:font-semibold
            file:bg-white file:text-blue-700 file:shadow-sm
            hover:file:bg-blue-100"
        />
      </div>

      {file && (
        <div className="mb-6 text-center">
          <p className="text-s text-gray-600 inline-block bg-gray-100 px-3 py-1 rounded-full">
            <span className="font-medium">File:</span> {file.name}
          </p>
        </div>
      )}

      {uploadedHeaders.length > 0 && (
        <div className="relative" ref={containerRef}>
          {/* SVG for connections */}
          <svg className="absolute w-full h-full top-0 left-0 pointer-events-none" style={{ zIndex: 1 }}>
            {connections.map(conn => (
              <path
                key={conn.id}
                d={conn.path}
                stroke="#3b82f6"
                strokeWidth="2"
                fill="none"
                strokeDasharray={mappings[conn.backendField] === conn.uploadedField ? "0" : "5,5"}
              />
            ))}
          </svg>

          <div className="flex justify-between mb-8">
            {/* Backend Fields */}
            <div className="w-5/12">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Backend Fields</h3>
              <div className="space-y-3">
                {backendFields.map(backendField => (
                  <div
                    key={backendField}
                    id={`backend-${backendField}`}
                    draggable
                    onDragStart={() => handleDragStart(backendField)}
                    className={`p-3 border rounded-lg cursor-move flex justify-between items-center ${
                      mappings[backendField] 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-medium text-gray-700">{backendField}</span>
                    {mappings[backendField] && (
                      <button 
                        onClick={() => removeMapping(backendField)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Uploaded Headers */}
            <div className="w-5/12">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">Your File Headers</h3>
              <div className="space-y-3">
                {uploadedHeaders.map(uploadedField => {
                  const isMapped = Object.values(mappings).includes(uploadedField);
                  return (
                    <div
                      key={uploadedField}
                      id={`uploaded-${uploadedField}`}
                      onDragOver={(e) => handleDragOver(e, uploadedField)}
                      onDrop={(e) => handleDrop(e, uploadedField)}
                      className={`p-3 border rounded-lg ${
                        isMapped
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      } ${!isMapped && 'cursor-pointer'}`}
                    >
                      <span className="text-gray-700">{uploadedField}</span>
                      {isMapped && (
                        <div className="text-x text-green-600 mt-1">
                          Mapped to: {Object.keys(mappings).find(key => mappings[key] === uploadedField)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <button
              onClick={validateMappings}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md transition-all"
            >
              Validate Mappings
            </button>
          </div>
        </div>
      )}

      {validationResult && (
        <div className={`mt-8 p-6 rounded-lg shadow-sm ${validationResult.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-start">
            <div className={`flex-shrink-0 h-6 w-6 ${validationResult.isValid ? 'text-green-500' : 'text-red-500'}`}>
              {validationResult.isValid ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-lg font-medium ${validationResult.isValid ? 'text-green-800' : 'text-red-800'}`}>
                {validationResult.message}
              </h3>
              {validationResult.isValid && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-800 mb-2">Mapping Summary:</h4>
                  <div className="bg-white p-4 rounded border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Backend Field</th>
                          <th className="px-4 py-2 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Mapped To</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(validationResult.mappings).map(([backend, uploaded]) => (
                          <tr key={backend}>
                            <td className="px-4 py-2 whitespace-nowrap text-s text-gray-700">{backend}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-s text-gray-700">{uploaded}</td>
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
      )}

      {uploadedHeaders.length === 0 && (
        <div className="mt-12 text-center">
          <div className="mx-auto w-24 h-24 text-gray-300 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-700">Upload an Excel file to begin mapping</h3>
          <p className="mt-1 text-s text-gray-500">Drag and drop fields from left to right to create mappings</p>
        </div>
      )}
    </div>
  );
};

export default ExcelMappingValidator2;