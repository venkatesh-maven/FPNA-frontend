// CRMApiService.js
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../../../config/config';
import { attachSessionInterceptor } from '../../../utils/sessionExpiry';

class CRMApiService {
  constructor(token) {
    this.token = token;
    this.api = attachSessionInterceptor(axios.create({
      baseURL: `${API_BASE_URL}/api/v1/company/HR_and_CRM/crm/`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }));
  }

  // Upload CRM file
  async uploadCRMFile(file, columnMappings) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('column_mapping', JSON.stringify(columnMappings));

      const response = await this.api.post('upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('CRM data uploaded successfully!');
      return response.data;
    } catch (error) {
      toast.error(`Upload failed: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  // Get all CRM entries
  async getCRMEntries(page = 1, limit = 10) {
    try {
      const response = await this.api.get('details/', {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      toast.error(`Failed to fetch CRM entries: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  // Get single CRM entry
  async getCRMEntry(opportunity_id) {
    try {
      const response = await this.api.get(`details/${opportunity_id}`);
      return response.data;
    } catch (error) {
      toast.error(`Failed to fetch CRM entry: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  // Update CRM entry
  async updateCRMEntry(opportunity_id, data) {
    try {
      const response = await this.api.put(`details/${opportunity_id}`, data);
      toast.success('CRM entry updated successfully!');
      return response.data;
    } catch (error) {
      toast.error(`Update failed: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  // Delete CRM entry
  async deleteCRMEntry(opportunity_id) {
    try {
      const response = await this.api.delete(`details/${opportunity_id}`);
      toast.success('CRM entry deleted successfully!');
      return response.data;
    } catch (error) {
      toast.error(`Delete failed: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  // Get integration history
  async getIntegrationHistory(page = 1, limit = 100) {
    try {
      const response = await this.api.get('integration-history', {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      toast.error(`Failed to fetch integration history: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  // Get entries by integration ID
  async getEntriesByIntegrationId(integration_id, page = 1, limit = 20) {
    try {
      const response = await this.api.get(`integration-history/${integration_id}/entries`, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      toast.error(`Failed to fetch integration entries: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }

  // Delete integration
  async deleteIntegration(integration_id) {
    try {
      const response = await this.api.delete(`integration-history/${integration_id}`);
      toast.success('Integration deleted successfully!');
      return response.data;
    } catch (error) {
      toast.error(`Delete integration failed: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  }
}

export default CRMApiService;