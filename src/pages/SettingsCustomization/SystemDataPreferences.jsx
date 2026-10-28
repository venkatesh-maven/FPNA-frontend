import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiSave, FiDownload, FiTrash2, FiEdit2, FiSearch, FiPlus } from 'react-icons/fi';
import * as XLSX from 'xlsx';

// Import components
import GLMasterView from './GL-Uploads/GLMasterView ';
import GLCreateForm from './GL-Uploads/GLCreateForm';
import GLEntriesTable from './GL-Uploads/GLEntriesTable.jsx';
import IntegrationHistoryTable from './GL-Uploads/IntegrationHistoryTable.jsx';
import GLMasterEditModal from './GL-Uploads/GLMasterEditModal';
import GLEntryEditModal from './GL-Uploads/GLEntryEditModal';
import DeleteConfirmationModal from './GL-Uploads/DeleteConfirmationModal.jsx';
import GLUploadWizard from './DataUpload/GLUploadWizard.jsx';
import UploadHistoryPanel from './DataUpload/UploadHistoryPanel.jsx';
import GLAccountsSummary from './DataUpload/GLAccountsSummary.jsx';
import GLEntriesExplorer from './DataUpload/GLEntriesExplorer.jsx';
import { OPEN_TAB_EVENT } from './DataUpload/acceptedDataStore.js';
import { API_BASE_URL } from '../../config/config.js';

