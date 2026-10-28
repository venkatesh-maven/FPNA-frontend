// UploadTab.js
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FiUpload, FiX, FiCheckCircle, FiChevronLeft, FiChevronRight, FiMove } from 'react-icons/fi';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { Tooltip } from 'react-tooltip';

const UploadTab = ({ apiService }) => {
  const containerRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [draggingField, setDraggingField] = useState(null);
  const [columnMappings, setColumnMappings] = useState({});
  const [connections, setConnections] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Matches the backend's required upload columns exactly (src/HRAndCRM/service.py CRMDataHandler.required_fields).
  const crmFields = [
    { id: 'opportunity_id', label: 'Opportunity ID', required: true },
    { id: 'customer_name', label: 'Customer Name', required: true },
    { id: 'contact_person', label: 'Contact Person', required: true },
    { id: 'email', label: 'Email', required: true },
    { id: 'product', label: 'Product', required: true },
    { id: 'deal_amount', label: 'Deal Amount', required: true },
    { id: 'stage', label: 'Stage', required: true }, // one of: Prospecting, Proposal, Negotiation, Closed Won, Closed Lost
    { id: 'probability', label: 'Probability', required: true },
    { id: 'expected_close_date', label: 'Expected Close Date', required: true },
    { id: 'region', label: 'Region', required: true },
    { id: 'extra_data', label: 'Extra Data', required: false },
  ];

  const downloadTemplate = () => {
    const headerRow = crmFields.map((f) => f.label);
    const exampleRow = [
      'OPP-1001', 'Acme Corporation', 'Jane Doe', 'jane.doe@acmecorp.example',
      'IT Staffing', 42000, 'Proposal', 60, '2027-03-15', 'North America', '',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
    ws['!cols'] = headerRow.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CRM Opportunities');
    XLSX.writeFile(wb, 'crm-opportunities-template.xlsx');
  };

  const parseFile = (file) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        if (jsonData.length > 0) {
          setHeaders(jsonData[0]);
          setPreviewData(jsonData.slice(1));
          initializeMappings(jsonData[0]);
        }
      } catch (error) {
        toast.error('Error parsing file: ' + error.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const initializeMappings = (fileHeaders) => {
    const initialMappings = {};
    fileHeaders.forEach((header) => {
      initialMappings[header] = '';
    });
    setColumnMappings(initialMappings);
  };

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) validateAndSetFile(file);
  };

  const validateAndSetFile = (file) => {
    // Backend only accepts .xlsx (src/HRAndCRM/controller.py upload endpoint rejects anything else).
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (fileExtension !== '.xlsx') {
      toast.error('Please upload an Excel (.xlsx) file — CSV and .xls are not accepted by the server.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    parseFile(file);
  };

  const handleDragStart = (fieldId) => {
    setDraggingField(fieldId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, header) => {
    e.preventDefault();
    if (draggingField) {
      setColumnMappings((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((key) => {
          if (updated[key] === draggingField) {
            updated[key] = '';
          }
        });
        updated[header] = draggingField;
        return updated;
      });
    }
    setDraggingField(null);
  };

  const removeMapping = (header) => {
    setColumnMappings((prev) => ({
      ...prev,
      [header]: '',
    }));
  };

  const calculateConnections = useCallback(() => {
    if (!containerRef.current) return;

    const newConnections = [];
    const containerRect = containerRef.current.getBoundingClientRect();

    headers.forEach((header) => {
      const systemFieldId = columnMappings[header];
      if (systemFieldId) {
        const sourceEl = document.getElementById(`excel-${header}`);
        const targetEl = document.getElementById(`system-${systemFieldId}`);

        if (sourceEl && targetEl) {
          const sourceRect = sourceEl.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();

          const sourceX = sourceRect.right - containerRect.left;
          const sourceY = sourceRect.top + sourceRect.height / 2 - containerRect.top;
          const targetX = targetRect.left - containerRect.left;
          const targetY = targetRect.top + targetRect.height / 2 - containerRect.top;

          const midX = (sourceX + targetX) / 2;
          const path = `M${sourceX},${sourceY} C${midX},${sourceY} ${midX},${targetY} ${targetX},${targetY}`;

          newConnections.push({
            id: `${header}-${systemFieldId}`,
            path,
            header,
            systemFieldId,
          });
        }
      }
    });

    setConnections(newConnections);
  }, [headers, columnMappings]);

  useEffect(() => {
    calculateConnections();
    window.addEventListener('resize', calculateConnections);
    return () => window.removeEventListener('resize', calculateConnections);
  }, [calculateConnections]);

  const pageSize = 20;
  const totalPages = Math.ceil(previewData.length / pageSize);
  const paginatedData = previewData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    const requiredFields = crmFields.filter((field) => field.required).map((field) => field.id);

    const missingFields = requiredFields.filter((field) => !Object.values(columnMappings).includes(field));

    if (missingFields.length > 0) {
      toast.error(`Missing required field mappings: ${missingFields.join(', ')}`);
      return;
    }

    // Server expects {sourceColumnHeader: targetField} with only mapped columns included.
    const activeMappings = Object.fromEntries(
      Object.entries(columnMappings).filter(([, target]) => target)
    );

    setIsUploading(true);
    try {
      await apiService.uploadCRMFile(selectedFile, activeMappings);
      setSelectedFile(null);
      setPreviewData([]);
      setHeaders([]);
      setColumnMappings({});
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDraggingFile ? 'border-sky-500 bg-sky-50' : 'border-sky-300 bg-white'
        }`}
        onDrop={handleFileDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
        onDragLeave={() => setIsDraggingFile(false)}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <FiUpload className="w-12 h-12 text-sky-400" data-tooltip-id="upload-icon" data-tooltip-content="Upload CRM file" />
          <Tooltip id="upload-icon" />
          <p className="text-lg font-medium text-sky-700">Drag and drop your CRM file here</p>
          <p className="text-s text-sky-500">or</p>
          <label className="cursor-pointer bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-colors">
            Browse Files
            <input type="file" className="hidden" onChange={handleFileChange} accept=".xlsx" />
          </label>
          <p className="text-x text-sky-400 mt-2">Supported format: .xlsx (Max 5MB)</p>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <button
          onClick={downloadTemplate}
          className="text-sky-600 hover:text-sky-800 text-s font-medium underline underline-offset-2"
        >
          Download a blank template with the correct columns
        </button>
      </div>

      {selectedFile && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-sky-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-sky-200 bg-sky-50">
              <h3 className="font-medium text-sky-800">Map Your Columns</h3>
              <p className="text-s text-sky-500">Drag CRM fields to Excel columns</p>
            </div>

            <div className="p-4 relative" ref={containerRef}>
              <svg className="absolute w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                {connections.map((conn) => (
                  <path key={conn.id} d={conn.path} stroke="#3b82f6" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />
                ))}
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                  </marker>
                </defs>
              </svg>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div>
                  <h4 className="text-s font-medium text-sky-700 mb-3">CRM Fields</h4>
                  <div className="space-y-2">
                    {crmFields.map((field) => (
                      <div
                        key={field.id}
                        id={`system-${field.id}`}
                        draggable
                        onDragStart={() => handleDragStart(field.id)}
                        className={`p-3 border rounded-lg flex items-center justify-between ${
                          Object.values(columnMappings).includes(field.id)
                            ? 'bg-sky-100 border-sky-300'
                            : 'bg-white border-sky-200'
                        } ${draggingField === field.id ? 'opacity-50' : 'cursor-move'}`}
                        data-tooltip-id={`field-${field.id}`}
                        data-tooltip-content={field.label}
                      >
                        <div>
                          <span className="font-medium text-sky-800">{field.label}</span>
                          {field.required && <span className="ml-2 text-x text-amber-600">Required</span>}
                        </div>
                        <FiMove className="text-sky-400" />
                        <Tooltip id={`field-${field.id}`} />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-s font-medium text-sky-700 mb-3">Excel Columns</h4>
                  <div className="space-y-2">
                    {headers.map((header) => (
                      <div
                        key={header}
                        id={`excel-${header}`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, header)}
                        className={`p-3 border rounded-lg ${
                          columnMappings[header] ? 'bg-green-50 border-green-300' : 'bg-white border-sky-200'
                        }`}
                        data-tooltip-id={`header-${header}`}
                        data-tooltip-content={header}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sky-800">{header}</span>
                          {columnMappings[header] && (
                            <button
                              onClick={() => removeMapping(header)}
                              className="text-red-500 hover:text-red-700 p-1"
                              data-tooltip-id="remove-mapping"
                              data-tooltip-content="Remove mapping"
                            >
                              <FiX />
                              <Tooltip id="remove-mapping" />
                            </button>
                          )}
                        </div>
                        {columnMappings[header] && (
                          <div className="text-x text-green-600 mt-1">
                            Mapped to: {crmFields.find((f) => f.id === columnMappings[header])?.label}
                          </div>
                        )}
                        <Tooltip id={`header-${header}`} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-sky-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-sky-200 bg-sky-50 flex justify-between items-center">
              <h3 className="font-medium text-sky-800">Data Preview</h3>
              <div className="flex items-center space-x-2">
                <span className="text-s text-sky-600">Page {currentPage + 1} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
                  disabled={currentPage === 0}
                  className="p-1 disabled:opacity-50"
                  data-tooltip-id="prev-page"
                  data-tooltip-content="Previous page"
                >
                  <FiChevronLeft className="text-sky-600" />
                  <Tooltip id="prev-page" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))}
                  disabled={currentPage === totalPages - 1}
                  className="p-1 disabled:opacity-50"
                  data-tooltip-id="next-page"
                  data-tooltip-content="Next page"
                >
                  <FiChevronRight className="text-sky-600" />
                  <Tooltip id="next-page" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sky-200">
                <thead className="bg-sky-50">
                  <tr>
                    {headers.map((header) => (
                      <th
                        key={header}
                        className={`px-4 py-3 text-left text-x font-medium uppercase tracking-wider ${
                          columnMappings[header] ? 'text-green-700 bg-green-50' : 'text-sky-500'
                        }`}
                      >
                        <div className="flex items-center">
                          {header}
                          {columnMappings[header] && (
                            <span className="ml-1 px-1 py-0.5 bg-sky-100 text-sky-600 text-xxs rounded">
                              {crmFields.find((f) => f.id === columnMappings[header])?.label}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-sky-200">
                  {paginatedData.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-2 whitespace-nowrap text-s text-sky-900 max-w-xs truncate" title={cell}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-medium transition-colors flex items-center disabled:opacity-50"
              data-tooltip-id="upload-button"
              data-tooltip-content="Upload mapped data"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <FiUpload className="mr-2" />
                  Upload Mapped Data
                </>
              )}
              <Tooltip id="upload-button" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-sky-50 p-6 rounded-lg border border-sky-200">
        <h3 className="text-md font-semibold text-sky-800 mb-3">Upload Instructions</h3>
        <ul className="space-y-2 text-s text-sky-700 list-disc pl-5">
          <li>File must be an .xlsx Excel file (CSV and .xls are rejected by the server)</li>
          <li>Drag CRM fields from the left to matching Excel columns on the right</li>
          <li>All required fields must be mapped before uploading</li>
          <li>Click the X icon to remove a mapping</li>
          <li>Preview your data before uploading</li>
        </ul>
      </div>
    </div>
  );
};

export default UploadTab;
