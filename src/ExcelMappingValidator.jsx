import { useState } from 'react';
import * as XLSX from 'xlsx';

const ExcelMappingValidator = () => {
  const [file, setFile] = useState(null);
  const [uploadedHeaders, setUploadedHeaders] = useState([]);
  const [mappings, setMappings] = useState({});
  const [validationResult, setValidationResult] = useState(null);

  // Expected backend field names
  const backendFields = [
     'date',
    'general_ledger_code',
    'category',
    'description',
    'debit',
    'credit',
    'account_name'
  ];

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

  const handleMappingChange = (backendField, selectedHeader) => {
    setMappings(prev => ({
      ...prev,
      [backendField]: selectedHeader === '-- Not Mapped --' ? null : selectedHeader
    }));
  };

  const validateMappings = () => {
    const requiredFields = [...new Set(backendFields)]; // Remove duplicates
    const unmappedFields = requiredFields.filter(field => !mappings[field]);

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
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Excel Field Mapping</h2>
      
      <div className="mb-6">
        <label className="block text-s font-medium text-gray-700 mb-2">
          Upload Excel File
        </label>
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          className="block w-full text-s text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-s file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
      </div>

      {file && (
        <div className="mb-4">
          <p className="text-s text-gray-600">
            <span className="font-medium">Selected file:</span> {file.name}
          </p>
        </div>
      )}

      {uploadedHeaders.length > 0 && (
        <>
          <div className="mb-6 grid grid-cols-12 gap-4 items-center">
            <div className="col-span-5 font-medium text-gray-700">Backend Fields</div>
            <div className="col-span-2"></div>
            <div className="col-span-5 font-medium text-gray-700">Your File Headers</div>
          </div>

          <div className="space-y-4 mb-6">
            {backendFields.map((backendField, index) => (
              <div key={`${backendField}-${index}`} className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-5 bg-gray-50 p-3 rounded border border-gray-200">
                  {backendField}
                </div>
                <div className="col-span-2 flex justify-center">
                  <span className="text-gray-500">→</span>
                </div>
                <div className="col-span-5">
                  <select
                    value={mappings[backendField] || ''}
                    onChange={(e) => handleMappingChange(backendField, e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Not Mapped --</option>
                    {uploadedHeaders.map(header => (
                      <option 
                        key={header} 
                        value={header}
                        disabled={Object.values(mappings).includes(header) && mappings[backendField] !== header}
                      >
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={validateMappings}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Validate Mappings
          </button>
        </>
      )}

      {validationResult && (
        <div className={`mt-6 p-4 rounded-md ${validationResult.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <h3 className={`text-lg font-medium mb-2 ${validationResult.isValid ? 'text-green-800' : 'text-red-800'}`}>
            {validationResult.isValid ? 'Mapping Successful!' : 'Mapping Issues Found'}
          </h3>
          <p className={validationResult.isValid ? 'text-green-700' : 'text-red-700'}>
            {validationResult.message}
          </p>
          {validationResult.isValid && (
            <div className="mt-3">
              <h4 className="font-medium text-gray-800 mb-1">Final Mappings:</h4>
              <pre className="bg-white p-3 rounded border border-gray-200 text-s overflow-x-auto">
                {JSON.stringify(validationResult.mappings, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 bg-gray-50 p-4 rounded-md">
        <h3 className="text-lg font-medium text-gray-800 mb-2">Instructions</h3>
        <ol className="list-decimal pl-5 space-y-1 text-s text-gray-700">
          <li>Upload your Excel file</li>
          <li>Map each backend field (left) to the corresponding header in your file (right)</li>
          <li>Click "Validate Mappings" to check your selections</li>
          <li>Each backend field must be mapped to proceed</li>
        </ol>
      </div>
    </div>
  );
};

export default ExcelMappingValidator;