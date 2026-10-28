import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiEdit2, FiTrash2, FiEye, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { Tooltip as ReactTooltip } from "react-tooltip";
import 'react-tooltip/dist/react-tooltip.css';
import { getHREmployees, deleteHREmployee, getHREmployee, updateHREmployee } from './hrApiService';
import { getDecimalPrecision } from '../../../utils/formatters';

const EmployeeModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b p-4">
          <h3 className="text-lg text-sky-800 font-semibold">{title}</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FiX size={24} />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

const ViewHRFile = ({ token }) => {
  const [employees, setEmployees] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewModal, setViewModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await getHREmployees(token, currentPage, 10);
      
      if (response) {
        setEmployees(response.items || []);
        setTotalPages(response.total_pages || 1);
        setTotalItems(response.total_items || 0);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error(`Failed to load employees: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [currentPage, token]);

  const fetchEmployeeDetails = async (employeeId) => {
    try {
      const employee = await getHREmployee(token, employeeId);
      setSelectedEmployee(employee);
      setEditFormData(employee);
    } catch (error) {
      toast.error(`Failed to fetch employee details: ${error.message}`);
    }
  };

  const handleDelete = async (employeeId) => {
    try {
      await deleteHREmployee(token, employeeId);
      toast.success('Employee deleted successfully');
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error(`Failed to delete employee: ${error.message}`);
    }
  };

  const confirmDelete = (employee) => {
    toast.info(
      <div>
        <p>Are you sure you want to delete {employee.name}?</p>
        <div className="flex justify-end mt-2 space-x-2">
          <button 
            onClick={() => {
              toast.dismiss();
              handleDelete(employee.employee_id);
            }}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
          <button 
            onClick={() => toast.dismiss()}
            className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>,
      {
        autoClose: false,
        closeButton: false,
      }
    );
  };

  const handleViewEmployee = async (employeeId) => {
    try {
      await fetchEmployeeDetails(employeeId);
      setViewModal(true);
    } catch (error) {
      toast.error(`Failed to view employee: ${error.message}`);
    }
  };

  const handleEditEmployee = async (employeeId) => {
    try {
      await fetchEmployeeDetails(employeeId);
      setEditModal(true);
    } catch (error) {
      toast.error(`Failed to edit employee: ${error.message}`);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateHREmployee(token, selectedEmployee.employee_id, editFormData);
      toast.success('Employee updated successfully');
      setEditModal(false);
      fetchEmployees();
    } catch (error) {
      toast.error(`Failed to update employee: ${error.message}`);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: getDecimalPrecision(),
      maximumFractionDigits: getDecimalPrecision()
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg border border-sky-200 shadow-sm overflow-hidden">
      <ReactTooltip id="tooltip" place="top" effect="solid" />
      
      {/* View Modal */}
      <EmployeeModal 
        isOpen={viewModal} 
        onClose={() => setViewModal(false)}
        title={`Employee Details - ${selectedEmployee?.name || ''}`}
      >
        {selectedEmployee && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-s font-medium text-gray-500">Employee ID</label>
                <p className="mt-1 text-s text-gray-900">{selectedEmployee.employee_id}</p>
              </div>
              <div>
                <label className="block text-s font-medium text-gray-500">Name</label>
                <p className="mt-1 text-s text-gray-900">{selectedEmployee.name}</p>
              </div>
              <div>
                <label className="block text-s font-medium text-gray-500">Email</label>
                <p className="mt-1 text-s text-gray-900">{selectedEmployee.email}</p>
              </div>
              <div>
                <label className="block text-s font-medium text-gray-500">Job Title</label>
                <p className="mt-1 text-s text-gray-900">{selectedEmployee.job_title || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-s font-medium text-gray-500">Department</label>
                <p className="mt-1 text-s text-gray-900">{selectedEmployee.department || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-s font-medium text-gray-500">Start Date</label>
                <p className="mt-1 text-s text-gray-900">{formatDate(selectedEmployee.start_date)}</p>
              </div>
              <div>
                <label className="block text-s font-medium text-gray-500">Termination Date</label>
                <p className="mt-1 text-s text-gray-900">{formatDate(selectedEmployee.termination_date)}</p>
              </div>
              <div>
                <label className="block text-s font-medium text-gray-500">Base Salary</label>
                <p className="mt-1 text-s text-gray-900">{formatCurrency(selectedEmployee.base_salary)}</p>
              </div>
              <div>
                <label className="block text-s font-medium text-gray-500">Bonus</label>
                <p className="mt-1 text-s text-gray-900">{formatCurrency(selectedEmployee.bonus)}</p>
              </div>
              <div>
                <label className="block text-s font-medium text-gray-500">Status</label>
                <p className="mt-1 text-s text-gray-900">
                  <span className={`px-2 inline-flex text-x leading-5 font-semibold rounded-full ${
                    selectedEmployee.status === 'Active' 
                      ? 'bg-green-100 text-green-800' 
                      : selectedEmployee.status === 'Terminated' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedEmployee.status || 'Unknown'}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-s font-medium text-gray-500">Location</label>
                <p className="mt-1 text-s text-gray-900">{selectedEmployee.location || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}
      </EmployeeModal>

      {/* Edit Modal */}
      <EmployeeModal 
        isOpen={editModal} 
        onClose={() => setEditModal(false)}
        title={`Edit Employee - ${selectedEmployee?.name || ''}`}
      >
        {selectedEmployee && (
          <form onSubmit={handleEditSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="">
                <label className="block text-s font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  name="name"
                  value={editFormData.name || ''}
                  onChange={handleEditChange}
                  className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-s"
                  required
                />
              </div>
              <div>
                <label className="block text-s font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  name="email"
                  value={editFormData.email || ''}
                  onChange={handleEditChange}
                  className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-s"
                  required
                />
              </div>
              <div>
                <label className="block text-s font-medium text-gray-700">Job Title</label>
                <input
                  type="text"
                  name="job_title"
                  value={editFormData.job_title || ''}
                  onChange={handleEditChange}
                  className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-s"
                />
              </div>
              <div>
                <label className="block text-s font-medium text-gray-700">Department</label>
                <input
                  type="text"
                  name="department"
                  value={editFormData.department || ''}
                  onChange={handleEditChange}
                  className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-s"
                />
              </div>
              <div>
                <label className="block text-s font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  value={editFormData.start_date ? editFormData.start_date.split('T')[0] : ''}
                  onChange={handleEditChange}
                  className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-s"
                />
              </div>
              <div>
                <label className="block text-s font-medium text-gray-700">Termination Date</label>
                <input
                  type="date"
                  name="termination_date"
                  value={editFormData.termination_date ? editFormData.termination_date.split('T')[0] : ''}
                  onChange={handleEditChange}
                  className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-s"
                />
              </div>
              <div>
                <label className="block text-s font-medium text-gray-700">Base Salary</label>
                <input
                  type="number"
                  name="base_salary"
                  value={editFormData.base_salary || ''}
                  onChange={handleEditChange}
                  className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-s"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-s font-medium text-gray-700">Bonus</label>
                <input
                  type="number"
                  name="bonus"
                  value={editFormData.bonus || ''}
                  onChange={handleEditChange}
                  className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-s"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-s font-medium text-gray-700">Status</label>
                <select
                  name="status"
                  value={editFormData.status || ''}
                  onChange={handleEditChange}
                  className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-s"
                >
                  <option value="Active">Active</option>
                  <option value="Terminated">Terminated</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>
              <div>
                <label className="block text-s font-medium text-gray-700">Location</label>
                <input
                  type="text"
                  name="location"
                  value={editFormData.location || ''}
                  onChange={handleEditChange}
                  className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-s"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-s font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-s font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </EmployeeModal>

      <div className="p-4 border-b border-sky-200 bg-sky-50 flex justify-between items-center">
        <h3 className="font-medium text-sky-800">HR Employees</h3>
        <div className="text-s text-sky-600">
          Total Employees: {totalItems.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-sky-200">
          <thead className="bg-sky-50">
            <tr>
              <th className="px-4 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Job Title</th>
              <th className="px-4 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Department</th>
              <th className="px-4 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Start Date</th>
              <th className="px-4 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Salary</th>
              <th className="px-4 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-x font-medium text-sky-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-sky-200">
            {loading ? (
              <tr>
                <td colSpan="8" className="px-4 py-4 text-center text-s text-sky-500">
                  <div className="flex justify-center items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading employees...
                  </div>
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-4 py-4 text-center text-s text-sky-500">
                  No employees found
                </td>
              </tr>
            ) : (
              employees.map(employee => (
                <tr key={employee.employee_id} className="hover:bg-sky-50">
                  <td className="px-4 py-4 whitespace-nowrap text-s font-medium text-sky-900">
                    {employee.name}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-s text-sky-900">
                    <a href={`mailto:${employee.email}`} className="text-sky-600 hover:text-sky-800">
                      {employee.email}
                    </a>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-s text-sky-900">
                    {employee.job_title || 'N/A'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-s text-sky-900">
                    {employee.department || 'N/A'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-s text-sky-900">
                    {formatDate(employee.start_date)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-s text-sky-900">
                    {formatCurrency(employee.base_salary)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-x leading-5 font-semibold rounded-full ${
                      employee.status === 'Active' 
                        ? 'bg-green-100 text-green-800' 
                        : employee.status === 'Terminated' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-gray-100 text-gray-800'
                    }`}>
                      {employee.status || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-s text-sky-900 flex space-x-2">
                    <button 
                      className="text-sky-600 hover:text-sky-800 p-1 rounded hover:bg-sky-100"
                      onClick={() => handleViewEmployee(employee.employee_id)}
                      data-tooltip-id="tooltip"
                      data-tooltip-content="View Details"
                    >
                      <FiEye />
                    </button>
                    <button 
                      className="text-amber-600 hover:text-amber-800 p-1 rounded hover:bg-amber-100"
                      onClick={() => handleEditEmployee(employee.employee_id)}
                      data-tooltip-id="tooltip"
                      data-tooltip-content="Edit Employee"
                    >
                      <FiEdit2 />
                    </button>
                    <button 
                      className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100"
                      onClick={() => confirmDelete(employee)}
                      data-tooltip-id="tooltip"
                      data-tooltip-content="Delete Employee"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-sky-200 bg-sky-50 flex justify-between items-center">
        <span className="text-s text-sky-600">
          Showing page {currentPage} of {totalPages} (Total: {totalItems.toLocaleString(undefined, { minimumFractionDigits: getDecimalPrecision(), maximumFractionDigits: getDecimalPrecision() })})
        </span>
        <div className="flex space-x-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            disabled={currentPage === 1 || loading}
            className="p-1 disabled:opacity-50 text-sky-600 hover:text-sky-800 disabled:hover:text-sky-600"
            data-tooltip-id="tooltip"
            data-tooltip-content="Previous Page"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages || loading}
            className="p-1 disabled:opacity-50 text-sky-600 hover:text-sky-800 disabled:hover:text-sky-600"
            data-tooltip-id="tooltip"
            data-tooltip-content="Next Page"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewHRFile;