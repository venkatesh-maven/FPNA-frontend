import React, { useState, useContext } from 'react';
import { FiUpload, FiPlus, FiDownload, FiFile, FiX, FiCalendar } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/config';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { TailSpin } from 'react-loader-spinner';
import { upload } from '../../assets/Assets'; // Assuming 'upload' can be a generic placeholder image
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getDecimalPrecision } from '../../utils/formatters';

const GLUploadScreen = () => {
  const { authToken } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('manual'); // Can be 'manual', 'upload', or 'history'
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fileUploadProgress, setFileUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Form state for manual entry
  const [formData, setFormData] = useState({
    general_ledger_code: '',
    account_name: '',
    category: ''
  });

  const [entries, setEntries] = useState([]);

  const showToast = (message, type = 'success') => {
    toast[type](message, {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    // Here you would typically fetch history data for the selected date
    showToast(`Fetching history for ${date.toLocaleDateString()}`);
    // Example: fetchHistoryData(date);
  };


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddEntry = () => {
    if (!formData.general_ledger_code || !formData.account_name || !formData.category) {
      showToast('All fields are required', 'error');
      return;
    }

    setEntries([...entries, formData]);
    setFormData({
      general_ledger_code: '',
      account_name: '',
      category: ''
    });
    showToast('Entry added successfully');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const selectedFile = e.dataTransfer.files[0];
    handleFileValidation(selectedFile);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    handleFileValidation(selectedFile);
  };

  const handleFileValidation = (selectedFile) => {
    if (selectedFile) {
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream' // Sometimes .xlsx files are identified as this
      ];
      const validExtensions = ['.xls', '.xlsx'];
      const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      
      // More robust check for extension if type is octet-stream
      if (selectedFile.type === 'application/octet-stream' && !validExtensions.includes(fileExtension)) {
        showToast('Please upload a valid Excel file (.xls, .xlsx)', 'error');
        return;
      }
      if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension)) {
          showToast('Please upload a valid Excel file (.xls, .xlsx)', 'error');
          return;
      }

      setFile(selectedFile);
      showToast('File selected successfully');
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const submitManualEntries = async () => {
    if (entries.length === 0) {
      showToast('Please add at least one entry', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-master/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ data: entries })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload GL data');
      }

      showToast('GL data uploaded successfully!');
      setEntries([]);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const submitFileUpload = async () => {
    if (!file) {
      showToast('Please select a file', 'error');
      return;
    }

    setIsLoading(true);
    setFileUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setFileUploadProgress(percentComplete);
        }
      };

      const promise = new Promise((resolve, reject) => {
        xhr.open('POST', `${API_BASE_URL}/api/v1/company/financial/upload-gl/`);
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const jsonResponse = JSON.parse(xhr.response);
                resolve(jsonResponse);
            } catch (e) {
                // if response is not json, but still successful
                resolve(xhr.response);
            }
          } else {
            try {
                const errorJson = JSON.parse(xhr.responseText);
                reject(errorJson); // Use errorJson.detail if available
            } catch (e) {
                reject(new Error(xhr.statusText || 'Upload failed'));
            }
          }
        };
        
        xhr.onerror = () => reject(new Error('Network Error'));
        xhr.send(formData);
      });

      await promise;
      
      showToast('File uploaded and processed successfully!');
      setFile(null);
      setFileUploadProgress(0);
    } catch (error) {
      // Error object might be what we parsed from xhr.responseText or a generic Error
      const errorMessage = error.detail || (error.message ? error.message : 'Failed to upload file');
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };
      

  return (
    <div className="container mx-auto">
      <ToastContainer />
      
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-700 to-sky-300 p-4 rounded-xl shadow-sm mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">General Ledger Management</h1>
            <p className="text-sky-100 text-s mt-1">Upload and manage your financial ledger data</p>
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              className={`flex items-center py-2.5 px-4 text-s font-medium rounded-lg border transition-colors duration-200 ${
                activeTab === 'manual' 
                  ? 'bg-white text-sky-800 border-sky-200' 
                  : 'bg-sky-800 text-white border-sky-700 hover:bg-sky-700'
              }`}
              onClick={() => setActiveTab('manual')}
            >
              <FiPlus className="mr-2" />
              Manual Entry
            </button>
            <button
              type="button"
              className={`flex items-center py-2.5 px-4 text-s font-medium rounded-lg border transition-colors duration-200 ${
                activeTab === 'upload' 
                  ? 'bg-white text-sky-800 border-sky-200' 
                  : 'bg-sky-800 text-white border-sky-700 hover:bg-sky-700'
              }`}
              onClick={() => setActiveTab('upload')}
            >
              <FiUpload className="mr-2" />
              File Upload
            </button>
            <button
              type="button"
              className={`flex items-center py-2.5 px-4 text-s font-medium rounded-lg border transition-colors duration-200 ${
                activeTab === 'history' 
                  ? 'bg-white text-sky-800 border-sky-200' 
                  : 'bg-sky-800 text-white border-sky-700 hover:bg-sky-700'
              }`}
              onClick={() => setActiveTab('history')}
            >
              <FiCalendar className="mr-2" />
              History
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* Tab Navigation */}
        <div className="flex border-b border-sky-100 mb-8">
          <button
            className={`py-3 px-6 font-medium text-s flex items-center ${
              activeTab === 'manual' 
                ? 'text-sky-600 border-b-2 border-sky-600' 
                : 'text-gray-500 hover:text-sky-500'
            }`}
            onClick={() => setActiveTab('manual')}
          >
            <FiPlus className="mr-2" />
            Manual Entry
          </button>
          <button
            className={`py-3 px-6 font-medium text-s flex items-center ${
              activeTab === 'upload' 
                ? 'text-sky-600 border-b-2 border-sky-600' 
                : 'text-gray-500 hover:text-sky-500'
            }`}
            onClick={() => setActiveTab('upload')}
          >
            <FiUpload className="mr-2" />
            File Upload
          </button>
          <button
            className={`py-3 px-6 font-medium text-s flex items-center ${
              activeTab === 'history' 
                ? 'text-sky-600 border-b-2 border-sky-600' 
                : 'text-gray-500 hover:text-sky-500'
            }`}
            onClick={() => setActiveTab('history')}
          >
            <FiCalendar className="mr-2" />
            View History
          </button>
        </div>

        {/* Manual Entry Tab */}
        {activeTab === 'manual' && (
          <div>
            <div className='flex justify-between items-center'>
              <img src={upload} className='w-[350px]' alt="Manual data entry illustration" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 w-[600px]"> {/* Adjusted width to match file upload tab */}
                <div>
                  <label className="block mb-2 text-s font-medium text-gray-700">GL Code</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <span className="text-gray-500 text-s">#</span>
                    </div>
                    <input
                      type="number"
                      name="general_ledger_code"
                      value={formData.general_ledger_code}
                      onChange={handleInputChange}
                      className="bg-sky-50 border border-sky-200 text-gray-900 text-s rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full pl-8 p-2.5"
                      placeholder="1001"
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 text-s font-medium text-gray-700">Account Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="account_name"
                      value={formData.account_name}
                      onChange={handleInputChange}
                      className="bg-sky-50 border border-sky-200 text-gray-900 text-s rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full pl-10 p-2.5"
                      placeholder="Cash Account"
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-2 text-s font-medium text-gray-700">Category</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" d="M17 10a7 7 0 11-14 0 7 7 0 0114 0zm-7-4a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"></path>
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="bg-sky-50 border border-sky-200 text-gray-900 text-s rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full pl-10 p-2.5"
                      placeholder="Assets"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end mb-8">
              <button
                type="button"
                onClick={handleAddEntry}
                className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-lg flex items-center transition-colors duration-200"
              >
                <FiPlus className="mr-2" />
                Add Entry
              </button>
            </div>

            {entries.length > 0 && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium text-gray-700">Entries Preview</h3>
                  <span className="text-s text-sky-600 bg-sky-100 px-3 py-1 rounded-full">
                    {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-sky-100">
                  <table className="min-w-full divide-y divide-sky-100">
                    <thead className="bg-sky-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-x font-medium text-sky-600 uppercase tracking-wider">GL Code</th>
                        <th scope="col" className="px-6 py-3 text-left text-x font-medium text-sky-600 uppercase tracking-wider">Account Name</th>
                        <th scope="col" className="px-6 py-3 text-left text-x font-medium text-sky-600 uppercase tracking-wider">Category</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-sky-100">
                      {entries.map((entry, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-sky-50'}>
                          <td className="px-6 py-4 whitespace-nowrap text-s font-medium text-gray-900">{entry.general_ledger_code}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-s text-gray-700">{entry.account_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-s text-gray-700">{entry.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={submitManualEntries}
                disabled={isLoading || entries.length === 0}
                className={`px-6 py-3 rounded-lg flex items-center transition-colors duration-200 ${
                  isLoading || entries.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isLoading ? (
                  <>
                    <TailSpin color="#FFFFFF" height={18} width={18} className="mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FiUpload className="mr-2" />
                    Upload {entries.length} {entries.length === 1 ? 'Entry' : 'Entries'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* File Upload Tab */}
        {activeTab === 'upload' && (
          <div>
            <div className='flex justify-between items-center'>
              <img src={upload} className='w-[350px]' alt="File upload illustration" />
              <div className="mb-8 w-[600px]">
                <label className="block mb-2 text-s font-medium text-gray-700">
                  Upload Excel File
                </label>
                <div 
                  className={`flex items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-200 ${
                    isDragging 
                      ? 'border-sky-400 bg-sky-50' 
                      : 'border-sky-200 hover:border-sky-300 bg-sky-50 hover:bg-sky-100'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                      <FiUpload className="w-10 h-10 mb-3 text-sky-400" />
                      <p className="mb-2 text-s text-gray-600">
                        <span className="font-semibold text-sky-600">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-x text-gray-500">
                        Excel files only (.xls, .xlsx). Max file size: 10MB
                      </p>
                      <input 
                        id="dropzone-file" 
                        type="file" 
                        className="hidden" 
                        accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={handleFileChange}
                        disabled={isLoading}
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {file && (
              <div className="mb-6 p-4 bg-sky-50 rounded-lg border border-sky-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FiFile className="w-5 h-5 text-sky-500 mr-3" />
                    <div>
                      <p className="text-s font-medium text-gray-700 truncate max-w-xs">{file.name}</p>
                      <p className="text-x text-gray-500">{(file.size / 1024 / 1024).toFixed(getDecimalPrecision())} MB</p>
                    </div>
                  </div>
                  <button 
                    onClick={removeFile}
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    disabled={isLoading}
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {fileUploadProgress > 0 && (
              <div className="mb-8">
                <div className="flex justify-between text-s text-gray-600 mb-1">
                  <span>Upload progress</span>
                  <span>{fileUploadProgress}%</span>
                </div>
                <div className="w-full bg-sky-100 rounded-full h-2.5">
                  <div 
                    className="bg-sky-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${fileUploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={submitFileUpload}
                disabled={isLoading || !file}
                className={`px-6 py-3 rounded-lg flex items-center transition-colors duration-200 ${
                  isLoading || !file
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isLoading ? (
                  <>
                    <TailSpin color="#FFFFFF" height={18} width={18} className="mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FiUpload className="mr-2" />
                    Upload File
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div>
            <div className='flex justify-between items-start'> {/* Use items-start for vertical alignment if heights differ */}
              <img src={upload} className='w-[350px]' alt="History illustration" /> {/* Replace with a history-specific image if available */}
              <div className="w-[600px] flex flex-col items-center">
                 <div className="w-full p-6 bg-sky-50 rounded-xl border border-sky-200 shadow-sm mb-8">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
                      Select Date to View Upload History
                    </h3>
                    <div className="flex justify-center">
                        <DatePicker
                          selected={selectedDate}
                          onChange={handleDateChange}
                          inline
                          showYearDropdown  // Added this prop
                          scrollableYearDropdown // Added this prop
                          yearDropdownItemNumber={15} // Optional: controls number of years in dropdown
                          dateFormat="MMMM d, yyyy" // Optional: formats the displayed date
                        />
                    </div>
                 </div>
                 {/* Placeholder for displaying fetched history data */}
                 <div className="w-full text-center p-4 bg-white rounded-lg border border-gray-200">
                    <h4 className="text-md font-semibold text-gray-700 mb-2">
                        History for: {selectedDate.toLocaleDateString()}
                    </h4>
                    <p className="text-s text-gray-500">
                        {/* Fetch and display actual history data here. 
                            For now, this is a placeholder. 
                            You might show a list, table, or summary. */}
                        No history data to display for this date yet. (Implement fetching logic)
                    </p>
                    {/* Example: if (historyData.length > 0) { map through historyData } else { <p>No entries.</p> } */}
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GLUploadScreen;