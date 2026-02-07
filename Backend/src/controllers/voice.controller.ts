import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  UserRole,
  TranscriptionStatus,
  TranscriptionProvider,
  AuditAction,
  AssessmentType,
  Prisma,
} from '../generated/prisma';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { whisperService } from '../services/whisper.service';
import { oasisExtractionService, OasisFieldMapping as ExtractedOasisField } from '../services/oasis-extraction.service';

// ===========================================
// CONFIGURATION
// ===========================================

const UPLOAD_DIR = process.env.VOICE_UPLOAD_DIR || './uploads/voice';
const MAX_AUDIO_SIZE = parseInt(process.env.MAX_AUDIO_SIZE || '52428800', 10); // 50MB default
const DEFAULT_PROVIDER = (process.env.DEFAULT_TRANSCRIPTION_PROVIDER || 'google') as TranscriptionProvider;
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

// ===========================================
// TYPE DEFINITIONS
// ===========================================

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

export interface OasisProcessRequest extends TranscribeRequestBody {
  patientId: string;
  assessmentType: AssessmentType;
  existingAssessmentId?: string;
}

export interface AudioFileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
}

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  speaker?: string;
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

export interface OasisFieldMapping {
  fieldCode: string;
  fieldName: string;
  section: string;
  extractedValue: string | number | boolean;
  mappedResponse?: string | number;
  confidence: number;
  sourceText: string;
  requiresReview: boolean;
  reviewReason?: string;
}

export interface ListTranscriptionsQuery {
  page?: string;
  limit?: string;
  patientId?: string;
  visitId?: string;
  status?: TranscriptionStatus;
  context?: TranscriptionContext;
  startDate?: string;
  endDate?: string;
}

// Extended request types
export interface TranscribeRequest extends AuthenticatedRequest {
  body: TranscribeRequestBody;
  file?: AudioFileUpload;
}

