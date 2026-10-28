import React, { useState } from 'react';
import { FiUpload } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../../../config/config';

const ExcelUploadTable = ({ token, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(`.${fileExtension}`)) {
      toast.error('Please upload a valid Excel file (XLSX, XLS, CSV)');
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/upload-gl/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to upload file');
      }

      toast.success('File uploaded successfully!');
      setFile(null);
      
      if (onUploadSuccess) {
        onUploadSuccess(responseData);
      }
    } catch (error) {
      toast.error(error.message || 'File upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-1">Upload GL Accounts</h2>
        <p className="text-s text-gray-600">Upload Excel or CSV file with account data</p>
      </div>

      <div className="border border-gray-300 rounded p-4 mb-4">
        <div className="mb-3">
          <label className="block text-s font-medium mb-1">Select file</label>
          <div className="flex">
            <label className="flex-1 border border-gray-300 rounded-l px-3 py-2 bg-gray-50 overflow-hidden">
              <span className="truncate block">
                {file ? file.name : 'No file selected'}
              </span>
              <input 
                type="file" 
                onChange={handleFileChange}
                className="hidden"
                accept=".xlsx,.xls,.csv"
              />
            </label>
            <button 
              onClick={handleUpload}
              disabled={!file || loading}
              className={`px-4 py-2 rounded-r ${!file || loading ? 'bg-gray-300 text-gray-500' : 'bg-gray-700 text-white'}`}
            >
              {loading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>

        <div className="text-x text-gray-500">
          <p>Supported formats: .xlsx, .xls, .csv</p>
          <p>Required columns: GL Code, Account Name, Category</p>
          <p>Optional column: Tag (single value)</p>
        </div>
      </div>
    </div>
  );
};

export default ExcelUploadTable;