/**
 * Patient Service
 *
 * API calls for patient management
 */

import apiClient from './api/client';
import type { PaginatedResponse } from '@typedefs/api.types';

// Patient list item (summary for search results)
export interface PatientListItem {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  preferredName: string | null;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  phoneMobile: string;
  addressCity: string;
  addressState: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCHARGED' | 'PENDING' | 'DECEASED';
  admissionDate: string | null;
  primaryPhysicianName: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    visits: number;
    assessments: number;
  };
}

// Search params
export interface PatientSearchParams {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: 'lastName' | 'firstName' | 'dateOfBirth' | 'admissionDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  assignedToMe?: boolean;
}

// Create patient request
export interface CreatePatientRequest {
  // Required fields
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
  phoneMobile: string;
  addressStreet1: string;
  addressCity: string;
  addressState: string;
  addressZipCode: string;
  // Optional fields
  middleName?: string;
  email?: string;
  primaryPhysicianName?: string;
  primaryPhysicianPhone?: string;
  // Emergency contact (optional)
  emergencyContacts?: Array<{
    firstName: string;
    lastName: string;
    relationship: string;
    phoneMobile: string;
  }>;
}

/**
 * Search patients
 */
export async function searchPatients(
  params?: PatientSearchParams
): Promise<PaginatedResponse<PatientListItem>> {
  const response = await apiClient.get<PaginatedResponse<PatientListItem>>('/patients', {
    params: {
      ...params,
      assignedToMe: params?.assignedToMe ? 'true' : undefined,
    },
  });
  return response.data;
}

/**
 * Get a single patient by ID
 */
export async function getPatient(id: string): Promise<PatientListItem> {
  const response = await apiClient.get<PatientListItem>(`/patients/${id}`);
  return response.data;
}

/**
 * Create a new patient
 */
export async function createPatient(data: CreatePatientRequest): Promise<PatientListItem> {
  const response = await apiClient.post<{ patient: PatientListItem }>('/patients', data);
  return response.data.patient;
}

// Assessment timeline types
export interface AssessmentTimelineItem {
  id: string;
  assessmentType: string;
  status: string;
  completionPercentage: number;
  hippsCode: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  clinician: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface AssessmentTimelineEpisode {
  id: string;
  episodeNumber: number;
  startDate: string;
  endDate: string | null;
  status: string;
  assessments: AssessmentTimelineItem[];
}

export interface AssessmentTimelineResponse {
  patientId: string;
  timeline: AssessmentTimelineEpisode[];
}

/**
 * Get patient assessment timeline grouped by 60-day episodes
 */
export async function getAssessmentTimeline(id: string): Promise<AssessmentTimelineResponse> {
  const response = await apiClient.get<AssessmentTimelineResponse>(
    `/patients/${id}/assessment-timeline`
  );
  return response.data;
}

export default {
  searchPatients,
  getPatient,
  createPatient,
  getAssessmentTimeline,
};
