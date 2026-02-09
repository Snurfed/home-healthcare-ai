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
  document: ReferralDocument;
}

interface GetReferralResponse extends ReferralDocument {}

interface ListReferralsResponse {
  referrals: ReferralListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
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

    const response = await apiClient.post<UploadResponse>(
      `/patients/${patientId}/referrals/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minutes for file upload
      }
    );
    return response.data.document;
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
    const { pagination } = response.data;
    return {
      data: response.data.referrals,
      pagination: {
        ...pagination,
        hasNext: pagination.page < pagination.totalPages,
        hasPrev: pagination.page > 1,
      },
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
    const response = await apiClient.patch<{ referral: ReferralDocument }>(
      `/referrals/${id}`,
      data
    );
    return response.data.referral;
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
