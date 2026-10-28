import React, { useState, useEffect, useContext } from 'react';
import { FiLifeBuoy, FiEdit2, FiTrash2, FiX, FiCheck, FiEye, FiPaperclip } from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/config';

const TicketingSystem = () => {
  const { token, user } = useContext(AuthContext);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [formData, setFormData] = useState({
  issue_type: '',
  title: '',  // Changed from 'title'
  description: '',  // Changed from 'description'
  priority: 'Low',
  files: []
});
  const [previewImages, setPreviewImages] = useState([]);

  useEffect(() => {
    fetchTickets();
  }, [page, limit, token]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/v1/company/management/tickets/?page=${page}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }
      
      const data = await response.json();
      setTickets(data.tickets || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('issue_type', formData.issue_type);
      // In both handleCreateTicket and handleUpdateTicket
formDataToSend.append('title', formData.title);
formDataToSend.append('description', formData.description);
      formDataToSend.append('priority', formData.priority);
      
      formData.files.forEach(file => {
        formDataToSend.append('files', file);
      });

      const response = await fetch(
        `${API_BASE_URL}/api/v1/company/management/tickets/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formDataToSend
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create ticket');
      }

      const newTicket = await response.json();
      setTickets([newTicket, ...tickets]);
      setShowCreateModal(false);
      resetForm();
      fetchTickets(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

 const handleEditTicket = (ticket) => {
  setCurrentTicket(ticket);
  setFormData({
    issue_type: ticket.issue_type || '',
    title: ticket.title || ticket.title || '', // Handle both cases
    description: ticket.description || ticket.description || '', // Handle both cases
    priority: ticket.priority || 'Low',
    files: []
  });
  setPreviewImages([]);
  setShowEditModal(true);
};

  const handleViewTicket = (ticket) => {
    setCurrentTicket(ticket);
    setShowViewModal(true);
  };

 const handleUpdateTicket = async (e) => {
  e.preventDefault();

  try {
    const formDataToSend = new FormData();

    // ✅ Make sure field names match backend exactly
    formDataToSend.append('ticketid', currentTicket.ticket_id); // fixed trailing space
    formDataToSend.append('issue_type', formData.issue_type || '');
    formDataToSend.append('title', formData.title || '');
    formDataToSend.append('description', formData.description || '');
    formDataToSend.append('priority', formData.priority || '');

    // ✅ Append multiple files correctly
    if (formData.files && formData.files.length > 0) {
      formData.files.forEach((file) => {
        formDataToSend.append('files', file);
      });
    }

    const response = await fetch(
      `${API_BASE_URL}/api/v1/company/management/tickets/`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          // ⚠️ DO NOT manually set 'Content-Type' for FormData — let the browser handle it
        },
        body: formDataToSend,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update ticket');
    }

    const updatedTicket = await response.json();

    setTickets((prevTickets) =>
      prevTickets.map((ticket) =>
        ticket.ticket_id === updatedTicket.ticket_id ? updatedTicket : ticket
      )
    );

    setShowEditModal(false);
    resetForm();
  } catch (err) {
    console.error('Update ticket error:', err);
    setError(err.message);
  }
};


  // const handleDeleteTicket = async (ticketid ) => {
  //   if (!window.confirm('Are you sure you want to delete this ticket?')) return;
    
  //   try {
  //     const response = await fetch(
  //       `${API_BASE_URL}/api/v1/company/management/tickets/${ticketid }`,
  //       {
  //         method: 'DELETE',
  //         headers: {
  //           'Authorization': `Bearer ${token}`,
  //         }
  //       }
  //     );

  //     if (!response.ok) {
  //       throw new Error('Failed to delete ticket');
  //     }

  //     setTickets(tickets.filter(ticket => ticket.ticket_id !== ticketid ));
  //   } catch (err) {
  //     setError(err.message);
  //   }
  // };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setFormData({
      ...formData,
      files: [...formData.files, ...files]
    });

    // Create previews for images
    const imagePreviews = files.filter(file => file.type.startsWith('image/'))
      .map(file => URL.createObjectURL(file));
    setPreviewImages([...previewImages, ...imagePreviews]);
  };

  const removeFile = (index) => {
    const newFiles = [...formData.files];
    newFiles.splice(index, 1);
    setFormData({
      ...formData,
      files: newFiles
    });

    // Also remove the preview if it exists
    const newPreviews = [...previewImages];
    if (index < newPreviews.length) {
      URL.revokeObjectURL(newPreviews[index]);
      newPreviews.splice(index, 1);
      setPreviewImages(newPreviews);
    }
  };

const handleInputChange = (e) => {
  const { name, value } = e.target;
  // Map lowercase names to correct API field names
  const apiFieldName = name === 'title' ? 'title' : 
                      name === 'description' ? 'description' : name;
  setFormData({
    ...formData,
    [apiFieldName]: value
  });
};

  const resetForm = () => {
    setFormData({
      issue_type: '',
      title: '',
      description: '',
      priority: 'Low',
      files: []
    });
    // Clean up object URLs
    previewImages.forEach(url => URL.revokeObjectURL(url));
    setPreviewImages([]);
  };

  const handleStatusChange = async (ticketid , newStatus) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/company/management/tickets/${ticketid}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update ticket status');
      }

      const updatedTicket = await response.json();
      setTickets(tickets.map(ticket => 
        ticket.ticket_id === updatedTicket.ticket_id ? updatedTicket : ticket
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );
  
  if (error) return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-s text-red-700">Error: {error}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h3 className="text-xl font-semibold flex items-center">
          <FiLifeBuoy className="mr-2 text-blue-500" /> Ticketing System
        </h3>
        <button 
          className="bg-sky-900 hover:bg-sky-700 text-white px-4 py-2 rounded-md w-full md:w-auto"
          onClick={() => setShowCreateModal(true)}
        >
          New Ticket
        </button>
      </div>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Create New Ticket</h3>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }} 
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <FiX size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateTicket}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 mb-2">Issue Type*</label>
                  <input
                    type="text"
                    name="issue_type"
                    value={formData.issue_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Priority*</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">title*</label>
               <input
  type="text"
  name="title"  // Changed from 'title'
  value={formData.title}
  onChange={handleInputChange}
  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
  required
/>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">description*</label>
               <textarea
  name="description"  // Changed from 'description'
  value={formData.description}
  onChange={handleInputChange}
  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
  required
  rows={4}
/>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Attachments</label>
                <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="w-full"
                    accept="image/*,.pdf,.doc,.docx"
                  />
                  <p className="text-s text-gray-500 mt-2">Upload images, PDFs, or documents</p>
                </div>
                
                {/* Preview of selected files */}
                {(formData.files.length > 0 || previewImages.length > 0) && (
                  <div className="mt-4">
                    <h4 className="text-s font-medium text-gray-700 mb-2">Selected files:</h4>
                    <div className="flex flex-wrap gap-2">
                      {previewImages.map((preview, index) => (
                        <div key={index} className="relative">
                          <img 
                            src={preview} 
                            alt={`Preview ${index}`} 
                            className="h-20 w-20 object-cover rounded border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                          >
                            <FiX size={12} />
                          </button>
                        </div>
                      ))}
                      {formData.files.filter(file => !file.type.startsWith('image/')).map((file, index) => (
                        <div key={index + previewImages.length} className="relative bg-gray-100 p-2 rounded flex items-center">
                          <FiPaperclip className="mr-2" />
                          <span className="text-x truncate max-w-xs">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(index + previewImages.length)}
                            className="ml-2 text-red-500"
                          >
                            <FiX size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col-reverse md:flex-row justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-900 text-white rounded-md hover:bg-sky-700 transition-colors"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ticket Modal */}
      {showEditModal && currentTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Edit Ticket</h3>
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  resetForm();
                }} 
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <FiX size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdateTicket}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 mb-2">Issue Type</label>
                  <input
                    type="text"
                    name="issue_type"
                    value={formData.issue_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Priority</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Attachments</label>
                <div className="border-2 border-dashed border-gray-300 rounded-md p-4">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="w-full"
                    accept="image/*,.pdf,.doc,.docx"
                  />
                  <p className="text-s text-gray-500 mt-2">Upload additional files</p>
                </div>
                
                {/* Existing attachments */}
                {currentTicket.attachments?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-s font-medium text-gray-700 mb-2">Current attachments:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {currentTicket.attachments.map((attachment, index) => (
                        <div key={index} className="border rounded-md overflow-hidden">
                          {attachment.file_path?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                            <img 
                              src={`${API_BASE_URL}/${attachment.file_path}`} 
                              alt={`Attachment ${index + 1}`}
                              className="w-full h-24 object-cover"
                            />
                          ) : (
                            <div className="p-3 bg-gray-50 flex flex-col items-center justify-center h-24">
                              <FiPaperclip className="text-gray-400 text-2xl mb-2" />
                              <p className="text-x text-gray-600 text-center truncate w-full px-2">
                                {attachment.file_path?.split('/').pop() || `Attachment ${index + 1}`}
                              </p>
                            </div>
                          )}
                          <a 
                            href={`${API_BASE_URL}/${attachment.file_path}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block text-center text-x text-blue-600 py-1 hover:bg-gray-100"
                          >
                            View
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* New files to be added */}
                {(formData.files.length > 0 || previewImages.length > 0) && (
                  <div className="mt-4">
                    <h4 className="text-s font-medium text-gray-700 mb-2">New files to add:</h4>
                    <div className="flex flex-wrap gap-2">
                      {previewImages.map((preview, index) => (
                        <div key={index} className="relative">
                          <img 
                            src={preview} 
                            alt={`Preview ${index}`} 
                            className="h-20 w-20 object-cover rounded border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                          >
                            <FiX size={12} />
                          </button>
                        </div>
                      ))}
                      {formData.files.filter(file => !file.type.startsWith('image/')).map((file, index) => (
                        <div key={index + previewImages.length} className="relative bg-gray-100 p-2 rounded flex items-center">
                          <FiPaperclip className="mr-2" />
                          <span className="text-x truncate max-w-xs">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(index + previewImages.length)}
                            className="ml-2 text-red-500"
                          >
                            <FiX size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col-reverse md:flex-row justify-end gap-3">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setShowEditModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-900 text-white rounded-md hover:bg-sky-700 transition-colors"
                >
                  Update Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Ticket Modal */}
      {showViewModal && currentTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Ticket Details</h3>
              <button 
                onClick={() => setShowViewModal(false)} 
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <FiX size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-s font-medium text-gray-500">title</h4>
                  <p className="text-gray-900">{currentTicket.title}</p>
                </div>
                <div>
                  <h4 className="text-s font-medium text-gray-500">Issue Type</h4>
                  <p className="text-gray-900">{currentTicket.issue_type}</p>
                </div>
                <div>
                  <h4 className="text-s font-medium text-gray-500">Priority</h4>
                  <span className={`px-2 py-1 text-x rounded-full ${
                    currentTicket.priority === 'High' ? 'bg-red-100 text-red-800' :
                    currentTicket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {currentTicket.priority}
                  </span>
                </div>
                <div>
                  <h4 className="text-s font-medium text-gray-500">Status</h4>
                  <span className={`px-2 py-1 text-x rounded-full ${
                    currentTicket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                    currentTicket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {currentTicket.status || 'Open'}
                  </span>
                </div>
                <div>
                  <h4 className="text-s font-medium text-gray-500">Created At</h4>
                  <p className="text-gray-900">
                    {new Date(currentTicket.created_at).toLocaleDateString()} at{' '}
                    {new Date(currentTicket.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <h4 className="text-s font-medium text-gray-500">Last Updated</h4>
                  <p className="text-gray-900">
                    {new Date(currentTicket.updated_at).toLocaleDateString()} at{' '}
                    {new Date(currentTicket.updated_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="text-s font-medium text-gray-500">description</h4>
                <p className="text-gray-900 whitespace-pre-line">{currentTicket.description}</p>
              </div>
              
              {currentTicket.attachments?.length > 0 && (
                <div>
                  <h4 className="text-s font-medium text-gray-500 mb-2">Attachments</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {currentTicket.attachments.map((attachment, index) => (
                      <div key={index} className="border rounded-md overflow-hidden">
                        {attachment.file_path?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                          <img 
                            src={`${API_BASE_URL}/${attachment.file_path}`} 
                            alt={`Attachment ${index + 1}`}
                            className="w-full h-24 object-cover"
                          />
                        ) : (
                          <div className="p-3 bg-gray-50 flex flex-col items-center justify-center h-24">
                            <FiPaperclip className="text-gray-400 text-2xl mb-2" />
                            <p className="text-x text-gray-600 text-center truncate w-full px-2">
                              {attachment.file_path?.split('/').pop() || `Attachment ${index + 1}`}
                            </p>
                          </div>
                        )}
                        <a 
                          href={`${API_BASE_URL}/${attachment.file_path}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block text-center text-x text-blue-600 py-1 hover:bg-gray-100"
                        >
                          View
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Ticket ID</th>
              <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">title</th>
              <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-4 py-3 text-left text-x font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tickets.map(ticket => (
              <tr key={ticket.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 text-s text-gray-500">
                  {ticket.ticket_id}
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium">{ticket.title}</div>
                  <div className="text-s text-gray-500">{ticket.issue_type}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center">
                    <span className={`px-2 py-1 text-x rounded-full ${
                      ticket.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                      ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {ticket.status || 'Open'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-s text-gray-500">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-1 text-x rounded-full ${
                    ticket.priority === 'High' ? 'bg-red-100 text-red-800' :
                    ticket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {ticket.priority}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleViewTicket(ticket)}
                      className="text-gray-600 hover:text-blue-600 transition-colors"
                      title="View"
                    >
                      <FiEye size={18} />
                    </button>
                    <button 
                      onClick={() => handleEditTicket(ticket)}
                      className="text-gray-600 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <FiEdit2 size={18} />
                    </button>
                    {/* <button 
                      onClick={() => handleDeleteTicket(ticket.ticket_id)}
                      className="text-gray-600 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <FiTrash2 size={18} />
                    </button> */}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tickets.length === 0 && !loading && (
        <div className="text-center py-12">
          <FiLifeBuoy className="mx-auto text-gray-400 text-4xl mb-4" />
          <h4 className="text-lg font-medium text-gray-900">No tickets found</h4>
          <p className="text-gray-500 mt-1">Create your first ticket to get started</p>
          <button 
            className="mt-4 bg-sky-900 hover:bg-sky-700 text-white px-4 py-2 rounded-md"
            onClick={() => setShowCreateModal(true)}
          >
            Create Ticket
          </button>
        </div>
      )}

      {tickets.length > 0 && (
        <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
          <div className="text-s text-gray-600">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, tickets.length)} of {tickets.length} tickets
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border rounded-md px-3 py-1 text-s"
            >
              <option value="5">5 per page</option>
              <option value="10">10 per page</option>
              <option value="20">20 per page</option>
              <option value="50">50 per page</option>
            </select>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-s text-gray-600">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={tickets.length < limit}
              className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketingSystem;