/**
 * Referral Service
 *
 * API calls for referral document upload and extraction
 */

import apiClient from './api/client';
import type {
  ReferralDocument,
  ReferralListItem,
  ReferralDocumentType,
  ExtractionStatusResponse,
  ApplyExtractionRequest,
  ApplyExtractionResponse,
  PaginatedResponse,
} from '@typedefs/index';

// Response types
interface UploadResponse {
  message: string;
  referralDocument: ReferralDocument;
}

interface GetReferralResponse extends ReferralDocument {}

interface ListReferralsResponse {
  data: ReferralListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface TriggerExtractionResponse {
  message: string;
  extractionStatus: string;
}

export const referralService = {
  /**
   * Upload a referral document for a patient
   */
  async uploadReferral(
    patientId: string,
    file: File,
    documentType: ReferralDocumentType,
    metadata?: Record<string, unknown>
  ): Promise<ReferralDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    // Note: Don't set Content-Type header manually for FormData
    // Axios will set it automatically with the correct boundary parameter
    const response = await apiClient.post<UploadResponse>(
      `/patients/${patientId}/referrals/upload`,
      formData,
      {
        timeout: 120000, // 2 minutes for file upload
      }
    );
    return response.data.referralDocument;
  },

  /**
   * List all referral documents for a patient
   */
  async listReferrals(
    patientId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<ReferralListItem>> {
    const response = await apiClient.get<ListReferralsResponse>(
      `/patients/${patientId}/referrals`,
      { params }
    );
    return {
      data: response.data.data,
      pagination: response.data.pagination,
    };
  },

  /**
   * Get a single referral document with extracted data
   */
  async getReferral(id: string): Promise<ReferralDocument> {
    const response = await apiClient.get<GetReferralResponse>(`/referrals/${id}`);
    return response.data;
  },

  /**
   * Get extraction status for polling
   */
  async getExtractionStatus(id: string): Promise<ExtractionStatusResponse> {
    const response = await apiClient.get<ExtractionStatusResponse>(
      `/referrals/${id}/status`
    );
    return response.data;
  },

  /**
   * Trigger extraction processing for a document
   */
  async triggerExtraction(id: string): Promise<void> {
    await apiClient.post<TriggerExtractionResponse>(`/referrals/${id}/extract`);
  },

  /**
   * Apply extracted data to an assessment
   */
  async applyToAssessment(
    referralId: string,
    data: ApplyExtractionRequest
  ): Promise<ApplyExtractionResponse> {
    const response = await apiClient.post<ApplyExtractionResponse>(
      `/referrals/${referralId}/apply`,
      data
    );
    return response.data;
  },

  /**
   * Update a referral document
   */
  async updateReferral(
    id: string,
    data: Partial<Pick<ReferralDocument, 'documentType' | 'metadata'>>
  ): Promise<ReferralDocument> {
    const response = await apiClient.patch<{ message: string; referralDocument: ReferralDocument }>(
      `/referrals/${id}`,
      data
    );
    return response.data.referralDocument;
  },

  /**
   * Delete a referral document (soft delete)
   */
  async deleteReferral(id: string): Promise<void> {
    await apiClient.delete(`/referrals/${id}`);
  },

  /**
   * Get download URL for a referral document
   */
  getDownloadUrl(id: string): string {
    const baseUrl = apiClient.defaults.baseURL || '/api';
    return `${baseUrl}/referrals/${id}/download`;
  },
};

export default referralService;
