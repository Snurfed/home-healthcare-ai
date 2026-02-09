/**
 * Voice Service
 *
 * API service for voice transcription and OASIS extraction
 */

import apiClient from './api/client';
import type { AssessmentType } from '@typedefs/index';

// ===========================================
// TYPES
// ===========================================

export interface VoiceProcessingResult {
  message: string;
  result: {
    transcriptionId: string;
    transcription: {
      id: string;
      status: string;
      duration: number;
      fullText: string;
      wordCount: number;
      confidence: number;
      medicalTerms: MedicalTermExtraction[];
      processingTimeMs: number;
    };
    oasisMapping: {
      assessmentType: AssessmentType;
      patientId: string;
      existingAssessmentId: string | null;
      mappedFields: OasisFieldMapping[];
      completionPercentage: number;
    };
    reviewRequired: OasisFieldMapping[];
  };
}

export interface OasisFieldMapping {
  itemCode: string;
  itemName: string;
  section: string;
  extractedValue: string | number;
  mappedResponseCode: string;
  confidence: number;
  sourceText: string;
  requiresReview: boolean;
  reviewReason?: string;
  alternativeValues?: Array<{
    value: string | number;
    responseCode: string;
    confidence: number;
  }>;
  // Inference tracking - when multiple items are inferred from a single statement
  inferredFrom?: {
    statement: string;
    category: string;
    itemCount: number;
  };
}

export interface MedicalTermExtraction {
  term: string;
  category: string;
  startPosition: number;
  endPosition: number;
  confidence: number;
  normalizedTerm?: string;
  codes?: {
    icd10?: string;
    snomed?: string;
    rxnorm?: string;
  };
}

export interface TranscriptionResult {
  id: string;
  status: string;
  duration: number;
  language: string;
  fullText: string;
  wordCount: number;
  confidence: number;
  segments: Array<{
    id: string;
    startTime: number;
    endTime: number;
    text: string;
    confidence: number;
  }>;
  medicalTerms: MedicalTermExtraction[];
  audioQuality: string;
  processingTimeMs: number;
  createdAt: string;
  completedAt: string;
}

// ===========================================
// SERVICE
// ===========================================

export const voiceService = {
  /**
   * Upload audio and get transcription with OASIS field extraction
   */
  async processOasisVoice(
    audioBlob: Blob,
    assessmentId: string,
    assessmentType: AssessmentType,
    patientId: string
  ): Promise<VoiceProcessingResult> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('patientId', patientId);
    formData.append('assessmentType', assessmentType);
    formData.append('existingAssessmentId', assessmentId);
    formData.append('context', 'oasis_assessment');
    formData.append('medicalVocabulary', 'true');

    const response = await apiClient.post<VoiceProcessingResult>(
      '/voice/process-oasis',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 minute timeout for processing
      }
    );

    return response.data;
  },

  /**
   * Get transcription by ID
   */
  async getTranscription(id: string): Promise<TranscriptionResult> {
    const response = await apiClient.get<TranscriptionResult>(
      `/voice/transcriptions/${id}`
    );
    return response.data;
  },

  /**
   * Simple audio transcription (without OASIS extraction)
   */
  async transcribe(
    audioBlob: Blob,
    options?: {
      patientId?: string;
      context?: string;
      language?: string;
    }
  ): Promise<{ transcription: TranscriptionResult }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    if (options?.patientId) formData.append('patientId', options.patientId);
    if (options?.context) formData.append('context', options.context);
    if (options?.language) formData.append('language', options.language);
    formData.append('medicalVocabulary', 'true');

    const response = await apiClient.post<{ transcription: TranscriptionResult }>(
      '/voice/transcribe',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      }
    );

    return response.data;
  },
};

export default voiceService;
