/**
 * Visit Note Service
 *
 * API service for visit note operations.
 */

import apiClient from './api/client';
import type {
  VisitNote,
  VisitNoteListItem,
  CreateVisitNoteRequest,
  UpdateVisitNoteRequest,
  GenerateAIDraftRequest,
  GenerateAIDraftResponse,
  FinalizeVisitNoteRequest,
  AmendVisitNoteRequest,
  EpisodeDashboardData,
} from '@typedefs/index';

// =============================================================================
// VISIT NOTE API
// =============================================================================

/**
 * Get a visit note by visit ID
 */
export async function getVisitNote(visitId: string): Promise<VisitNote | null> {
  try {
    const response = await apiClient.get<VisitNote>(`/visits/${visitId}/note`);
    return response.data;
  } catch (error) {
    // Return null if note doesn't exist yet
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a new visit note
 */
export async function createVisitNote(data: CreateVisitNoteRequest): Promise<VisitNote> {
  const response = await apiClient.post<VisitNote>(`/visits/${data.visitId}/note`, data);
  return response.data;
}

/**
 * Update an existing visit note
 */
export async function updateVisitNote(
  visitId: string,
  data: UpdateVisitNoteRequest
): Promise<VisitNote> {
  const response = await apiClient.put<VisitNote>(`/visits/${visitId}/note`, data);
  return response.data;
}

/**
 * Generate AI draft for a section or specific questions
 */
export async function generateAIDraft(
  visitId: string,
  data: GenerateAIDraftRequest
): Promise<GenerateAIDraftResponse> {
  const response = await apiClient.post<GenerateAIDraftResponse>(`/visits/${visitId}/note/draft`, data);
  return response.data;
}

/**
 * Finalize a visit note with signatures
 */
export async function finalizeVisitNote(
  visitId: string,
  data: FinalizeVisitNoteRequest
): Promise<VisitNote> {
  const response = await apiClient.post<VisitNote>(`/visits/${visitId}/note/finalize`, data);
  return response.data;
}

/**
 * Amend a finalized visit note
 */
export async function amendVisitNote(
  visitId: string,
  data: AmendVisitNoteRequest
): Promise<VisitNote> {
  const response = await apiClient.post<VisitNote>(`/visits/${visitId}/note/amend`, data);
  return response.data;
}

/**
 * Get list of visit notes for an episode
 */
export async function getEpisodeVisitNotes(episodeId: string): Promise<VisitNoteListItem[]> {
  const response = await apiClient.get<VisitNoteListItem[]>(`/episodes/${episodeId}/visit-notes`);
  return response.data;
}

// =============================================================================
// EPISODE DASHBOARD API
// =============================================================================

/**
 * Get episode dashboard data
 */
export async function getEpisodeDashboard(episodeId: string): Promise<EpisodeDashboardData> {
  const response = await apiClient.get<EpisodeDashboardData>(`/episodes/${episodeId}/dashboard`);
  return response.data;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Auto-save visit note with debouncing handled by the caller
 */
export async function autoSaveVisitNote(
  visitId: string,
  data: UpdateVisitNoteRequest
): Promise<{ success: boolean; savedAt: string }> {
  const response = await apiClient.put<VisitNote>(`/visits/${visitId}/note`, data);
  return {
    success: true,
    savedAt: response.data.updatedAt,
  };
}

export default {
  getVisitNote,
  createVisitNote,
  updateVisitNote,
  generateAIDraft,
  finalizeVisitNote,
  amendVisitNote,
  getEpisodeVisitNotes,
  getEpisodeDashboard,
  autoSaveVisitNote,
};
