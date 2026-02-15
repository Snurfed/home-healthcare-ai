/**
 * Communication Service
 *
 * API client for physician communication detection and generation.
 */

import apiClient from './api/client';
import type {
  GetTriggersResponse,
  DetectTriggersRequest,
  DetectTriggersResponse,
  DismissTriggerRequest,
  GenerateCommunicationRequest,
  GenerateCommunicationResponse,
  UpdateCommunicationRequest,
  RegenerateCommunicationRequest,
  ListCommunicationsResponse,
  PhysicianCommunication,
} from '../types/communication.types';

export const communicationService = {
  // ==========================================================================
  // TRIGGER ENDPOINTS
  // ==========================================================================

  /**
   * Get all communication triggers for an assessment
   */
  async getTriggers(assessmentId: string): Promise<GetTriggersResponse> {
    const response = await apiClient.get<GetTriggersResponse>(
      `/assessments/${assessmentId}/communication-triggers`
    );
    return response.data;
  },

  /**
   * Detect triggers for a specific question change
   */
  async detectTriggers(
    assessmentId: string,
    request: DetectTriggersRequest
  ): Promise<DetectTriggersResponse> {
    const response = await apiClient.post<DetectTriggersResponse>(
      `/assessments/${assessmentId}/communication-triggers/detect`,
      request,
      { timeout: 5000 } // 5 second timeout - detection should be fast
    );
    return response.data;
  },

  /**
   * Dismiss a communication trigger
   */
  async dismissTrigger(
    triggerId: string,
    request: DismissTriggerRequest
  ): Promise<{ success: boolean; dismissedAt: string }> {
    const response = await apiClient.post<{
      success: boolean;
      dismissedAt: string;
    }>(`/communication-triggers/${triggerId}/dismiss`, request);
    return response.data;
  },

  // ==========================================================================
  // GENERATION ENDPOINTS
  // ==========================================================================

  /**
   * Generate a communication draft from a trigger
   */
  async generateCommunication(
    assessmentId: string,
    request: GenerateCommunicationRequest
  ): Promise<GenerateCommunicationResponse> {
    const response = await apiClient.post<GenerateCommunicationResponse>(
      `/assessments/${assessmentId}/communications/generate`,
      request,
      { timeout: 30000 } // 30 second timeout for AI generation
    );
    return response.data;
  },

  /**
   * Generate a post-visit summary communication
   */
  async generatePostVisitSummary(
    assessmentId: string,
    physicianName: string,
    physicianNpi?: string
  ): Promise<GenerateCommunicationResponse> {
    const response = await apiClient.post<GenerateCommunicationResponse>(
      `/assessments/${assessmentId}/communications/post-visit-summary`,
      { physicianName, physicianNpi },
      { timeout: 60000 } // 60 second timeout for comprehensive summary
    );
    return response.data;
  },

  // ==========================================================================
  // COMMUNICATION CRUD
  // ==========================================================================

  /**
   * Get a specific communication
   */
  async getCommunication(communicationId: string): Promise<PhysicianCommunication> {
    const response = await apiClient.get<PhysicianCommunication>(
      `/communications/${communicationId}`
    );
    return response.data;
  },

  /**
   * Update a communication draft
   */
  async updateCommunication(
    communicationId: string,
    request: UpdateCommunicationRequest
  ): Promise<PhysicianCommunication> {
    const response = await apiClient.patch<PhysicianCommunication>(
      `/communications/${communicationId}`,
      request
    );
    return response.data;
  },

  /**
   * Regenerate a communication with instructions
   */
  async regenerateCommunication(
    communicationId: string,
    request: RegenerateCommunicationRequest
  ): Promise<{ success: boolean; communication: PhysicianCommunication; generationTimeMs: number }> {
    const response = await apiClient.post<{
      success: boolean;
      communication: PhysicianCommunication;
      generationTimeMs: number;
    }>(`/communications/${communicationId}/regenerate`, request, {
      timeout: 30000,
    });
    return response.data;
  },

  // ==========================================================================
  // LIST ENDPOINTS
  // ==========================================================================

  /**
   * Get all communications for a patient
   */
  async getPatientCommunications(
    patientId: string,
    options?: {
      status?: string;
      type?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ListCommunicationsResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.type) params.append('type', options.type);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response = await apiClient.get<ListCommunicationsResponse>(
      `/patients/${patientId}/communications?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Get all communications for an episode
   */
  async getEpisodeCommunications(
    episodeId: string,
    options?: {
      status?: string;
      type?: string;
    }
  ): Promise<ListCommunicationsResponse> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.type) params.append('type', options.type);

    const response = await apiClient.get<ListCommunicationsResponse>(
      `/episodes/${episodeId}/communications?${params.toString()}`
    );
    return response.data;
  },
};

export default communicationService;
