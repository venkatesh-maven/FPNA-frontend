import React, { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';

const GLMasterEditModal = ({ 
  entry, 
  onClose, 
  onSave,
  loading
}) => {
  const [editedEntry, setEditedEntry] = useState({
    general_ledger_code: '',
    account_name: '',
    category: '',
    tags: []
  });

  useEffect(() => {
    if (entry) {
      setEditedEntry({
        general_ledger_code: entry.general_ledger_code || '',
        account_name: entry.account_name || '',
        category: entry.category || '',
        tags: entry.tags || []
      });
    }
  }, [entry]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedEntry(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTagChange = (e) => {
    const { value } = e.target;
    setEditedEntry(prev => ({
      ...prev,
      tags: value.split(',').map(tag => tag.trim()).filter(tag => tag)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    toast.dismiss();

    if (!editedEntry.account_name || !editedEntry.category) {
      toast.error('Account name and category are required');
      return;
    }

    // Prepare payload with all required fields including general_ledger_code
    const payload = {
      general_ledger_code: editedEntry.general_ledger_code,
      account_name: editedEntry.account_name,
      category: editedEntry.category,
      tags: editedEntry.tags
    };

    onSave(payload);
  };

  if (!entry) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Edit GL Account</h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700"
            disabled={loading}
          >
            <FiX size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">GL Code</label>
              <input
                type="text"
                name="general_ledger_code"
                value={editedEntry.general_ledger_code}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                required
                disabled
              />
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Account Name</label>
              <input
                type="text"
                name="account_name"
                value={editedEntry.account_name}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                name="category"
                value={editedEntry.category}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                required
              />
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Tags (comma separated)</label>
              <input
                type="text"
                value={editedEntry.tags?.join(', ') || ''}
                onChange={handleTagChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded text-s font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded text-s font-medium text-white bg-[#004a80] hover:bg-[#003366] disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GLMasterEditModal;