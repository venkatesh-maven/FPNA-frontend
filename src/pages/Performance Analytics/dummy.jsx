import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  FiSettings,
  FiLayout,
  FiActivity,
  FiBell,
  FiDatabase,
  FiLock,
  FiCheck,
  FiPlus,
  FiEdit2,
  FiUpload,
  FiFile,
  FiX,
  FiCalendar,
  FiList,
  FiTrash2,
  FiAlertTriangle,
  FiInfo,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as XLSX from 'xlsx';

// Imports
import { AuthContext } from '../../context/AuthContext'; // Adjust path if necessary
import { API_BASE_URL } from '../../config/config';   // Adjust path if necessary
import { TailSpin } from 'react-loader-spinner';
import { upload as glUploadIllustration } from '../../assets/Assets'; // Adjust path.
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Custom Header for React DatePicker - WITH SCROLLABLE YEAR DROPDOWN
const CustomCalendarHeader = ({
  date,
  changeYear,
  decreaseMonth,
  increaseMonth,
  prevMonthButtonDisabled,
  nextMonthButtonDisabled,
  yearItemNumber = 15,
  yearsToDisplayAroundCurrent = 7,
}) => {
  const currentYear = date.getFullYear();
  const currentMonthName = date.toLocaleString('default', { month: 'long' });

  const [showYearPicker, setShowYearPicker] = useState(false);
  const yearPickerRef = useRef(null);
  const yearDropdownRef = useRef(null);

  const startYear = currentYear - yearsToDisplayAroundCurrent;
  const yearDropdownValues = Array.from(
    { length: yearItemNumber },
    (_, i) => startYear + i
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        showYearPicker &&
        yearPickerRef.current && !yearPickerRef.current.contains(event.target) &&
        yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)
      ) {
        setShowYearPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showYearPicker]);


  const handleYearSelect = (year) => {
    changeYear(year);
    setShowYearPicker(false);
  };

  return (
    <div className="flex items-center justify-between px-1.5 py-1 bg-sky-100 border-b border-sky-200 rounded-t-md relative">
      <div className="flex items-center">
        <button
          onClick={decreaseMonth}
          disabled={prevMonthButtonDisabled}
          type="button"
          className="p-1.5 text-sky-700 hover:bg-sky-200 rounded-full disabled:opacity-50 focus:outline-none"
          aria-label="Previous Month"
        >
          <FiChevronLeft className="w-4 h-4" />
        </button>
        <span className="mx-2 text-x font-semibold text-sky-800 min-w-[70px] text-center">
          {currentMonthName}
        </span>
        <button
          onClick={increaseMonth}
          disabled={nextMonthButtonDisabled}
          type="button"
          className="p-1.5 text-sky-700 hover:bg-sky-200 rounded-full disabled:opacity-50 focus:outline-none"
          aria-label="Next Month"
        >
          <FiChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="relative">
        <button
          ref={yearPickerRef}
          type="button"
          onClick={() => setShowYearPicker(!showYearPicker)}
          className="text-x font-semibold text-sky-800 bg-transparent border-0 focus:outline-none p-1.5 hover:bg-sky-200 rounded-md"
        >
          {currentYear}
        </button>
        {showYearPicker && (
          <div
            ref={yearDropdownRef}
            className="absolute right-0 mt-1 w-24 max-h-40 overflow-y-auto bg-white border border-sky-200 rounded-md shadow-lg z-20 scrollbar-thin scrollbar-thumb-sky-300 scrollbar-track-sky-100"
          >
            {yearDropdownValues.map((year) => (
              <button
                key={year}
                onClick={() => handleYearSelect(year)}
                className={`w-full text-left px-3 py-1.5 text-x hover:bg-sky-100 ${
                  year === currentYear ? 'bg-sky-100 font-bold text-sky-700' : 'text-gray-700'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


const SettingsCustomization = () => {
  const [activeTab, setActiveTab] = useState('glfile');

  const [colorSettings, setColorSettings] = useState({
    primaryColor: '#0C4A6E', // Example: Tailwind sky-800
    textColor: '#374151',    // Example: Tailwind gray-700
    backgroundColor: '#F9FAFB', // Example: Tailwind gray-50
    fontSize: '14px',
    fontFamily: 'Inter'
  });
  const [emailNotifications, setEmailNotifications] = useState({
    transactionAlerts: true,
    reportReady: true,
    systemUpdates: false,
    weeklySummary: true
  });

  const { authToken } = useContext(AuthContext); // Assuming AuthContext provides authToken
  const [glActiveTab, setGLActiveTab] = useState('manual');
  const [glFile, setGLFile] = useState(null);
  const [isGLLoading, setIsGLLoading] = useState(false);
  const [isGLDragging, setIsGLDragging] = useState(false);
  
  // GL History States
  const [glSelectedDate, setGLSelectedDate] = useState(new Date());
  const [glHistoryFetchDate, setGLHistoryFetchDate] = useState(null);
  const [glHistoryData, setGLHistoryData] = useState(null);
  const [isFetchingGLHistory, setIsFetchingGLHistory] = useState(false);


  const [glFormData, setGLFormData] = useState({
    general_ledger_code: '',
    account_name: '',
    category: ''
  });
  const [glEntries, setGLEntries] = useState([]);
  const [glParsedFileEntries, setGLParsedFileEntries] = useState([]);

  const [allGLCodesData, setAllGLCodesData] = useState(null);
  const [totalGLCodesCount, setTotalGLCodesCount] = useState(0);
  const [isFetchingAllGLCodes, setIsFetchingAllGLCodes] = useState(false);
  
  // States for Editing GL Code
  const [editingGLCode, setEditingGLCode] = useState(null);
  const [editFormData, setEditFormData] = useState({ account_name: '', category: '' });
  const [isUpdatingGLCode, setIsUpdatingGLCode] = useState(false);

  // States for Deleting GL Code
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [glCodeToDelete, setGLCodeToDelete] = useState(null);
  const [isDeletingGLCode, setIsDeletingGLCode] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  const showGLToast = (message, type = 'success', duration = 3000) => {
    toast[type](message, {
      position: "top-right", autoClose: duration, hideProgressBar: false,
      closeOnClick: true, pauseOnHover: true, draggable: true, progress: undefined,
    });
  };

  // GL History: Update selected date in DatePicker
  const handleGLDateChange = (date) => {
    setGLSelectedDate(date);
  };

  // GL History: Fetch data for the selected date
  const fetchGLHistoryForSelectedDate = async () => {
    if (!glSelectedDate) {
      showGLToast('Please select a date first.', 'info');
      return;
    }
    setGLHistoryFetchDate(glSelectedDate);
    setIsFetchingGLHistory(true);
    setGLHistoryData(null);
    showGLToast(`Fetching history for ${glSelectedDate.toLocaleDateString()}`, 'info');

    try {
      // --- SIMULATED FETCH FOR DEMO ---
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockData = [
        { id: 1, general_ledger_code: 1001, account_name: "Cash & Bank", amount: 12500.75, type_of_entry: "File Upload", created_at: new Date(glSelectedDate.getFullYear(), glSelectedDate.getMonth(), glSelectedDate.getDate(), 9, 30).toISOString() },
        { id: 2, general_ledger_code: 6010, account_name: "Office Supplies Expense", amount: -150.20, type_of_entry: "Manual Entry", created_at: new Date(glSelectedDate.getFullYear(), glSelectedDate.getMonth(), glSelectedDate.getDate(), 14, 15).toISOString() },
        { id: 3, general_ledger_code: 4000, account_name: "Sales Revenue", amount: 7800.00, type_of_entry: "System Generated", created_at: new Date(glSelectedDate.getFullYear(), glSelectedDate.getMonth(), glSelectedDate.getDate(), 11, 0).toISOString() }
      ];
      if (glSelectedDate.getDate() % 3 !== 0) { // Simulate data for most dates
          setGLHistoryData(mockData);
          showGLToast(`Simulated history for ${glSelectedDate.toLocaleDateString()} fetched.`, 'success');
      } else {
          setGLHistoryData([]);
          showGLToast(`No history found for ${glSelectedDate.toLocaleDateString()}.`, 'info');
      }
    } catch (error) {
      showGLToast(error.message, 'error', 5000);
      setGLHistoryData([]);
    } finally {
      setIsFetchingGLHistory(false);
    }
  };


  const handleGLInputChange = (e) => {
    const { name, value } = e.target;
    setGLFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGLAddEntry = () => {
    if (!glFormData.general_ledger_code || !glFormData.account_name || !glFormData.category) {
      showGLToast('All GL entry fields are required', 'error'); return;
    }
    if (isNaN(Number(glFormData.general_ledger_code))) {
      showGLToast('GL Code must be a number', 'error'); return;
    }
    setGLEntries([...glEntries, { ...glFormData, general_ledger_code: Number(glFormData.general_ledger_code) }]);
    setGLFormData({ general_ledger_code: '', account_name: '', category: '' });
    showGLToast('GL Entry added successfully');
  };

  const handleGLDragOver = (e) => { e.preventDefault(); setIsGLDragging(true); };
  const handleGLDragLeave = () => { setIsGLDragging(false); };
  const handleGLDrop = (e) => {
    e.preventDefault(); setIsGLDragging(false);
    const selectedFile = e.dataTransfer.files[0];
    handleGLFileValidationAndParse(selectedFile);
  };
  const handleGLFilePickerChange = (e) => {
    const selectedFile = e.target.files[0];
    handleGLFileValidationAndParse(selectedFile);
    e.target.value = null;
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: ["general_ledger_code", "account_name", "category"], range: 1
          });
          const validatedData = jsonData.map((row, index) => {
            const rowNum = index + 2;
            if (row.general_ledger_code === undefined || row.account_name === undefined || row.category === undefined) {
              throw new Error(`Row ${rowNum} is missing required columns. Expected: 'general_ledger_code', 'account_name', 'category'.`);
            }
            if (row.general_ledger_code === null || row.general_ledger_code === '' || isNaN(Number(row.general_ledger_code))) {
              throw new Error(`Invalid GL Code in Excel (Row ${rowNum}): '${row.general_ledger_code}' must be a non-empty number.`);
            }
            return {
              general_ledger_code: Number(row.general_ledger_code),
              account_name: String(row.account_name).trim() || `N/A (Row ${rowNum})`,
              category: String(row.category).trim() || `N/A (Row ${rowNum})`
            };
          });
          resolve(validatedData);
        } catch (err) { reject(err); }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const handleGLFileValidationAndParse = async (selectedFile) => {
    if (selectedFile) {
      const validTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'];
      const validExtensions = ['.xls', '.xlsx'];
      const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      const isTypeValid = validTypes.includes(selectedFile.type);
      const isExtensionValid = validExtensions.includes(fileExtension);

      if (!isTypeValid && !(selectedFile.type === 'application/octet-stream' && isExtensionValid)) {
        showGLToast('Please upload a valid Excel file (.xls, .xlsx)', 'error'); return;
      }
      setGLFile(selectedFile);
      setIsGLLoading(true);
      setGLParsedFileEntries([]);
      try {
        const parsedData = await parseExcelFile(selectedFile);
        setGLParsedFileEntries(parsedData);
        showGLToast(`GL File '${selectedFile.name}' parsed. ${parsedData.length} entries found. Review and submit.`, 'success', 4000);
      } catch (error) {
        showGLToast(`Error parsing file: ${error.message}`, 'error', 5000);
        setGLFile(null);
      } finally { setIsGLLoading(false); }
    }
  };

  const handleParsedEntryChange = (index, field, value) => {
    setGLParsedFileEntries(prevEntries =>
      prevEntries.map((entry, i) =>
        i === index ? { ...entry, [field]: field === 'general_ledger_code' ? (value === '' ? '' : Number(value)) : value } : entry
      )
    );
  };

  const removeGLFileAndParsedData = () => {
    setGLFile(null); setGLParsedFileEntries([]);
  };

  const submitGLDataToMaster = async (entriesToSubmit, source) => {
    if (entriesToSubmit.length === 0) {
      showGLToast(`Please add or parse at least one GL entry to upload from ${source}.`, 'error'); return;
    }
    const invalidEntry = entriesToSubmit.find(entry =>
        entry.general_ledger_code === '' || entry.general_ledger_code === null || isNaN(Number(entry.general_ledger_code)) ||
        !entry.account_name || entry.account_name.startsWith('N/A (Row') ||
        !entry.category || entry.category.startsWith('N/A (Row')
    );
    if (invalidEntry) {
        showGLToast('All fields (GL Code, Account Name, Category) are required for every entry, and GL Code must be a number. Please correct any "N/A" values from parsing.', 'error', 6000);
        return;
    }
    setIsGLLoading(true);
    try {
      const payload = {
        data: entriesToSubmit.map(entry => ({
          general_ledger_code: Number(entry.general_ledger_code),
          account_name: String(entry.account_name),
          category: String(entry.category)
        }))
      };
      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-master/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(payload)
      });
      const responseData = await response.json();
      if (!response.ok) {
        if (response.status === 422 && responseData.detail && Array.isArray(responseData.detail)) {
          const errorMessages = responseData.detail.map(err => `${err.loc.join(' -> ')}: ${err.msg}`).join('; ');
          throw new Error(`Validation Error: ${errorMessages}`);
        }
        throw new Error(responseData.detail || responseData.message || `Failed to upload GL data from ${source}. Status: ${response.status}`);
      }
      showGLToast(responseData.message || `${entriesToSubmit.length} GL entries uploaded successfully from ${source}!`, 'success');
      if (responseData.created_ids) console.log("Created IDs:", responseData.created_ids);
      if (responseData.skipped_gl_codes && responseData.skipped_gl_codes.length > 0) {
          showGLToast(`Skipped GL Codes: ${responseData.skipped_gl_codes.join(', ')}`, 'warning', 5000);
      }
      if (source === 'manual entry') { setGLEntries([]); }
      else if (source === 'file upload') { setGLParsedFileEntries([]); setGLFile(null); }
    } catch (error) { showGLToast(error.message, 'error', 6000); }
    finally { setIsGLLoading(false); }
  };

  const submitGLManualEntries = () => { submitGLDataToMaster(glEntries, 'manual entry'); };
  const submitGLParsedFileEntries = () => { submitGLDataToMaster(glParsedFileEntries, 'file upload'); };

  const fetchAllGLCodes = async (showToasts = true) => {
    if(showToasts) setIsFetchingAllGLCodes(true);
    if(showToasts) setAllGLCodesData(null);
    if(showToasts) setTotalGLCodesCount(0);
    if(showToasts && !isFetchingAllGLCodes) showGLToast('Fetching all GL codes...', 'info');

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-master/codes`, {
        method: 'GET', headers: { 'Authorization': `Bearer ${authToken}`, 'Accept': 'application/json' }
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.detail || `Failed to fetch GL codes. Status: ${response.status}`);
      }
      const codes = responseData.master_gl_info;
      const count = responseData.count;
      if (codes && Array.isArray(codes)) {
        if (codes.length === 0 && showToasts) {
          showGLToast('No GL codes found or empty list returned.', 'warning');
        } else if (showToasts && codes.length > 0) {
          showGLToast(`Successfully fetched ${codes.length} of ${count || codes.length} GL codes!`, 'success');
        }
        setAllGLCodesData(codes);
        setTotalGLCodesCount(count || codes.length);
      } else {
        if(showToasts) showGLToast('Unexpected response structure for GL codes.', 'error');
        setAllGLCodesData([]); setTotalGLCodesCount(0);
      }
    } catch (error) {
      if(showToasts) showGLToast(error.message, 'error', 5000);
      setAllGLCodesData([]); setTotalGLCodesCount(0);
    } finally { if(showToasts) setIsFetchingAllGLCodes(false); }
  };
  
  // --- Edit Functions ---
  const openEditDialog = (glCode) => {
    setEditingGLCode(glCode);
    setEditFormData({
      account_name: glCode.account_name,
      category: glCode.category,
    });
  };

  const closeEditDialog = () => {
    setEditingGLCode(null);
    setEditFormData({ account_name: '', category: '' });
  };
  
  const handleUpdateGLCode = async () => {
    if (!editingGLCode || !editFormData.account_name || !editFormData.category) {
      showGLToast('Account Name and Category cannot be empty.', 'error');
      return;
    }
    setIsUpdatingGLCode(true);
    try {
      const payload = {
        account_name: editFormData.account_name,
        category: editFormData.category,
      };
      
      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-master/${editingGLCode.general_ledger_code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(payload)
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.detail || `Failed to update GL Account ${editingGLCode.general_ledger_code}.`);
      }
      showGLToast(responseData.message || `GL Account '${editingGLCode.general_ledger_code}' updated successfully!`, 'success');
      
      closeEditDialog();
      fetchAllGLCodes(false); // Refresh list without showing loading indicators
    } catch (error) {
      showGLToast(error.message, 'error', 6000);
    } finally {
      setIsUpdatingGLCode(false);
    }
  };

  // --- Delete Functions ---
  const openDeleteConfirmDialog = (glCode) => { setGLCodeToDelete(glCode); setShowDeleteConfirm(true); };
  const closeDeleteConfirmDialog = () => { setGLCodeToDelete(null); setShowDeleteConfirm(false); };

  const handleDeleteGLCode = async () => {
    if (!glCodeToDelete) return;
    setIsDeletingGLCode(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-master/${glCodeToDelete.general_ledger_code}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}`, 'Accept': 'application/json' }
      });
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
         if (response.status === 422 && responseData.detail && Array.isArray(responseData.detail)) {
          const errorMessages = responseData.detail.map(err => `${err.loc.join(' -> ')}: ${err.msg}`).join('; ');
          throw new Error(`Validation Error: ${errorMessages}`);
        }
        throw new Error(responseData.message || responseData.detail || `Failed to delete GL Account ${glCodeToDelete.general_ledger_code}. Status: ${response.status}`);
      }
      showGLToast(responseData.message || `GL Account '${glCodeToDelete.general_ledger_code}' cleared successfully!`, 'success');
      closeDeleteConfirmDialog();
      fetchAllGLCodes(false);
    } catch (error) { showGLToast(error.message, 'error', 6000); }
    finally { setIsDeletingGLCode(false); }
  };

  const glIllustrationCommonStyle = 'w-full max-w-[180px] h-auto self-center lg:self-start mb-4 lg:mb-0';

  const menuItems = [
    { id: 'glfile', title: 'Upload GL', icon: <FiUpload /> },
    { id: 'dashboard', title: 'Dashboard UI', icon: <FiLayout /> },
    { id: 'reports', title: 'Reports & Workflow', icon: <FiActivity /> },
    { id: 'alerts', title: 'Alerts & Notifications', icon: <FiBell /> },
    { id: 'system', title: 'System & Data', icon: <FiDatabase /> },
    { id: 'roles', title: 'Role Access', icon: <FiLock /> }
  ];

  const handleColorChange = (e, field) => setColorSettings(prev => ({ ...prev, [field]: e.target.value }));
  const handleSubmitSettings = () => { console.log('Sending UI settings to backend:', colorSettings); toast.success('UI settings saved successfully!'); };
  const handleEmailNotificationChange = (field) => setEmailNotifications(prev => ({ ...prev, [field]: !prev[field] }));

  return (
    <div className="p-4 sm:p-6 bg-sky-50 min-h-screen">
      <ToastContainer position="top-right" autoClose={3000} newestOnTop />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#004a80] to-[#cfe6f7] p-4 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <FiSettings className="w-6 h-6 text-white mr-3" />
            <h1 className="text-xl font-bold text-white">Settings & Customization</h1>
          </div>
        </div>
      </div>

      {/* Horizontal Tab Navigation */}
      <div className="mb-6 bg-white p-2 rounded-lg shadow">
        <nav className="flex flex-wrap gap-x-1 gap-y-1 sm:gap-x-2">
          {menuItems.map((item) => (
            <button
              key={item.id} onClick={() => setActiveTab(item.id)}
              className={`flex items-center px-3 py-2.5 sm:px-4 text-x sm:text-s font-medium rounded-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sky-500
                ${activeTab === item.id
                  ? 'bg-sky-700 text-white shadow-sm'
                  : 'text-sky-700 hover:bg-sky-100 hover:text-sky-800'
                }`}
            >
              {React.cloneElement(item.icon, { className: "w-4 h-4 sm:w-5 sm:h-5 mr-2" })}
              {item.title}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-xl p-6 ">
        {activeTab === 'glfile' && (
          <div>
            <h3 className="text-2xl font-semibold text-sky-800 mb-1">Upload General Ledger File</h3>
            <p className="text-gray-600 mb-6 text-s">Manage General Ledger data by manual entry, file upload, view history, or list all GL codes.</p>
            <div className="flex border-b border-sky-200 mb-8">
              {[
                { id: 'manual', label: 'Manual Entry', icon: FiPlus },
                { id: 'upload', label: 'File Upload', icon: FiUpload },
                { id: 'history', label: 'History', icon: FiCalendar },
                { id: 'allGLCodes', label: 'All GL Codes', icon: FiList }
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`py-3 px-4 sm:px-6 font-medium text-x sm:text-s flex items-center focus:outline-none
                    ${ glActiveTab === tab.id
                      ? 'text-sky-600 border-b-2 border-sky-600'
                      : 'text-gray-500 hover:text-sky-500 hover:border-b-2 hover:border-sky-300'
                    }`}
                  onClick={() => {
                    setGLActiveTab(tab.id);
                    if (tab.id !== 'manual') setGLEntries([]);
                    if (tab.id !== 'upload') { setGLFile(null); setGLParsedFileEntries([]);}
                    if (tab.id !== 'history') { setGLHistoryData(null); setGLHistoryFetchDate(null); }
                  }}
                >
                  <tab.icon className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" /> {tab.label}
                </button>
              ))}
            </div>

            {glActiveTab === 'manual' && ( <div className="flex flex-col">{/*...Manual Entry UI...*/}</div> )}
            {glActiveTab === 'upload' && ( <div>{/*...File Upload UI...*/}</div> )}
            {glActiveTab === 'history' && ( <div>{/*...History UI...*/}</div> )}
            
            {glActiveTab === 'allGLCodes' && (
              <div className="flex flex-col">
                <div className='flex flex-col lg:flex-row items-start gap-6 mb-6'>
                  <div className="flex-shrink-0">
                    <img src={glUploadIllustration} className={glIllustrationCommonStyle} alt="All GL codes illustration" />
                  </div>
                  <div className="flex-grow w-full">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xl font-semibold text-sky-800">All General Ledger Codes</h4>
                      {allGLCodesData && (
                          <span className="text-s text-sky-600 bg-sky-100 px-3 py-1 rounded-full">
                              Displaying {allGLCodesData.length} of {totalGLCodesCount} codes
                          </span>
                      )}
                    </div>
                    <p className="text-s text-gray-600 mb-4">
                      View, edit, or delete General Ledger codes currently in the system.
                    </p>
                    <button
                      onClick={() => fetchAllGLCodes(true)}
                      disabled={isFetchingAllGLCodes}
                      className={`bg-teal-500 hover:bg-teal-600 text-white px-5 py-2.5 rounded-lg flex items-center text-s ${isFetchingAllGLCodes ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isFetchingAllGLCodes ? (
                        <><TailSpin color="#FFFFFF" height={18} width={18} className="mr-2" /> Fetching...</>
                      ) : (
                        <><FiList className="mr-2" /> {allGLCodesData ? 'Refresh' : 'Fetch'} All GL Codes</>
                      )}
                    </button>
                  </div>
                </div>

                {isFetchingAllGLCodes && !allGLCodesData && (
                  <div className="text-center py-8">
                    <TailSpin color="#0EA5E9" height={40} width={40} />
                    <p className="text-sky-600 mt-2">Loading GL Codes...</p>
                  </div>
                )}

                {allGLCodesData && allGLCodesData.length === 0 && !isFetchingAllGLCodes && (
                   <div className="p-4 text-center bg-yellow-50 border border-yellow-300 rounded-lg">
                      <FiInfo className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                      <p className="text-yellow-700">No General Ledger codes found or the list is empty.</p>
                  </div>
                )}

                {allGLCodesData && allGLCodesData.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-sky-100 max-h-[calc(100vh-350px)]">
                    <table className="min-w-full divide-y divide-sky-100">
                      <thead className="bg-sky-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-x font-medium text-sky-600 uppercase tracking-wider">GL Code</th>
                          <th className="px-3 py-2.5 text-left text-x font-medium text-sky-600 uppercase tracking-wider">Account Name</th>
                          <th className="px-3 py-2.5 text-left text-x font-medium text-sky-600 uppercase tracking-wider">Category</th>
                          <th className="px-3 py-2.5 text-left text-x font-medium text-sky-600 uppercase tracking-wider">Created At</th>
                          <th className="px-3 py-2.5 text-left text-x font-medium text-sky-600 uppercase tracking-wider">Updated At</th>
                          <th className="px-3 py-2.5 text-left text-x font-medium text-sky-600 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-sky-100">
                        {allGLCodesData.map((code, index) => (
                          <tr key={code.id || index} className="hover:bg-sky-50/70">
                            <td className="px-3 py-2 whitespace-nowrap text-s text-gray-800">{code.general_ledger_code}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-s text-gray-700">{code.account_name}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-s text-gray-700">{code.category}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-s text-gray-500">{formatDate(code.created_at)}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-s text-gray-500">{formatDate(code.updated_at)}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-s text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <button onClick={() => openEditDialog(code)} className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-100 rounded-md transition-colors" title={`Edit GL Account ${code.general_ledger_code}`}><FiEdit2 className="w-4 h-4" /></button>
                                <button onClick={() => openDeleteConfirmDialog(code)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors" title={`Delete GL Account ${code.general_ledger_code}`}><FiTrash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Other main tabs (dashboard, reports, etc.) */}
        {activeTab === 'dashboard' && ( <div>{/*...Dashboard UI content...*/}</div> )}
        {activeTab === 'reports' && ( <div>{/*...Reports UI content...*/}</div> )}
        {activeTab === 'alerts' && ( <div>{/*...Alerts UI content...*/}</div> )}
        {activeTab === 'system' && ( <div>{/*...System UI content...*/}</div> )}
        {activeTab === 'roles' && ( <div>{/*...Roles UI content...*/}</div> )}
      </div>

      {/* Edit GL Code Modal */}
      {editingGLCode && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
               <h3 className="text-lg font-semibold text-gray-900">Edit GL Account</h3>
               <button onClick={closeEditDialog} className="p-1.5 rounded-full hover:bg-gray-100"><FiX className="w-5 h-5 text-gray-500"/></button>
            </div>
            <div className="space-y-4">
              <div>
                  <label className="block text-s font-medium text-gray-700">GL Code (Read-only)</label>
                  <input type="text" value={editingGLCode.general_ledger_code} readOnly className="mt-1 block w-full bg-gray-100 border-gray-300 rounded-md shadow-sm p-2 text-s" />
              </div>
              <div>
                  <label htmlFor="edit_account_name" className="block text-s font-medium text-gray-700">Account Name</label>
                  <input id="edit_account_name" type="text" value={editFormData.account_name} onChange={(e) => setEditFormData({...editFormData, account_name: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 text-s focus:ring-sky-500 focus:border-sky-500" />
              </div>
              <div>
                  <label htmlFor="edit_category" className="block text-s font-medium text-gray-700">Category</label>
                  <input id="edit_category" type="text" value={editFormData.category} onChange={(e) => setEditFormData({...editFormData, category: e.target.value})} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 text-s focus:ring-sky-500 focus:border-sky-500" />
              </div>
            </div>
            <div className="mt-8 flex justify-end space-x-3">
              <button onClick={closeEditDialog} disabled={isUpdatingGLCode} className="px-4 py-2 text-s font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50">Cancel</button>
              <button onClick={handleUpdateGLCode} disabled={isUpdatingGLCode} className="px-4 py-2 text-s font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md border border-sky-600 disabled:opacity-50 disabled:bg-sky-400 flex items-center">
                {isUpdatingGLCode ? (<><TailSpin color="#FFFFFF" height={16} width={16} className="mr-2" /> Saving...</>) : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && glCodeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex items-start">
              <div className="mr-3 flex-shrink-0 bg-red-100 rounded-full p-2">
                 <FiAlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete GL Account</h3>
                <p className="text-s text-gray-600 mb-1">
                  Are you sure you want to delete GL Account:
                </p>
                <p className="text-s font-medium text-gray-800">
                    Code: <span className="text-red-600">{glCodeToDelete.general_ledger_code}</span>
                </p>
                 <p className="text-s font-medium text-gray-800">
                    Name: <span className="text-red-600">{glCodeToDelete.account_name}</span>
                </p>
                <p className="text-x text-gray-500 mt-3">This action cannot be undone.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={closeDeleteConfirmDialog}
                disabled={isDeletingGLCode}
                className="px-4 py-2 text-s font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300 disabled:opacity-50"
              >
                No, Cancel
              </button>
              <button
                onClick={handleDeleteGLCode}
                disabled={isDeletingGLCode}
                className="px-4 py-2 text-s font-medium text-white bg-red-600 hover:bg-red-700 rounded-md border border-red-600 disabled:opacity-50 disabled:bg-red-400 flex items-center"
              >
                {isDeletingGLCode ? (
                  <><TailSpin color="#FFFFFF" height={16} width={16} className="mr-2" /> Deleting...</>
                ) : (
                  "Yes, Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        .react-datepicker-small .react-datepicker__month-container { width: 100%; }
        .react-datepicker-small .react-datepicker__day,
        .react-datepicker-small .react-datepicker__day-name {
          margin: 0.1rem;
          font-size: 0.7rem;
          line-height: 1.4rem;
          width: 1.4rem;
          height: 1.4rem;
        }
        .react-datepicker-small .react-datepicker__header--custom {
          background-color: transparent; border-bottom: none; padding: 0;
        }
        .react-datepicker-popper[data-placement^=top] .react-datepicker__triangle::before,
        .react-datepicker-popper[data-placement^=bottom] .react-datepicker__triangle::before,
        .react-datepicker-popper[data-placement^=top] .react-datepicker__triangle::after,
        .react-datepicker-popper[data-placement^=bottom] .react-datepicker__triangle::after {
          /* You might need to adjust triangle colors if they don't match the custom header */
        }
        .react-datepicker-inline { width: 100%; }

        /* Tailwind CSS Scrollbar Plugin (optional, but makes it look nicer) */
        .scrollbar-thin { scrollbar-width: thin; }
        .scrollbar-thumb-sky-300::-webkit-scrollbar-thumb { --tw-scrollbar-thumb: #7dd3fc; background-color: var(--tw-scrollbar-thumb); }
        .scrollbar-thumb-sky-300 { scrollbar-color: #7dd3fc var(--tw-scrollbar-track); }
        .scrollbar-track-sky-100::-webkit-scrollbar-track { --tw-scrollbar-track: #e0f2fe; background-color: var(--tw-scrollbar-track); }
        .scrollbar-track-sky-100 { --tw-scrollbar-track: #e0f2fe; }

      `}</style>
    </div>
  );
};

export default SettingsCustomization;