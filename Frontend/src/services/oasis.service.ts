/**
 * OASIS Service
 *
 * OASIS Assessment API calls
 */

import apiClient from './api/client';
import type {
  OASISAssessment,
  AssessmentListItem,
  OASISQuestion,
  CreateAssessmentRequest,
  UpdateAssessmentRequest,
  SubmitForReviewRequest,
  ReviewAssessmentRequest,
  ListAssessmentsParams,
  QuestionLibraryParams,
  PaginatedResponse,
  ScoringResult,
  HIPPSDetailsResponse,
  HIPPSDetailsOptions,
} from '@typedefs/index';

// Response types for create/update
interface CreateAssessmentResponse {
  message: string;
  assessment: OASISAssessment;
}

interface UpdateAssessmentResponse {
  message: string;
  assessment: {
    id: string;
    status: string;
    completionPercentage: number;
    updatedAt: string;
  };
}

interface QuestionLibraryResponse {
  questions: OASISQuestion[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const oasisService = {
  /**
   * List assessments with pagination and filters
   */
  async listAssessments(
    params?: ListAssessmentsParams
  ): Promise<PaginatedResponse<AssessmentListItem>> {
    const response = await apiClient.get<PaginatedResponse<AssessmentListItem>>(
      '/oasis/assessments',
      { params }
    );
    return response.data;
  },

  /**
   * Get a single assessment by ID
   */
  async getAssessment(id: string): Promise<OASISAssessment> {
    const response = await apiClient.get<OASISAssessment>(`/oasis/assessments/${id}`);
    return response.data;
  },

  /**
   * Create a new assessment
   */
  async createAssessment(data: CreateAssessmentRequest): Promise<OASISAssessment> {
    const response = await apiClient.post<CreateAssessmentResponse>(
      '/oasis/assessments',
      data
    );
    return response.data.assessment;
  },

  /**
   * Update an assessment (section responses)
   */
  async updateAssessment(
    id: string,
    data: UpdateAssessmentRequest
  ): Promise<UpdateAssessmentResponse['assessment']> {
    const response = await apiClient.put<UpdateAssessmentResponse>(
      `/oasis/assessments/${id}`,
      data
    );
    return response.data.assessment;
  },

  /**
   * Submit assessment for review
   */
  async submitForReview(id: string, data: SubmitForReviewRequest): Promise<OASISAssessment> {
    const response = await apiClient.post<{ assessment: OASISAssessment }>(
      `/oasis/assessments/${id}/submit`,
      data
    );
    return response.data.assessment;
  },

  /**
   * Review an assessment (approve/reject)
   */
  async reviewAssessment(
    id: string,
    data: ReviewAssessmentRequest
  ): Promise<OASISAssessment> {
    const response = await apiClient.post<{ assessment: OASISAssessment }>(
      `/oasis/assessments/${id}/review`,
      data
    );
    return response.data.assessment;
  },

  /**
   * Lock an approved assessment
   */
  async lockAssessment(id: string): Promise<OASISAssessment> {
    const response = await apiClient.post<{ assessment: OASISAssessment }>(
      `/oasis/assessments/${id}/lock`
    );
    return response.data.assessment;
  },

  /**
   * Calculate HIPPS score for an assessment
   */
  async calculateScore(id: string): Promise<ScoringResult> {
    const response = await apiClient.post<{ scoring: ScoringResult }>(
      `/oasis/assessments/${id}/calculate-score`
    );
    return response.data.scoring;
  },

  /**
   * Get OASIS question library
   */
  async getQuestions(params?: QuestionLibraryParams): Promise<OASISQuestion[]> {
    const response = await apiClient.get<QuestionLibraryResponse>('/oasis/questions', {
      params,
    });
    return response.data.questions;
  },

  /**
   * Get questions for a specific section
   */
  async getQuestionsBySection(section: string): Promise<OASISQuestion[]> {
    return this.getQuestions({ section: section as QuestionLibraryParams['section'] });
  },

  /**
   * Delete an assessment (soft delete)
   */
  async deleteAssessment(id: string): Promise<void> {
    await apiClient.delete(`/oasis/assessments/${id}`);
  },

  /**
   * Get detailed HIPPS code information with breakdown and reimbursement
   */
  async getHippsDetails(
    id: string,
    options?: HIPPSDetailsOptions
  ): Promise<HIPPSDetailsResponse> {
    const params: Record<string, string> = {};
    if (options?.includeOptimizations) {
      params.includeOptimizations = 'true';
    }
    if (options?.wageIndex) {
      params.wageIndex = options.wageIndex.toString();
    }
    if (options?.recalculate) {
      params.recalculate = 'true';
    }
    const response = await apiClient.get<HIPPSDetailsResponse>(
      `/oasis/assessments/${id}/hipps`,
      { params }
    );
    return response.data;
  },

  /**
   * Calculate enhanced HIPPS score with full breakdown
   */
  async calculateEnhancedScore(
    id: string,
    options?: { includeOptimizations?: boolean; wageIndex?: number }
  ): Promise<HIPPSDetailsResponse> {
    const response = await apiClient.post<HIPPSDetailsResponse>(
      `/oasis/assessments/${id}/calculate-hipps`,
      options
    );
    return response.data;
  },
};

export default oasisService;