const SystemDataPreferences = ({ token }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [showLegacy, setShowLegacy] = useState(false);

  // Other panels (upload result, accounts view) can ask to switch tab.
  useEffect(() => {
    const onOpen = (e) => {
      const tab = e.detail?.tab;
      if (['create', 'view', 'entries', 'history'].includes(tab)) {
        setActiveTab(tab);
        setCurrentPage(1);
      }
    };
    window.addEventListener(OPEN_TAB_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TAB_EVENT, onOpen);
  }, []);
  const [glMasterData, setGlMasterData] = useState([]);
  const [glEntries, setGlEntries] = useState([]);
  const [integrationHistory, setIntegrationHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataFormat, setDataFormat] = useState('json');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [entryToDelete, setEntryToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Fetch GL Master Data
  const fetchGlMasterData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-master/codes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch GL master data');
      }
      
      const data = await response.json();
      setGlMasterData(data.master_gl_info || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch GL Entries
  const fetchGlEntries = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-entries?page=${currentPage}&limit=${itemsPerPage}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch GL entries');
      }
      
      const data = await response.json();
      setGlEntries(data.data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Integration History
  const fetchIntegrationHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/integration-history?page=${currentPage}&limit=${itemsPerPage}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch integration history');
      }
      
      const data = await response.json();
      setIntegrationHistory(data.records || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle download of GL master data
  const handleDownload = () => {
    const dataToExport = glMasterData.map(item => ({
      general_ledger_code: item.general_ledger_code,
      account_name: item.account_name,
      category: item.category,
      tags: item.tags?.join(', ') || ''
    }));

    if (dataFormat === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gl-master-data.json';
      a.click();
      URL.revokeObjectURL(url);
    } else if (dataFormat === 'csv') {
      const csvContent = [
        ['General Ledger Code', 'Account Name', 'Category', 'Tags'],
        ...dataToExport.map(item => [item.general_ledger_code, item.account_name, item.category, item.tags])
      ].map(e => e.join(',')).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gl-master-data.csv';
      a.click();
      URL.revokeObjectURL(url);
    } else if (dataFormat === 'excel') {
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'GL Master Data');
      XLSX.write_file(wb, 'gl-master-data.xlsx');
    }

    toast.success('GL master data downloaded successfully!');
  };

  // Handle delete of GL account
  const handleDeleteGlAccount = async (glCode) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-master/${glCode}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete GL account');
      }
      
      toast.success('GL account deleted successfully!');
      setShowDeleteModal(false);
      fetchGlMasterData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete of GL entry
  const handleDeleteEntry = async (entryId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-entries/item/${entryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete GL entry');
      }
      
      toast.success('GL entry deleted successfully!');
      setShowDeleteModal(false);
      fetchGlEntries();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete of integration history item
  const handleDeleteHistoryItem = async (historyId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/integration-history/${historyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete history item');
      }
      
      toast.success('History item deleted successfully!');
      setShowDeleteModal(false);
      fetchIntegrationHistory();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle update of GL entry
const handleUpdateEntry = async (updatedEntry) => {
  try {
    if (!updatedEntry.id || typeof updatedEntry.id !== 'string') {
      toast.error('Invalid or missing entry ID');
      return;
    }

    setLoading(true);

    const isDebit = parseFloat(updatedEntry.debit) > 0;
    const isCredit = parseFloat(updatedEntry.credit) > 0;

    if (isDebit && isCredit) {
      toast.error('Cannot enter both debit and credit');
      return;
    }

    if (!isDebit && !isCredit) {
      toast.error('Enter at least debit or credit');
      return;
    }

    const payload = {
      date: updatedEntry.date ? new Date(updatedEntry.date).toISOString() : null,
      general_ledger_code: updatedEntry.general_ledger_code ? parseInt(updatedEntry.general_ledger_code) : null,
      account_name: updatedEntry.account_name || null,
      category: updatedEntry.category || null,
      description: updatedEntry.description || null,
      ...(isDebit ? { debit: parseFloat(updatedEntry.debit) } : { credit: parseFloat(updatedEntry.credit) }),
    };

    console.log('Sending PATCH payload:', payload);

    const response = await fetch(`${API_BASE_URL}/api/v1/company/financial/gl-entries/item/${updatedEntry.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error Response:', errorData);
      throw new Error(errorData.message || 'Failed to update GL entry');
    }

    toast.success('GL entry updated successfully!');
    setShowEditModal(false);
    fetchGlEntries();
  } catch (error) {
    toast.error(error.message);
  } finally {
    setLoading(false);
  }
};




  // Handle update of GL Master Account
const handleUpdateGlAccount = async (updatedAccount) => {
  try {
    setLoading(true);
    
    const response = await fetch(
      `${API_BASE_URL}/api/v1/company/financial/gl-master/${updatedAccount.general_ledger_code}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          general_ledger_code: updatedAccount.general_ledger_code, // ✅ Include this
          account_name: updatedAccount.account_name,
          category: updatedAccount.category,
          tags: updatedAccount.tags || []
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Update error:', errorData); // optional debugging
      throw new Error('Failed to update GL account');
    }

    toast.success('GL account updated successfully!');
    setShowEditModal(false);
    fetchGlMasterData();
  } catch (error) {
    toast.error(error.message);
  } finally {
    setLoading(false);
  }
};


  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    setCurrentPage(newPage);
  };

  // Calculate total pages for each tab
  const totalGlMasterPages = Math.ceil(glMasterData.length / itemsPerPage);
  const totalGlEntriesPages = Math.ceil(glEntries.length / itemsPerPage);
  const totalHistoryPages = Math.ceil(integrationHistory.length / itemsPerPage);

  // Fetch data when tab or page changes
  useEffect(() => {
    if (activeTab === 'view') {
      fetchGlMasterData();
    } else if (activeTab === 'entries') {
      fetchGlEntries();
    } else if (activeTab === 'history') {
      fetchIntegrationHistory();
    }
  }, [activeTab, currentPage]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#004a80] mb-4">General Ledger Accounts Management</h2>
      <p className="text-gray-600 mb-6">Manage GL accounts, entries, and integration history.</p>

      {/* Tabs */}
      <div className="mb-2">
        <nav className="flex flex-wrap border-b inline-block border-sky-200">
  {[
    { key: 'create', label: 'Financial Data Upload' },
    { key: 'view', label: 'View Financial Data Accounts' },
    { key: 'entries', label: 'Financial Data Entries' },
    { key: 'history', label: 'Integration History' },
  ].map(tab => (
    <button
      key={tab.key}
      onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
      className={`px-4 py-2 font-medium text-s rounded-t-lg mr-2 transition-all 
        ${activeTab === tab.key 
          ? 'bg-sky-700 text-white shadow-md' 
          : 'bg-sky-100 text-sky-700 hover:bg-sky-100'}`}
    >
      {tab.label}
    </button>
  ))}
</nav>

      </div>

      {/* Tab Content */}
      <div className="">
        {activeTab === 'view' && <GLAccountsSummary />}
        {(activeTab === 'view' || activeTab === 'entries') && (
          <div className="mt-6 mb-3">
            <button
              type="button"
              onClick={() => setShowLegacy((v) => !v)}
              className="text-sm text-slate-500 hover:text-sky-700 underline"
            >
              {showLegacy ? 'Hide earlier system data' : 'Show earlier system data'}
            </button>
          </div>
        )}
        {activeTab === 'view' && showLegacy && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-gray-700">GL Accounts</h3>
              <div className="flex space-x-2">
                <div className="relative">
                  <select
                    value={dataFormat}
                    onChange={(e) => setDataFormat(e.target.value)}
                    className="appearance-none bg-white border border-gray-300 rounded px-3 py-1 pr-8 focus:outline-none focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80] text-s"
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                    <option value="excel">Excel</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
                <button
                  onClick={handleDownload}
                  disabled={!glMasterData.length}
                  className="flex items-center bg-[#004a80] text-white px-3 py-1 rounded hover:bg-[#003366] disabled:opacity-50 text-s"
                >
                  <FiDownload className="mr-1" />
                  Download
                </button>
              </div>
            </div>

            <GLMasterView
              data={glMasterData}
              loading={loading}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              totalPages={totalGlMasterPages}
              onPageChange={handlePageChange}
              onDelete={(glCode, accountName) => {
                setEntryToDelete({ id: glCode, name: accountName });
                setShowDeleteModal(true);
              }}
              onEdit={(item) => {
                setEntryToEdit(item);
                setShowEditModal(true);
              }}
              searchTerm={searchTerm}
              onSearchChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
        

        {activeTab === 'create' && <GLUploadWizard />}

        {activeTab === 'entries' && <GLEntriesExplorer />}
        {activeTab === 'entries' && showLegacy && (
          <div>
            <h3 className="font-medium text-gray-700 mb-4">GL Entries</h3>
            <GLEntriesTable
              data={glEntries}
              loading={loading}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              totalPages={totalGlEntriesPages}
              onPageChange={handlePageChange}
              onEdit={(item) => {
                setEntryToEdit(item);
                setShowEditModal(true);
              }}
              onDelete={(id, name) => {
                setEntryToDelete({ id, name });
                setShowDeleteModal(true);
              }}
              searchTerm={searchTerm}
              onSearchChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <UploadHistoryPanel />
            <h3 className="font-medium text-gray-700 mb-4">Earlier system imports</h3>
            <IntegrationHistoryTable
              data={integrationHistory}
              loading={loading}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              totalPages={totalHistoryPages}
              onPageChange={handlePageChange}
              onDelete={(id, name) => {
                setEntryToDelete({ id, name });
                setShowDeleteModal(true);
              }}
              searchTerm={searchTerm}
              onSearchChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>



{/* Update the GL Master */}
      {/* {showEditModal && (
  <EditGLModal
    entry={entryToEdit}
    onClose={() => setShowEditModal(false)}
    onSave={activeTab === 'view' ? handleUpdateGlAccount : handleUpdateEntry}
    loading={loading}
    isGlMaster={activeTab === 'view'}
  />
)}

      {showEditModal && (
        <EditGLModal
          entry={entryToEdit}
          onClose={() => setShowEditModal(false)}
          onSave={handleUpdateEntry}
          loading={loading}
        />
      )} */}


    

{/* // Then in the modal rendering section: */}
{showEditModal && activeTab === 'view' && (
  <GLMasterEditModal
    entry={entryToEdit}
    onClose={() => setShowEditModal(false)}
    onSave={handleUpdateGlAccount}
    loading={loading}
  />
)}

{showEditModal && (activeTab === 'entries' || activeTab === 'history') && (
  
 <GLEntryEditModal
  entry={entryToEdit}
  
  onClose={() => setShowEditModal(false)}
  onSave={handleUpdateEntry}
  loading={loading}
  
/>



)}


      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        itemName={entryToDelete?.name}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={() => {
          if (activeTab === 'view') {
            handleDeleteGlAccount(entryToDelete.id);
          } else if (activeTab === 'entries') {
            handleDeleteEntry(entryToDelete.id);
          } else if (activeTab === 'history') {
            handleDeleteHistoryItem(entryToDelete.id);
          }
        }}
        loading={loading}
      />
    </div>
  );
};

export default SystemDataPreferences;