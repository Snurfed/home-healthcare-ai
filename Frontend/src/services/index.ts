/**
 * Service Exports
 */

export { default as apiClient, tokenStorage, isApiError, getErrorMessage, getValidationErrors } from './api/client';
export { default as authService } from './auth.service';
export { default as oasisService } from './oasis.service';
export { default as patientService } from './patient.service';
export { default as episodeService } from './episode.service';
export { default as emrService } from './emr.service';

// Re-export types
export type { PatientListItem, PatientSearchParams, CreatePatientRequest } from './patient.service';
export type { Episode, CreateEpisodeRequest, ListEpisodesResponse } from './episode.service';
