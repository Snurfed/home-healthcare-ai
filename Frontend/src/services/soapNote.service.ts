/**
 * SOAP Note Service
 *
 * API calls for SOAP note generation and management
 */

import apiClient from './api/client';
import type {
  SoapNote,
  SoapNotesListParams,
  SoapNotesListResponse,
  GenerateSoapNoteRequest,
  GenerateSoapNoteResponse,
  UpdateSoapNoteRequest,
  UpdateSoapNoteStatusRequest,
  RegenerateSectionRequest,
  RegenerateSectionResponse,
  SoapSection,
} from '@typedefs/index';

// ===========================================
// SOAP NOTE SERVICE
// ===========================================

export const soapNoteService = {
  /**
   * Generate a new SOAP note from assessment data
   */
  async generateSoapNote(
    assessmentId: string,
    request?: GenerateSoapNoteRequest
  ): Promise<GenerateSoapNoteResponse> {
    const response = await apiClient.post<GenerateSoapNoteResponse>(
      `/assessments/${assessmentId}/soap-notes/generate`,
      request || {}
    );
    return response.data;
  },

  /**
   * Get SOAP note by assessment ID
   */
  async getSoapNoteByAssessment(assessmentId: string): Promise<SoapNote | null> {
    try {
      const response = await apiClient.get<SoapNote>(
        `/assessments/${assessmentId}/soap-notes`
      );
      return response.data;
    } catch (error: unknown) {
      // 404 means no SOAP note exists yet
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          return null;
        }
      }
      throw error;
    }
  },

  /**
   * Get SOAP note by ID
   */
  async getSoapNote(id: string): Promise<SoapNote> {
    const response = await apiClient.get<SoapNote>(`/soap-notes/${id}`);
    return response.data;
  },

  /**
   * Update SOAP note sections
   */
  async updateSoapNote(id: string, data: UpdateSoapNoteRequest): Promise<SoapNote> {
    const response = await apiClient.patch<{ soapNote: SoapNote }>(
      `/soap-notes/${id}`,
      data
    );
    return response.data.soapNote;
  },

  /**
   * Update SOAP note status (draft -> reviewed -> finalized)
   */
  async updateSoapNoteStatus(
    id: string,
    data: UpdateSoapNoteStatusRequest
  ): Promise<SoapNote> {
    const response = await apiClient.patch<{ soapNote: SoapNote }>(
      `/soap-notes/${id}/status`,
      data
    );
    return response.data.soapNote;
  },

  /**
   * Regenerate a specific section of a SOAP note
   */
  async regenerateSection(
    id: string,
    section: SoapSection,
    instructions?: string
  ): Promise<RegenerateSectionResponse> {
    const request: RegenerateSectionRequest = { section, instructions };
    const response = await apiClient.post<RegenerateSectionResponse>(
      `/soap-notes/${id}/regenerate`,
      request
    );
    return response.data;
  },

  /**
   * List all SOAP notes for a patient
   */
  async listByPatient(
    patientId: string,
    params?: SoapNotesListParams
  ): Promise<SoapNotesListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.status) queryParams.set('status', params.status);
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);

    const url = `/patients/${patientId}/soap-notes${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await apiClient.get<SoapNotesListResponse>(url);
    return response.data;
  },

  /**
   * Export SOAP note as PDF/HTML
   */
  async exportPdf(id: string): Promise<Blob> {
    const baseUrl = apiClient.defaults.baseURL || '/api';
    const accessToken = sessionStorage.getItem('accessToken');

    const response = await fetch(
      `${baseUrl}/soap-notes/${id}/pdf`,
      {
        method: 'GET',
        credentials: 'include',
        headers: accessToken ? {
          Authorization: `Bearer ${accessToken}`,
        } : {},
      }
    );

    if (!response.ok) {
      throw new Error('Failed to export SOAP note');
    }

    return response.blob();
  },

  /**
   * Download SOAP note as HTML file
   */
  async downloadPdf(id: string, patientName: string): Promise<void> {
    const blob = await this.exportPdf(id);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SOAP_Note_${patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Create a new SOAP note (manual, without AI generation)
   */
  async createSoapNote(
    assessmentId: string,
    data?: UpdateSoapNoteRequest & { generateFromAssessment?: boolean }
  ): Promise<SoapNote> {
    const response = await apiClient.post<{ soapNote: SoapNote }>(
      `/assessments/${assessmentId}/soap-notes`,
      data || {}
    );
    return response.data.soapNote;
  },
};

export default soapNoteService;
