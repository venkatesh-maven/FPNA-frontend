import { API_BASE_URL } from "../../../config/config";
import { toast } from 'react-toastify';

export const uploadHRData = async (token, file, columnMappings) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('column_mapping', JSON.stringify(columnMappings));

    const response = await fetch(`${API_BASE_URL}/api/v1/company/HR_and_CRM/HR_data/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Upload failed');
    }

    const data = await response.json();
    toast.success('HR data uploaded successfully!');
    return data;
  } catch (error) {
    toast.error(`Upload failed: ${error.message}`);
    throw error;
  }
};

export const getHREmployees = async (token, page = 1, limit = 10) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/company/HR_and_CRM/hr/details/?page=${page}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch employees');
    }

    const data = await response.json();
    return {
      items: data.items || [],
      total_items: data.total_items || 0,
      total_pages: data.total_pages || 1,
      has_next: data.has_next || false,
      page: data.page || page,
      limit: data.limit || limit
    };
  } catch (error) {
    toast.error(`Failed to fetch employees: ${error.message}`);
    throw error;
  }
};

export const getHREmployee = async (token, employeeId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/company/HR_and_CRM/hr/details/${employeeId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch employee');
    }

    return await response.json();
  } catch (error) {
    toast.error(`Failed to fetch employee: ${error.message}`);
    throw error;
  }
};

export const updateHREmployee = async (token, employeeId, employeeData) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/company/HR_and_CRM/hr/details/${employeeId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(employeeData)
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update employee');
    }

    const data = await response.json();
    toast.success('Employee updated successfully!');
    return data;
  } catch (error) {
    toast.error(`Failed to update employee: ${error.message}`);
    throw error;
  }
};

export const deleteHREmployee = async (token, employeeId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/company/HR_and_CRM/hr/details/${employeeId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete employee');
    }

    toast.success('Employee deleted successfully!');
    return { success: true };
  } catch (error) {
    toast.error(`Failed to delete employee: ${error.message}`);
    throw error;
  }
};






export const getHRIntegrationHistory = async (token, page = 1, limit = 100) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/company/HR_and_CRM/hr/integration-history?page=${page}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch integration history');
    }

    const data = await response.json();
    return {
      records: data.records || [],
      total_records: data.total_records || 0,
      has_next: data.has_next || false,
      page: data.page || page,
      limit: data.limit || limit
    };
  } catch (error) {
    toast.error(`Failed to fetch integration history: ${error.message}`);
    throw error;
  }
};

export const getHRIntegrationEntries = async (token, integrationId, page = 1, limit = 20) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/company/HR_and_CRM/hr/integration-history/${integrationId}/entries?page=${page}&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch integration entries');
    }

    const data = await response.json();
    return {
      entries: data.entries || [],
      total_entries: data.total_entries || 0,
      has_next: data.has_next || false,
      page: data.page || page,
      limit: data.limit || limit,
      integration_id: data.integration_id || integrationId
    };
  } catch (error) {
    toast.error(`Failed to fetch integration entries: ${error.message}`);
    throw error;
  }
};

export const deleteHRIntegration = async (token, integrationId) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/company/HR_and_CRM/hr/integration-history/${integrationId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete integration');
    }

    toast.success('Integration deleted successfully!');
    return { success: true };
  } catch (error) {
    toast.error(`Failed to delete integration: ${error.message}`);
    throw error;
  }
};