export interface OasisRequest extends AuthenticatedRequest {
  body: OasisProcessRequest;
  file?: AudioFileUpload;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Create PHI audit log for voice transcription access
 */
async function createVoiceAuditLog(
  action: AuditAction,
  userId: string,
  userEmail: string,
  userRole: string,
  resourceId: string,
  success: boolean,
  req: AuthenticatedRequest,
  options: {
    description?: string;
    patientId?: string;
    errorMessage?: string;
  } = {}
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        userEmail,
        userRole,
        action,
        resourceType: 'voice_transcription',
        resourceId,
        description: options.description,
        phiAccessed: !!options.patientId,
        phiFields: options.patientId ? ['audio_content', 'transcription_text'] : [],
        success,
        errorMessage: options.errorMessage,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
        timestamp: new Date(),
        retentionExpiresAt: new Date(Date.now() + 6 * 365 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    console.error('[Voice Audit Log Error]', error);
  }
}

/**
 * Ensure upload directory exists
 */
function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Save audio file to disk
 */
async function saveAudioFile(
  file: AudioFileUpload,
  transcriptionId: string
): Promise<{ storagePath: string; fileName: string }> {
  ensureUploadDir();

  const ext = path.extname(file.originalname) || '.wav';
  const fileName = `${transcriptionId}${ext}`;
  const storagePath = path.join(UPLOAD_DIR, fileName);

  if (file.buffer) {
    await fs.promises.writeFile(storagePath, file.buffer);
  } else if (file.path) {
    await fs.promises.copyFile(file.path, storagePath);
  } else {
    throw new Error('No audio data provided');
  }

  return { storagePath, fileName };
}

/**
 * Validate audio file
 */
function validateAudioFile(file?: AudioFileUpload): string[] {
  const errors: string[] = [];

  if (!file) {
    errors.push('No audio file provided');
    return errors;
  }

  if (!SUPPORTED_AUDIO_TYPES.includes(file.mimetype)) {
    errors.push(`Unsupported audio format: ${file.mimetype}. Supported formats: WAV, MP3, M4A, OGG, WebM, FLAC`);
  }

  if (file.size > MAX_AUDIO_SIZE) {
    errors.push(`File size exceeds maximum allowed (${MAX_AUDIO_SIZE / 1024 / 1024}MB)`);
  }

  if (file.size === 0) {
    errors.push('Audio file is empty');
  }

  return errors;
}

/**
 * Calculate audio duration from file (placeholder - would use ffprobe in production)
 */
function estimateAudioDuration(fileSize: number, mimeType: string): number {
  // Rough estimation based on typical bitrates
  const bitrateMap: Record<string, number> = {
    'audio/wav': 1411000, // 1411 kbps for CD quality WAV
    'audio/mp3': 128000,  // 128 kbps typical MP3
    'audio/mpeg': 128000,
    'audio/m4a': 128000,
    'audio/ogg': 128000,
    'audio/webm': 128000,
    'audio/flac': 900000, // ~900 kbps typical FLAC
  };

  const bitrate = bitrateMap[mimeType] || 128000;
  return Math.round((fileSize * 8) / bitrate);
}

/**
 * Transcription service using OpenAI Whisper
 */
async function callTranscriptionService(
  audioPath: string,
  options: {
    provider: TranscriptionProvider;
    language: string;
    speakerDiarization: boolean;
    medicalVocabulary: boolean;
    context: TranscriptionContext;
  }
): Promise<{
  fullText: string;
  segments: TranscriptSegment[];
  confidence: number;
  medicalTerms: MedicalTermExtraction[];
  processingTimeMs: number;
  audioQuality: string;
}> {
  // Use Whisper service for transcription
  const result = await whisperService.transcribeAudio(audioPath, {
    language: options.language.split('-')[0], // Convert en-US to en
    medicalVocabulary: options.medicalVocabulary,
  });

  // Extract medical terms from transcription
  const medicalTerms = whisperService.extractMedicalTerms(result.text);

  // Assess audio quality
  const audioQuality = whisperService.assessAudioQuality(result);

  return {
    fullText: result.text,
    segments: result.segments,
    confidence: result.confidence,
    medicalTerms: medicalTerms as MedicalTermExtraction[],
    processingTimeMs: result.processingTimeMs,
    audioQuality,
  };
}

/**
 * Extract OASIS field mappings from transcription using Claude AI
 */
async function extractOasisMappings(
  transcriptionText: string,
  assessmentType: AssessmentType,
  _existingResponses?: Record<string, { responseCode?: string; responseValue?: string }>
): Promise<{
  mappedFields: ExtractedOasisField[];
  completionPercentage: number;
  confidenceMetrics: {
    overall: number;
    highConfidence: number;
    needsReview: number;
  };
}> {
  const result = await oasisExtractionService.extractOasisFields(
    transcriptionText,
    assessmentType
  );

  return {
    mappedFields: result.mappedFields,
    completionPercentage: result.completionPercentage,
    confidenceMetrics: result.confidenceMetrics,
  };
}

/**
 * Check if user has access to transcription
 */
async function checkTranscriptionAccess(
  userId: string,
  userRole: UserRole,
  transcription: { clinicianId: string; patientId: string | null }
): Promise<boolean> {
  // Admins and supervisors can access all transcriptions
  if ([UserRole.ADMIN, UserRole.SUPERVISOR].includes(userRole)) {
    return true;
  }

  // Clinician who created it has access
  if (transcription.clinicianId === userId) {
    return true;
  }

  // If linked to a patient, check patient assignment
  if (transcription.patientId) {
    const assignment = await prisma.patientAssignment.findFirst({
      where: {
        patientId: transcription.patientId,
        userId,
        endDate: null,
      },
    });
    return !!assignment;
  }

  return false;
}

// ===========================================
// CONTROLLER FUNCTIONS
// ===========================================

/**
 * Transcribe an audio file to text
 * POST /api/voice/transcribe
 */
export async function transcribe(
  req: TranscribeRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Validate audio file
    const validationErrors = validateAudioFile(req.file);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid audio file',
        errors: validationErrors,
      });
    }

    const file = req.file!;
    const {
      patientId,
      visitId,
      context = 'general_notes',
      language = 'en-US',
      speakerDiarization = false,
      medicalVocabulary = true,
    } = req.body;

    // Validate patient exists if provided
    if (patientId) {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        select: { id: true, deletedAt: true },
      });
      if (!patient || patient.deletedAt) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Patient not found',
        });
      }
    }

    // Validate visit exists if provided
    if (visitId) {
      const visit = await prisma.visit.findUnique({
        where: { id: visitId },
        select: { id: true, deletedAt: true },
      });
      if (!visit || visit.deletedAt) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Visit not found',
        });
      }
    }

    const transcriptionId = uuidv4();
    const duration = estimateAudioDuration(file.size, file.mimetype);

    // Save audio file
    const { storagePath, fileName } = await saveAudioFile(file, transcriptionId);

    // Create transcription record
    const transcription = await prisma.voiceTranscription.create({
      data: {
        id: transcriptionId,
        patientId: patientId || null,
        visitId: visitId || null,
        clinicianId: req.user.id,
        audioFileName: file.originalname,
        audioStoragePath: storagePath,
        audioMimeType: file.mimetype,
        audioDurationSeconds: duration,
        audioFileSize: file.size,
        status: TranscriptionStatus.PROCESSING,
        provider: DEFAULT_PROVIDER,
        transcriptionContext: context,
        language,
      },
    });

    // Process transcription (async in production, sync here for simplicity)
    try {
      const result = await callTranscriptionService(storagePath, {
        provider: DEFAULT_PROVIDER,
        language,
        speakerDiarization,
        medicalVocabulary,
        context,
      });

      // Update transcription with results
      const updatedTranscription = await prisma.voiceTranscription.update({
        where: { id: transcriptionId },
        data: {
          status: TranscriptionStatus.COMPLETED,
          fullText: result.fullText,
          segments: result.segments as unknown as Prisma.InputJsonValue,
          wordCount: result.fullText.split(/\s+/).filter(w => w).length,
          overallConfidence: result.confidence,
          medicalTerms: result.medicalTerms as unknown as Prisma.InputJsonValue,
          audioQuality: result.audioQuality,
          processingStartedAt: new Date(),
          processingCompletedAt: new Date(),
          processingTimeMs: result.processingTimeMs,
        },
      });

      // Audit log
      await createVoiceAuditLog(
        AuditAction.CREATE,
        req.user.id,
        req.user.email,
        req.user.role,
        transcriptionId,
        true,
        req,
        {
          description: `Created transcription: ${file.originalname}`,
          patientId,
        }
      );

      return res.status(201).json({
        message: 'Transcription completed successfully',
        transcription: {
          id: updatedTranscription.id,
          status: updatedTranscription.status,
          duration: updatedTranscription.audioDurationSeconds,
          language: updatedTranscription.language,
          fullText: updatedTranscription.fullText,
          wordCount: updatedTranscription.wordCount,
          confidence: updatedTranscription.overallConfidence,
          segments: updatedTranscription.segments,
          medicalTerms: updatedTranscription.medicalTerms,
          audioQuality: updatedTranscription.audioQuality,
          processingTimeMs: updatedTranscription.processingTimeMs,
          createdAt: updatedTranscription.createdAt,
          completedAt: updatedTranscription.processingCompletedAt,
        },
      });
    } catch (processingError) {
      // Update status to failed
      await prisma.voiceTranscription.update({
        where: { id: transcriptionId },
        data: {
          status: TranscriptionStatus.FAILED,
          errorMessage: processingError instanceof Error ? processingError.message : 'Unknown error',
        },
      });

      throw processingError;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Transcribe audio and auto-populate OASIS assessment fields
 * POST /api/voice/process-oasis
 */
export async function processOasis(
  req: OasisRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Only clinical staff can process OASIS
    const allowedRoles = [
      UserRole.ADMIN,
      UserRole.SUPERVISOR,
      UserRole.NURSE,
      UserRole.THERAPIST_PT,
      UserRole.THERAPIST_OT,
      UserRole.THERAPIST_ST,
    ];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to process OASIS assessments',
      });
    }

    // Validate audio file
    const validationErrors = validateAudioFile(req.file);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid audio file',
        errors: validationErrors,
      });
    }

    const file = req.file!;
    const {
      patientId,
      visitId,
      assessmentType,
      existingAssessmentId,
      language = 'en-US',
      speakerDiarization = false,
      medicalVocabulary = true,
    } = req.body;

    // Validate required fields
    if (!patientId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Patient ID is required for OASIS processing',
      });
    }

    if (!assessmentType) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Assessment type is required',
      });
    }

    // Validate patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, firstName: true, lastName: true, deletedAt: true },
    });
    if (!patient || patient.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Patient not found',
      });
    }

    // Validate existing assessment if provided
    if (existingAssessmentId) {
      const assessment = await prisma.oasisAssessment.findUnique({
        where: { id: existingAssessmentId },
        select: { id: true, patientId: true, status: true },
      });
      if (!assessment) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Assessment not found',
        });
      }
      if (assessment.patientId !== patientId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Assessment does not belong to the specified patient',
        });
      }
    }

    const transcriptionId = uuidv4();
    const duration = estimateAudioDuration(file.size, file.mimetype);

    // Save audio file
    const { storagePath } = await saveAudioFile(file, transcriptionId);

    // Create transcription record
    const transcription = await prisma.voiceTranscription.create({
      data: {
        id: transcriptionId,
        patientId,
        visitId: visitId || null,
        clinicianId: req.user.id,
        audioFileName: file.originalname,
        audioStoragePath: storagePath,
        audioMimeType: file.mimetype,
        audioDurationSeconds: duration,
        audioFileSize: file.size,
        status: TranscriptionStatus.PROCESSING,
        provider: DEFAULT_PROVIDER,
        transcriptionContext: 'oasis_assessment',
        language,
      },
    });

    try {
      // Process transcription
      const transcriptionResult = await callTranscriptionService(storagePath, {
        provider: DEFAULT_PROVIDER,
        language,
        speakerDiarization,
        medicalVocabulary,
        context: 'oasis_assessment',
      });

      // Extract OASIS field mappings
      const oasisResult = await extractOasisMappings(
        transcriptionResult.fullText,
        assessmentType
      );

      // Update transcription with results
      const updatedTranscription = await prisma.voiceTranscription.update({
        where: { id: transcriptionId },
        data: {
          status: TranscriptionStatus.COMPLETED,
          fullText: transcriptionResult.fullText,
          segments: transcriptionResult.segments as unknown as Prisma.InputJsonValue,
          wordCount: transcriptionResult.fullText.split(/\s+/).filter(w => w).length,
          overallConfidence: transcriptionResult.confidence,
          medicalTerms: transcriptionResult.medicalTerms as unknown as Prisma.InputJsonValue,
          audioQuality: transcriptionResult.audioQuality,
          oasisMappingResult: oasisResult as unknown as Prisma.InputJsonValue,
          processingStartedAt: new Date(),
          processingCompletedAt: new Date(),
          processingTimeMs: transcriptionResult.processingTimeMs,
        },
      });

      // Audit log
      await createVoiceAuditLog(
        AuditAction.CREATE,
        req.user.id,
        req.user.email,
        req.user.role,
        transcriptionId,
        true,
        req,
        {
          description: `OASIS voice processing for patient: ${patient.lastName}, ${patient.firstName}`,
          patientId,
        }
      );

      return res.status(201).json({
        message: 'OASIS processing completed',
        result: {
          transcriptionId: updatedTranscription.id,
          transcription: {
            id: updatedTranscription.id,
            status: updatedTranscription.status,
            duration: updatedTranscription.audioDurationSeconds,
            fullText: updatedTranscription.fullText,
            wordCount: updatedTranscription.wordCount,
            confidence: updatedTranscription.overallConfidence,
            medicalTerms: updatedTranscription.medicalTerms,
            processingTimeMs: updatedTranscription.processingTimeMs,
          },
          oasisMapping: {
            assessmentType,
            patientId,
            existingAssessmentId: existingAssessmentId || null,
            mappedFields: oasisResult.mappedFields,
            completionPercentage: oasisResult.completionPercentage,
          },
          reviewRequired: oasisResult.mappedFields.filter(f => f.requiresReview),
        },
      });
    } catch (processingError) {
      await prisma.voiceTranscription.update({
        where: { id: transcriptionId },
        data: {
          status: TranscriptionStatus.FAILED,
          errorMessage: processingError instanceof Error ? processingError.message : 'Unknown error',
        },
      });

      throw processingError;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Get a transcription by ID
 * GET /api/voice/transcriptions/:id
 */
export async function getTranscription(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid transcription ID format',
      });
    }

    const transcription = await prisma.voiceTranscription.findUnique({
      where: { id },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        visit: {
          select: { id: true, visitType: true, scheduledDate: true },
        },
        clinician: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!transcription || transcription.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Transcription not found',
      });
    }

    // Check access permissions
    const hasAccess = await checkTranscriptionAccess(
      req.user.id,
      req.user.role,
      { clinicianId: transcription.clinicianId, patientId: transcription.patientId }
    );

    if (!hasAccess) {
      await createVoiceAuditLog(
        AuditAction.READ,
        req.user.id,
        req.user.email,
        req.user.role,
        id,
        false,
        req,
        {
          description: 'Access denied to transcription',
          patientId: transcription.patientId || undefined,
          errorMessage: 'Unauthorized access attempt',
        }
      );

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this transcription',
      });
    }

    // Audit log
    await createVoiceAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      true,
      req,
      {
        description: `Viewed transcription: ${transcription.audioFileName}`,
        patientId: transcription.patientId || undefined,
      }
    );

    return res.status(200).json({
      id: transcription.id,
      status: transcription.status,
      audioFileName: transcription.audioFileName,
      duration: transcription.audioDurationSeconds,
      language: transcription.language,
      fullText: transcription.fullText,
      wordCount: transcription.wordCount,
      segments: transcription.segments,
      confidence: transcription.overallConfidence,
      medicalTerms: transcription.medicalTerms,
      audioQuality: transcription.audioQuality,
      context: transcription.transcriptionContext,
      provider: transcription.provider,
      processingTimeMs: transcription.processingTimeMs,
      oasisMapping: transcription.oasisMappingResult,
      errorMessage: transcription.errorMessage,
      patient: transcription.patient,
      visit: transcription.visit,
      clinician: transcription.clinician,
      createdAt: transcription.createdAt,
      processingStartedAt: transcription.processingStartedAt,
      completedAt: transcription.processingCompletedAt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List transcriptions with filtering and pagination
 * GET /api/voice/transcriptions
 */
export async function listTranscriptions(
  req: AuthenticatedRequest & { query: ListTranscriptionsQuery },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const {
      page = '1',
      limit = '20',
      patientId,
      visitId,
      status,
      context,
      startDate,
      endDate,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: Prisma.VoiceTranscriptionWhereInput = {
      deletedAt: null,
    };

    // Role-based filtering
    if (![UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role)) {
      // Non-admin users can only see their own transcriptions or ones for patients they're assigned to
      where.OR = [
        { clinicianId: req.user.id },
        {
          patient: {
            assignments: {
              some: {
                userId: req.user.id,
                endDate: null,
              },
            },
          },
        },
      ];
    }

    if (patientId) where.patientId = patientId;
    if (visitId) where.visitId = visitId;
    if (status) where.status = status;
    if (context) where.transcriptionContext = context;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [transcriptions, total] = await Promise.all([
      prisma.voiceTranscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          status: true,
          audioFileName: true,
          audioDurationSeconds: true,
          language: true,
          wordCount: true,
          overallConfidence: true,
          transcriptionContext: true,
          provider: true,
          createdAt: true,
          processingCompletedAt: true,
          patient: {
            select: { id: true, firstName: true, lastName: true, mrn: true },
          },
          clinician: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.voiceTranscription.count({ where }),
    ]);

    // Audit log
    await createVoiceAuditLog(
      AuditAction.READ,
      req.user.id,
      req.user.email,
      req.user.role,
      'list',
      true,
      req,
      {
        description: `Listed ${transcriptions.length} transcriptions`,
        patientId: patientId || undefined,
      }
    );

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      data: transcriptions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a transcription (soft delete)
 * DELETE /api/voice/transcriptions/:id
 */
export async function deleteTranscription(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid transcription ID format',
      });
    }

    const transcription = await prisma.voiceTranscription.findUnique({
      where: { id },
    });

    if (!transcription) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Transcription not found',
      });
    }

    if (transcription.deletedAt) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Transcription has already been deleted',
      });
    }

    // Only the creator, admins, or supervisors can delete
    const canDelete =
      transcription.clinicianId === req.user.id ||
      [UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role);

    if (!canDelete) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this transcription',
      });
    }

    // Soft delete
    await prisma.voiceTranscription.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await createVoiceAuditLog(
      AuditAction.DELETE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      true,
      req,
      {
        description: `Deleted transcription: ${transcription.audioFileName}`,
        patientId: transcription.patientId || undefined,
      }
    );

    return res.status(200).json({
      message: 'Transcription deleted successfully',
      transcriptionId: id,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel a pending/processing transcription
 * POST /api/voice/transcriptions/:id/cancel
 */
export async function cancelTranscription(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  next: NextFunction
): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const { id } = req.params;

    const transcription = await prisma.voiceTranscription.findUnique({
      where: { id },
    });

    if (!transcription || transcription.deletedAt) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Transcription not found',
      });
    }

    // Can only cancel pending or processing transcriptions
    if (![TranscriptionStatus.PENDING, TranscriptionStatus.PROCESSING].includes(transcription.status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot cancel transcription with status: ${transcription.status}`,
      });
    }

    // Only the creator or admins can cancel
    const canCancel =
      transcription.clinicianId === req.user.id ||
      [UserRole.ADMIN, UserRole.SUPERVISOR].includes(req.user.role);

    if (!canCancel) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to cancel this transcription',
      });
    }

    // Update status to cancelled
    const updated = await prisma.voiceTranscription.update({
      where: { id },
      data: { status: TranscriptionStatus.CANCELLED },
    });

    // Audit log
    await createVoiceAuditLog(
      AuditAction.UPDATE,
      req.user.id,
      req.user.email,
      req.user.role,
      id,
      true,
      req,
      {
        description: `Cancelled transcription: ${transcription.audioFileName}`,
        patientId: transcription.patientId || undefined,
      }
    );

    return res.status(200).json({
      message: 'Transcription cancelled successfully',
      transcription: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ===========================================
// EXPORTS
// ===========================================

export default {
  transcribe,
  processOasis,
  getTranscription,
  listTranscriptions,
  deleteTranscription,
  cancelTranscription,
};
