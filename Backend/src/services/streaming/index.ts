/**
 * Streaming Services Index
 *
 * Re-exports all streaming service modules for convenient importing.
 */

// Streaming Transcription
export {
  StreamingTranscriptionSession,
  createTranscriptionSession,
  getTranscriptionSession,
  removeTranscriptionSession,
  getActiveSessionIds as getActiveTranscriptionSessionIds,
  type TranscriptionCallback,
  type TranscriptionUpdate,
  type TranscriptionSessionConfig,
  type AudioChunk,
  type SessionState as TranscriptionSessionState,
} from './streamingTranscription.service';

// Real-time Extraction
export {
  RealtimeExtractionSession,
  createExtractionSession,
  getExtractionSession,
  removeExtractionSession,
  type ExtractedEntity,
  type EntityType,
  type ExtractionResult,
  type ExtractionCallback,
  type ExtractionSessionConfig,
} from './realtimeExtraction.service';

// Field Mapper
export {
  FieldMapperService,
  createFieldMapper,
  getFieldMapper,
  removeFieldMapper,
  type TemplateType,
  type FieldMapping,
  type FieldUpdate,
  type FieldMapperConfig,
  type CustomTemplateDefinition,
} from './fieldMapper.service';

// Capture Session (Orchestrator)
export {
  CaptureSession,
  createCaptureSession,
  getCaptureSession,
  removeCaptureSession,
  getActiveCaptureSessionIds,
  getSessionsByUser,
  getSessionsByVisit,
  type CaptureSessionStatus,
  type CaptureSessionConfig,
  type CaptureSessionState,
  type CaptureSessionResult,
  type CaptureEvent,
  type CaptureEventCallback,
  type StatusUpdate,
  type ErrorEvent,
} from './captureSession.service';
