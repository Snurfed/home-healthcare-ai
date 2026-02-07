import { Router } from 'express';
import multer from 'multer';
import * as voiceController from '../controllers/voice.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';

// ===========================================
// MULTER CONFIGURATION
// ===========================================

const storage = multer.memoryStorage();

const SUPPORTED_AUDIO_TYPES = [
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
];

const uploadAudio = multer({
  storage,
  limits: {
    fileSize: 52428800, // 50MB max
  },
  fileFilter: (_req, file, cb) => {
    if (SUPPORTED_AUDIO_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}. Supported: WAV, MP3, M4A, OGG, WebM, FLAC`));
    }
  },
});

// ===========================================
// TYPE DEFINITIONS (kept for API documentation)
// ===========================================

// Audio Upload Types
export interface AudioFileMetadata {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: AudioMimeType;
  size: number;
  buffer?: Buffer;
  path?: string;
}

export type AudioMimeType =
  | 'audio/wav'
  | 'audio/wave'
  | 'audio/x-wav'
  | 'audio/mp3'
  | 'audio/mpeg'
  | 'audio/mp4'
  | 'audio/m4a'
  | 'audio/x-m4a'
  | 'audio/ogg'
  | 'audio/webm'
  | 'audio/flac';

export interface TranscribeRequestBody {
  patientId?: string;
  visitId?: string;
  context?: TranscriptionContext;
  language?: string;
  speakerDiarization?: boolean;
  medicalVocabulary?: boolean;
}

export type TranscriptionContext =
  | 'general_notes'
  | 'oasis_assessment'
  | 'medication_review'
  | 'wound_care'
  | 'vital_signs'
  | 'patient_education'
  | 'care_coordination';

// Transcription Result Types
export interface TranscriptionResult {
  id: string;
  status: TranscriptionStatus;
  audioFileUrl?: string;
  duration: number;
  language: string;
  transcript: TranscriptSegment[];
  fullText: string;
  wordCount: number;
  confidence: ConfidenceMetrics;
  speakers?: SpeakerSegment[];
  medicalTerms?: MedicalTermExtraction[];
  timestamps: {
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
  };
  metadata: TranscriptionMetadata;
}

export type TranscriptionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  speaker?: string;
  words?: WordDetail[];
}

export interface WordDetail {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
  isUncertain: boolean;
}

export interface SpeakerSegment {
  speakerId: string;
  speakerLabel: string;
  segments: {
    startTime: number;
    endTime: number;
    text: string;
  }[];
  totalSpeakingTime: number;
}

// Confidence Score Types
export interface ConfidenceMetrics {
  overall: number;
  segments: SegmentConfidence[];
  lowConfidenceFlags: LowConfidenceFlag[];
  qualityIndicators: AudioQualityIndicators;
}

export interface SegmentConfidence {
  segmentId: string;
  confidence: number;
  uncertainWords: string[];
}

export interface LowConfidenceFlag {
  segmentId: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  suggestedReview: boolean;
  possibleAlternatives?: string[];
}

export interface AudioQualityIndicators {
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  signalToNoiseRatio?: number;
  hasBackgroundNoise: boolean;
  hasSpeechOverlap: boolean;
  volumeConsistency: 'consistent' | 'variable' | 'problematic';
}

// Medical Term Extraction
export interface MedicalTermExtraction {
  term: string;
  category: MedicalTermCategory;
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

export type MedicalTermCategory =
  | 'diagnosis'
  | 'symptom'
  | 'medication'
  | 'procedure'
  | 'vital_sign'
  | 'body_part'
  | 'medical_device'
  | 'lab_value';

// OASIS Field Mapping Types
export interface OasisProcessRequest extends TranscribeRequestBody {
  patientId: string;
  assessmentType: OasisAssessmentType;
  existingAssessmentId?: string;
}

export type OasisAssessmentType =
  | 'start_of_care'
  | 'resumption_of_care'
  | 'recertification'
  | 'follow_up'
  | 'transfer'
  | 'discharge';

export interface OasisProcessingResult {
  transcriptionId: string;
  transcription: TranscriptionResult;
  oasisMapping: OasisFieldMapping;
  extractedData: ExtractedOasisData;
  reviewRequired: OasisReviewItem[];
}

export interface OasisFieldMapping {
  assessmentId: string;
  assessmentType: OasisAssessmentType;
  patientId: string;
  mappedFields: MappedOasisField[];
  unmappedContent: string[];
  completionPercentage: number;
  lastUpdated: string;
}

export interface MappedOasisField {
  fieldCode: string;
  fieldName: string;
  section: OasisSection;
  extractedValue: string | number | boolean | string[];
  mappedResponse?: string | number;
  confidence: number;
  sourceSegments: string[];
  sourceText: string;
  requiresReview: boolean;
  reviewReason?: string;
  alternativeValues?: {
    value: string | number;
    confidence: number;
  }[];
}

export type OasisSection =
  | 'clinical_record'
  | 'patient_tracking'
  | 'patient_history'
  | 'living_situation'
  | 'sensory_status'
  | 'integumentary_status'
  | 'respiratory_status'
  | 'cardiac_status'
  | 'elimination_status'
  | 'neuro_emotional'
  | 'adl_iadl'
  | 'medications'
  | 'care_management'
  | 'therapy_need'
  | 'functional_abilities';

export interface ExtractedOasisData {
  diagnoses?: {
    primary?: { code: string; description: string };
    secondary?: { code: string; description: string }[];
  };
  functionalStatus?: {
    selfCare?: FunctionalAssessment;
    mobility?: FunctionalAssessment;
    cognitiveFunction?: CognitiveAssessment;
  };
  skinCondition?: {
    hasWounds: boolean;
    wounds?: WoundAssessment[];
    skinIntegrity?: string;
  };
  vitalSigns?: {
    bloodPressure?: { systolic: number; diastolic: number };
    heartRate?: number;
    respiratoryRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
    weight?: number;
    painLevel?: number;
  };
  medications?: {
    current?: MedicationMention[];
    changes?: MedicationChange[];
  };
  livingSituation?: {
    homeEnvironment?: string;
    safetyRisks?: string[];
    caregiverAvailability?: string;
  };
}

export interface FunctionalAssessment {
  eating?: number;
  oralHygiene?: number;
  toileting?: number;
  dressing?: number;
  bathing?: number;
  transfers?: number;
  ambulation?: number;
  stairs?: number;
}

export interface CognitiveAssessment {
  orientation?: string;
  memory?: string;
  decisionMaking?: string;
  behavioralSymptoms?: string[];
}

export interface WoundAssessment {
  location: string;
  type: string;
  stage?: number;
  measurements?: {
    length?: number;
    width?: number;
    depth?: number;
  };
  characteristics?: string[];
  treatment?: string;
}

export interface MedicationMention {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  purpose?: string;
}

export interface MedicationChange {
  medication: string;
  changeType: 'started' | 'stopped' | 'modified';
  previousDosage?: string;
  newDosage?: string;
  reason?: string;
}

export interface OasisReviewItem {
  fieldCode: string;
  fieldName: string;
  reason: ReviewReason;
  extractedValue: string | number;
  suggestedValue?: string | number;
  sourceText: string;
  priority: 'high' | 'medium' | 'low';
}

export type ReviewReason =
  | 'low_confidence'
  | 'multiple_values_detected'
  | 'conflicting_information'
  | 'incomplete_data'
  | 'ambiguous_statement'
  | 'clinical_validation_needed'
  | 'value_out_of_range';

// Transcription Metadata
export interface TranscriptionMetadata {
  patientId?: string;
  visitId?: string;
  clinicianId: string;
  context: TranscriptionContext;
  provider: TranscriptionProvider;
  audioFormat: string;
  sampleRate?: number;
  channels?: number;
  processingTimeMs: number;
}

export type TranscriptionProvider = 'google' | 'aws' | 'openai' | 'azure';

// ===========================================
// ROUTER INITIALIZATION
// ===========================================

const router = Router();

// ===========================================
// ROUTES
// ===========================================

/**
 * @route   POST /api/voice/transcribe
 * @desc    Transcribe audio file to text
 * @access  Private - Clinical staff only
 */
router.post(
  '/transcribe',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.HOME_HEALTH_AIDE,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  uploadAudio.single('audio'),
  voiceController.transcribe
);

/**
 * @route   POST /api/voice/process-oasis
 * @desc    Transcribe audio and auto-populate OASIS assessment fields
 * @access  Private - Clinical staff who can complete OASIS
 */
router.post(
  '/process-oasis',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
  ]),
  uploadAudio.single('audio'),
  voiceController.processOasis
);

/**
 * @route   GET /api/voice/transcriptions
 * @desc    List transcriptions with filtering and pagination
 * @access  Private - Users see own transcriptions or assigned patients
 */
router.get(
  '/transcriptions',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.HOME_HEALTH_AIDE,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  voiceController.listTranscriptions
);

/**
 * @route   GET /api/voice/transcriptions/:id
 * @desc    Get transcription by ID
 * @access  Private - Creator, assigned clinicians, or admin/supervisor
 */
router.get(
  '/transcriptions/:id',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.HOME_HEALTH_AIDE,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  voiceController.getTranscription
);

/**
 * @route   DELETE /api/voice/transcriptions/:id
 * @desc    Soft delete a transcription
 * @access  Private - Creator or admin/supervisor
 */
router.delete(
  '/transcriptions/:id',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.HOME_HEALTH_AIDE,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  voiceController.deleteTranscription
);

/**
 * @route   POST /api/voice/transcriptions/:id/cancel
 * @desc    Cancel a pending or processing transcription
 * @access  Private - Creator or admin/supervisor
 */
router.post(
  '/transcriptions/:id/cancel',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.HOME_HEALTH_AIDE,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  voiceController.cancelTranscription
);

export default router;
