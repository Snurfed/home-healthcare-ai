/**
 * Form Engine Service
 *
 * API service for form engine operations including:
 * - Form retrieval by discipline/visit type
 * - Response saving
 * - Module toggling
 * - Validation
 */

import apiClient from './api/client';
import type {
  Discipline,
  VisitType,
  BuiltForm,
  CanonicalVisitNote,
  CanonicalResponse,
  CanonicalValidationResult,
  CanonicalFormDefinition,
} from '@typedefs/index';

// =============================================================================
// TYPES
// =============================================================================

export interface GetFormParams {
  discipline: Discipline;
  visitType: VisitType;
  visitId?: string;
  activeModules?: string[];
}

export interface GetFormResponse {
  form: BuiltForm;
  visitNote?: CanonicalVisitNote;
  requiresOasis: boolean;
}

export interface SaveResponsesRequest {
  responses: Record<string, {
    value: unknown;
    source?: CanonicalResponse['source'];
    confidence?: number;
    notes?: string;
  }>;
  activeModules?: string[];
}

export interface SaveResponsesResponse {
  success: boolean;
  validation: CanonicalValidationResult;
  updatedAt: string;
}

export interface ToggleModuleRequest {
  moduleId: string;
  active: boolean;
}

export interface ToggleModuleResponse {
  success: boolean;
  activeModules: string[];
}

export interface FormDefinitionListItem {
  id: string;
  discipline: Discipline;
  visitType: VisitType;
  name: string;
  sectionCount: number;
  questionCount: number;
  requiresOasis: boolean;
}

export interface SectionListItem {
  sectionId: string;
  name: string;
  category: string;
  questionCount: number;
  applicableDisciplines: Discipline[];
  applicableVisitTypes: VisitType[];
  isModule: boolean;
}

export interface QuestionSearchResult {
  conceptId: string;
  label: string;
  type: string;
  sectionId: string;
  sectionName: string;
}

// =============================================================================
// FORM RETRIEVAL API
// =============================================================================

/**
 * Get form for a discipline and visit type
 */
export async function getForm(params: GetFormParams): Promise<GetFormResponse> {
  const queryParams = new URLSearchParams({
    discipline: params.discipline,
    visitType: params.visitType,
  });

  if (params.visitId) {
    queryParams.append('visitId', params.visitId);
  }

  if (params.activeModules?.length) {
    queryParams.append('activeModules', params.activeModules.join(','));
  }

  const response = await apiClient.get<GetFormResponse>(`/forms?${queryParams.toString()}`);
  return response.data;
}

/**
 * Get form for a specific visit
 */
export async function getVisitForm(
  visitId: string,
  options?: { discipline?: Discipline; visitType?: VisitType }
): Promise<GetFormResponse> {
  const queryParams = new URLSearchParams();

  if (options?.discipline) {
    queryParams.append('discipline', options.discipline);
  }

  if (options?.visitType) {
    queryParams.append('visitType', options.visitType);
  }

  const url = queryParams.toString()
    ? `/visits/${visitId}/form?${queryParams.toString()}`
    : `/visits/${visitId}/form`;

  const response = await apiClient.get<GetFormResponse>(url);
  return response.data;
}

/**
 * Get all available form definitions
 */
export async function getFormDefinitions(): Promise<FormDefinitionListItem[]> {
  const response = await apiClient.get<FormDefinitionListItem[]>('/forms/definitions');
  return response.data;
}

/**
 * Get a specific form definition by ID
 */
export async function getFormDefinitionById(definitionId: string): Promise<CanonicalFormDefinition> {
  const response = await apiClient.get<CanonicalFormDefinition>(`/forms/definitions/${definitionId}`);
  return response.data;
}

/**
 * Get all available sections
 */
export async function getSections(): Promise<SectionListItem[]> {
  const response = await apiClient.get<SectionListItem[]>('/forms/sections');
  return response.data;
}

// =============================================================================
// RESPONSE MANAGEMENT API
// =============================================================================

/**
 * Save responses for a visit
 */
export async function saveResponses(
  visitId: string,
  data: SaveResponsesRequest
): Promise<SaveResponsesResponse> {
  const response = await apiClient.post<SaveResponsesResponse>(
    `/visits/${visitId}/form/responses`,
    data
  );
  return response.data;
}

/**
 * Toggle a module on/off for a visit
 */
export async function toggleModule(
  visitId: string,
  data: ToggleModuleRequest
): Promise<ToggleModuleResponse> {
  const response = await apiClient.post<ToggleModuleResponse>(
    `/visits/${visitId}/form/modules`,
    data
  );
  return response.data;
}

// =============================================================================
// VALIDATION API
// =============================================================================

/**
 * Validate a visit note
 */
export async function validateVisitNote(visitId: string): Promise<CanonicalValidationResult> {
  const response = await apiClient.get<CanonicalValidationResult>(
    `/visits/${visitId}/form/validate`
  );
  return response.data;
}

// =============================================================================
// QUESTION LOOKUP API
// =============================================================================

/**
 * Search questions by label or concept ID
 */
export async function searchQuestions(
  query: string,
  limit = 20
): Promise<QuestionSearchResult[]> {
  const response = await apiClient.get<QuestionSearchResult[]>(
    `/forms/questions?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  return response.data;
}

/**
 * Get a question by concept ID
 */
export async function getQuestion(conceptId: string): Promise<QuestionSearchResult | null> {
  try {
    const response = await apiClient.get<QuestionSearchResult>(
      `/forms/questions/${encodeURIComponent(conceptId)}`
    );
    return response.data;
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export default {
  getForm,
  getVisitForm,
  getFormDefinitions,
  getFormDefinitionById,
  getSections,
  saveResponses,
  toggleModule,
  validateVisitNote,
  searchQuestions,
  getQuestion,
};
