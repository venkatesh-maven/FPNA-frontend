import React, { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';

const GLEntryEditModal = ({ 
  entry, 
  onClose, 
  onSave,
  loading
}) => {
  const [editedEntry, setEditedEntry] = useState({
    id: '',
    date: '',
    general_ledger_code: '',
    account_name: '',
    category: '',
    description: '',
    debit: 0,
    credit: 0
  });

useEffect(() => {
  if (entry) {
    setEditedEntry({
      id: entry.id || '',
      date: entry.date ? entry.date.slice(0, 10) : '', // 👈 Fix for "yyyy-MM-dd"
      general_ledger_code: entry.general_ledger_code || '',
      account_name: entry.account_name || '',
      category: entry.category || '',
      description: entry.description || '',
      debit: entry.debit || 0,
      credit: entry.credit || 0
    });
  }
    console.log('Modal entry received:', entry);

}, [entry]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedEntry(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAmountChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value) || 0;
    
    setEditedEntry(prev => ({
      ...prev,
      [name]: numValue,
      [name === 'debit' ? 'credit' : 'debit']: 0
    }));
  };

 const handleSubmit = (e) => {
  e.preventDefault();

  toast.dismiss();

  if (!editedEntry.id) {
    toast.error('Missing GL entry ID');
    return;
  }

  if (!editedEntry.general_ledger_code || !editedEntry.account_name) {
    toast.error('GL Code and Account Name are required');
    return;
  }

  if (editedEntry.debit > 0 && editedEntry.credit > 0) {
    toast.error('Cannot have both debit and credit amounts');
    return;
  }

  if (editedEntry.debit === 0 && editedEntry.credit === 0) {
    toast.error('Must enter either a debit or credit amount');
    return;
  }

  const payload = {
  date: new Date(editedEntry.date).toISOString(), // ✅ convert to ISO string
  general_ledger_code: Number(editedEntry.general_ledger_code), // ✅ ensure it's a number
  account_name: editedEntry.account_name,
  category: editedEntry.category,
  description: editedEntry.description,
  ...(editedEntry.debit > 0 
    ? { debit: Number(editedEntry.debit), credit: null } 
    : { debit: null, credit: Number(editedEntry.credit) })
};


onSave({ ...payload, id: editedEntry.id }); // ensure id is passed
};


  if (!entry) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Edit GL Entry</h3>
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
              <label className="block text-s font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                name="date"
                value={editedEntry.date}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                required
              />
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">GL Code</label>
              <input
                type="text"
                name="general_ledger_code"
                value={editedEntry.general_ledger_code}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                name="category"
                value={editedEntry.category}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="block text-s font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              name="description"
              value={editedEntry.description}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Debit</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="debit"
                value={editedEntry.debit}
                onChange={handleAmountChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
              />
            </div>
            <div>
              <label className="block text-s font-medium text-gray-700 mb-1">Credit</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="credit"
                value={editedEntry.credit}
                onChange={handleAmountChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[#004a80] focus:border-[#004a80]"
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

export default GLEntryEditModal;