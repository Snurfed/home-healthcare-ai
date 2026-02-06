/**
 * Episode Service
 *
 * API calls for episode management
 */

import apiClient from './api/client';

// Episode type
export interface Episode {
  id: string;
  patientId: string;
  episodeNumber: number;
  startDate: string;
  endDate: string | null;
  referralDate: string | null;
  referralSource: string | null;
  referralDiagnosis: string | null;
  certPeriodStart: string | null;
  certPeriodEnd: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  _count?: {
    assessments: number;
    visits: number;
  };
}

// Create episode request
export interface CreateEpisodeRequest {
  startDate: string;
  referralDate?: string;
  referralSource?: string;
  referralDiagnosis?: string;
  certPeriodStart?: string;
  certPeriodEnd?: string;
}

// List episodes response
export interface ListEpisodesResponse {
  data: Episode[];
  patient: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * Get episodes for a patient
 */
export async function getPatientEpisodes(
  patientId: string,
  includeEnded = false
): Promise<ListEpisodesResponse> {
  const response = await apiClient.get<ListEpisodesResponse>(
    `/patients/${patientId}/episodes`,
    { params: { includeEnded: includeEnded ? 'true' : 'false' } }
  );
  return response.data;
}

/**
 * Create a new episode for a patient
 */
export async function createEpisode(
  patientId: string,
  data: CreateEpisodeRequest
): Promise<{ message: string; episode: Episode }> {
  const response = await apiClient.post<{ message: string; episode: Episode }>(
    `/patients/${patientId}/episodes`,
    data
  );
  return response.data;
}

/**
 * Get a single episode by ID
 */
export async function getEpisode(id: string): Promise<Episode> {
  const response = await apiClient.get<Episode>(`/episodes/${id}`);
  return response.data;
}

export default {
  getPatientEpisodes,
  createEpisode,
  getEpisode,
};
